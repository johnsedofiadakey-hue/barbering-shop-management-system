import logging
from datetime import datetime, timedelta

from celery import shared_task
from django.utils import timezone

from django.conf import settings

from .models import Appointment, AppointmentStatus, PaymentStatus, ShopSettings
from .utils import send_barber_reminder_email
from .utils.emails import send_client_booking_confirmation_email
from .utils.sms import send_booking_confirmation_sms, send_client_reminder_sms


logger = logging.getLogger(__name__)


@shared_task
def complete_ongoing_appointments():
    """Move appointments through in-progress and completed using their real duration."""

    now = timezone.localtime(timezone.now())
    changed = 0
    appointments = Appointment.objects.filter(
        status__in=[AppointmentStatus.ONGOING.value, AppointmentStatus.IN_PROGRESS.value]
    )

    for appointment in appointments:
        if now >= appointment.end_datetime:
            appointment.status = AppointmentStatus.COMPLETED.value
            appointment.save(update_fields=['status'])
            changed += 1
        elif now >= appointment.start_datetime and appointment.status == AppointmentStatus.ONGOING.value:
            appointment.status = AppointmentStatus.IN_PROGRESS.value
            appointment.save(update_fields=['status'])
            changed += 1

    return changed


@shared_task
def release_unpaid_appointments():
    """
    Cancels ONGOING appointments whose payment hold (deposit/full choice) expired without
    being paid, freeing the slot for someone else. Appointments booked with no payment
    required are never touched here.
    """
    now = timezone.now()
    expired = Appointment.objects.filter(
        status=AppointmentStatus.ONGOING.value,
        payment_status=PaymentStatus.PENDING.value,
        payment_deadline__lt=now,
    )
    return expired.update(status=AppointmentStatus.CANCELLED.value)


@shared_task
def send_booking_confirmation(appointment_id):
    """Send a booking or rescheduling confirmation without risking the booking transaction."""

    try:
        appointment = Appointment.objects.select_related('client', 'barber').get(pk=appointment_id)
    except Appointment.DoesNotExist:
        return False

    try:
        send_booking_confirmation_sms(
            appointment.client.phone_number,
            f'{appointment.barber.name} {appointment.barber.surname}',
            appointment.date,
            appointment.slot.strftime('%H:%M'),
            appointment.location_type == 'HOME',
        )
        appointment.confirmation_sent_at = timezone.now()
        appointment.notification_error = ''
        appointment.save(update_fields=['confirmation_sent_at', 'notification_error'])

        # Email confirmation is a bonus for clients who added one — never lets a missing
        # or failing email block the SMS confirmation above, which is the source of truth.
        if appointment.client.email:
            try:
                from django.utils.http import urlsafe_base64_encode
                from django.utils.encoding import force_bytes
                from django.contrib.auth.tokens import default_token_generator

                uid = urlsafe_base64_encode(force_bytes(appointment.client.pk))
                token = default_token_generator.make_token(appointment.client)
                send_client_booking_confirmation_email(
                    appointment.client, appointment.barber, appointment, uid, token, settings.FRONTEND_URL
                )
            except Exception:
                logger.exception('Booking confirmation email failed for appointment %s', appointment_id)

        return True
    except Exception as exc:  # Notification failure must never remove a valid booking.
        logger.exception('Booking confirmation failed for appointment %s', appointment_id)
        appointment.notification_error = str(exc)[:500]
        appointment.save(update_fields=['notification_error'])
        return False


@shared_task
def send_appointment_reminders():
    """Send the client an SMS reminder and the barber an email reminder."""

    now = timezone.localtime(timezone.now())
    shop = ShopSettings.load()
    reminder_limit = now + timedelta(minutes=shop.reminder_minutes)
    sent = 0
    appointments = Appointment.objects.select_related('client', 'barber').filter(
        status=AppointmentStatus.ONGOING.value,
        reminder_sent_at__isnull=True,
        date=now.date(),
    )

    for appointment in appointments:
        appointment_time = timezone.make_aware(
            datetime.combine(appointment.date, appointment.slot),
            timezone.get_current_timezone(),
        )
        if not (now < appointment_time <= reminder_limit):
            continue

        try:
            send_client_reminder_sms(
                appointment.client.phone_number,
                f'{appointment.barber.name} {appointment.barber.surname}',
                appointment_time,
            )
            if appointment.barber.email:
                send_barber_reminder_email(appointment.barber, appointment.client, appointment_time)
            appointment.reminder_sent_at = timezone.now()
            appointment.reminder_email_sent = True
            appointment.notification_error = ''
            appointment.save(
                update_fields=['reminder_sent_at', 'reminder_email_sent', 'notification_error']
            )
            sent += 1
        except Exception as exc:
            logger.exception('Appointment reminder failed for appointment %s', appointment.id)
            appointment.notification_error = str(exc)[:500]
            appointment.save(update_fields=['notification_error'])

    return sent
