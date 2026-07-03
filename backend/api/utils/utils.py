import os
import uuid
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import  force_str
from django.contrib.auth.tokens import default_token_generator
from rest_framework import serializers


def get_profile_image_path(instance, filename):
    """
    Utility function that generates a unique file path for the uploaded profile picture.
    Example: images/profile/1a2b3c4d5e6f7g8h9i0j.png
    """
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('images', 'profile', filename)


def generate_client_username(phone_number):
    """
    Generates an opaque internal username for a phone-based client.
    Clients never see or use this; it only satisfies AbstractUser's USERNAME_FIELD uniqueness.
    """
    return f"client_{uuid.uuid4().hex[:12]}"


def get_or_create_client_by_phone(phone_number, name=None, surname=None):
    """
    Fetches the Client registered with this phone number, or creates a new active one.

    Shared by the OTP login flow and the guest booking flow so both converge on the
    same client record. New clients get an unusable password (OTP is their only auth)
    and an auto-generated internal username.

    Returns a (client, created) tuple.
    """
    from ..models import Client

    client = Client.objects.filter(phone_number=phone_number).first()

    if client:
        # Backfill the name if we learned it later (e.g. OTP-first client who then books)
        updates = []
        if name and not client.name:
            client.name = name
            updates.append('name')
        if surname and not client.surname:
            client.surname = surname
            updates.append('surname')
        if updates:
            client.save(update_fields=updates)

        return client, False

    client = Client(
        username=generate_client_username(phone_number),
        phone_number=phone_number,
        name=name or '',
        surname=surname or '',
        is_active=True,
    )
    client.set_unusable_password()
    client.save()

    return client, True


def get_user_from_uid_token(uidb64, token, role=None):
    """
    Utility function that checks if a token previously registered to a user is valid.
    Raises serializers.ValidationError if invalid.
    """
    from ..models import User

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)

    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        raise serializers.ValidationError("Invalid link.")
    
    if not default_token_generator.check_token(user, token):
        raise serializers.ValidationError("Invalid or expired token.")

    return user
