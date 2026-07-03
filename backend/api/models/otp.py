from django.db import models
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from enum import Enum


class OTPPurpose(Enum):
    """
    Enumeration of possible purposes for an OTP code.
    """
    LOGIN = "LOGIN"
    BOOKING = "BOOKING"

    @classmethod
    def choices(cls):
        return [(purpose.value, purpose.name) for purpose in cls]


class OTP(models.Model):
    """
    Represents a one-time password sent via SMS to a phone number.

    - No FK to Client: an OTP may be requested for a phone number that has no account yet.
    - The code is stored hashed (never plaintext), single-use via `consumed_at`.
    - `attempt_count` tracks wrong-code verification attempts; exceeding `max_attempts` invalidates the OTP.
    """
    phone_number = models.CharField(max_length=16)
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(max_length=10, choices=OTPPurpose.choices(), default=OTPPurpose.LOGIN.value)
    expires_at = models.DateTimeField()
    attempt_count = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['phone_number', 'purpose', 'consumed_at']),
        ]

    def set_code(self, raw_code):
        """
        Hashes and stores the raw OTP code.
        """
        self.code_hash = make_password(raw_code)

    def check_code(self, raw_code):
        """
        Verifies a raw OTP code against the stored hash.
        """
        return check_password(raw_code, self.code_hash)

    @property
    def is_expired(self):
        """
        Returns True if this OTP is past its expiry time.
        """
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self):
        """
        Returns True if this OTP was already used (or invalidated).
        """
        return self.consumed_at is not None

    @property
    def is_locked(self):
        """
        Returns True if too many wrong verification attempts were made against this OTP.
        """
        return self.attempt_count >= self.max_attempts

    def consume(self):
        """
        Marks this OTP as used (or invalidated), making it unusable for further verification.
        """
        self.consumed_at = timezone.now()
        self.save(update_fields=['consumed_at'])

    def register_failed_attempt(self):
        """
        Increments the wrong-code attempt counter, invalidating the OTP once max attempts is reached.
        """
        self.attempt_count += 1

        if self.attempt_count >= self.max_attempts:
            self.consumed_at = timezone.now()
            self.save(update_fields=['attempt_count', 'consumed_at'])
        else:
            self.save(update_fields=['attempt_count'])

    def to_dict(self):
        """
        Returns a JSON-serializable dict representation of the OTP (never includes the code).
        """
        return {
            'id': self.id,
            'phone_number': self.phone_number,
            'purpose': self.purpose,
            'expires_at': self.expires_at,
            'consumed_at': self.consumed_at,
            'created_at': self.created_at,
        }
