from decimal import Decimal
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from rest_framework import serializers
from ..utils import (
    ClientValidationMixin,
    BarberValidationMixin,
    UsernameValidationMixin,
    EmailValidationMixin,
    AppointmentValidationMixin,
    ReviewValidationMixin,
    GetClientsMixin,
    GetBarbersMixin,
    GetAppointmentsMixin,
    GetReviewsMixin,
)
from ..models import (
    Appointment,
    Service,
    AppointmentService,
    Review,
    AppointmentStatus,
    AppointmentLocation,
    PaymentChoice,
    PaymentStatus,
    ShopSettings,
)


class GetClientProfileSerializer(ClientValidationMixin, GetClientsMixin, serializers.Serializer):
    """
    Returns all the information related to the profile of a given client
    """
    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        return attrs

    def to_representation(self, validated_data):
        client = validated_data['client']
        return {'profile': self.get_client_private(client) }


class UpdateClientProfileSerializer(ClientValidationMixin, UsernameValidationMixin, EmailValidationMixin, serializers.Serializer):
    """
    Client only: Updates general informations about a given client.
    """
    username = serializers.CharField(required=False)
    name = serializers.CharField(required=False)
    surname = serializers.CharField(required=False)
    phone_number = serializers.CharField(required=False, max_length=16)
    # Optional: lets the client receive booking confirmations and a magic sign-in link by email.
    # Phone/OTP remains the only required login method — this never replaces it.
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = self.validate_client(attrs)

        if 'phone_number' in attrs:
            raise serializers.ValidationError({
                'phone_number': 'Phone number changes require a new verified login. Contact support to transfer this account.'
            })

        if not any(field in attrs for field in ('username', 'name', 'surname', 'email')):
            raise serializers.ValidationError('You must provide at least one field: username, name, surname or email.')

        if 'username' in attrs:
            attrs = self.validate_username_unique(attrs, user_instance=attrs['client'])

        if attrs.get('email'):
            attrs = self.validate_email_unique(attrs, user_instance=attrs['client'])

        return attrs

    def update(self, instance, validated_data):
        if 'username' in validated_data:
            instance.username = validated_data['username']

        if 'name' in validated_data:
            instance.name = validated_data['name']

        if 'surname' in validated_data:
            instance.surname = validated_data['surname']

        if 'email' in validated_data:
            instance.email = validated_data['email'] or None

        instance.save()
        return instance

    def save(self, **kwargs):
        return self.update(self.validated_data['client'], self.validated_data)
    

class DeleteClientProfileSerializer(ClientValidationMixin, serializers.Serializer):
    """
    Client only: Deletes a given existing client account.
    """
    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        return attrs

    def delete(self):
        self.validated_data['client'].delete()


class GetClientAppointmentsSerializer(ClientValidationMixin, GetAppointmentsMixin, serializers.Serializer):
    """
    Client only: Returns all appointments for a given client
    """
    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        return attrs
    
    def to_representation(self, validated_data):
        client = validated_data['client']
        return {'appointments': self.get_appointments_public(client_id=client.id)}
    

