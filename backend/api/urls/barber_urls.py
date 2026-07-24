from django.urls import path
from ..views import (
    manage_barber_profile,
    get_barber_availabilities,
    manage_barber_services,
    manage_barber_service,
    get_barber_appointments,
    update_barber_appointment_status,
    get_barber_reviews,
)


urlpatterns = [
    # Barber profile management
    path('profile/', manage_barber_profile, name='manage_barber_profile'),

    # Service management
    path('services/', manage_barber_services, name='manage_barber_services'),
    path('services/<int:service_id>/', manage_barber_service, name='manage_barber_service'),

    # Getters for authenticated barber
    path('availabilities/', get_barber_availabilities, name='get_barber_availabilities'),
    path('appointments/', get_barber_appointments, name='get_barber_appointments'),
    path('appointments/<int:appointment_id>/', update_barber_appointment_status, name='update_barber_appointment_status'),
    path('reviews/', get_barber_reviews, name='get_barber_reviews'),
]
