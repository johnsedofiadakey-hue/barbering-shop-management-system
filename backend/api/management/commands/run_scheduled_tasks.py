from django.core.management.base import BaseCommand
from django.conf import settings

from api.tasks import complete_ongoing_appointments, send_appointment_reminders, release_unpaid_appointments


class Command(BaseCommand):
    help = 'Run appointment status and reminder maintenance once.'

    def handle(self, *args, **options):
        complete_ongoing_appointments()
        release_unpaid_appointments()
        if settings.SMS_BACKEND == 'twilio':
            send_appointment_reminders()
        else:
            self.stdout.write(self.style.WARNING('SMS reminders skipped: no production provider is configured.'))
        self.stdout.write(self.style.SUCCESS('Scheduled appointment maintenance completed.'))
