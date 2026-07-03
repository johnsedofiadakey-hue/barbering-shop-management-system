from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes, parser_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from rest_framework.throttling import AnonRateThrottle
from rest_framework import status
from ..serializers import (
    RequestOTPSerializer,
    VerifyOTPSerializer,
)


class OTPRequestThrottle(AnonRateThrottle):
    """
    Per-IP throttle for OTP requests (defense against phone-number enumeration/spam).
    """
    scope = 'otp_request'


@extend_schema(
    methods=['POST'],
    request=RequestOTPSerializer,
    responses={
        200: OpenApiResponse(description="Verification code sent via SMS."),
        400: OpenApiResponse(description="Validation error."),
        429: OpenApiResponse(description="Rate limited: cooldown or daily cap reached."),
    },
    description="Client only: Request a one-time login code sent via SMS to the given phone number.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([OTPRequestThrottle])
@parser_classes([JSONParser])
def request_otp(request):
    """
    Requests a one-time login code for a phone number, sent via SMS.
    """
    serializer = RequestOTPSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({'detail': 'Verification code sent.'}, status=status.HTTP_200_OK)


@extend_schema(
    methods=['POST'],
    request=VerifyOTPSerializer,
    responses={
        200: VerifyOTPSerializer,
        400: OpenApiResponse(description="Validation error."),
        403: OpenApiResponse(description="Invalid or expired code."),
    },
    description="Client only: Verify a one-time code and log in. Creates the client account on first login. Returns user and JWT tokens.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([JSONParser])
def verify_otp(request):
    """
    Verifies a one-time code for a phone number and returns a JWT session.
    First-time verification auto-creates the client account.
    """
    serializer = VerifyOTPSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    return Response(serializer.data, status=status.HTTP_200_OK)
