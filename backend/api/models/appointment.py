from datetime import datetime, timedelta

from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone
from enum import Enum
from .user import Barber, Client

class AppointmentStatus(Enum):
    """
    Enumeration of possible statuses for an appointment.
    """
    ONGOING = "ONGOING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"

    @classmethod
    def choices(cls):
        return [(status.value, status.name) for status in cls]


class Service(models.Model):
    """
    Represents a specific service that a barber offers to clients.

    - Each service is linked to a single barber.
    - A barber can offer multiple different services, but cannot have two services with the same name.
    - Includes details such as the service name and its price.
    """
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='services_offered')
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=240, blank=True)
    image = models.ImageField(upload_to='images/services/', null=True, blank=True)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    duration_minutes = models.PositiveSmallIntegerField(default=30)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['barber', 'name'], name='unique_service_name_per_barber')
        ]

    def to_dict(self):
        """
        Returns a JSON-serializable dict representation of the service.
        """
        return {
            'id': self.id,
            'barber_id': self.barber.id,
            'name': self.name,
            'description': self.description,
            'image': self.image.url if self.image else None,
            'price': float(self.price),
            'duration_minutes': self.duration_minutes,
        }


class AppointmentLocation(Enum):
    SHOP = 'SHOP'
    HOME = 'HOME'

    @classmethod
    def choices(cls):
        return [(location.value, location.name) for location in cls]


class PaymentChoice(Enum):
    """
    What the client chose to secure their booking with, at the time they booked.
    """
    NONE = 'NONE'
    DEPOSIT = 'DEPOSIT'
    FULL = 'FULL'

    @classmethod
    def choices(cls):
        return [(choice.value, choice.name) for choice in cls]


class PaymentStatus(Enum):
    """
    UNPAID: no payment required (PaymentChoice.NONE) or not yet attempted.
    PENDING: a Paystack transaction was initialized; the slot is held until `payment_deadline`.
    PAID: payment confirmed via the Paystack webhook.
    """
    UNPAID = 'UNPAID'
    PENDING = 'PENDING'
    PAID = 'PAID'

    @classmethod
    def choices(cls):
        return [(status.value, status.name) for status in cls]



class Appointment(models.Model):
    """
    Represents a scheduled appointment booked by a client with a barber.

    - Each appointment records which client is booking, which barber, the date and time slot, and the selected services.
    - Clients may book only one appointment per date.
    - Prevents double-booking by ensuring a barber can have only one appointment per slot on a given date.
    - Tracks the appointment status (e.g., ongoing, completed, canceled).
    """
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name='appointments_created')
    barber = models.ForeignKey(Barber, null=True, blank=True, on_delete=models.SET_NULL, related_name='appointments_received')

    date = models.DateField()
    slot = models.TimeField()
    services = models.ManyToManyField(Service, through='AppointmentService', related_name='appointments')
    status = models.CharField(max_length=16, choices=AppointmentStatus.choices(), default=AppointmentStatus.ONGOING.value)
    reminder_email_sent = models.BooleanField(default=False)
    duration_minutes = models.PositiveSmallIntegerField(default=30)
    location_type = models.CharField(max_length=8, choices=AppointmentLocation.choices(), default=AppointmentLocation.SHOP.value)
    home_address = models.CharField(max_length=255, blank=True)
    notes = models.CharField(max_length=500, blank=True)
    travel_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    notification_error = models.CharField(max_length=500, blank=True)

    # Payment (Paystack). An unpaid PENDING hold is released back into availability by a
    # periodic task if the client doesn't pay before `payment_deadline` — see api.tasks.
    payment_choice = models.CharField(max_length=8, choices=PaymentChoice.choices(), default=PaymentChoice.NONE.value)
    payment_status = models.CharField(max_length=8, choices=PaymentStatus.choices(), default=PaymentStatus.UNPAID.value)
    payment_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    payment_reference = models.CharField(max_length=100, unique=True, null=True, blank=True)
    payment_deadline = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['client', 'date'],
                condition=~Q(status__in=[AppointmentStatus.CANCELLED.value, AppointmentStatus.NO_SHOW.value]),
                name='unique_active_appointment_per_client_date',
            ),
            models.UniqueConstraint(
                fields=['barber', 'date', 'slot'],
                condition=~Q(status__in=[AppointmentStatus.CANCELLED.value, AppointmentStatus.NO_SHOW.value]),
                name='unique_active_appointment_per_barber_slot',
            ),
        ]

    @property
    def service_ids(self):
        """
        Returns a list of dicts representing this barber's services.
        """
        return list(self.services.values_list('id', flat=True))
    
    @property
    def services_list(self):
        """
        Returns a list of dicts of all services associated with this appointment at booking time.
        """
        return [service.to_dict() for service in self.line_items.all()]
    
    @property
    def amount_spent(self):
        """
        Returns the total price of all services in this appointment.
        """
        total = self.line_items.aggregate(total=Sum('price'))['total']
        return float((total or 0) + self.travel_fee)

    @property
    def start_datetime(self):
        return timezone.make_aware(datetime.combine(self.date, self.slot), timezone.get_current_timezone())

    @property
    def end_datetime(self):
        return self.start_datetime + timedelta(minutes=self.duration_minutes)

    @property
    def can_modify(self):
        if self.status != AppointmentStatus.ONGOING.value:
            return False

        from .business import ShopSettings

        notice = timedelta(hours=ShopSettings.load().cancellation_notice_hours)
        return timezone.localtime(timezone.now()) < self.start_datetime - notice
    
    def to_dict(self):
        """
        Returns a JSON-serializable dict representation of the appointment.
        """
        return {
            'id': self.id,
            'client_id': self.client.id if self.client else None,
            'barber_id': self.barber.id if self.barber else None,
            'amount_spent': self.amount_spent,
            'services': self.services_list,
            'date': self.date,
            'slot': self.slot.strftime("%H:%M"),
            'end_time': self.end_datetime.strftime("%H:%M"),
            'duration_minutes': self.duration_minutes,
            'location_type': self.location_type,
            'home_address': self.home_address,
            'notes': self.notes,
            'travel_fee': float(self.travel_fee),
            'status': self.status,
            'reminder_email_sent': self.reminder_email_sent,
            'confirmation_sent_at': self.confirmation_sent_at,
            'reminder_sent_at': self.reminder_sent_at,
            'notification_error': self.notification_error,
            'can_modify': self.can_modify,
            'payment_choice': self.payment_choice,
            'payment_status': self.payment_status,
            'payment_amount': float(self.payment_amount),
            'payment_deadline': self.payment_deadline,
            'paid_at': self.paid_at,
        }


