import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import Admin, BeforeAfterItem, Barber, PortfolioItem, Service, ShopSettings


TEST_MEDIA_ROOT = tempfile.mkdtemp()


def tearDownModule():
    shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class BusinessSettingsTest(APITestCase):
    def setUp(self):
        self.admin = Admin.objects.create_user(username='shopadmin', password='AdminPass123!', is_active=True)
        self.barber = Barber.objects.create_user(
            username='catalogbarber',
            email='catalog@example.com',
            password='BarberPass123!',
            name='Catalog',
            surname='Barber',
            is_active=True,
        )
        self.shop_url = reverse('manage_shop_settings')
        self.portfolio_url = reverse('manage_portfolio')
        self.services_url = reverse('manage_services')
        self.before_after_url = reverse('manage_before_after')

    def login_admin(self):
        token = str(RefreshToken.for_user(self.admin).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_public_shop_settings_are_available_but_admin_update_is_protected(self):
        public_response = self.client.get(reverse('get_shop_settings'))
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.data['shop']['currency_code'], 'GHS')
        self.assertEqual(public_response.data['shop']['timezone'], 'Africa/Accra')

        anonymous_update = self.client.patch(self.shop_url, {'name': 'Private edit'}, format='json')
        self.assertEqual(anonymous_update.status_code, status.HTTP_401_UNAUTHORIZED)

        self.login_admin()
        update = self.client.patch(
            self.shop_url,
            {
                'name': 'The Gold Chair',
                'home_visit_fee': '45.00',
                'announcement_enabled': True,
                'announcement_text': 'Friday executive cut offer',
            },
            format='json',
        )
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.data['shop']['name'], 'The Gold Chair')
        self.assertTrue(update.data['shop']['announcement_enabled'])
        self.assertEqual(ShopSettings.load().home_visit_fee, 45)

    def test_admin_can_publish_a_featured_cut(self):
        self.login_admin()
        image = SimpleUploadedFile(
            'fade.gif',
            b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;',
            content_type='image/gif',
        )
        response = self.client.post(
            self.portfolio_url,
            {'title': 'Executive Fade', 'duration_minutes': 45, 'price': '85.00', 'image': image},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PortfolioItem.objects.filter(title='Executive Fade').exists())

        public_response = self.client.get(reverse('get_portfolio'))
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.data['portfolio'][0]['title'], 'Executive Fade')

    def test_admin_can_create_a_service_with_an_image_for_public_menu(self):
        self.login_admin()
        image = SimpleUploadedFile(
            'service.gif',
            b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;',
            content_type='image/gif',
        )
        response = self.client.post(
            self.services_url,
            {
                'barber_id': self.barber.id,
                'name': 'Premium Fade',
                'description': 'Consultation, fade, line-up and finish.',
                'duration_minutes': 60,
                'price': '120.00',
                'image': image,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['service']['image'])
        service = Service.objects.get(name='Premium Fade')

        public_response = self.client.get(
            reverse('get_barber_services_public', kwargs={'barber_id': self.barber.id})
        )
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.data['services'][0]['id'], service.id)
        self.assertIn('/images/services/', public_response.data['services'][0]['image'])

    def test_admin_can_publish_optional_before_and_after_pair(self):
        self.login_admin()
        before = SimpleUploadedFile(
            'before.gif',
            b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;',
            content_type='image/gif',
        )
        after = SimpleUploadedFile(
            'after.gif',
            b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;',
            content_type='image/gif',
        )
        response = self.client.post(
            self.before_after_url,
            {
                'title': 'Fade transformation',
                'before_image': before,
                'after_image': after,
                'barber_id': self.barber.id,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(BeforeAfterItem.objects.filter(title='Fade transformation').exists())

        public = self.client.get(reverse('get_before_after'))
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertEqual(public.data['before_after'][0]['title'], 'Fade transformation')
