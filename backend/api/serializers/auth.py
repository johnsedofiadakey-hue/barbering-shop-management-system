import secrets
from datetime import timedelta
from django.core.exceptions import ObjectDoesNotExist
from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework import serializers
from ..models import User, Client, OTP, OTPPurpose, Roles
from ..utils import (
    UserValidationMixin,
    EmailValidationMixin,
    PhoneNumberValidationMixin,
    UIDTokenValidationSerializer,
    BarberValidationMixin,
    get_or_create_client_by_phone,
)
from ..utils.sms import send_otp_sms


def _attach_client_session(attrs, client):
    """Attach the verified client and a Django JWT pair to serializer data."""
    if not client.is_active:
        raise PermissionDenied('Account inactive.')

    if not client.phone_verified_at:
        client.phone_verified_at = timezone.now()
        client.save(update_fields=['phone_verified_at'])

    refresh = RefreshToken.for_user(client)
    refresh.set_exp(lifetime=timedelta(days=settings.CLIENT_REFRESH_TOKEN_DAYS))
    attrs['user'] = client
    attrs['refresh'] = refresh
    return attrs


def _client_session_representation(instance):
    user = instance['user']
    refresh = instance['refresh']

    return {
        'user': user.to_dict(),
        'requires_profile_setup': not bool(user.name.strip() and user.surname.strip()),
        'token': {
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'expires_in': int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
            'refresh_expires_in': settings.CLIENT_REFRESH_TOKEN_DAYS * 24 * 60 * 60,
            'token_type': 'Bearer',
        }
    }

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
    

class RegisterBarberSerializer(UIDTokenValidationSerializer, BarberValidationMixin, serializers.Serializer):
    """
    Barber completes registration via invite link. Authenticates with a Firebase-verified
    identity (created client-side via Firebase email/password sign-up) rather than a Django
    password, matching the Firebase-only staff sign-in path.
    """
    id_token = serializers.CharField(required=True, write_only=True)
    name = serializers.CharField(required=True)
    surname = serializers.CharField(required=True)
    description = serializers.CharField(required=False)

    def validate(self, attrs):
        attrs = self.validate_uid_token(attrs, target_key='barber')  # Returns User object to 'barber' key
        attrs = self.validate_barber(attrs, check_active=False)      # Changes User object in 'barber' to be type Barber

        if attrs['barber'].is_active:
            raise serializers.ValidationError('Account already registered.')

        decoded_token = _decode_firebase_token(attrs['id_token'], 'Invalid or expired sign-in.')
        uid = decoded_token.get('uid')
        if not uid:
            raise PermissionDenied('The verified account is missing an identity.')
        if User.objects.filter(firebase_uid=uid).exclude(pk=attrs['barber'].pk).exists():
            raise serializers.ValidationError('This identity is already linked to another account.')
        attrs['firebase_uid'] = uid

        return attrs

    def create(self, validated_data):
        barber = validated_data['barber']
        barber.name = validated_data['name']
        barber.surname = validated_data['surname']
        barber.firebase_uid = validated_data['firebase_uid']
        barber.is_active = True

        if 'description' in validated_data:
            barber.description = validated_data['description']

        barber.set_unusable_password()  # sign-in for this account happens via Firebase, not Django password
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
    JWT pair.
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

        return _attach_client_session(attrs, client)

    def to_representation(self, instance):
        return _client_session_representation(instance)


def _decode_firebase_token(id_token, error_message):
    """Shared Firebase ID-token verification used by every Firebase-backed login path."""
    if not getattr(settings, 'FIREBASE_AUTH_ENABLED', False):
        raise PermissionDenied('Firebase authentication is not enabled.')

    try:
        import firebase_admin
        from firebase_admin import auth as firebase_auth

        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(options={
                'projectId': settings.FIREBASE_PROJECT_ID,
            })

        return firebase_auth.verify_id_token(id_token)
    except Exception as exc:
        raise PermissionDenied(error_message) from exc


class FirebasePhoneLoginSerializer(PhoneNumberValidationMixin, serializers.Serializer):
    """Exchange a Firebase phone-auth ID token for the application's JWT pair."""

    id_token = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        decoded_token = _decode_firebase_token(attrs['id_token'], 'Invalid or expired phone verification.')

        phone_number = decoded_token.get('phone_number')
        if not phone_number:
            raise PermissionDenied('The verified account does not contain a phone number.')

        phone_attrs = self.validate_phone_number_format({'phone_number': phone_number})
        client, _ = get_or_create_client_by_phone(phone_attrs['phone_number'])
        attrs['phone_number'] = phone_attrs['phone_number']
        return _attach_client_session(attrs, client)

    def to_representation(self, instance):
        return _client_session_representation(instance)


class FirebaseStaffLoginSerializer(serializers.Serializer):
    """
    Exchange a Firebase email/password ID token for the application's JWT pair.

    Unlike the client phone path, this never auto-creates an account: only a User
    (Admin or Barber) that has already been explicitly linked via `firebase_uid`
    (see the `create_firebase_admin` management command) can sign in this way.
    """

    id_token = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        decoded_token = _decode_firebase_token(attrs['id_token'], 'Invalid or expired sign-in.')

        uid = decoded_token.get('uid')
        if not uid:
            raise PermissionDenied('The verified account is missing an identity.')

        try:
            user = User.objects.get(firebase_uid=uid, role__in=[Roles.ADMIN.value, Roles.BARBER.value])
        except User.DoesNotExist:
            raise PermissionDenied('This account is not authorized for staff sign-in.') from None

        if not user.is_active:
            raise PermissionDenied('Account inactive.')

        attrs['user'] = user
        attrs['refresh'] = RefreshToken.for_user(user)
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