class CreateClientAppointmentSerializer(ClientValidationMixin, BarberValidationMixin, AppointmentValidationMixin, serializers.Serializer):
    """
    Client only: Creates a new appointment for a given client with a barber.
    """
    date = serializers.DateField(required=True)
    slot = serializers.TimeField(required=True)
    services = serializers.PrimaryKeyRelatedField(required=True, queryset=Service.objects.all(), many=True, allow_empty=True)
    location_type = serializers.ChoiceField(required=False, choices=AppointmentLocation.choices(), default=AppointmentLocation.SHOP.value)
    home_address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    payment_choice = serializers.ChoiceField(required=False, choices=PaymentChoice.choices(), default=PaymentChoice.NONE.value)

    def validate(self, attrs):
        from ..utils import paystack

        attrs = self.validate_client(attrs)
        attrs = self.validate_barber(attrs)
        attrs = self.validate_services_belong_to_barber(attrs)
        shop = ShopSettings.load()

        if attrs.get('payment_choice', PaymentChoice.NONE.value) != PaymentChoice.NONE.value and not paystack.is_configured():
            raise serializers.ValidationError('Online payment is not available right now — book without paying instead.')

        if attrs['location_type'] == AppointmentLocation.HOME.value:
            if not shop.home_visits_enabled:
                raise serializers.ValidationError('Home visits are currently unavailable.')
            if not attrs.get('home_address', '').strip():
                raise serializers.ValidationError('A service address is required for home visits.')
            attrs['travel_fee'] = shop.home_visit_fee
        else:
            attrs['home_address'] = ''
            attrs['travel_fee'] = 0

        attrs = self.validate_appointment_date_and_slot(attrs)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        client = validated_data['client']
        barber = validated_data['barber']
        date = validated_data['date']
        slot = validated_data['slot']
        services = validated_data['services']
        payment_choice = validated_data.get('payment_choice', PaymentChoice.NONE.value)
        travel_fee = validated_data.get('travel_fee', 0)

        total_due = sum((service.price for service in services), Decimal('0')) + travel_fee
        if payment_choice == PaymentChoice.FULL.value:
            payment_amount = total_due
        elif payment_choice == PaymentChoice.DEPOSIT.value:
            payment_amount = (total_due * settings.BOOKING_DEPOSIT_PERCENT / Decimal('100')).quantize(Decimal('0.01'))
        else:
            payment_amount = Decimal('0')

        appointment = Appointment(
            client=client,
            barber=barber,
            date=date,
            slot=slot,
            duration_minutes=validated_data['duration_minutes'],
            location_type=validated_data['location_type'],
            home_address=validated_data.get('home_address', ''),
            notes=validated_data.get('notes', ''),
            travel_fee=travel_fee,
            payment_choice=payment_choice,
            payment_amount=payment_amount,
            payment_status=PaymentStatus.PENDING.value if payment_choice != PaymentChoice.NONE.value else PaymentStatus.UNPAID.value,
            payment_deadline=(
                timezone.now() + timedelta(minutes=settings.BOOKING_PAYMENT_WINDOW_MINUTES)
                if payment_choice != PaymentChoice.NONE.value
                else None
            ),
        )
        appointment.save()

        for service in services:
            AppointmentService.objects.create(
                appointment=appointment,
                name=service.name,
                price=service.price,
                duration_minutes=service.duration_minutes,
                original_service=service
            )

        # A deposit/full payment choice means the booking isn't final until the client
        # actually pays — the webhook queues this same confirmation once that happens.
        if payment_choice == PaymentChoice.NONE.value:
            transaction.on_commit(lambda: self._queue_confirmation(appointment.id))

        return appointment

    @staticmethod
    def _queue_confirmation(appointment_id):
        from ..tasks import send_booking_confirmation

        try:
            send_booking_confirmation.delay(appointment_id)
        except Exception:
            send_booking_confirmation(appointment_id)


class RescheduleClientAppointmentSerializer(ClientValidationMixin, AppointmentValidationMixin, serializers.Serializer):
    date = serializers.DateField(required=True)
    slot = serializers.TimeField(required=True)

    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        attrs = self.validate_find_appointment(attrs)
        appointment = attrs['appointment']
        attrs['barber'] = appointment.barber
        attrs['duration_minutes'] = appointment.duration_minutes
        attrs = self.validate_appointment_date_and_slot(attrs, appointment_instance=appointment)
        return attrs

    @transaction.atomic
    def save(self, **kwargs):
        appointment = self.validated_data['appointment']
        appointment.date = self.validated_data['date']
        appointment.slot = self.validated_data['slot']
        appointment.reminder_email_sent = False
        appointment.reminder_sent_at = None
        appointment.confirmation_sent_at = None
        appointment.notification_error = ''
        appointment.save()
        transaction.on_commit(lambda: CreateClientAppointmentSerializer._queue_confirmation(appointment.id))
        return appointment


