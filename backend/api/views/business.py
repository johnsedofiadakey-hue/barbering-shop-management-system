from django.conf import settings as django_settings
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import BeforeAfterItem, PortfolioItem, Service, ShopSettings
from ..serializers import AdminServiceSerializer, BeforeAfterItemSerializer, PortfolioItemSerializer, ShopSettingsSerializer
from ..utils import IsAdminRole


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def get_shop_settings(request):
    data = ShopSettingsSerializer(ShopSettings.load()).data
    # Not a model field — computed from whether Paystack secrets are set, so the frontend
    # can hide paid-booking options entirely when there's no gateway to actually charge.
    data['payments_enabled'] = bool(django_settings.PAYSTACK_SECRET_KEY)
    data['booking_deposit_percent'] = django_settings.BOOKING_DEPOSIT_PERCENT
    data['booking_payment_window_minutes'] = django_settings.BOOKING_PAYMENT_WINDOW_MINUTES
    return Response({'shop': data})


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def get_portfolio(request):
    items = PortfolioItem.objects.filter(active=True)
    return Response({'portfolio': PortfolioItemSerializer(items, many=True).data})


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def get_before_after(request):
    items = BeforeAfterItem.objects.filter(active=True).select_related('barber', 'service')
    return Response({'before_after': BeforeAfterItemSerializer(items, many=True).data})


@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminRole])
@parser_classes([JSONParser])
def manage_shop_settings(request):
    shop = ShopSettings.load()

    if request.method == 'GET':
        return Response({'shop': ShopSettingsSerializer(shop).data})

    serializer = ShopSettingsSerializer(shop, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'shop': serializer.data})


@api_view(['GET', 'POST'])
@permission_classes([IsAdminRole])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def manage_portfolio(request):
    if request.method == 'GET':
        return Response({'portfolio': PortfolioItemSerializer(PortfolioItem.objects.all(), many=True).data})

    payload = request.data.copy()
    if 'active' not in payload:
        payload['active'] = 'true'
    if 'featured' not in payload:
        payload['featured'] = 'true'
    serializer = PortfolioItemSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'item': serializer.data}, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminRole])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def manage_portfolio_item(request, item_id):
    try:
        item = PortfolioItem.objects.get(pk=item_id)
    except PortfolioItem.DoesNotExist:
        return Response({'detail': 'Portfolio item not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        item.image.delete(save=False)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = PortfolioItemSerializer(item, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'item': serializer.data})


@api_view(['GET', 'POST'])
@permission_classes([IsAdminRole])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def manage_services(request):
    if request.method == 'GET':
        services = Service.objects.select_related('barber').order_by('barber__name', 'name')
        return Response({'services': AdminServiceSerializer(services, many=True).data})

    serializer = AdminServiceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'service': serializer.data}, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminRole])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def manage_service(request, service_id):
    try:
        service = Service.objects.select_related('barber').get(pk=service_id)
    except Service.DoesNotExist:
        return Response({'detail': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if service.image:
            service.image.delete(save=False)
        service.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = AdminServiceSerializer(service, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'service': serializer.data})


@api_view(['GET', 'POST'])
@permission_classes([IsAdminRole])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def manage_before_after(request):
    if request.method == 'GET':
        items = BeforeAfterItem.objects.select_related('barber', 'service').all()
        return Response({'before_after': BeforeAfterItemSerializer(items, many=True).data})

    payload = request.data.copy()
    if 'active' not in payload:
        payload['active'] = 'true'
    serializer = BeforeAfterItemSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'item': serializer.data}, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminRole])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def manage_before_after_item(request, item_id):
    try:
        item = BeforeAfterItem.objects.select_related('barber', 'service').get(pk=item_id)
    except BeforeAfterItem.DoesNotExist:
        return Response({'detail': 'Before-and-after item not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        item.before_image.delete(save=False)
        item.after_image.delete(save=False)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = BeforeAfterItemSerializer(item, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'item': serializer.data})
