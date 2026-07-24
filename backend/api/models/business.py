from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class ShopSettings(models.Model):
    """Singleton configuration for the barbershop and its booking rules."""

    name = models.CharField(max_length=100, default='BarberManager')
    tagline = models.CharField(max_length=180, default='Precision cuts. Effortless booking.')
    announcement_enabled = models.BooleanField(default=False)
    announcement_text = models.CharField(max_length=180, blank=True)
    description = models.TextField(
        blank=True,
        default='A modern barbershop built around craft, comfort, and dependable service.',
    )
    phone_number = models.CharField(max_length=20, blank=True)
    whatsapp_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    maps_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)

    currency_code = models.CharField(max_length=3, default='GHS')
    currency_symbol = models.CharField(max_length=8, default='GH₵')
    timezone = models.CharField(max_length=64, default='Africa/Accra')
    opening_hours = models.JSONField(
        default=dict,
        blank=True,
        help_text='Map of weekday labels to display hours.',
    )

    home_visits_enabled = models.BooleanField(default=True)
    home_visit_fee = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
    )
    service_radius_km = models.PositiveSmallIntegerField(default=15)
    booking_horizon_days = models.PositiveSmallIntegerField(default=60)
    cancellation_notice_hours = models.PositiveSmallIntegerField(default=2)
    reminder_minutes = models.PositiveSmallIntegerField(default=90)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'shop settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings

    def to_dict(self):
        return {
            'name': self.name,
            'tagline': self.tagline,
            'announcement_enabled': self.announcement_enabled,
            'announcement_text': self.announcement_text,
            'description': self.description,
            'phone_number': self.phone_number,
            'whatsapp_number': self.whatsapp_number,
            'email': self.email,
            'address': self.address,
            'maps_url': self.maps_url,
            'instagram_url': self.instagram_url,
            'currency_code': self.currency_code,
            'currency_symbol': self.currency_symbol,
            'timezone': self.timezone,
            'opening_hours': self.opening_hours,
            'home_visits_enabled': self.home_visits_enabled,
            'home_visit_fee': float(self.home_visit_fee),
            'service_radius_km': self.service_radius_km,
            'booking_horizon_days': self.booking_horizon_days,
            'cancellation_notice_hours': self.cancellation_notice_hours,
            'reminder_minutes': self.reminder_minutes,
        }


class PortfolioItem(models.Model):
    """Admin-managed work shown on the public landing page."""

    title = models.CharField(max_length=100)
    description = models.CharField(max_length=240, blank=True)
    image = models.ImageField(upload_to='images/portfolio/')
    duration_minutes = models.PositiveSmallIntegerField(default=30)
    price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(0)],
    )
    featured = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('display_order', '-created_at')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'image': self.image.url if self.image else None,
            'duration_minutes': self.duration_minutes,
            'price': float(self.price),
            'featured': self.featured,
            'active': self.active,
            'display_order': self.display_order,
        }


class BeforeAfterItem(models.Model):
    """Optional admin-managed transformation pair for public inspiration."""

    title = models.CharField(max_length=100)
    description = models.CharField(max_length=240, blank=True)
    before_image = models.ImageField(upload_to='images/before-after/before/')
    after_image = models.ImageField(upload_to='images/before-after/after/')
    barber = models.ForeignKey(
        'Barber',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='before_after_work',
    )
    service = models.ForeignKey(
        'Service',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='before_after_work',
    )
    active = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('display_order', '-created_at')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'before_image': self.before_image.url if self.before_image else None,
            'after_image': self.after_image.url if self.after_image else None,
            'barber_id': self.barber_id,
            'barber_name': (
                f'{self.barber.name} {self.barber.surname}'.strip() or self.barber.username
                if self.barber
                else ''
            ),
            'service_id': self.service_id,
            'service_name': self.service.name if self.service else '',
            'active': self.active,
            'display_order': self.display_order,
        }
