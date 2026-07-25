import { useState, useEffect } from 'react';
import styles from './BookingWidget.module.scss';
import Button from '@components/common/Button/Button';
import Icon from '@components/common/Icon/Icon';
import Spinner from '@components/common/Spinner/Spinner';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';
import Calendar from './Calendar';
import TimeSlotGrid from './TimeSlotGrid';
import api from '@api';

import fadeImage from '@assets/images/portfolio/skin-fade.webp';
import beardImage from '@assets/images/portfolio/beard-sculpt.webp';
import towelImage from '@assets/images/portfolio/hot-towel.webp';

const SERVICE_FALLBACK_IMAGES = [fadeImage, beardImage, towelImage];

const getServiceImage = (service, index) => {
  if (service.image) return service.image;
  const name = service.name?.toLowerCase() || '';
  if (name.includes('beard')) return beardImage;
  if (name.includes('towel') || name.includes('shave')) return towelImage;
  if (name.includes('fade') || name.includes('cut')) return fadeImage;
  return SERVICE_FALLBACK_IMAGES[index % SERVICE_FALLBACK_IMAGES.length];
};

const DEFAULT_SHOP = { currency_symbol: 'GH₵', home_visits_enabled: true, home_visit_fee: 0 };

function BookingWidget({ onBookingComplete }) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const [shop, setShop] = useState(DEFAULT_SHOP);

  const [barbers, setBarbers] = useState([]);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);
  const [barberId, setBarberId] = useState(null);

  const [services, setServices] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  const [dates, setDates] = useState([]);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const [slots, setSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);

  const [locationType, setLocationType] = useState('SHOP');
  const [homeAddress, setHomeAddress] = useState('');

  const [step, setStep] = useState('barber'); // 'barber' | 'service' | 'schedule'

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    document.body.style.overflow = isMobileSheetOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileSheetOpen]);

  // Load the real barber list + shop settings once
  useEffect(() => {
    let mounted = true;

    api.pub
      .getShopSettings()
      .then(({ shop }) => mounted && setShop({ ...DEFAULT_SHOP, ...shop }))
      .catch(() => {});

    setIsLoadingBarbers(true);
    api.pub
      .getBarbersPublic()
      .then(({ barbers }) => {
        if (!mounted) return;
        const activeBarbers = barbers || [];
        setBarbers(activeBarbers);
        // Skip the barber-picking step entirely when there is only one to choose from
        if (activeBarbers.length === 1) {
          setBarberId(activeBarbers[0].id);
          setStep('service');
        }
      })
      .catch(() => {})
      .finally(() => mounted && setIsLoadingBarbers(false));

    return () => {
      mounted = false;
    };
  }, []);

  // Load real services + availability for the selected barber
  useEffect(() => {
    if (!barberId) return;
    let mounted = true;

    setIsLoadingServices(true);
    api.pub
      .getBarberServicesPublic(barberId)
      .then(({ services }) => mounted && setServices(services || []))
      .catch(() => mounted && setServices([]))
      .finally(() => mounted && setIsLoadingServices(false));

    setIsLoadingDates(true);
    api.pub
      .getBarberAvailabilitiesPublic(barberId)
      .then(({ availabilities }) => mounted && setDates((availabilities || []).map((a) => a.date)))
      .catch(() => mounted && setDates([]))
      .finally(() => mounted && setIsLoadingDates(false));

    setSelectedServiceIds([]);
    setSelectedDate(null);
    setSelectedTime(null);

    return () => {
      mounted = false;
    };
  }, [barberId]);

  // Load real slots whenever barber, date, or the chosen services change
  useEffect(() => {
    if (!barberId || !selectedDate || selectedServiceIds.length === 0) {
      setSlots([]);
      return;
    }
    let mounted = true;
    setIsLoadingSlots(true);
    setSelectedTime(null);
    api.pub
      .getBarberSlotsPublic(barberId, { date: selectedDate, services: selectedServiceIds })
      .then(({ slots }) => mounted && setSlots(slots || []))
      .catch(() => mounted && setSlots([]))
      .finally(() => mounted && setIsLoadingSlots(false));

    return () => {
      mounted = false;
    };
  }, [barberId, selectedDate, selectedServiceIds]);

  const handleSelectBarber = (id) => {
    setBarberId(id);
    setStep('service');
  };

  const toggleService = (serviceId) => {
    const value = String(serviceId);
    setSelectedServiceIds((current) => (current.includes(value) ? current.filter((id) => id !== value) : [...current, value]));
  };

  const canGoBack = step === 'schedule' || (step === 'service' && barbers.length > 1);
  const handleBack = () => {
    if (step === 'schedule') setStep('service');
    else if (step === 'service') setStep('barber');
  };

  const formatPrice = (price) => `${shop.currency_symbol} ${Number(price || 0).toFixed(0)}`;

  const selectedServices = services.filter((s) => selectedServiceIds.includes(String(s.id)));
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);

  const addressReady = locationType !== 'HOME' || homeAddress.trim().length > 0;
  const scheduleReady = Boolean(selectedDate && selectedTime && addressReady);

  const handleConfirm = () => {
    if (!scheduleReady) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    onBookingComplete?.({
      barberId,
      serviceIds: selectedServiceIds,
      date: selectedDate,
      slot: selectedTime,
      locationType,
      homeAddress: locationType === 'HOME' ? homeAddress.trim() : '',
    });
  };

  const totalSteps = barbers.length > 1 ? 3 : 2;
  const stepPosition = { barber: 1, service: barbers.length > 1 ? 2 : 1, schedule: totalSteps }[step];

  return (
    <>
      {/* Mobile FAB */}
      <button className={styles.mobileFab} onClick={() => setIsMobileSheetOpen(true)} aria-label="Book Appointment">
        <Icon name="calendar" />
        <span>Book Appointment</span>
      </button>

      {isMobileSheetOpen && <div className={styles.sheetBackdrop} onClick={() => setIsMobileSheetOpen(false)} />}

      <div className={`${styles.bookingWidget} glass-panel ${isMobileSheetOpen ? styles.sheetOpen : ''}`}>
        <div className={styles.sheetHandle} onClick={() => setIsMobileSheetOpen(false)} />

        <div className={styles.widgetHeader}>
          {canGoBack ? (
            <button type="button" className={styles.backBtn} onClick={handleBack}>
              <Icon name="left" size="sm" /> Back
            </button>
          ) : (
            <span />
          )}
          <span className={styles.stepIndicator}>
            Step {stepPosition} of {totalSteps}
          </span>
        </div>

        {step === 'barber' && (
          <div className={styles.stepBody}>
            <h3 className={styles.stepTitle}>Choose your barber</h3>
            {isLoadingBarbers ? (
              <div className={styles.stepLoading}>
                <Spinner size="sm" />
              </div>
            ) : barbers.length === 0 ? (
              <p className={styles.stepEmpty}>No barbers are open for booking right now.</p>
            ) : (
              <div className={styles.barberGrid}>
                {barbers.map((barber) => (
                  <button
                    type="button"
                    key={barber.id}
                    className={styles.barberCard}
                    onClick={() => handleSelectBarber(barber.id)}
                  >
                    <ProfileImage src={barber.profile_image} size="5.4rem" />
                    <span>
                      <strong>{`${barber.name || ''} ${barber.surname || ''}`.trim() || 'Your barber'}</strong>
                      <small>★ {Number(barber.average_rating || 0).toFixed(1)}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'service' && (
          <div className={styles.stepBody}>
            <h3 className={styles.stepTitle}>Choose your service</h3>
            {isLoadingServices ? (
              <div className={styles.stepLoading}>
                <Spinner size="sm" />
              </div>
            ) : services.length === 0 ? (
              <p className={styles.stepEmpty}>This barber has no bookable services right now.</p>
            ) : (
              <div className={styles.serviceGridChoices}>
                {services.map((service, index) => {
                  const selected = selectedServiceIds.includes(String(service.id));
                  return (
                    <button
                      type="button"
                      key={service.id}
                      className={`${styles.serviceCardChoice} ${selected ? styles.selected : ''}`}
                      onClick={() => toggleService(service.id)}
                    >
                      <img src={getServiceImage(service, index)} alt="" />
                      <span>
                        <strong>{service.name}</strong>
                        <small>
                          {service.duration_minutes} min · {formatPrice(service.price)}
                        </small>
                      </span>
                      {selected && <Icon name="check" size="sm" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'schedule' && (
          <div className={styles.stepBody}>
            <h3 className={styles.stepTitle}>Pick a date & time</h3>
            <div className={styles.layout}>
              <div className={styles.calendarSection}>
                <Calendar dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} isLoading={isLoadingDates} />
              </div>
              <div className={styles.timeSection}>
                <TimeSlotGrid
                  selectedDate={selectedDate}
                  slots={slots}
                  selectedTime={selectedTime}
                  onSelectTime={setSelectedTime}
                  isLoading={isLoadingSlots}
                />
              </div>
            </div>

            {shop.home_visits_enabled && (
              <div className={styles.locationToggle}>
                <button
                  type="button"
                  className={locationType === 'SHOP' ? styles.selected : ''}
                  onClick={() => setLocationType('SHOP')}
                >
                  <Icon name="barber" size="sm" /> At the shop
                </button>
                <button
                  type="button"
                  className={locationType === 'HOME' ? styles.selected : ''}
                  onClick={() => setLocationType('HOME')}
                >
                  <Icon name="client" size="sm" /> Home visit (+{formatPrice(shop.home_visit_fee)})
                </button>
              </div>
            )}

            {locationType === 'HOME' && (
              <label className={styles.addressField}>
                Service address
                <input
                  type="text"
                  value={homeAddress}
                  maxLength={255}
                  placeholder="Area and a clear landmark"
                  onChange={(e) => setHomeAddress(e.target.value)}
                />
              </label>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.selectionSummary}>
            {step === 'barber' && <p className={styles.hint}>Tap a barber to continue.</p>}
            {step === 'service' &&
              (selectedServices.length > 0 ? (
                <p>
                  <span className="text-gradient-gold">{selectedServices.length}</span> service
                  {selectedServices.length > 1 ? 's' : ''} selected · {formatPrice(totalPrice)}
                </p>
              ) : (
                <p className={styles.hint}>Select one or more services to continue.</p>
              ))}
            {step === 'schedule' &&
              (selectedDate && selectedTime ? (
                <p>
                  Selected: <span className="text-gradient-gold">{selectedDate}</span> at{' '}
                  <span className="text-gradient-gold">{selectedTime}</span>
                </p>
              ) : (
                <p className={styles.hint}>Select a date and time to continue.</p>
              ))}
          </div>

          {step === 'service' && (
            <Button
              color="gold"
              disabled={selectedServiceIds.length === 0}
              onClick={() => setStep('schedule')}
              className={styles.confirmBtn}
            >
              Continue
            </Button>
          )}
          {step === 'schedule' && (
            <Button color="gold" disabled={!scheduleReady} onClick={handleConfirm} className={styles.confirmBtn}>
              Continue — verify your phone
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export default BookingWidget;
