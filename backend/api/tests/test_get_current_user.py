from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import Client, Barber, Admin
from api.models import Roles


class GetUserViewTests(APITestCase):
    """
    Tests for the get_user view across different roles.
    """

    def setUp(self):
        self.get_user_url = reverse('get_current_user')
        self.password = 'TestPass123!'


    def authenticate_user(self, user):
        token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


    def test_get_user_as_client(self):
        """
        A CLIENT role user can retrieve their own user data.
        """
        user = Client.objects.create_user(
            username='clientuser',
            email='client@example.com',
            password=self.password,
            phone_number='+15551110001'
        )
        user.is_active = True
        user.save()
        self.authenticate_user(user)

        response = self.client.get(self.get_user_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user_data = response.data['me']

        self.assertEqual(user_data['username'], user.username)
        self.assertEqual(user_data['role'], Roles.CLIENT.value)


    def test_get_user_as_barber(self):
        """
        A BARBER role user can retrieve their own user data.
        """
        user = Barber.objects.create_user(
            username='barberuser',
            email='barber@example.com',
            password=self.password
        )
        user.is_active = True
        user.save()
        self.authenticate_user(user)

        response = self.client.get(self.get_user_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user_data = response.data['me']
        self.assertEqual(user_data['username'], user.username)
        self.assertEqual(user_data['role'], Roles.BARBER.value)


    def test_get_user_as_admin(self):
        """
        An ADMIN role user can retrieve their own user data.
        """
        user = Admin.objects.create_superuser(
            username='adminuser',
            password=self.password
        )
        self.authenticate_user(user)

        response = self.client.get(self.get_user_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user_data = response.data['me']
        self.assertEqual(user_data['username'], user.username)
        self.assertEqual(user_data['role'], Roles.ADMIN.value)


    def test_get_user_unauthenticated(self):
        """
        Unauthenticated access to get_user should be denied.
        """
        response = self.client.get(self.get_user_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
