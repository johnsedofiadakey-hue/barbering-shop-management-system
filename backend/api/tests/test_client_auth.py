from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch
from django.urls import reverse
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta
from api.models import Client, OTP, OTPPurpose


@patch('api.serializers.auth.send_otp_sms')
class ClientOTPAuthFlowTest(APITestCase):
    """
    Tests for the client phone/OTP authentication flow: request code, verify code,
    account auto-creation, login of existing clients, and logout.
    """
    def setUp(self):
        self.request_otp_url = reverse('request_otp')
        self.verify_otp_url = reverse('verify_otp')
        self.logout_url = reverse('logout_user')

        self.phone_number = '+15551230001'

        # Clear DRF throttle state (per-IP, cache-backed) so tests don't rate-limit each other
        cache.clear()

    def request_code(self, phone_number=None):
        """
        Helper to request an OTP and return the raw code (captured before hashing via the mock).
        """
        response = self.client.post(self.request_otp_url, {'phone_number': phone_number or self.phone_number}, format='json')
        return response

    def get_latest_code(self, mock_send_otp_sms):
        """
        Extracts the raw OTP code from the mocked SMS send call.
        """
        args, kwargs = mock_send_otp_sms.call_args
        return args[1]

    def test_request_otp_sends_sms_and_creates_record(self, mock_send_otp_sms):
        """
        Requesting an OTP creates a hashed record and sends the code via SMS.
        """
        response = self.request_code()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(OTP.objects.count(), 1)
        mock_send_otp_sms.assert_called_once()

        otp = OTP.objects.get()
        raw_code = self.get_latest_code(mock_send_otp_sms)

        self.assertEqual(otp.phone_number, self.phone_number)
        self.assertEqual(otp.purpose, OTPPurpose.LOGIN.value)
        self.assertNotEqual(otp.code_hash, raw_code)  # never stored in plaintext
        self.assertTrue(otp.check_code(raw_code))

    def test_verify_otp_creates_client_with_unusable_password(self, mock_send_otp_sms):
        """
        First-time OTP verification auto-creates an active client with no usable password.
        """
        self.request_code()
        raw_code = self.get_latest_code(mock_send_otp_sms)

        response = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': raw_code}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        self.assertIn('access_token', response.data['token'])

        client = Client.objects.get(phone_number=self.phone_number)
        self.assertTrue(client.is_active)
        self.assertFalse(client.has_usable_password())
        self.assertIsNotNone(client.phone_verified_at)

    def test_verify_otp_logs_in_existing_client(self, mock_send_otp_sms):
        """
        OTP verification for an already-registered phone logs into the same client (no duplicate).
        """
        existing = Client(username='client_existing1', phone_number=self.phone_number, name='Ada', surname='Lovelace', is_active=True)
        existing.set_unusable_password()
        existing.save()

        self.request_code()
        raw_code = self.get_latest_code(mock_send_otp_sms)

        response = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': raw_code}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Client.objects.filter(phone_number=self.phone_number).count(), 1)
        self.assertEqual(response.data['user']['id'], existing.id)

    def test_verify_otp_fails_with_wrong_code(self, mock_send_otp_sms):
        """
        Wrong code is rejected and increments the attempt counter.
        """
        self.request_code()

        response = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': '000000'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(OTP.objects.get().attempt_count, 1)
        self.assertFalse(Client.objects.filter(phone_number=self.phone_number).exists())

    def test_verify_otp_fails_when_expired(self, mock_send_otp_sms):
        """
        Expired codes are rejected.
        """
        self.request_code()
        raw_code = self.get_latest_code(mock_send_otp_sms)

        OTP.objects.update(expires_at=timezone.now() - timedelta(minutes=1))

        response = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': raw_code}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_verify_otp_is_single_use(self, mock_send_otp_sms):
        """
        A consumed code cannot be used twice.
        """
        self.request_code()
        raw_code = self.get_latest_code(mock_send_otp_sms)

        first = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': raw_code}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': raw_code}, format='json')
        self.assertEqual(second.status_code, status.HTTP_403_FORBIDDEN)

    def test_request_otp_fails_with_invalid_phone_number(self, mock_send_otp_sms):
        """
        Requesting an OTP with a malformed phone number is rejected.
        """
        response = self.request_code(phone_number='1234-notaphone')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(OTP.objects.count(), 0)
        mock_send_otp_sms.assert_not_called()

    def test_full_otp_login_logout_flow(self, mock_send_otp_sms):
        """
        Full flow: request code -> verify -> use JWT -> logout blacklists refresh token.
        """
        self.request_code()
        raw_code = self.get_latest_code(mock_send_otp_sms)

        login_response = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': raw_code}, format='json')
        access_token = login_response.data['token']['access_token']
        refresh_token = login_response.data['token']['refresh_token']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_response = self.client.post(self.logout_url, {'refresh_token': refresh_token}, format='json')

        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertEqual(logout_response.data.get('detail'), 'Logout successful.')
