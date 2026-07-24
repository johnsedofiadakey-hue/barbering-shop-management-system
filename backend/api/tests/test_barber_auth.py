from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch
from django.test import override_settings
from django.urls import reverse
from django.core import mail
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
import re
from api.models import User, Barber, Roles

@patch('django.core.mail.send_mail', return_value=1)
class BarberAuthFlowTest(APITestCase):
    """
    Tests for barber invitation and registration flows.
    """
    def setUp(self):
        self.invite_url = reverse('invite_barber')
        self.register_url = 'register_barber'

        # User data for admin
        self.admin_username = 'root'
        self.admin_password = 'AdminPass123!'

        # Create admin user to authenticate invite requests
        self.admin = User.objects.create_user(
            username=self.admin_username,
            email=None,
            password=self.admin_password,
            role=Roles.ADMIN.value,
        )


    def authenticate_admin(self):
        """
        Helper to authenticate admin
        """
        token = str(RefreshToken.for_user(self.admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


    def invite_barber(self, email='newbarber@example.com'):
        """
        Helper to send invite as an admin, returns (response, uid, token)
        """
        self.authenticate_admin()

        data = {'email': email}
        response = self.client.post(self.invite_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data.get('detail'), 'Barber invited successfully.')

        # Look for a link of the form: FRONTEND_URL/register/UID/TOKEN
        match = re.search(re.escape(settings.FRONTEND_URL) + r'/register/(?P<uidb64>[^/]+)/(?P<token>[^/\s]+)', mail.outbox[0].body)
        self.assertIsNotNone(match, "Verification link not found in email body")
    
        return response, match.group('uidb64'), match.group('token')
    

    @override_settings(FIREBASE_AUTH_ENABLED=True, FIREBASE_PROJECT_ID='barberingsalonmanager')
    @patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'firebase-uid-newbarber'})
    @patch('firebase_admin.get_app', return_value=object())
    def test_register_barber_success(self, _get_app, _verify_id_token, mock_send_mail):
        """
        A barber can register successfully using a valid uid and token, authenticating with a
        Firebase-verified identity (created client-side) instead of a Django password.
        """
        email = 'registerbarber@example.com'
        response, uid, token = self.invite_barber(email)

        self.assertEqual(response.data.get('detail'), 'Barber invited successfully.')

        register_url = reverse(self.register_url, kwargs={'uidb64': uid, 'token': token})

        data = {
            'id_token': 'verified-token',
            'name': 'test name',
            'surname': 'test surname'
        }
        response = self.client.post(register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data.get('detail'), 'Barber registered and account activated.')

        # Check user created and active with correct role
        barber = Barber.objects.filter(email=email).first()
        self.assertIsNotNone(barber)
        self.assertTrue(barber.is_active)
        self.assertEqual(barber.role, Roles.BARBER.value)
        self.assertEqual(barber.firebase_uid, 'firebase-uid-newbarber')
        self.assertFalse(barber.has_usable_password())

        # Test correct saving of name and surname:
        self.assertEqual(barber.name, 'test name')
        self.assertEqual(barber.surname, 'test surname')


    def test_register_barber_invalid_uid(self, mock_send_mail):
        """
        Registering with invalid UID returns error.
        """
        response, uid, token = self.invite_barber('invaliduid@example.com')

        self.assertEqual(response.data.get('detail'), 'Barber invited successfully.')
        
        register_url = reverse(self.register_url, kwargs={'uidb64': 'invalid-uid', 'token': token})

        data = {'id_token': 'verified-token', 'name': 'test name', 'surname': 'test surname'}
        response = self.client.post(register_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('detail'), 'Invalid link.')


    def test_register_barber_invalid_token(self, mock_send_mail):
        """
        Registering with invalid UID returns error.
        """
        response, uid, token = self.invite_barber('invalidtoken@example.com')

        self.assertEqual(response.data.get('detail'), 'Barber invited successfully.')
        
        register_url = reverse(self.register_url, kwargs={'uidb64': uid, 'token': 'invalid-token'})

        data = {'id_token': 'verified-token', 'name': 'test name', 'surname': 'test surname'}
        response = self.client.post(register_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('detail'), 'Invalid or expired token.')


    def test_invite_barber_already_regsitered(self, mock_send_mail):
        """
        Trying to register a barber who already exists returns error.
        """
        email = 'existingbarber@example.com'

        User.objects.create_user(
            username='existingbarber',
            email=email,
            password='somepass',
            role=Roles.BARBER.value,
            is_active=True
        )
        
        self.authenticate_admin()

        data = {'email': email}
        response = self.client.post(self.invite_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('detail'), f'The email "{email}" is already taken.')

