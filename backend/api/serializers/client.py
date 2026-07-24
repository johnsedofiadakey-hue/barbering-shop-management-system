from django.utils import timezone
from django.db import transaction
from rest_framework import serializers
from ..utils import (
    ClientValidationMixin,
    BarberValidationMixin,
    UsernameValidationMixin,
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


class UpdateClientProfileSerializer(ClientValidationMixin, UsernameValidationMixin, serializers.Serializer):
    """
    Client only: Updates general informations about a given client.
    """
    username = serializers.CharField(required=False)
    name = serializers.CharField(required=False)
    surname = serializers.CharField(required=False)
    phone_number = serializers.CharField(required=False, max_length=16)

    def validate(self, attrs):
        attrs = self.validate_client(attrs)

        if 'phone_number' in attrs:
            raise serializers.ValidationError({
                'phone_number': 'Phone number changes require a new verified login. Contact support to transfer this account.'
            })

        if not any(field in attrs for field in ('username', 'name', 'surname')):
            raise serializers.ValidationError('You must provide at least one field: username, name or surname.')
        
        if 'username' in attrs:
            attrs = self.validate_username_unique(attrs, user_instance=attrs['client'])

        return attrs

    def update(self, instance, validated_data):
        if 'username' in validated_data:
            instance.username = validated_data['username']

        if 'name' in validated_data:
            instance.name = validated_data['name']
        
        if 'surname' in validated_data:
            instance.surname = validated_data['surname']
        
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

    def validate(self, attrs):
        attrs = self.validate_client(attrs)
        attrs = self.validate_barber(attrs)
        attrs = self.validate_services_belong_to_barber(attrs)
        shop = ShopSettings.load()

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

        appointment = Appointment(
            client=client, 
            barber=barber, 
            date=date, 
            slot=slot,
            duration_minutes=validated_data['duration_minutes'],
            location_type=validated_data['location_type'],
            home_address=validated_data.get('home_address', ''),
            notes=validated_data.get('notes', ''),
            travel_fee=validated_data.get('travel_fee', 0),
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
