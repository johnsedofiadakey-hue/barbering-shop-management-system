from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Availability, Barber, Service, ShopSettings


class Command(BaseCommand):
    help = (
        'Create a bookable starter service catalog. The initial administrator is created '
        'separately via `create_firebase_admin`, since staff sign-in is Firebase-only.'
    )

    def handle(self, *args, **options):
        barber, created = Barber.objects.get_or_create(
            username='lead-barber',
            defaults={
                'email': 'lead-barber@example.com',
                'name': 'Lead',
                'surname': 'Barber',
                'description': 'Precision grooming, clean finishes, and dependable service.',
                'is_active': True,
            },
        )
        if created:
            barber.set_unusable_password()
            barber.save(update_fields=['password'])

        services = (
            ('Signature Fade', 'Consultation, precision fade, detailed finish, and styling.', '120.00', 45),
            ('Beard Sculpt', 'Shape, line-up, and conditioning for a clean tailored beard.', '70.00', 30),
            ('Cut & Hot Towel Ritual', 'A complete cut followed by a relaxing hot towel finish.', '160.00', 60),
        )
        for name, description, price, duration in services:
            Service.objects.update_or_create(
                barber=barber,
                name=name,
                defaults={
                    'description': description,
                    'price': price,
                    'duration_minutes': duration,
                },
            )

        slots = [f'{hour:02d}:{minute:02d}' for hour in range(9, 19) for minute in (0, 30)]
        start_date = timezone.localdate()
        for offset in range(61):
            date = start_date + timedelta(days=offset)
            if date.weekday() == 6:
                continue
            Availability.objects.update_or_create(
                barber=barber,
                date=date,
                defaults={'slots': slots},
            )

        ShopSettings.load()
        self.stdout.write(self.style.SUCCESS('Production starter data is ready.'))
