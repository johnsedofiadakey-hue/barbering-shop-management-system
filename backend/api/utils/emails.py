from django.conf import settings
from django.urls import reverse
from django.core.mail import send_mail


def send_client_verify_email(email, uid, token, domain):
    """
    Sends email confirmation link to client after registration.
    """
    link = f'{domain}/verify/{uid}/{token}'

    subject = '[BarberManager] Verify your email to register as a client'
    message = (
        f'Thank you for registering.\n\n'
        f'Please click the link below to verify your account:\n'
        f'{link}\n\n'
        'If you did not register, please ignore this email.'
    )
    send_mail(subject, message, 'barber.manager.verify@gmail.com', [email])


def send_barber_invite_email(email, uid, token, domain):
    """
    Sends barber invitation email with registration link.
    """
    link = f'{domain}/register/{uid}/{token}'

    subject = '[BarberManager] You have been invited to register as a barber'
    message = (
        f'You have been invited to join as a barber.\n\n'
        f'Please click the link below to complete your registration:\n'
        f'{link}\n\n'
        'If you did not expect this invitation, please ignore this email.'
    )
    send_mail(subject, message, 'barber.manager.verify@gmail.com', [email])


def send_client_reminder_email(client, barber, appointment_datetime):
    """
    Sends a reminder email to the client 1 hour before their appointment.
    """
    subject = '[BarberManager] Appointment Reminder'
    message = (
        f'Hi {client.name} {client.surname} (username: {client.username}),\n\n'
        f'This is a reminder for your upcoming appointment with the barber {barber.name} {barber.surname} '
        f'on {appointment_datetime.strftime("%Y-%m-%d at %H:%M")}.\n\n'
        'Please arrive on time.\n'
        'Thank you for using BarberManager!'
    )
    send_mail(subject, message, 'barber.manager.verify@gmail.com', [client.email])


def send_client_magic_link_email(client, uid, token, domain, next_path=None):
    """
    Sends a passwordless sign-in link to a client's email (a supplement to phone/OTP,
    never a replacement — the client must have already verified their phone once).
    """
    suffix = f'?next={next_path}' if next_path else ''
    link = f'{domain}/magic/{uid}/{token}{suffix}'

    subject = '[BarberManager] Your sign-in link'
    message = (
        f'Hi {client.name or "there"},\n\n'
        'Tap the link below to open your BarberManager account:\n'
        f'{link}\n\n'
        'This link expires soon and can only be used once. If you did not request it, you can ignore this email.'
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [client.email])


def send_client_booking_confirmation_email(client, barber, appointment, uid, token, domain):
    """
    Sends an order confirmation for a new appointment, with a magic link into the client's portal.
    Only called when the client has an email on file — phone/SMS confirmation always goes out regardless.
    """
    from ..models import ShopSettings

    shop = ShopSettings.load()
    link = f'{domain}/magic/{uid}/{token}?next=%2Fclient%2Fappointments'
    location = 'Home visit' if appointment.location_type == 'HOME' else 'At the shop'
    services = ', '.join(service.name for service in appointment.line_items.all()) or 'Your service'

    subject = '[BarberManager] Booking confirmed'
    message = (
        f'Hi {client.name or "there"},\n\n'
        'Your appointment is confirmed:\n\n'
        f'  Barber: {barber.name} {barber.surname}\n'
        f'  Service: {services}\n'
        f'  Date: {appointment.date.strftime("%A, %d %B %Y")}\n'
        f'  Time: {appointment.slot.strftime("%H:%M")}\n'
        f'  Location: {location}\n'
        f'  Total: {shop.currency_symbol}{appointment.amount_spent:.0f}\n\n'
        f'Manage this booking any time from your portal:\n{link}\n\n'
        'Thank you for booking with BarberManager!'
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [client.email])


def send_barber_reminder_email(barber, client, appointment_datetime):
    """
    Sends a reminder email to the barber 1 hour before an appointment.
    """
    subject = '[BarberManager] Upcoming Appointment Reminder'
    message = (
        f'Dear {barber.name} {barber.surname} (username: {barber.username}),\n\n'
        f'This is a reminder that you have an appointment with the client {client.name} {client.surname} '
        f'on {appointment_datetime.strftime("%Y-%m-%d at %H:%M")}.\n\n'
        'Get ready to provide great service!\n'
        'BarberManager Team'
    )
    send_mail(subject, message, 'barber.manager.verify@gmail.com', [barber.email])