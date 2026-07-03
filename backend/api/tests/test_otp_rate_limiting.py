from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch
from django.urls import reverse
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from datetime import timedelta
from api.models import OTP, OTPPurpose


@patch('api.serializers.auth.send_otp_sms')
class OTPRateLimitingTest(APITestCase):
    """
    Dedicated coverage for the OTP abuse/cost controls: request cooldown,
    per-phone daily cap, and the wrong-code attempt cap.
    """
    def setUp(self):
        self.request_otp_url = reverse('request_otp')
        self.verify_otp_url = reverse('verify_otp')
        self.phone_number = '+15551230002'

        # DRF's AnonRateThrottle stores per-IP state in the cache, which persists
        # across test methods — clear it so tests only exercise the DB-level limits
        cache.clear()

    def make_otp(self, created_delta=timedelta(0), **overrides):
        """
        Helper to create an OTP row directly with a custom creation time.
        """
        otp = OTP(
            phone_number=overrides.get('phone_number', self.phone_number),
            purpose=overrides.get('purpose', OTPPurpose.LOGIN.value),
            expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
            consumed_at=overrides.get('consumed_at'),
        )
        otp.set_code('123456')
        otp.save()

        # auto_now_add ignores passed values, so backdate explicitly
        OTP.objects.filter(pk=otp.pk).update(created_at=timezone.now() - created_delta)

        return otp

    def test_cooldown_blocks_rapid_second_request(self, mock_send_otp_sms):
        """
        A second request inside the cooldown window is throttled.
        """
        first = self.client.post(self.request_otp_url, {'phone_number': self.phone_number}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second = self.client.post(self.request_otp_url, {'phone_number': self.phone_number}, format='json')
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(OTP.objects.count(), 1)
        self.assertEqual(mock_send_otp_sms.call_count, 1)

    def test_request_allowed_after_cooldown(self, mock_send_otp_sms):
        """
        A new request after the cooldown has elapsed succeeds.
        """
        self.make_otp(created_delta=timedelta(seconds=settings.OTP_REQUEST_COOLDOWN_SECONDS + 5))

        response = self.client.post(self.request_otp_url, {'phone_number': self.phone_number}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_daily_cap_blocks_request(self, mock_send_otp_sms):
        """
        Once the per-phone daily cap is reached, further requests are throttled.
        """
        for i in range(settings.OTP_MAX_PER_DAY):
            self.make_otp(created_delta=timedelta(hours=1 + i))

        response = self.client.post(self.request_otp_url, {'phone_number': self.phone_number}, format='json')

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        mock_send_otp_sms.assert_not_called()

    def test_daily_cap_ignores_old_requests(self, mock_send_otp_sms):
        """
        OTPs older than 24 hours don't count toward the daily cap.
        """
        for i in range(settings.OTP_MAX_PER_DAY):
            self.make_otp(created_delta=timedelta(hours=25 + i))

        response = self.client.post(self.request_otp_url, {'phone_number': self.phone_number}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_attempt_cap_invalidates_otp(self, mock_send_otp_sms):
        """
        Exceeding max wrong-code attempts invalidates the OTP, forcing a fresh code.
        """
        self.client.post(self.request_otp_url, {'phone_number': self.phone_number}, format='json')
        otp = OTP.objects.get()

        for _ in range(otp.max_attempts):
            response = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': '000000'}, format='json')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        otp.refresh_from_db()
        self.assertTrue(otp.is_consumed)

        # Even the correct code is now rejected (OTP invalidated)
        args, _ = mock_send_otp_sms.call_args
        raw_code = args[1]
        response = self.client.post(self.verify_otp_url, {'phone_number': self.phone_number, 'code': raw_code}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rate_limits_are_per_phone(self, mock_send_otp_sms):
        """
        One phone's cooldown does not block a different phone.
        """
        first = self.client.post(self.request_otp_url, {'phone_number': self.phone_number}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        other = self.client.post(self.request_otp_url, {'phone_number': '+15551230099'}, format='json')
        self.assertEqual(other.status_code, status.HTTP_200_OK)
