from django.urls import path
from ..views import (
    manage_admin_profile,
    get_all_barbers,
    get_all_clients,
    invite_barber,
    delete_barber,
    create_barber_availability,
    manage_barber_availability,
    get_all_appointments,
    manage_shop_settings,
    manage_portfolio,
    manage_portfolio_item,
    manage_services,
    manage_service,
    manage_before_after,
    manage_before_after_item,
)

urlpatterns = [
    path('shop/', manage_shop_settings, name='manage_shop_settings'),
    path('portfolio/', manage_portfolio, name='manage_portfolio'),
    path('portfolio/<int:item_id>/', manage_portfolio_item, name='manage_portfolio_item'),
    path('services/', manage_services, name='manage_services'),
    path('services/<int:service_id>/', manage_service, name='manage_service'),
    path('before-after/', manage_before_after, name='manage_before_after'),
    path('before-after/<int:item_id>/', manage_before_after_item, name='manage_before_after_item'),
    # Admin profile management
    path('profile/', manage_admin_profile, name='manage_admin_profile'),

    # Barber User management
    path('barbers/invite/', invite_barber, name='invite_barber'),
    path('barbers/<int:barber_id>/', delete_barber, name='delete_barber'),

    # Barber Availability management
    path('barbers/<int:barber_id>/availabilities/', create_barber_availability, name='create_barber_availability'),
    path('barbers/<int:barber_id>/availabilities/<int:availability_id>/', manage_barber_availability, name='manage_barber_availability'),

    # Getters for authenticated admin
    path('barbers/', get_all_barbers, name='get_all_barbers'),
    path('clients/', get_all_clients, name='get_all_clients'),
    path('appointments/', get_all_appointments, name='get_all_appointments'),
]
