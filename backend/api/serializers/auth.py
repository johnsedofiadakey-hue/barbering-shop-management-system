import secrets
from datetime import timedelta
from django.contrib.auth import authenticate
from django.core.exceptions import ObjectDoesNotExist
from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework import serializers
from ..models import User, Client, OTP, OTPPurpose
from ..utils import (
    UserValidationMixin,
    UsernameValidationMixin,
    EmailValidationMixin,
    PasswordValidationMixin,
    PhoneNumberValidationMixin,
    UIDTokenValidationSerializer,
    BarberValidationMixin,
    get_or_create_client_by_phone,
)
from ..utils.sms import send_otp_sms

class GetCurrentUserSerializer(UserValidationMixin, serializers.Serializer):
    """
    Returns common information related to the profile of a given user
    """
    def validate(self, attrs):
        attrs = self.validate_user(attrs)
        return attrs

    def to_representation(self, validated_data):
        user = validated_data['user']
        return {'me': user.to_dict()}
    

class RegisterBarberSerializer(UIDTokenValidationSerializer, BarberValidationMixin, UsernameValidationMixin, PasswordValidationMixin, serializers.Serializer):
    """
    Barber completes registration via invite link. Only sets username and password.
    """
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    name = serializers.CharField(required=True)
    surname = serializers.CharField(required=True)
    description = serializers.CharField(required=False)

    def validate(self, attrs):
        attrs = self.validate_uid_token(attrs, target_key='barber')  # Returns User object to 'barber' key
        attrs = self.validate_barber(attrs, check_active=False)      # Changes User object in 'barber' to be type Barber
        attrs = self.validate_username_format(attrs)
        attrs = self.validate_username_unique(attrs)

        if attrs['barber'].is_active:
            raise serializers.ValidationError('Account already registered.')

        return attrs

    def create(self, validated_data):
        barber = validated_data['barber']
        barber.username = validated_data['username']
        barber.name = validated_data['name']
        barber.surname = validated_data['surname']
        barber.is_active = True

        if 'description' in validated_data:
            barber.description = validated_data['description']

        barber.set_password(validated_data['password'])
        barber.save()

        return barber


class GetEmailFromTokenSerializer(UIDTokenValidationSerializer, serializers.Serializer):
    """
    Returns the email associated to the user from a valid given uid64 and token
    """
    def validate(self, attrs):
        attrs = self.validate_uid_token(attrs)
        return attrs
    
    def to_representation(self, validated_data):
        user = validated_data['user']
        return {'email': user.email}


class RequestOTPSerializer(PhoneNumberValidationMixin, serializers.Serializer):
    """
    Requests a one-time login code sent via SMS to the given phone number.

    Rate limited: per-phone cooldown between requests and a per-phone daily cap
    (SMS costs money and OTP endpoints are a common abuse vector).
    """
    phone_number = serializers.CharField(required=True)

    def validate(self, attrs):
        attrs = self.validate_phone_number_format(attrs)
        phone_number = attrs['phone_number']
        now = timezone.now()

        cooldown = timedelta(seconds=settings.OTP_REQUEST_COOLDOWN_SECONDS)
        recent = OTP.objects.filter(
            phone_number=phone_number,
            purpose=OTPPurpose.LOGIN.value,
            created_at__gte=now - cooldown,
        ).exists()

        if recent:
            raise Throttled(detail='Please wait before requesting another code.')

        daily_count = OTP.objects.filter(
            phone_number=phone_number,
            created_at__gte=now - timedelta(hours=24),
        ).count()

        if daily_count >= settings.OTP_MAX_PER_DAY:
            raise Throttled(detail='Too many codes requested for this number. Try again later.')

        return attrs

    def create(self, validated_data):
        phone_number = validated_data['phone_number']
        raw_code = f'{secrets.randbelow(1_000_000):06d}'

        otp = OTP(
            phone_number=phone_number,
            purpose=OTPPurpose.LOGIN.value,
            expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
        )
        otp.set_code(raw_code)
        otp.save()

        send_otp_sms(phone_number, raw_code, settings.OTP_EXPIRY_MINUTES)

        return otp


