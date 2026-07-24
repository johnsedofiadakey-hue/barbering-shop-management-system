from rest_framework import serializers

from ..models import BeforeAfterItem, Barber, PortfolioItem, Service, ShopSettings


class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        exclude = ('id', 'updated_at')


class PortfolioItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioItem
        fields = (
            'id',
            'title',
            'description',
            'image',
            'duration_minutes',
            'price',
            'featured',
            'active',
            'display_order',
        )
        read_only_fields = ('id',)

    def validate_duration_minutes(self, value):
        if value < 10 or value > 480:
            raise serializers.ValidationError('Duration must be between 10 and 480 minutes.')
        return value


class AdminServiceSerializer(serializers.ModelSerializer):
    barber_id = serializers.PrimaryKeyRelatedField(source='barber', queryset=Barber.objects.all())
    barber_name = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Service
        fields = (
            'id',
            'barber_id',
            'barber_name',
            'name',
            'description',
            'image',
            'duration_minutes',
            'price',
        )
        read_only_fields = ('id', 'barber_name')

    def get_barber_name(self, service):
        full_name = f'{service.barber.name} {service.barber.surname}'.strip()
        return full_name or service.barber.username

    def validate_duration_minutes(self, value):
        if value < 10 or value > 480:
            raise serializers.ValidationError('Duration must be between 10 and 480 minutes.')
        return value

    def update(self, instance, validated_data):
        old_image = instance.image
        updated = super().update(instance, validated_data)
        new_image_name = updated.image.name if updated.image else None
        if 'image' in validated_data and old_image and old_image.name != new_image_name:
            old_image.delete(save=False)
        return updated


class BeforeAfterItemSerializer(serializers.ModelSerializer):
    barber_id = serializers.PrimaryKeyRelatedField(
        source='barber',
        queryset=Barber.objects.all(),
        required=False,
        allow_null=True,
    )
    service_id = serializers.PrimaryKeyRelatedField(
        source='service',
        queryset=Service.objects.all(),
        required=False,
        allow_null=True,
    )
    barber_name = serializers.SerializerMethodField()
    service_name = serializers.CharField(source='service.name', read_only=True, default='')

    class Meta:
        model = BeforeAfterItem
        fields = (
            'id',
            'title',
            'description',
            'before_image',
            'after_image',
            'barber_id',
            'barber_name',
            'service_id',
            'service_name',
            'active',
            'display_order',
        )
        read_only_fields = ('id', 'barber_name', 'service_name')

    def get_barber_name(self, item):
        if not item.barber:
            return ''
        return f'{item.barber.name} {item.barber.surname}'.strip() or item.barber.username

    def update(self, instance, validated_data):
        old_before = instance.before_image
        old_after = instance.after_image
        updated = super().update(instance, validated_data)
        if 'before_image' in validated_data and old_before and old_before.name != updated.before_image.name:
            old_before.delete(save=False)
        if 'after_image' in validated_data and old_after and old_after.name != updated.after_image.name:
            old_after.delete(save=False)
        return updated
