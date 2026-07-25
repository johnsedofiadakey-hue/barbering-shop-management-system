from django.core.management.base import BaseCommand
from api.models import Barber, Service, ServiceCategory
from decimal import Decimal

class Command(BaseCommand):
    help = 'Seeds standard Ghanaian barbering categories and services for all barbers.'

    def handle(self, *args, **options):
        # Default Ghanaian Services mapped to their categories
        default_services = [
            # CORE Category
            {'name': 'Adult Fade', 'category': ServiceCategory.CORE.value, 'price': Decimal('50.00'), 'duration': 40, 'desc': 'Standard adult skin fade with sharp edges.'},
            {'name': 'Adult Taper', 'category': ServiceCategory.CORE.value, 'price': Decimal('40.00'), 'duration': 30, 'desc': 'Classic taper fade.'},
            {'name': 'Shape-up / Line-up', 'category': ServiceCategory.CORE.value, 'price': Decimal('20.00'), 'duration': 15, 'desc': 'Crisp hairline and beard line-up.'},
            {'name': 'Kids Cut (Under 12)', 'category': ServiceCategory.CORE.value, 'price': Decimal('30.00'), 'duration': 30, 'desc': 'Gentle and precise haircut for boys.'},
            
            # PREMIUM Category
            {'name': 'Beard Trimming & Hot Towel', 'category': ServiceCategory.PREMIUM.value, 'price': Decimal('30.00'), 'duration': 25, 'desc': 'Beard trim, shape up, and relaxing hot towel treatment.'},
            {'name': 'VIP Full Grooming', 'category': ServiceCategory.PREMIUM.value, 'price': Decimal('120.00'), 'duration': 60, 'desc': 'Full haircut, beard trim, facial scrub, and hot towel.'},
            {'name': 'Facial Scrub & Wash', 'category': ServiceCategory.PREMIUM.value, 'price': Decimal('40.00'), 'duration': 20, 'desc': 'Deep cleansing facial scrub and wash.'},
            
            # TREATMENT Category
            {'name': 'Sporting Waves Treatment', 'category': ServiceCategory.TREATMENT.value, 'price': Decimal('25.00'), 'duration': 20, 'desc': 'Wave setting and texturizer treatment.'},
            {'name': 'Hair Dye / Color', 'category': ServiceCategory.TREATMENT.value, 'price': Decimal('35.00'), 'duration': 30, 'desc': 'Black/brown dye application for hair or beard.'},
            
            # LOCS Category
            {'name': 'Locs Retwist', 'category': ServiceCategory.LOCS.value, 'price': Decimal('80.00'), 'duration': 90, 'desc': 'Wash and retwist for dreadlocks.'},
            {'name': 'Locs Styling', 'category': ServiceCategory.LOCS.value, 'price': Decimal('40.00'), 'duration': 30, 'desc': 'Intricate styling for locs.'},
        ]

        barbers = Barber.objects.all()
        if not barbers.exists():
            self.stdout.write(self.style.WARNING('No barbers found in the database. Please add a barber first.'))
            return

        for barber in barbers:
            self.stdout.write(self.style.SUCCESS(f'Seeding services for {barber.username}...'))
            
            for service_data in default_services:
                service, created = Service.objects.update_or_create(
                    barber=barber,
                    name=service_data['name'],
                    defaults={
                        'category': service_data['category'],
                        'price': service_data['price'],
                        'duration_minutes': service_data['duration'],
                        'description': service_data['desc'],
                    }
                )
                verb = 'Created' if created else 'Updated'
                self.stdout.write(f'  - {verb}: {service.name} ({service.category})')
        
        self.stdout.write(self.style.SUCCESS('Successfully seeded Ghanaian barbering categories!'))
