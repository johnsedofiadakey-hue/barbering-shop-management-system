from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes, parser_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from rest_framework.throttling import AnonRateThrottle
from rest_framework import status
from ..serializers import (
    GetCurrentUserSerializer,
    GetEmailFromTokenSerializer,
    RegisterBarberSerializer,
    LogoutSerializer,
    RefreshTokenCustomSerializer,
    FirebasePhoneLoginSerializer,
    FirebaseStaffLoginSerializer,
    RequestMagicLinkSerializer,
    VerifyMagicLinkSerializer,
)


class MagicLinkRequestThrottle(AnonRateThrottle):
    """
    Per-IP throttle for magic-link requests (mirrors the OTP request throttle).
    """
    scope = 'magic_link_request'


@extend_schema(
    methods=['GET'],
    responses={200: GetCurrentUserSerializer},
    description="Returns the current authenticated user's information.",
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser]) 
def get_current_user(request):
    """
    Returns the current authenticated user's information.
    """
    serializer = GetCurrentUserSerializer(data={}, context={'user': request.user})
    serializer.is_valid(raise_exception=True)

    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    methods=['POST'],
    request=RegisterBarberSerializer,
    responses={
        201: OpenApiResponse(description="Barber registered and account activated."),
        400: OpenApiResponse(description="Validation error or expired/invalid invite link."),
    },
    description="Barber completes registration via invite link, authenticating with a Firebase-verified identity.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([JSONParser])
def register_barber(request, uidb64, token):
    """
    Barber completes registration via invite link, authenticating with a Firebase-verified identity.
    """
    serializer = RegisterBarberSerializer(data=request.data, context={'uidb64': uidb64, 'token': token})
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({'detail': 'Barber registered and account activated.'}, status=status.HTTP_201_CREATED)
    

@extend_schema(
    methods=['GET'],
    responses={200: GetEmailFromTokenSerializer},
    description="Returns the email associated to the user from a valid given uid64 and token.",
)
@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([JSONParser])
def get_email_from_token(request, uidb64, token):
    """
    Returns the email associated to the user from a valid given uid64 and token
    """
    serializer = GetEmailFromTokenSerializer(data={}, context={'uidb64': uidb64, 'token': token})
    serializer.is_valid(raise_exception=True) 
    
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    methods=['POST'],
    request=RequestMagicLinkSerializer,
    responses={200: OpenApiResponse(description="If the email matches an account, a sign-in link was emailed.")},
    description="Client only: Emails a one-time sign-in link to a client's email on file, if any.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([MagicLinkRequestThrottle])
@parser_classes([JSONParser])
def request_magic_link(request):
    """
    Emails a one-time sign-in link to a client's email on file, if any. Always
    responds the same way so this can't be used to enumerate registered emails.
    """
    serializer = RequestMagicLinkSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({'detail': 'If that email is on an account, a sign-in link is on its way.'}, status=status.HTTP_200_OK)


@extend_schema(
    methods=['POST'],
    request=VerifyMagicLinkSerializer,
    responses={
        200: VerifyMagicLinkSerializer,
        400: OpenApiResponse(description="Invalid or expired link."),
    },
    description="Client only: Exchanges a valid magic-link uid/token pair for a JWT session.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([JSONParser])
def verify_magic_link(request, uidb64, token):
    """
    Exchanges a valid magic-link uid/token pair for a JWT session.
    """
    serializer = VerifyMagicLinkSerializer(data={}, context={'uidb64': uidb64, 'token': token})
    serializer.is_valid(raise_exception=True)

    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    methods=['POST'],
    request=FirebasePhoneLoginSerializer,
    responses={
        200: FirebasePhoneLoginSerializer,
        403: OpenApiResponse(description="Invalid, expired, or unverified Firebase phone token."),
    },
    description="Exchange a Firebase-verified phone identity for an application JWT session.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([JSONParser])
def firebase_phone_login(request):
    serializer = FirebasePhoneLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    methods=['POST'],
    request=FirebaseStaffLoginSerializer,
    responses={
        200: FirebaseStaffLoginSerializer,
        403: OpenApiResponse(description="Invalid sign-in, or the account is not linked for staff sign-in."),
    },
    description="Exchange a Firebase-verified staff (admin/barber) identity for an application JWT session. "
                "Only accounts explicitly linked via firebase_uid can use this.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([JSONParser])
def firebase_staff_login(request):
    serializer = FirebaseStaffLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    methods=['POST'],
    request=LogoutSerializer,
    responses={
        200: OpenApiResponse(description="Logout successful."),
        400: OpenApiResponse(description="Invalid or expired refresh token."),
    },
    description="Logout by blacklisting the refresh token.",
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser]) 
def logout_user(request):
    """
    Logout by blacklisting the refresh token.
    """
    serializer = LogoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    
    return Response({'detail': 'Logout successful.'}, status=status.HTTP_200_OK)
    

@extend_schema(
    methods=['POST'],
    request=RefreshTokenCustomSerializer,
    responses={
        200: OpenApiResponse(description="Access token refreshed successfully."),
        400: OpenApiResponse(description="Invalid or expired refresh token."),
    },
    description="Refresh the access token using a refresh token.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([]) 
@parser_classes([JSONParser]) 
def refresh_token(request):
    """
    Refresh the access token using a refresh token passed as 'refresh_token' in the request.
    """
    serializer = RefreshTokenCustomSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(serializer.get_response(), status=status.HTTP_200_OK)
