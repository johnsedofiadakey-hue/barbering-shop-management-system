import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _send_message(phone_number, body):
    """
    Channel-agnostic message dispatcher.

    - `settings.SMS_BACKEND == 'console'` logs the message instead of sending (dev/tests).
    - `settings.MESSAGE_CHANNEL == 'whatsapp'` sends via WhatsApp using the same Twilio API
      (numbers get the 'whatsapp:' prefix); default channel is plain SMS.
    """
    backend = getattr(settings, 'SMS_BACKEND', 'twilio')

    if backend == 'disabled':
        raise RuntimeError('Appointment SMS provider is not configured.')

    if backend == 'console':
        logger.info('[SMS console backend] to=%s body=%r', phone_number, body)
        print(f'[SMS console backend] to={phone_number} body={body!r}')
        return

    if backend != 'twilio':
        raise RuntimeError(f'Unsupported SMS backend: {backend}')

    from twilio.rest import Client as TwilioClient

    channel = getattr(settings, 'MESSAGE_CHANNEL', 'sms')
    from_number = settings.TWILIO_FROM_NUMBER
    to_number = phone_number

    if channel == 'whatsapp':
        from_number = f'whatsapp:{from_number}'
        to_number = f'whatsapp:{to_number}'

    client = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    client.messages.create(body=body, from_=from_number, to=to_number)


def send_otp_sms(phone_number, code, expiry_minutes):
    """
    Sends a one-time login/booking code to the given phone number.
    """
    body = (
        f'[BarberManager] Your verification code is {code}. '
        f'It expires in {expiry_minutes} minutes. Do not share this code.'
    )
    _send_message(phone_number, body)


def send_booking_confirmation_sms(phone_number, barber_name, date, slot, is_home_visit):
    """
    Sends a booking confirmation to the client right after an appointment is created.
    """
    barber_part = f' with {barber_name}' if barber_name else ''
    location_part = ' (home visit)' if is_home_visit else ''

    body = (
        f'[BarberManager] Your appointment{barber_part} on {date} at {slot}{location_part} is confirmed. '
        f'Reply or log in with this number to manage your booking.'
    )
    _send_message(phone_number, body)


def send_client_reminder_sms(phone_number, barber_name, appointment_datetime):
    """
    Sends a reminder to the client 90 minutes before their appointment.
    """
    barber_part = f' with {barber_name}' if barber_name else ''

    body = (
        f'[BarberManager] Reminder: your appointment{barber_part} is at '
        f'{appointment_datetime.strftime("%H:%M")} today ({appointment_datetime.strftime("%Y-%m-%d")}). '
        f'See you soon!'
    )
    _send_message(phone_number, body)
