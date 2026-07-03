from .base import *

DEBUG = True
FRONTEND_URL = 'http://localhost:3002'
INSTALLED_APPS += ['django.contrib.admin', 'django_extensions']

# Print SMS messages to console instead of calling Twilio in development
SMS_BACKEND = os.getenv('SMS_BACKEND', 'console')