class PayClientAppointmentSerializer(ClientValidationMixin, serializers.Serializer):
    """
    Client only: Starts (or restarts) a Paystack checkout for an appointment's deposit/full
    payment. Deliberately not built on AppointmentValidationMixin.validate_find_appointment —
    that method enforces the cancellation-notice window, which has nothing to do with paying.
    """
    def validate(self, attrs):
        from ..utils import paystack

        attrs = self.validate_client(attrs)
        client = attrs['client']
        appointment_id = self.context.get('appointment_id')

        try:
            appointment = Appointment.objects.get(pk=appointment_id, client=client)
        except Appointment.DoesNotExist:
            raise serializers.ValidationError('Appointment not found.')

        if appointment.status != AppointmentStatus.ONGOING.value:
            raise serializers.ValidationError('This appointment is no longer active.')

        if appointment.payment_choice == PaymentChoice.NONE.value:
            raise serializers.ValidationError('This appointment does not require payment.')

        if appointment.payment_status == PaymentStatus.PAID.value:
            raise serializers.ValidationError('This appointment is already paid.')

        if not appointment.payment_deadline or timezone.now() > appointment.payment_deadline:
            raise serializers.ValidationError('The payment window for this booking has expired. Please book again.')

        if not paystack.is_configured():
            raise serializers.ValidationError('Payments are not available right now.')

        attrs['appointment'] = appointment
        return attrs

    def save(self, **kwargs):
        import uuid

        from ..utils import paystack

        appointment = self.validated_data['appointment']
        client = appointment.client

        reference = f'apt{appointment.id}-{uuid.uuid4().hex[:10]}'
        email = client.email or f'client{client.id}@barbermanager.local'
        callback_url = f'{settings.FRONTEND_URL}/client/appointments?payment=callback'

        try:
            data = paystack.initialize_transaction(email, appointment.payment_amount, reference, callback_url)
        except paystack.PaystackError as exc:
            raise serializers.ValidationError(str(exc))

        appointment.payment_reference = reference
        appointment.save(update_fields=['payment_reference'])

        return {'authorization_url': data['authorization_url'], 'reference': reference}


class CancelClientAppointmentSerializer(ClientValidationMixin, AppointmentValidationMixin, serializers.Serializer):
    """
    Client only: Cancels an ONGOING appointment for the authenticated client.
    """
    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        attrs = self.validate_find_appointment(attrs)
        return attrs
    
    def save(self):
        appointment = self.validated_data['appointment']
        appointment.status = AppointmentStatus.CANCELLED.value
        appointment.save()

        return appointment


class GetClientReviewsSerializer(ClientValidationMixin, GetReviewsMixin, serializers.Serializer):
    """
    Client only: Returns all reviews posted by a given client
    """
    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        return attrs

    def to_representation(self, validated_data):
        client = validated_data['client']
        return {'reviews': self.get_reviews_public(client_id=client.id)}


class CreateClientReviewSerializer(ClientValidationMixin, BarberValidationMixin, ReviewValidationMixin, serializers.Serializer):
    """
    Client only: Creates a review for a barber if at least one completed appointment exists (one per barber).
    """
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(allow_blank=True, required=False, max_length=500)

    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        attrs = self.validate_barber(attrs)
        attrs = self.validate_appointment_for_review(attrs)
        return attrs

    def create(self, validated_data):
        review = Review(
            client=validated_data['client'],
            barber=validated_data['barber'],
            rating=validated_data['rating'],
        )
        if 'comment' in validated_data:
            review.comment = validated_data['comment']

        review.save()

        return review
    

class UpdateClientReviewSerializer(ClientValidationMixin, ReviewValidationMixin, serializers.Serializer):
    """
    Client only: Updates a given existing review, for a given client.
    """
    rating = serializers.IntegerField(min_value=1, max_value=5, required=False)
    comment = serializers.CharField(allow_blank=True, required=False, max_length=500)

    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        attrs = self.validate_find_review(attrs)

        if 'rating' not in attrs and 'comment' not in attrs:
            raise serializers.ValidationError('You must provide at least one field to update: rating or comment.')
        
        return attrs

    def update(self, instance, validated_data):
        if 'rating' in validated_data:
            instance.rating = validated_data['rating']
            updated = True

        if 'comment' in validated_data:
            instance.comment = validated_data['comment']
            updated = True

        if updated:
            instance.edited_at = timezone.now()

        instance.save()

        return instance

    def save(self, **kwargs):
        return self.update(self.validated_data['review'], self.validated_data)


class DeleteClientReviewSerializer(ClientValidationMixin, ReviewValidationMixin, serializers.Serializer):
    """
    Client only: Deletes a given existing reveiw, for a given client.
    """
    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        attrs = self.validate_find_review(attrs)
        return attrs

    def delete(self):
        self.validated_data['review'].delete()


class GetClientCompletedBarbersSerializer(GetBarbersMixin, ClientValidationMixin, serializers.Serializer):
    """
    Returns all barbers with whom the client has completed appointments.
    """
    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        return attrs

    def to_representation(self, validated_data):
        client = validated_data['client']
        return {'barbers': self.get_barbers_completed_public(client) }
