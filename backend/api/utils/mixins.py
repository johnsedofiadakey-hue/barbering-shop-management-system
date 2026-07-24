from rest_framework import serializers


class EmailValidationMixin:
    """
    Utility mixin to handle common email validation checks
    """
    def validate_email_unique(self, attrs, user_instance=None):
        from ..models import User

        email = attrs['email']
        user = User.objects.filter(email=email)

        if user_instance:
            user = user.exclude(pk=user_instance.pk)

        if user.exists():
            raise serializers.ValidationError(f'The email "{email}" is already taken.')
        
        attrs['email'] = email
        return attrs


class UsernameValidationMixin:
    """
    Utility mixin to handle common username validation checks
    """
    def validate_username_unique(self, attrs, user_instance=None): 
        from ..models import User

        username = attrs['username']
        user = User.objects.filter(username=username)

        if user_instance:
            user = user.exclude(pk=user_instance.pk)
        
        if user.exists():
            raise serializers.ValidationError(f'The username "{username}" is already taken.')
        
        attrs['username'] = username
        return attrs

    def validate_username_format(self, attrs):
        from ..utils import username_validator

        username = attrs['username']

        try:
            username_validator(username)
        except:
            raise serializers.ValidationError("Username can only contain ASCII letters, digits, and underscores")
        
        return attrs


class PhoneNumberValidationMixin:
    """
    Utility mixin to handle phone number validation checks
    """
    def validate_phone_number_format(self, attrs):
        from ..utils import phone_number_validator

        phone_number = attrs.get("phone_number")

        if phone_number:
            try:
                phone_number_validator(phone_number)
            except:
                raise serializers.ValidationError("Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed (E.164 format).")
        
        return attrs
    

class UIDTokenValidationSerializer(serializers.Serializer):
    """
    Utility serializer that handlles token checks, from which other serializers inherit
    """
    def validate_uid_token(self, attrs, target_key='user'):
        from .utils import get_user_from_uid_token

        uidb64 = self.context.get('uidb64')
        token = self.context.get('token')

        if not uidb64 or not token:
            raise serializers.ValidationError("Missing uid or token.")

        user = get_user_from_uid_token(uidb64, token)

        attrs[target_key] = user
        return attrs


class ModelInstanceOrIDValidationMixin:
    """
    Mixin to fetch and validate a user model instance from either an instance or a PK in context.
    """
    def validate_user_model(self, model, attrs, check_active):
        from ..models import User
        model_name = model.__name__
        out_key = model_name.lower()
        context_keys = [out_key, f"{out_key}_id"]
        found = None
        
        # Get value for the first key found
        for key in context_keys:
            if key in self.context:
                found = self.context[key]
                break

        # If not found in `context` search in `attrs`
        for key in context_keys:
            if key in attrs:
                found = attrs[key]
                break
            
        if not found:
            raise serializers.ValidationError(f"No {model_name} or ID provided in context.")
        
        # If it's the correct model instance, return directly
        if isinstance(found, model):
            if check_active and not found.is_active:
                raise serializers.ValidationError(f"{model_name} is inactive.")
            
            attrs[out_key] = found
            return attrs
        
        # If instance of User, get the correct related model (client/barber/admin):
        if isinstance(found, User):
            user_type_name = model_name.lower()

            if hasattr(found, user_type_name):
                user_type = getattr(found, user_type_name, None)

                if user_type:
                    if check_active and not user_type.is_active:
                        raise serializers.ValidationError(f"{model_name} is inactive.")
                    
                    attrs[out_key] = user_type
                    return attrs
                
            raise serializers.ValidationError(f"User does not have a {user_type_name} profile.")

        # If it's a valid integer pk, query for instance
        if isinstance(found, int):
            try:
                user = model.objects.get(pk=found, is_active=True)
            except model.DoesNotExist:
                raise serializers.ValidationError(f'{model_name} with ID: "{found}" does not exist or is inactive.')
            
            attrs[out_key] = user
            return attrs

        # If it's neither, fallback error
        raise serializers.ValidationError(f"{model_name} must be provided as an instance or a primary key, not '{found}'.")


