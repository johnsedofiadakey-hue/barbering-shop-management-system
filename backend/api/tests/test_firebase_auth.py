from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Admin, Barber, Client


class FirebasePhoneLoginTests(APITestCase):
    def setUp(self):
        self.url = reverse('firebase_phone_login')

    def test_rejects_exchange_when_firebase_auth_is_disabled(self):
        response = self.client.post(self.url, {'id_token': 'token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(FIREBASE_AUTH_ENABLED=True, FIREBASE_PROJECT_ID='barberingsalonmanager')
    @patch('firebase_admin.auth.verify_id_token', return_value={'phone_number': '+233200000001'})
    @patch('firebase_admin.get_app', return_value=object())
    def test_verified_firebase_phone_creates_client_and_returns_session(self, _get_app, verify_id_token):
        response = self.client.post(self.url, {'id_token': 'verified-token'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['phone_number'], '+233200000001')
        self.assertEqual(response.data['user']['role'], 'CLIENT')
        self.assertIn('access_token', response.data['token'])
        self.assertIn('refresh_token', response.data['token'])
        self.assertTrue(Client.objects.filter(phone_number='+233200000001').exists())
        verify_id_token.assert_called_once_with('verified-token')


class FirebaseStaffLoginTests(APITestCase):
    def setUp(self):
        self.url = reverse('firebase_staff_login')
        self.admin = Admin(username='owner-admin', email='admin@bbmanager.com', firebase_uid='firebase-uid-123')
        self.admin.set_unusable_password()
        self.admin.save()

    def test_rejects_exchange_when_firebase_auth_is_disabled(self):
        response = self.client.post(self.url, {'id_token': 'token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(FIREBASE_AUTH_ENABLED=True, FIREBASE_PROJECT_ID='barberingsalonmanager')
    @patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'firebase-uid-123'})
    @patch('firebase_admin.get_app', return_value=object())
    def test_linked_admin_can_sign_in_via_firebase(self, _get_app, verify_id_token):
        response = self.client.post(self.url, {'id_token': 'verified-token'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'ADMIN')
        self.assertEqual(response.data['user']['username'], 'owner-admin')
        self.assertIn('access_token', response.data['token'])
        verify_id_token.assert_called_once_with('verified-token')

    @override_settings(FIREBASE_AUTH_ENABLED=True, FIREBASE_PROJECT_ID='barberingsalonmanager')
    @patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'firebase-uid-123'})
    @patch('firebase_admin.get_app', return_value=object())
    def test_linked_barber_can_sign_in_via_firebase(self, _get_app, _verify_id_token):
        self.admin.delete()
        barber = Barber(
            username='lead-barber',
            email='barber@bbmanager.com',
            name='Lead',
            surname='Barber',
            firebase_uid='firebase-uid-123',
        )
        barber.set_unusable_password()
        barber.save()

        response = self.client.post(self.url, {'id_token': 'verified-token'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['role'], 'BARBER')

    @override_settings(FIREBASE_AUTH_ENABLED=True, FIREBASE_PROJECT_ID='barberingsalonmanager')
    @patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'unlinked-uid'})
    @patch('firebase_admin.get_app', return_value=object())
    def test_unlinked_uid_is_rejected(self, _get_app, _verify_id_token):
        response = self.client.post(self.url, {'id_token': 'verified-token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(FIREBASE_AUTH_ENABLED=True, FIREBASE_PROJECT_ID='barberingsalonmanager')
    @patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'client-uid-999'})
    @patch('firebase_admin.get_app', return_value=object())
    def test_client_role_cannot_use_staff_login_even_if_linked(self, _get_app, _verify_id_token):
        client = Client(
            username='client_abc',
            email='client@example.com',
            name='C',
            surname='L',
            phone_number='+233200009999',
            firebase_uid='client-uid-999',
        )
        client.set_unusable_password()
        client.save()

        response = self.client.post(self.url, {'id_token': 'verified-token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(FIREBASE_AUTH_ENABLED=True, FIREBASE_PROJECT_ID='barberingsalonmanager')
    @patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'firebase-uid-123'})
    @patch('firebase_admin.get_app', return_value=object())
    def test_inactive_admin_is_rejected(self, _get_app, _verify_id_token):
        self.admin.is_active = False
        self.admin.save(update_fields=['is_active'])

        response = self.client.post(self.url, {'id_token': 'verified-token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
