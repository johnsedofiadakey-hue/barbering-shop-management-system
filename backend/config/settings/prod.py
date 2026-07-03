from .base import *

DEBUG = False
FRONTEND_URL = 'https://barbermanager.creepymemes.com' # TODO: change to frontend

# Lock CORS down in production (base.py leaves it open for development)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = (
    'rest_framework.renderers.JSONRenderer',
)

# Ensure cookies are only sent over HTTPS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True


# We leave SSL redirect to Nginx
SECURE_SSL_REDIRECT = False

# No need for SECURE_HSTS_* settings here, as Nginx handles HSTS globally