class UserValidationMixin(ModelInstanceOrIDValidationMixin):
    """
    Mixin to validate that a user_id from context exists and is active. Also adds 'user' to attrs.
    """
    def validate_user(self, attrs, check_active=True):
        from ..models import User
        return self.validate_user_model(User, attrs, check_active)


class AdminValidationMixin(ModelInstanceOrIDValidationMixin):
    """
    Mixin to validate that an Admin instance or ID from context, ensure active, adds 'admin' to attrs.
    """
    def validate_admin(self, attrs, check_active=True):
        from ..models import Admin
        return self.validate_user_model(Admin, attrs, check_active)
    

class ClientValidationMixin(ModelInstanceOrIDValidationMixin):
    """
    Mixin to validate that a Client instance or ID from context, ensure active, adds 'client' to attrs.
    """
    def validate_client(self, attrs, check_active=True):
        from ..models import Client
        return self.validate_user_model(Client, attrs, check_active)


class BarberValidationMixin(ModelInstanceOrIDValidationMixin):
    """
    Mixin to validate that a Barber instance or ID from context, ensure active, adds 'barber' to attrs.
    """
    def validate_barber(self, attrs, check_active=True):
        from ..models import Barber
        return self.validate_user_model(Barber, attrs, check_active)


class AppointmentValidationMixin:
    """
    Mixin that rovides validation methods for appointment management:

    - Ensures that a client and barber do not have conflicting appointments on the same date or time slot, and that a client cannot have multiple ongoing appointments.
    - Verifies provided services all belong to the specified barber before creating or modifying an appointment.
    - Checks that an availability entry exists for the barber on the desired date, and that the requested time slot is included in the barber's available slots.
    - Confirms the existence of a specific appointment for the client and ensures it is ONGOING before allowing cancellation.
    """
    def validate_services_belong_to_barber(self, attrs):
        barber = attrs['barber']
        services = attrs['services']

        if not services:
            raise serializers.ValidationError('Select at least one service.')

        for service in services:
            if service.barber_id != barber.id:
                raise serializers.ValidationError(f'Service with ID "{service.id}" for the barber "{barber}" does not exist.')

        attrs['duration_minutes'] = sum(service.duration_minutes for service in services)
        return attrs

    def validate_appointment_date_and_slot(self, attrs, appointment_instance=None):
        from datetime import datetime, timedelta

        from django.utils import timezone

        from ..models import Appointment, Availability, AppointmentStatus, ShopSettings

        client = attrs['client']
        barber = attrs['barber']
        appointment_date = attrs['date']
        appointment_slot = attrs['slot']
        duration_minutes = attrs.get('duration_minutes', 30)
        shop = ShopSettings.load()

        now = timezone.localtime(timezone.now())
        requested_start = timezone.make_aware(
            datetime.combine(appointment_date, appointment_slot),
            timezone.get_current_timezone(),
        )
        requested_end = requested_start + timedelta(minutes=duration_minutes)

        if requested_start <= now:
            raise serializers.ValidationError('Appointments must be booked for a future time.')

        if appointment_date > now.date() + timedelta(days=shop.booking_horizon_days):
            raise serializers.ValidationError(
                f'Appointments can only be booked up to {shop.booking_horizon_days} days ahead.'
            )

        client_appointments = Appointment.objects.filter(client=client, date=appointment_date).exclude(
            status__in=[AppointmentStatus.CANCELLED.value, AppointmentStatus.NO_SHOW.value]
        )
        barber_appointments = Appointment.objects.filter(barber=barber, date=appointment_date).exclude(
            status__in=[AppointmentStatus.CANCELLED.value, AppointmentStatus.NO_SHOW.value]
        )

        if appointment_instance:
            client_appointments = client_appointments.exclude(pk=appointment_instance.pk)
            barber_appointments = barber_appointments.exclude(pk=appointment_instance.pk)

        if client_appointments.exists():
            raise serializers.ValidationError(f'Appointment for the date "{appointment_date}" for the client: "{client}" already exists.')

        for existing in barber_appointments:
            if requested_start < existing.end_datetime and requested_end > existing.start_datetime:
                raise serializers.ValidationError('That time overlaps another appointment for this barber.')

        try:
            availability = Availability.objects.get(barber=barber, date=appointment_date)
        except Availability.DoesNotExist:
            raise serializers.ValidationError(f'Barber is not available on "{appointment_date}".')
        
        slot_str = appointment_slot.strftime('%H:%M')

        if slot_str not in availability.slots:
            raise serializers.ValidationError(f'Barber: "{barber}" is not available at "{slot_str}" on "{appointment_date}".')

        parsed_slots = sorted(
            datetime.strptime(slot, '%H:%M') for slot in availability.slots
        )
        intervals = [
            int((later - earlier).total_seconds() // 60)
            for earlier, later in zip(parsed_slots, parsed_slots[1:])
            if later > earlier
        ]
        interval = min(intervals) if intervals else 30
        available_slots = set(availability.slots)
        cursor = datetime.combine(appointment_date, appointment_slot)
        end_cursor = cursor + timedelta(minutes=duration_minutes)

        while cursor < end_cursor:
            if cursor.strftime('%H:%M') not in available_slots:
                raise serializers.ValidationError(
                    'The selected services do not fit in the barber\'s remaining availability.'
                )
            cursor += timedelta(minutes=interval)

        return attrs
    
    def validate_find_appointment(self, attrs):
        from datetime import timedelta

        from django.utils import timezone

        from ..models import Appointment, AppointmentStatus, ShopSettings

        client = attrs['client']
        appointment_id = self.context.get('appointment_id')

        try:
            appointment = Appointment.objects.get(pk=appointment_id, client=client)
        except Appointment.DoesNotExist:
            raise serializers.ValidationError(f'Appointment with ID "{appointment_id}" for the client: "{client}" does not exist.')
        
        if appointment.status != AppointmentStatus.ONGOING.value:
            raise serializers.ValidationError('Only ONGOING appointments can be cancelled.')

        notice = timedelta(hours=ShopSettings.load().cancellation_notice_hours)
        if timezone.localtime(timezone.now()) >= appointment.start_datetime - notice:
            raise serializers.ValidationError(
                f'Appointments must be cancelled at least {ShopSettings.load().cancellation_notice_hours} hours in advance.'
            )

        attrs['appointment'] = appointment
        return attrs


class AvailabilityValidationMixin:
    """
    Mixin that provides validation methods for availability management:

    - Ensures a barber does not already have an availability set for the same date, preventing duplicate availabilities on a single day.
    - Validates the existence of an availability entry for the given barber and specified ID before allowing retrieval or update operations.
    - Built in util function that generates the slots based on input start/end time and interval
    """
    def validate_availability_date(self, attrs, availability_instance=None):
        from ..models import Availability

        barber = attrs['barber']
        availability_date = attrs['date']

        availability =  Availability.objects.filter(barber=barber, date=availability_date)

        if availability_instance:
            availability = availability.exclude(pk=availability_instance.pk)

        if availability.exists():
            raise serializers.ValidationError(f'Availability with the date: "{availability_date}" for the barber: "{barber}" already exists.')

        return attrs

    def validate_find_availability(self, attrs):
        from ..models import Availability
        
        barber = attrs['barber']
        availability_id = self.context.get('availability_id')

        try:
            availability = Availability.objects.get(barber=barber, pk=availability_id)
        except Availability.DoesNotExist:
            raise serializers.ValidationError(f'Availability with the ID: "{availability_id}" for the barber: "{barber}" does not exist.')
        
        attrs['availability'] = availability
        return attrs
    
    def generate_slots(self, start_time, end_time, interval):
        from datetime import timedelta, datetime

        slots = []
        start_date = datetime.combine(datetime.today(), start_time)
        end_date = datetime.combine(datetime.today(), end_time)

        while start_date + timedelta(minutes=interval) <= end_date:
            slots.append(start_date.strftime('%H:%M'))
            start_date += timedelta(minutes=interval)

        return slots
    

class ServiceValidationMixin:
    """
    Mixin that provides validation methods for service-related operations:

    - Ensures a barber does not already have a service with the same name (case-insensitive) before creating or updating a service.
    - Ensures a service with the given ID exists and is owned by the specified barber before proceeding with actions that need to fetch or validate a particular service.
    """
    def validate_service_name(self, attrs, service_instance=None):
        from ..models import Service

        barber = attrs['barber']
        service_name = attrs['name']

        service = Service.objects.filter(barber=barber, name__iexact=service_name)

        if service_instance:
            service = service.exclude(pk=service_instance.pk)

        if service.exists():
            raise serializers.ValidationError(f'Service with the name: "{service_name}" for the barber: "{barber}" already exists.')
        
        return attrs

    def validate_find_service(self, attrs):
        from ..models import Service

        barber = attrs['barber']
        service_id = self.context.get('service_id')

        try:
            service = Service.objects.get(barber=barber, pk=service_id)
        except Service.DoesNotExist:
            raise serializers.ValidationError(f'Service with the ID: "{service_id}" for the barber: "{barber}" does not exist.')
        
        attrs['service'] = service
        return attrs
    

class ReviewValidationMixin:
    """
    Mixin that provides validation methods for review-related actions:
    
    - Ensures that the client has at least one COMPLETED appointment with the barber, and has not reviewed them yet.
    - Ensures a review exists and belongs to the requesting client when retrieving or modifying a review.
    """
    def validate_appointment_for_review(self, attrs):
        from ..models import Appointment, Review, AppointmentStatus

        client = attrs['client']
        barber = attrs['barber']

        if Review.objects.filter(client=client, barber=barber).exists():
            raise serializers.ValidationError(f'Client: "{client}" already has a review for the barber: "{barber}".')
        
        if not Appointment.objects.filter(client=client, barber=barber, status=AppointmentStatus.COMPLETED.value).exists():
            raise serializers.ValidationError('You may only review a barber if you have completed at least one appointment with them.')

        return attrs
    
    def validate_find_review(self, attrs):
        from ..models import Review, AppointmentStatus

        client = attrs['client']
        review_id = self.context.get('review_id')

        try:
            review = Review.objects.get(client=client, pk=review_id)
        except Review.DoesNotExist:
            raise serializers.ValidationError(f'Review with the ID: "{review_id}" for the client: "{client}" does not exist.')
        
        attrs['review'] = review
        return attrs


class GetAdminsMixin:
    """
    Mixin for retrieving and serializing Admin models.
    """
    def get_admins_queryset(self):
        """
        Returns Admin queryset in the system.
        """
        from ..models import Admin
        return Admin.objects.all()
    
    def get_admin_private(self, admin):
        """
        Returns all data for a single admin.
        """
        return admin.to_dict()
    
    def get_admins_private(self):
        """
        Returns all admins as full dicts.
        """
        return [self.get_admin_private(a) for a in self.get_admins_queryset()]
    

class GetBarbersMixin:
    """
    Mixin for retrieving and serializing Barber models.
    """
    _PUBLIC_EXCLUDES = ['email', 'completed_appointments',  'upcoming_appointments', 'availabilities', 'is_active', 'total_revenue']

    def get_barbers_queryset(self, show_all=False):
        """
        Returns Barber queryset in the system.
        If show_all is True, returns all barbers.
        """
        from ..models import Barber
        return Barber.objects.filter(is_active=True) if not show_all else Barber.objects.all()
    
    def get_barber_public(self, barber):
        """
        Returns only the public data for a single barber.
        """
        data = barber.to_dict().copy()
        for field in self._PUBLIC_EXCLUDES:
            data.pop(field, None)
        data['latest_reviews'] = [
            {
                'rating': review['rating'],
                'comment': review['comment'],
                'created_at': review['created_at'],
            }
            for review in data.get('latest_reviews', [])
        ]
        return data
    
    def get_barber_private(self, barber):
        """
        Returns all data for a single barber.
        """
        return barber.to_dict()
    
    def get_barbers_private(self, show_all=False):
        """
        Returns all barbers as full dicts (all or only active).
        """
        return [self.get_barber_private(b) for b in self.get_barbers_queryset(show_all=show_all)]
    
    def get_barbers_public(self):
        """
        Returns all active barbers as public dicts.
        """
        return [self.get_barber_public(b) for b in self.get_barbers_queryset()]
    
    def get_barbers_completed_public(self, client):
        """
        Returns public data for all barbers that the client had a completed appointment with.
        """
        from ..models import Barber
        from ..models import AppointmentStatus

        # All ids of barbers the client had a completed appointment with
        barber_ids = client.appointments_created.filter(status=AppointmentStatus.COMPLETED.value).values_list('barber_id', flat=True).distinct()

        # Only active barbers (is_active=True), matching get_barbers_public
        return [self.get_barber_public(barber) for barber in Barber.objects.filter(id__in=barber_ids, is_active=True)]


class GetClientsMixin:
    """
    Mixin for retrieving and serializing Client models.
    """
    def get_clients_queryset(self, show_all=False):
        """
        Returns Client queryset in the system.
        If show_all is True, returns all clients.
        """
        from ..models import Client
        return Client.objects.filter(is_active=True) if not show_all else Client.objects.all()
    
    def get_client_public(self, client):
        """
        Returns the minimal identity card needed by authorized staff views.
        """
        return {
            'id': client.id,
            'username': client.username,
            'name': client.name,
            'surname': client.surname,
            'profile_image': client.profile_image.url if client.profile_image else None,
        }
    
    def get_client_private(self, client):
        """
        Returns all data for a single client.
        """
        return client.to_dict()
    
    def get_clients_private(self, show_all=False):
        """
        Returns all clients as full dicts (all or only active).
        """
        return [self.get_client_private(b) for b in self.get_clients_queryset(show_all=show_all)]
    
    def get_clients_public(self):
        """
        Returns all active clients as public dicts.
        """
        return [self.get_client_public(b) for b in self.get_clients_queryset()]
    

class GetAvailabilitiesMixin:
    """
    Mixin for retrieving and serializing Availability models.
    """
    def _get_availabilities_queryset(self, barber_id, show_all=False):
        """
        Returns Availability queryset for a specific barber, only for dates today or in the future.
        If show_all is True, returns all availabilities.
        """
        from ..models import Availability
        from django.utils import timezone
        return Availability.objects.filter(barber_id=barber_id, date__gte=timezone.localdate()) if not show_all else Availability.objects.all()

    def _remove_booked_slots(self, barber, date, slots):
        """
        Given a barber, date, and a list of slots, return list of slots which are not already booked.
        """
        from datetime import datetime

        from django.utils import timezone

        from ..models import Appointment, AppointmentStatus

        appointments = Appointment.objects.filter(barber=barber, date=date).exclude(
            status__in=[AppointmentStatus.CANCELLED.value, AppointmentStatus.NO_SHOW.value]
        )

        result = []
        for slot in slots:
            slot_time = datetime.strptime(slot, '%H:%M').time()
            candidate = timezone.make_aware(
                datetime.combine(date, slot_time),
                timezone.get_current_timezone(),
            )
            if not any(appointment.start_datetime <= candidate < appointment.end_datetime for appointment in appointments):
                result.append(slot)

        return result
    
    def _filter_slots(self, availability):
        """
        Given an Availability instance, filter out:
        - slots that are in the past (if today)
        - slots that are already booked (non-cancelled appointment)
        """
        from django.utils import timezone

        today = timezone.localdate()
        now = timezone.localtime(timezone.now()).time()

        slots = availability.slots
        
        # If today, filter out past slots
        if availability.date == today:
            slots = [slot for slot in slots if self._slot_str_is_future(slot, now)]
        
        # Then always filter out booked slots
        slots = self._remove_booked_slots(availability.barber, availability.date, slots)

        return slots

    def _filter_slots_for_duration(self, availability, slots, duration_minutes):
        """Only return starts with enough consecutive free availability for the selected services."""
        from datetime import datetime, timedelta

        parsed_slots = sorted(datetime.strptime(slot, '%H:%M') for slot in availability.slots)
        intervals = [
            int((later - earlier).total_seconds() // 60)
            for earlier, later in zip(parsed_slots, parsed_slots[1:])
            if later > earlier
        ]
        interval = min(intervals) if intervals else 30
        available = set(slots)
        fitting_slots = []

        for slot in slots:
            cursor = datetime.combine(availability.date, datetime.strptime(slot, '%H:%M').time())
            end = cursor + timedelta(minutes=duration_minutes)
            fits = True
            while cursor < end:
                if cursor.strftime('%H:%M') not in available:
                    fits = False
                    break
                cursor += timedelta(minutes=interval)
            if fits:
                fitting_slots.append(slot)

        return fitting_slots

    def _slot_str_is_future(self, slot_str, now_time):
        """
        slot_str: e.g. "14:00"
        now_time: a datetime.time object
        Returns True if slot_str represents a time strictly AFTER now_time.
        """
        import datetime

        try:
            hour, minute = map(int, slot_str.split(':'))
            slot_time = datetime.time(hour=hour, minute=minute)
            return slot_time > now_time
        
        except Exception:
            return False

    def get_availability_public(self, availability):
        """
        Returns all data for a single availability, only showing future slots where appropriate.
        """
        availability_data = availability.to_dict()
        availability_data["slots"] = self._filter_slots(availability)
        return availability_data
    
    def get_availabilities_public(self, barber_id, show_all=False):
        """
        Returns list of availability dicts ONLY with future-dated availabilities, and with slots filtered for "today".
        Removes any today-availabilities that have zero remaining slots.
        """
        result = []
        for availability in self._get_availabilities_queryset(barber_id=barber_id, show_all=show_all):
            filtered_slots = self._filter_slots(availability)

            if filtered_slots:
                availability_data = availability.to_dict()
                availability_data['slots'] = filtered_slots
                result.append(availability_data)

        return result


class GetServicesMixin:
    """
    Mixin for retrieving and serializing Service models.
    """
    def get_services_queryset(self, barber_id, show_all=False):
        """
        Returns Service queryset for a specific barber.
        If show_all is True, returns all services.
        """
        from ..models import Service
        return Service.objects.filter(barber_id=barber_id) if not show_all else Service.objects.all()
    
    def get_service_public(self, service):
        """
        Returns all data for a single service.
        """
        return service.to_dict()
    
    def get_services_public(self, barber_id, show_all=False):
        """
        Returns all barbers as full dicts (all or only active).
        """
        return [self.get_service_public(b) for b in self.get_services_queryset(barber_id=barber_id, show_all=show_all)]


class GetAppointmentsMixin:
    """
    Mixin for retrieving and serializing Appointment models.
    """
    def get_appointments_queryset(self, barber_id=None, client_id=None, show_all=False):
        """
        Returns Appointment queryset filtered by barber or client.
        If show_all is True, returns all appointments. (For admin use only!)
        """
        from ..models import Appointment

        if show_all:
            return Appointment.objects.all()
        
        if barber_id and client_id:
            raise serializers.ValidationError('Appointments Queryset Error: Provide only a barber_id or a client_id, not both.')

        if not barber_id and not client_id:
            raise serializers.ValidationError('Appointments Queryset Error: Provide either a barber_id or a client_id.')
        
        if barber_id:
            return Appointment.objects.filter(barber_id=barber_id)
        
        return Appointment.objects.filter(client_id=client_id)
    
    def get_appointment_public(self, appointment):
        """
        Returns all data for a single appointment.
        """
        return appointment.to_dict()
    

    def get_appointments_public(self, barber_id=None, client_id=None, show_all=False):
        """
        Returns all barbers as full dicts (all or only active).
        """
        return [self.get_appointment_public(b) for b in self.get_appointments_queryset(barber_id=barber_id, client_id=client_id, show_all=show_all)]
    

class GetReviewsMixin:
    """
    Mixin for retrieving and serializing Review models.
    """
    def get_reviews_queryset(self, barber_id=None, client_id=None, show_all=False):
        """
        Returns Review queryset filtered by barber or client.
        If show_all is True, returns all reviews.
        """
        from ..models import Review

        if show_all:
            return Review.objects.all()
        
        if barber_id and client_id:
            raise serializers.ValidationError('Reviews Queryset Error: Provide only a barber_id or a client_id, not both.')

        if not barber_id and not client_id:
            raise serializers.ValidationError('Reviews Queryset Error: Provide either a barber_id or a client_id.')
        
        if barber_id:
            return Review.objects.filter(barber_id=barber_id)
        
        return Review.objects.filter(client_id=client_id)
    
    def get_review_public(self, review):
        """
        Returns all data for a single review.
        """
        return review.to_dict()
    
    def get_reviews_public(self, barber_id=None, client_id=None, show_all=False):
        """
        Returns all barbers as full dicts (all or only active).
        """
        return [self.get_review_public(b) for b in self.get_reviews_queryset(barber_id=barber_id, client_id=client_id, show_all=show_all)]
