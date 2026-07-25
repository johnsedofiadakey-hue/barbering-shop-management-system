import json
import logging

from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from ..models import Appointment, PaymentStatus
from ..utils import paystack

logger = logging.getLogger(__name__)


@extend_schema(
    methods=['POST'],
    request=None,
    responses={200: OpenApiResponse(description="Acknowledged.")},
    description="Paystack calls this after a transaction completes. Authenticated by HMAC "
    "signature (the `x-paystack-signature` header), not a user session.",
)
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def paystack_webhook(request):
    """
    Marks the matching appointment PAID once Paystack confirms a successful charge.
    Deliberately public (no IsAuthenticated) — Paystack itself is the caller, authenticated
    by verifying the request body against its HMAC signature instead of a user session.
    """
    signature = request.headers.get('x-paystack-signature', '')
    if not paystack.verify_webhook_signature(request.body, signature):
        return Response(status=status.HTTP_401_UNAUTHORIZED)

    try:
        payload = json.loads(request.body)
    except ValueError:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    event = payload.get('event')
    data = payload.get('data') or {}

    if event == 'charge.success' and data.get('status') == 'success':
        reference = data.get('reference')
        appointment = Appointment.objects.filter(payment_reference=reference).first()

        if not appointment:
            logger.warning('Paystack webhook: no appointment found for reference %s', reference)
        elif appointment.payment_status != PaymentStatus.PAID.value:
            appointment.payment_status = PaymentStatus.PAID.value
            appointment.paid_at = timezone.now()
            appointment.save(update_fields=['payment_status', 'paid_at'])

            # The booking-created confirmation is deferred until now for paid bookings
            # (see CreateClientAppointmentSerializer.create) — send it now that it's final.
            from ..tasks import send_booking_confirmation

            try:
                send_booking_confirmation.delay(appointment.id)
            except Exception:
                send_booking_confirmation(appointment.id)

    # Always 200 so Paystack doesn't endlessly retry a webhook we've already understood.
    return Response(status=status.HTTP_200_OK)
