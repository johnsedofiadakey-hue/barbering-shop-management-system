from django.urls import path
from ..views import (
    get_current_user,
    register_barber,
    get_email_from_token,
    logout_user,
    request_otp,
    verify_otp,
    request_magic_link,
    verify_magic_link,
    refresh_token,
    firebase_phone_login,
    firebase_staff_login,
)

urlpatterns = [
    # Barber registration management (admin invite flow)
    path('register/<uidb64>/<token>/', register_barber, name='register_barber'),
    path('email/<uidb64>/<token>/', get_email_from_token, name='get_email_from_token'),

    # Client phone/OTP authentication
    path('otp/request/', request_otp, name='request_otp'),
    path('otp/verify/', verify_otp, name='verify_otp'),
    path('firebase/phone/', firebase_phone_login, name='firebase_phone_login'),

    # Client email magic-link authentication (supplements phone/OTP, never replaces it)
    path('magic-link/request/', request_magic_link, name='request_magic_link'),
    path('magic-link/<uidb64>/<token>/', verify_magic_link, name='verify_magic_link'),

    # Staff (admin/barber) Firebase-bridged authentication — never auto-creates accounts
    path('firebase/staff/', firebase_staff_login, name='firebase_staff_login'),

    # Operations for authenticated users
    path('me/', get_current_user, name='get_current_user'),
    path('logout/', logout_user, name='logout_user'),

    # Session refresh management
    path('refresh-token/', refresh_token, name='refresh_token'),
]
