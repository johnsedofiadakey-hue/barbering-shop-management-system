import hashlib
import hmac

import requests
from django.conf import settings

PAYSTACK_BASE_URL = 'https://api.paystack.co'


class PaystackError(Exception):
    """Raised when Paystack isn't configured, or a request to it fails."""


def is_configured():
    return bool(settings.PAYSTACK_SECRET_KEY)


def _headers():
    if not is_configured():
        raise PaystackError('Payments are not configured for this shop yet.')
    return {
        'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}',
        'Content-Type': 'application/json',
    }


def initialize_transaction(email, amount, reference, callback_url):
    """
    Starts a Paystack hosted-checkout transaction and returns its `authorization_url` for
    the client to be redirected to. `amount` is in the shop's major currency unit (e.g.
    cedis); Paystack expects the minor unit, so it's converted here.
    """
    response = requests.post(
        f'{PAYSTACK_BASE_URL}/transaction/initialize',
        headers=_headers(),
        json={
            'email': email,
            'amount': int(round(float(amount) * 100)),
            'reference': reference,
            'callback_url': callback_url,
            'currency': settings.PAYSTACK_CURRENCY,
        },
        timeout=15,
    )
    data = response.json()
    if not response.ok or not data.get('status'):
        raise PaystackError(data.get('message', 'Could not start the payment.'))
    return data['data']


def verify_transaction(reference):
    """Confirms a transaction's status directly with Paystack (used as a webhook fallback)."""
    response = requests.get(
        f'{PAYSTACK_BASE_URL}/transaction/verify/{reference}',
        headers=_headers(),
        timeout=15,
    )
    data = response.json()
    if not response.ok or not data.get('status'):
        raise PaystackError(data.get('message', 'Could not verify the payment.'))
    return data['data']


def verify_webhook_signature(request_body, signature_header):
    """Validates the `x-paystack-signature` header against the raw request body."""
    if not settings.PAYSTACK_SECRET_KEY or not signature_header:
        return False

    computed = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode('utf-8'),
        request_body,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(computed, signature_header)