class VerifyOTPSerializer(PhoneNumberValidationMixin, serializers.Serializer):
    """
    Verifies a one-time code for a phone number and logs the client in.

    On success: gets or creates the Client for this phone (OTP is the only client auth,
    so new clients get an unusable password), stamps phone_verified_at, and issues a
    JWT pair — same response shape as LoginSerializer for frontend compatibility.
    """
    phone_number = serializers.CharField(required=True)
    code = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        attrs = self.validate_phone_number_format(attrs)

        otp = (
            OTP.objects.filter(
                phone_number=attrs['phone_number'],
                purpose=OTPPurpose.LOGIN.value,
                consumed_at__isnull=True,
            )
            .order_by('-created_at')
            .first()
        )

        if not otp or otp.is_expired:
            raise PermissionDenied('Invalid or expired code. Request a new one.')

        if not otp.check_code(attrs['code']):
            otp.register_failed_attempt()
            raise PermissionDenied('Invalid or expired code. Request a new one.')

        otp.consume()

        client, _ = get_or_create_client_by_phone(attrs['phone_number'])

        if not client.is_active:
            raise PermissionDenied('Account inactive.')

        if not client.phone_verified_at:
            client.phone_verified_at = timezone.now()
            client.save(update_fields=['phone_verified_at'])

        attrs['user'] = client
        attrs['refresh'] = RefreshToken.for_user(client)

        return attrs

    def to_representation(self, instance):
        user = instance['user']
        refresh = instance['refresh']

        return {
            'user': user.to_dict(),
            'token': {
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'expires_in': int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
                'refresh_expires_in': int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
                'token_type': 'Bearer',
            }
        }


class LoginSerializer(serializers.Serializer):
    """
    Login using either email or username, not both.
    Note: barber/admin only — clients authenticate via the OTP endpoints.
    """
    email = serializers.EmailField(required=False)
    username = serializers.CharField(required=False)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        email = data.get('email')
        username = data.get('username')
        password = data.get('password')

        if not email and not username:
            raise serializers.ValidationError("You must provide either an email or username.")
        if email and username:
            raise serializers.ValidationError("Provide only one of email or username, not both.")

        identifier = username or email

        user = authenticate(username=identifier, password=password)

        if not user:
            raise PermissionDenied('Invalid credentials.')

        if not user.is_active:
            raise PermissionDenied('Account inactive. Please verify your email.')

        data['user'] = user
        data['refresh'] = RefreshToken.for_user(user)

        return data

    def to_representation(self, instance):
        user = instance['user']
        refresh = instance['refresh']

        return {
            'user': user.to_dict(),
            'token': {
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'expires_in': int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
                'refresh_expires_in': int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
                'token_type': 'Bearer',
            }
        }


class LogoutSerializer(serializers.Serializer):
    """
    Logout by blacklisting entered refresh token
    """
    refresh_token = serializers.CharField(required=True)

    def validate_refresh_token(self, value):
        try:
            self.token = RefreshToken(value)
        except TokenError:
            raise serializers.ValidationError("Invalid or expired refresh token.")
        
        return value
    
    def save(self, **kwargs):
        try:
            self.token.blacklist()
        except AttributeError:
            raise serializers.ValidationError("Token blacklisting not supported.")


class RequestPasswordResetSerializer(serializers.Serializer):
    """
    Request password reset by email associated to account
    """
    email = serializers.EmailField(required=True)

    def get_user(self):
        email = self.validated_data.get('email')

        try:
            user = User.objects.get(email=email, is_active=True)
            return user
        except User.DoesNotExist:
            return  # Silently continue for security


class ConfirmPasswordResetSerializer(PasswordValidationMixin, UIDTokenValidationSerializer):
    """
    Resets a user's password after validating the request token and password
    """
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        attrs = self.validate_uid_token(attrs)
        return attrs
    
    def save(self, **kwargs):
        user = self.validated_data['user']
        password = self.validated_data['password']

        user.set_password(password)
        user.save()

        return user


class RefreshTokenCustomSerializer(TokenRefreshSerializer):
    """
    Custom refresh token serializer for field name 'refresh_token'
    """
    refresh = None
    refresh_token = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        attrs['refresh'] = attrs.pop('refresh_token')

        try:
            validated_data = super().validate(attrs)

        except ObjectDoesNotExist:
            raise serializers.ValidationError({'refresh_token': ["User not found or has been deleted."]})
        
        except TokenError as e:
            raise serializers.ValidationError({'refresh_token': [str(e)]})
        
        return validated_data
    
    def get_response(self):
        return {
            'access_token': self.validated_data['access'],
            'expires_in': int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
            'token_type': 'Bearer',
        }
