from django.core.management.base import BaseCommand, CommandError

from api.models import Barber, Service


class Command(BaseCommand):
    help = (
        'Adds (or updates) a single named haircut as a bookable Service, so it appears '
        'immediately in the client booking flow. Run once per cut. The photo is left blank — '
        'upload it afterward via Admin > Catalog > Edit & upload.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--barber-username', required=True, help='Username of the barber this cut is offered by.')
        parser.add_argument('--name', required=True, help='Display name of the cut.')
        parser.add_argument('--description', default='', help='Short description shown on the service card.')
        parser.add_argument('--price', required=True, help='Price, e.g. 100.00')
        parser.add_argument('--duration-minutes', type=int, required=True, help='Appointment duration in minutes.')

    def handle(self, *args, **options):
        try:
            barber = Barber.objects.get(username=options['barber_username'])
        except Barber.DoesNotExist:
            raise CommandError(f"No barber with username \"{options['barber_username']}\".")

        service, created = Service.objects.update_or_create(
            barber=barber,
            name=options['name'],
            defaults={
                'description': options['description'],
                'price': options['price'],
                'duration_minutes': options['duration_minutes'],
            },
        )

        verb = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{verb} service "{service.name}" for {barber.username}.'))