class AppointmentService(models.Model):
    """
    Stores a copy ("line item") of each service included in an appointment, capturing its details at the time of booking.

    - Links to a specific appointment via a foreign key.
    - Snapshots the service name and price at booking time, so appointment history is preserved even if the Service is changed or deleted.
    - Optionally links back to the original Service for reference, but original_service may be null if the Service is removed from the system.
    """
    appointment = models.ForeignKey('Appointment', on_delete=models.CASCADE, related_name='line_items')
    original_service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    duration_minutes = models.PositiveSmallIntegerField(default=30)

    def to_dict(self):
        return {
            'id': self.id,
            'original_service_id': self.original_service_id,
            'name': self.name,
            'price': float(self.price),
            'duration_minutes': self.duration_minutes,
        }


class Availability(models.Model):
    """
    Stores a barber's available time slots for client bookings on a particular date.

    - Each availability record is linked to one barber and one date.
    - The 'slots' field contains a list of available 1-hour time slots in "HH:MM" format.
    - Used by admins to manage and update barbers' availability for appointments.
    """
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='availabilities_assigned',)
    date = models.DateField()
    slots = models.JSONField()  # Example: ["09:00", "10:00", "11:00"]
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['barber', 'date'], name='unique_availability_date_per_barber')
        ]

    def to_dict(self):
        """
        Returns a JSON-serializable dict representation of the availability.
        """
        return {
            'id': self.id,
            'barber_id': self.barber.id,
            'date': self.date,
            'slots': self.slots,
        }


class Review(models.Model):
    """
    Represents a single review by a client for a barber after a completed appointment.
    
    - Each review is linked to one appointment, one client, and one barber.
    - A client can only leave one review per barber, regardless of the number of appointments.
    - Only appointments that have been completed should be reviewed.
    - Includes rating, optional comment, and timestamp of creation.
    """
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name='client_reviews')
    barber = models.ForeignKey(Barber, null=True, blank=True, on_delete=models.SET_NULL, related_name='barber_reviews')

    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True) 

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['client', 'barber'], name='unique_client_review_per_barber')
        ]

    def to_dict(self):
        """
        Returns a JSON-serializable dict representation of the review.
        """
        return {
            'id': self.id,
            'client_id': self.client.id if self.client else None,
            'barber_id': self.barber.id if self.barber else None,
            'rating': self.rating,
            'comment': self.comment,
            'created_at': self.created_at.strftime('%Y-%m-%d'),
            'edited_at': self.edited_at.strftime('%Y-%m-%d') if self.edited_at else None,
        }
