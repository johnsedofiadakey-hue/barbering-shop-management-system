import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useForm } from '@hooks/useForm';
import styles from './ClientAppointments.module.scss';
import api from '@api';
import { formatBookingDate, formatTime, formatTimeRange } from '@utils/dateTime';
import { getClientStatusLabel } from '@utils/status';

import Input from '@components/common/Input/Input';
import Modal from '@components/common/Modal/Modal';
import Icon from '@components/common/Icon/Icon';
import Tag from '@components/common/Tag/Tag';
import Button from '@components/common/Button/Button';
import Spinner from '@components/common/Spinner/Spinner';
import Profile from '@components/ui/Profile/Profile';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';

import fadeImage from '@assets/images/portfolio/skin-fade.webp';
import beardImage from '@assets/images/portfolio/beard-sculpt.webp';
import towelImage from '@assets/images/portfolio/hot-towel.webp';

const SERVICE_FALLBACK_IMAGES = [fadeImage, beardImage, towelImage];

const getServiceFallbackImage = (service, index) => {
  const name = service.name?.toLowerCase() || '';
  if (name.includes('beard')) return beardImage;
  if (name.includes('towel') || name.includes('shave')) return towelImage;
  if (name.includes('fade') || name.includes('cut')) return fadeImage;
  return SERVICE_FALLBACK_IMAGES[index % SERVICE_FALLBACK_IMAGES.length];
};

const formatDate = (value, options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) =>
  value ? new Intl.DateTimeFormat('en-GH', options).format(new Date(`${value}T12:00:00`)) : '';

function ClientAppointments() {
  const { profile } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  // Parse booking prefill params from query (set by the homepage booking widget, or a barber "Book" shortcut)
  const queryParams = new URLSearchParams(location.search);
  const preselectBarberId = queryParams.get('bookBarber');
  const directBooking = queryParams.get('book') === '1';
  const prefillServices = queryParams.get('bookServices');
  const prefillDate = queryParams.get('bookDate');
  const prefillSlot = queryParams.get('bookSlot');
  const prefillLocation = queryParams.get('bookLocation');
  const prefillAddress = queryParams.get('bookAddress');
  const prefillPayment = queryParams.get('bookPayment');
  const isFullyPrefilled = Boolean(preselectBarberId && prefillServices && prefillDate && prefillSlot);
  const paymentCallback = queryParams.get('payment') === 'callback';

  const [appointments, setAppointments] = useState([]);

  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isLoadingBarberProfiles, setIsLoadingBarberProfiles] = useState(true);
  const [paymentBanner, setPaymentBanner] = useState(paymentCallback);

  const [barbers, setBarbers] = useState({}); // barberId -> profile
  const [shop, setShop] = useState({
    currency_symbol: 'GH₵',
    home_visits_enabled: true,
    home_visit_fee: 0,
    payments_enabled: false,
    booking_deposit_percent: 20,
  });

  // Popup states
  const [bookPopup, setBookPopup] = useState(Boolean(preselectBarberId || directBooking));
  const [bookStepIndex, setBookStepIndex] = useState(isFullyPrefilled ? 2 : 0);
  const [cancelPopup, setCancelPopup] = useState({ open: false, appointment: null });
  const [reschedulePopup, setReschedulePopup] = useState({ open: false, appointment: null });

  // Preselected fields state from parameters (homepage widget hands off a full selection; a
  // barber-only shortcut like "Book again" only preselects the barber)
  const [bookFields, setBookFields] = useState({
    barber_id: preselectBarberId || '',
    services: prefillServices ? prefillServices.split(',').filter(Boolean) : [],
    date: prefillDate || '',
    slot: prefillSlot || '',
    location_type: prefillLocation || 'SHOP',
    home_address: prefillAddress || '',
    payment_choice: prefillPayment || 'NONE',
    notes: '',
  });

  /**
   * Defines fetching all appointmentts from api (single responsibility, outside effect)
   */
  const fetchAppointments = useCallback(async () => {
    setIsLoadingAppointments(true);

    try {
      const result = await api.client.getClientAppointments();
      setAppointments(result.appointments || []);
    } finally {
      setIsLoadingAppointments(false);
    }
  }, []);

  /**
   * Defines fetching all barber profiles needed (only unique barber IDs)
   */
  const fetchBarberProfiles = useCallback(async (appointments) => {
    setIsLoadingBarberProfiles(true);

    try {
      // Gets all unique barber IDs from appointments
      const barberIds = [...new Set(appointments.map((a) => a.barber_id))];

      // fetches all barber profiles in parallel
      const entries = await Promise.all(
        barberIds.map(async (id) => {
          try {
            const { profile } = await api.pub.getBarberProfilePublic(id);
            return [id, profile];
          } catch {
            return [id, null];
          }
        }),
      );

      setBarbers((prev) => ({ ...prev, ...Object.fromEntries(entries) })); // assembles into { [id]: profile }
    } finally {
      setIsLoadingBarberProfiles(false);
    }
  }, []);

  /**
   * Only fetch if profile is loaded AND user is client
   */
  useEffect(() => {
    if (profile?.role === 'CLIENT') {
      fetchAppointments();
      api.pub
        .getShopSettings()
        .then(({ shop }) => setShop(shop))
        .catch(() => {});
    }
  }, [profile, fetchAppointments]);

  /**
   * When appointments change, fetch needed barber profiles
   */
  useEffect(() => {
    if (appointments.length > 0) {
      fetchBarberProfiles(appointments);
    }
  }, [appointments, fetchBarberProfiles]);

  /**
   * Returning from Paystack: the webhook that marks payment PAID can land a few seconds
   * after this redirect, so show a "confirming" banner and give it one extra refresh.
   */
  useEffect(() => {
    if (!paymentCallback) return;

    const params = new URLSearchParams(location.search);
    params.delete('payment');
    navigate({ search: params.toString() }, { replace: true });

    const timer = setTimeout(() => {
      fetchAppointments();
      setPaymentBanner(false);
    }, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentCallback]);

  /**
   *  If query param is present and modal isn't open, open it and preselect barber
   */
  useEffect(() => {
    if (!preselectBarberId && !directBooking) return;

    // Open and preselect the barber (ok even if already open). A fully-prefilled selection
    // (from the homepage widget) skips straight to the confirm step instead of redoing the wizard.
    openBookPopup();
    if (preselectBarberId) {
      setBookFields((fields) => ({
        ...fields,
        barber_id: preselectBarberId,
        services: prefillServices ? prefillServices.split(',').filter(Boolean) : fields.services,
        date: prefillDate || fields.date,
        slot: prefillSlot || fields.slot,
        location_type: prefillLocation || fields.location_type,
        home_address: prefillAddress || fields.home_address,
        payment_choice: prefillPayment || fields.payment_choice,
      }));
      setBookStepIndex(isFullyPrefilled ? 2 : 0);
    }

    // Remove the params immediately so closing won't reopen the modal
    const params = new URLSearchParams(location.search);
    ['bookBarber', 'book', 'bookServices', 'bookDate', 'bookSlot', 'bookLocation', 'bookAddress', 'bookPayment'].forEach((key) =>
      params.delete(key),
    );
    navigate({ search: params.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectBarberId, directBooking, location.search, navigate]);

  // Book appointment popup state handlers
  const openBookPopup = () => {
    setBookStepIndex(0);
    setBookPopup(true);
  };
  const openRebookPopup = (appointment) => {
    setBookFields({
      barber_id: String(appointment.barber_id || ''),
      services: [],
      date: '',
      slot: '',
      location_type: appointment.location_type || 'SHOP',
      home_address: appointment.home_address || '',
      payment_choice: 'NONE',
      notes: '',
    });
    setBookStepIndex(0);
    setBookPopup(true);
  };
  const closeBookPopup = () => {
    setBookPopup(false);
    setBookStepIndex(0);
    setBookFields({
      barber_id: '',
      services: [],
      date: '',
      slot: '',
      location_type: 'SHOP',
      home_address: '',
      payment_choice: 'NONE',
      notes: '',
    });
  };

  // Cancel apointment popup state handlers
  const openCancelPopup = (appointment) => setCancelPopup({ open: true, appointment });
  const closeCancelPopup = () => setCancelPopup({ open: false, appointment: null });
  const openReschedulePopup = (appointment) => setReschedulePopup({ open: true, appointment });
  const closeReschedulePopup = () => setReschedulePopup({ open: false, appointment: null });

  /**
   * Handles booking appointmentss
   */
  const handleBookAppointment = async ({
    barber_id,
    services,
    date,
    slot,
    location_type,
    home_address,
    payment_choice,
    notes,
  }) => {
    const result = await api.client.createClientAppointment(barber_id, {
      services,
      date,
      slot,
      location_type,
      home_address,
      payment_choice,
      notes,
    });

    if (payment_choice && payment_choice !== 'NONE' && result.appointment_id) {
      const { authorization_url } = await api.client.payClientAppointment(result.appointment_id);
      window.location.href = authorization_url; // Full-page redirect to Paystack's hosted checkout
      return;
    }

    closeBookPopup();
    await fetchAppointments();
  };

  const handlePayNow = async (appointmentId) => {
    const { authorization_url } = await api.client.payClientAppointment(appointmentId);
    window.location.href = authorization_url;
  };

  const handleRescheduleAppointment = async (appointmentId, { date, slot }) => {
    await api.client.rescheduleClientAppointment(appointmentId, { date, slot });
    closeReschedulePopup();
    await fetchAppointments();
  };

  /**
   * Handles canceling the selected appointment
   */
  const handleCancelAppointment = async (appointmentId) => {
    await api.client.cancelClientAppointment(appointmentId);
    closeCancelPopup();
    await fetchAppointments();
  };

  /**
   * Function that fetches and returns all barbers from the API (useCallback to fix endless loop)
   */
  const fetchBarbers = useCallback(async () => {
    const { barbers } = await api.pub.getBarbersPublic();
    return barbers;
  }, []);

  /**
   * Function that fetches and returns all services of the selected barber from the API (useCallback to fix endless loop)
   */
  const fetchServices = useCallback(async (barberId) => {
    if (!barberId) return [];

    const { services } = await api.pub.getBarberServicesPublic(barberId);
    return services;
  }, []);

  const VisualBarberServiceSelect = () => {
    const { fields, handleChange } = useForm();
    const [availableBarbers, setAvailableBarbers] = useState([]);
    const [availableServices, setAvailableServices] = useState([]);
    const [loadingChoices, setLoadingChoices] = useState(true);

    useEffect(() => {
      let mounted = true;
      setLoadingChoices(true);
      fetchBarbers()
        .then((items) => mounted && setAvailableBarbers(items || []))
        .finally(() => mounted && setLoadingChoices(false));
      return () => {
        mounted = false;
      };
    }, []);

    useEffect(() => {
      let mounted = true;
      if (!fields.barber_id) {
        setAvailableServices([]);
        return () => {
          mounted = false;
        };
      }
      fetchServices(fields.barber_id).then((items) => mounted && setAvailableServices(items || []));
      return () => {
        mounted = false;
      };
    }, [fields.barber_id]);

    const chooseBarber = (barberId) => {
      handleChange({ target: { name: 'barber_id', value: String(barberId) } });
      handleChange({ target: { name: 'services', value: [] } });
      handleChange({ target: { name: 'date', value: '' } });
      handleChange({ target: { name: 'slot', value: '' } });
    };

    const toggleService = (serviceId) => {
      const value = String(serviceId);
      const selected = fields.services || [];
      handleChange({
        target: {
          name: 'services',
          value: selected.includes(value) ? selected.filter((id) => id !== value) : [...selected, value],
        },
      });
      handleChange({ target: { name: 'slot', value: '' } });
    };

    if (loadingChoices) return <Spinner />;

    return (
      <div className={styles.visualChoices}>
        <div className={styles.choiceSection}>
          <div className={styles.choiceHeading}>
            <span>1</span>
            <div>
              <strong>Choose your barber</strong>
              <small>Tap a face to select</small>
            </div>
          </div>
          <div className={styles.barberChoiceGrid}>
            {availableBarbers.map((barber) => {
              const selected = String(fields.barber_id) === String(barber.id);
              return (
                <button
                  className={`${styles.barberChoice} ${selected ? styles.selectedChoice : ''}`}
                  type="button"
                  key={barber.id}
                  onClick={() => chooseBarber(barber.id)}
                  aria-pressed={selected}
                >
                  <ProfileImage src={barber.profile_image} size="6.2rem" />
                  <span>
                    <strong>{`${barber.name || ''} ${barber.surname || ''}`.trim() || 'Your barber'}</strong>
                    <small>★ {Number(barber.average_rating || 0).toFixed(1)}</small>
                  </span>
                  {selected && <Icon name="check" size="sm" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.choiceSection}>
          <div className={styles.choiceHeading}>
            <span>2</span>
            <div>
              <strong>Choose your look</strong>
              <small>{fields.barber_id ? 'Select one or more services' : 'Choose a barber first'}</small>
            </div>
          </div>
          {fields.barber_id && (
            <div className={styles.serviceChoiceGrid}>
              {availableServices.map((service, index) => {
                const selected = (fields.services || []).includes(String(service.id));
                const serviceImage = service.image || getServiceFallbackImage(service, index);
                return (
                  <button
                    className={`${styles.serviceChoice} ${selected ? styles.selectedChoice : ''}`}
                    type="button"
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    aria-pressed={selected}
                  >
                    <div className={styles.serviceChoiceMedia}>
                      <img src={serviceImage} alt="" />
                    </div>
                    <div className={styles.serviceChoiceCopy}>
                      <strong>{service.name}</strong>
                      <p>{service.description || 'A tailored cut finished to your preference.'}</p>
                      <span>
                        {service.duration_minutes} min · {shop.currency_symbol} {Number(service.price).toFixed(0)}
                      </span>
                    </div>
                    {selected && <Icon name="check" size="sm" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Date and slot selection component to render the dropdown input of dates and slots to be selected
   */
  const DateSlotSelect = () => {
    const { fields } = useForm();

    /**
     * Function that fetches all availabilities dates of the selected barber from the API (useCallback to fix endless loop)
     */
    const fetchAvailabilities = useCallback(async (barberId) => {
      if (!barberId) return [];

      const { availabilities } = await api.pub.getBarberAvailabilitiesPublic(barberId);
      return availabilities;
    }, []);

    /**
     * Function that fetches all slots of the selected availability date from the API (useCallback to fix endless loop)
     */
    const fetchSlots = useCallback(async (barberId, date, services) => {
      if (!barberId || !date) return [];
      const { slots } = await api.pub.getBarberSlotsPublic(barberId, { date, services });

      return slots;
    }, []);

    // If no barber is selected render error
    if (!fields.barber_id) return <div>Please select a barber first.</div>;

    return (
      <>
        <Input
          type="dropdown"
          size="md"
          name="date"
          label="Date"
          fetcher={() => fetchAvailabilities(fields.barber_id)}
          mapOption={(availability) => ({ key: availability.date, value: formatBookingDate(availability.date) })}
          required //
        />

        <Input
          type="dropdown"
          size="md"
          name="slot"
          label="Time"
          fetcher={() => fetchSlots(fields.barber_id, fields.date, fields.services)}
          reloadKey={`${fields.barber_id}-${fields.date}-${(fields.services || []).join(',')}`}
          mapOption={(slot) => ({ key: slot, value: formatTime(slot) })}
          disabled={!fields.date}
          required //
        />
      </>
    );
  };

  const ScheduleLocationSelect = () => {
    const { fields, handleChange } = useForm();
    const [dates, setDates] = useState([]);
    const [slots, setSlots] = useState([]);
    const [loadingSchedule, setLoadingSchedule] = useState(true);

    useEffect(() => {
      let mounted = true;
      setLoadingSchedule(true);
      api.pub
        .getBarberAvailabilitiesPublic(fields.barber_id)
        .then(({ availabilities }) => mounted && setDates(availabilities || []))
        .finally(() => mounted && setLoadingSchedule(false));
      return () => {
        mounted = false;
      };
    }, [fields.barber_id]);

    useEffect(() => {
      let mounted = true;
      if (!fields.date) {
        setSlots([]);
        return () => {
          mounted = false;
        };
      }
      api.pub
        .getBarberSlotsPublic(fields.barber_id, { date: fields.date, services: fields.services })
        .then(({ slots }) => mounted && setSlots(slots || []));
      return () => {
        mounted = false;
      };
    }, [fields.barber_id, fields.date, fields.services]);

    const chooseValue = (name, value) => handleChange({ target: { name, value } });

    return (
      <div className={styles.scheduleChoices}>
        <div className={styles.choiceSection}>
          <div className={styles.choiceHeading}>
            <span>1</span>
            <div>
              <strong>Pick a date</strong>
              <small>Only available days are shown</small>
            </div>
          </div>
          {loadingSchedule ? (
            <Spinner />
          ) : (
            <div className={styles.dateChips}>
              {dates.map((availability) => (
                <button
                  type="button"
                  key={availability.date}
                  className={fields.date === availability.date ? styles.selectedChoice : ''}
                  onClick={() => {
                    chooseValue('date', availability.date);
                    chooseValue('slot', '');
                  }}
                >
                  {formatBookingDate(availability.date)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.choiceSection}>
          <div className={styles.choiceHeading}>
            <span>2</span>
            <div>
              <strong>Pick a time</strong>
              <small>Displayed in AM/PM</small>
            </div>
          </div>
          <div className={styles.timeChips}>
            {fields.date && slots.length === 0 && <p>No time is available for this service combination.</p>}
            {slots.map((slot) => (
              <button
                type="button"
                key={slot}
                className={fields.slot === slot ? styles.selectedChoice : ''}
                onClick={() => chooseValue('slot', slot)}
              >
                {formatTime(slot)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.choiceSection}>
          <div className={styles.choiceHeading}>
            <span>3</span>
            <div>
              <strong>Where?</strong>
              <small>Choose the shop or an available home visit</small>
            </div>
          </div>
          <div className={styles.locationChoices}>
            <button
              type="button"
              className={fields.location_type === 'SHOP' ? styles.selectedChoice : ''}
              onClick={() => chooseValue('location_type', 'SHOP')}
            >
              <Icon name="barber" size="md" />
              <span>
                <strong>At the shop</strong>
                <small>No travel fee</small>
              </span>
            </button>
            {shop.home_visits_enabled && (
              <button
                type="button"
                className={fields.location_type === 'HOME' ? styles.selectedChoice : ''}
                onClick={() => chooseValue('location_type', 'HOME')}
              >
                <Icon name="client" size="md" />
                <span>
                  <strong>Home visit</strong>
                  <small>
                    +{shop.currency_symbol} {shop.home_visit_fee}
                  </small>
                </span>
              </button>
            )}
          </div>
        </div>
        {fields.location_type === 'HOME' && (
          <Input
            name="home_address"
            label="Service address"
            type="text"
            maxLength={255}
            required
            helperText="Include your area and a clear landmark."
          />
        )}

        {shop.payments_enabled && (
          <div className={styles.choiceSection}>
            <div className={styles.choiceHeading}>
              <span>4</span>
              <div>
                <strong>Secure your booking</strong>
                <small>An unpaid hold is released after a while so someone else can take the slot</small>
              </div>
            </div>
            <div className={styles.paymentChoices}>
              <button
                type="button"
                className={fields.payment_choice === 'NONE' ? styles.selectedChoice : ''}
                onClick={() => chooseValue('payment_choice', 'NONE')}
              >
                <strong>No payment</strong>
                <small>Pay at the shop</small>
              </button>
              <button
                type="button"
                className={fields.payment_choice === 'DEPOSIT' ? styles.selectedChoice : ''}
                onClick={() => chooseValue('payment_choice', 'DEPOSIT')}
              >
                <strong>{shop.booking_deposit_percent}% deposit</strong>
                <small>Pay online now</small>
              </button>
              <button
                type="button"
                className={fields.payment_choice === 'FULL' ? styles.selectedChoice : ''}
                onClick={() => chooseValue('payment_choice', 'FULL')}
              >
                <strong>Pay in full</strong>
                <small>Pay online now</small>
              </button>
            </div>
          </div>
        )}

        <Input
          name="notes"
          label="Notes for your barber"
          type="text"
          maxLength={500}
          helperText="Optional: access details or haircut preferences."
        />
      </div>
    );
  };

  /**
   * Confirmation step component to display current selection prior to submission
   */
  function ConfirmationStep() {
    const { fields } = useForm();

    const [barbers, setBarbers] = useState([]);
    const [services, setServices] = useState([]);
    const [loadingBarbers, setLoadingBarbers] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    /**
     * Function that fetches all barbers from API
     */
    const loadBarbers = useCallback(async () => {
      setLoadingBarbers(true);

      try {
        const result = await fetchBarbers();
        setBarbers(result || []);
      } finally {
        setLoadingBarbers(false);
      }
    }, []);

    /**
     * Function that fetches all services for the selected barber from API
     */
    const loadServices = useCallback(async (barberId) => {
      setLoadingServices(true);

      try {
        const result = await fetchServices(barberId);
        setServices(result || []);
      } finally {
        setLoadingServices(false);
      }
    }, []);

    /**
     * Fetches all barbers on mount
     */
    useEffect(() => {
      loadBarbers();
    }, [loadBarbers]);

    /**
     * Fetches all selected barber's offered services on mount
     */
    useEffect(() => {
      loadServices(fields.barber_id);
    }, [loadServices, fields.barber_id]);

    // Find selected barber and services
    const selectedBarber = barbers.find((barber) => String(barber.id) === String(fields.barber_id));
    const selectedServices = services.filter((service) => fields.services?.includes(String(service.id)));
    const totalDue =
      selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0) +
      (fields.location_type === 'HOME' ? Number(shop.home_visit_fee || 0) : 0);

    return (
      <div className={styles.confirmation}>
        <div className={styles.confirmRow}>
          <div className={styles.confirmBlock}>
            <Icon name="barber" size="ty" />
            <span className={styles.confirmLabel}>Barber:</span>
          </div>
          <div className={styles.confirmContent}>
            <div className={styles.confirmValue}>
              {loadingBarbers ? (
                <Spinner size="sm" />
              ) : selectedBarber ? (
                `${selectedBarber.name || ''} ${selectedBarber.surname || ''}`.trim() || 'Your barber'
              ) : fields.barber_id ? (
                fields.barber_id
              ) : (
                '-'
              )}
            </div>
          </div>
        </div>

        <div className={styles.confirmRow}>
          <div className={styles.confirmBlock}>
            <Icon name="service" size="ty" />
            <span className={styles.confirmLabel}>Services:</span>
          </div>
          <div className={styles.confirmContent}>
            <div className={styles.confirmValue}>
              {loadingServices ? (
                <Spinner size="sm" />
              ) : selectedServices.length ? (
                selectedServices.map((s) => s.name).join(', ')
              ) : fields.services?.length ? (
                fields.services.join(', ')
              ) : (
                '-'
              )}
            </div>
          </div>
        </div>

        <div className={styles.confirmRow}>
          <div className={styles.confirmBlock}>
            <Icon name="calendar" size="ty" />
            <span className={styles.confirmLabel}>Date:</span>
          </div>
          <div className={styles.confirmContent}>
            <div className={styles.confirmValue}>
              {formatBookingDate(fields.date, { weekday: 'long', month: 'long', day: 'numeric' }) || '-'}
            </div>
          </div>
        </div>

        <div className={styles.confirmRow}>
          <div className={styles.confirmBlock}>
            <Icon name="availability" size="ty" />
            <span className={styles.confirmLabel}>Slot:</span>
          </div>
          <div className={styles.confirmContent}>
            <div className={styles.confirmValue}>{formatTime(fields.slot) || '-'}</div>
          </div>
        </div>

        <div className={styles.confirmRow}>
          <div className={styles.confirmBlock}>
            <Icon name="client" size="ty" />
            <span className={styles.confirmLabel}>Location:</span>
          </div>
          <div className={styles.confirmContent}>
            <div className={styles.confirmValue}>
              {fields.location_type === 'HOME' ? fields.home_address || 'Home visit' : 'Barbershop'}
            </div>
          </div>
        </div>

        {fields.payment_choice && fields.payment_choice !== 'NONE' && (
          <div className={styles.confirmRow}>
            <div className={styles.confirmBlock}>
              <Icon name="revenue" size="ty" />
              <span className={styles.confirmLabel}>Payment:</span>
            </div>
            <div className={styles.confirmContent}>
              <div className={styles.confirmValue}>
                {fields.payment_choice === 'FULL' ? (
                  <>
                    Pay in full — {shop.currency_symbol}
                    {totalDue.toFixed(0)} now
                  </>
                ) : (
                  <>
                    {shop.booking_deposit_percent}% deposit — {shop.currency_symbol}
                    {(totalDue * (shop.booking_deposit_percent / 100)).toFixed(0)} now
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  // Only render UI for clients otherwise render nothing
  if (!profile || profile.role !== 'CLIENT') return null;

  return (
    <>
      <div className={styles.appointmentsPage}>
        {paymentBanner && (
          <div className={styles.paymentBanner}>
            <Icon name="check" size="sm" />
            <span>Payment received — confirming your booking. This can take a few seconds.</span>
          </div>
        )}
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Your schedule</span>
            <h1>Appointments</h1>
            <p>Book again, reschedule or cancel from one place.</p>
          </div>
          <div className={styles.headerActions}>
            <Button
              className={styles.refreshBtn}
              type="button"
              color="primary"
              size="md"
              onClick={fetchAppointments}
              disabled={isLoadingAppointments}
              aria-label="Refresh appointments"
            >
              {isLoadingAppointments ? <Spinner size="sm" /> : <Icon name="refresh" size="sm" />}
              <span>Refresh</span>
            </Button>
            <Button className={styles.actionBtn} type="button" color="gold" size="md" onClick={openBookPopup}>
              <Icon name="plus" size="sm" />
              <span>New booking</span>
            </Button>
          </div>
        </header>

        {isLoadingAppointments && appointments.length === 0 ? (
          <div className={styles.loadingState}>
            <Spinner />
            <span>Loading your appointments…</span>
          </div>
        ) : appointments.length === 0 ? (
          <section className={styles.emptyState}>
            <span className={styles.emptyIcon}>
              <Icon name="calendar" size="lg" />
            </span>
            <h2>No appointments yet</h2>
            <p>Your first booking takes only a few taps.</p>
            <Button type="button" color="gold" size="lg" onClick={openBookPopup}>
              Book your first visit
            </Button>
          </section>
        ) : (
          <section className={styles.appointmentList} aria-label="Your appointments">
            {appointments.map((appointment) => {
              const isActive = ['ONGOING', 'IN_PROGRESS'].includes(appointment.status);
              return (
                <article className={`${styles.appointmentCard} ${isActive ? styles.activeAppointment : ''}`} key={appointment.id}>
                  <div className={styles.cardHeader}>
                    <Profile profile={barbers[appointment.barber_id]} loading={isLoadingBarberProfiles} />
                    <div className={styles.statusTags}>
                      {appointment.payment_status === 'PENDING' && (
                        <Tag className={styles.statusTag} color="yellow">
                          Payment pending
                        </Tag>
                      )}
                      <Tag
                        className={styles.statusTag}
                        color={appointment.status === 'COMPLETED' ? 'green' : isActive ? 'yellow' : 'red'}
                      >
                        {getClientStatusLabel(appointment.status, appointment.date)}
                      </Tag>
                    </div>
                  </div>

                  <div className={styles.scheduleBlock}>
                    <div className={styles.dateBadge}>
                      <strong>{new Date(`${appointment.date}T12:00:00`).getDate()}</strong>
                      <span>{formatDate(appointment.date, { month: 'short' })}</span>
                    </div>
                    <div>
                      <h2>{formatDate(appointment.date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                      <p>
                        {formatTimeRange(appointment.slot, appointment.end_time)} ·{' '}
                        {appointment.location_type === 'HOME' ? 'Home visit' : shop.name}
                      </p>
                    </div>
                  </div>

                  <div className={styles.appointmentMeta}>
                    <div>
                      <span>Service</span>
                      <strong>{appointment.services.map((service) => service.name).join(', ') || 'Barber appointment'}</strong>
                    </div>
                    <div>
                      <span>Total</span>
                      <strong>
                        {shop.currency_symbol} {Number(appointment.amount_spent).toFixed(0)}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    {appointment.payment_status === 'PENDING' && (
                      <Button type="button" size="md" color="gold" onClick={() => handlePayNow(appointment.id)}>
                        <Icon name="revenue" size="sm" />
                        Pay now
                      </Button>
                    )}
                    {appointment.can_modify ? (
                      <>
                        <Button type="button" size="md" color="goldoutline" onClick={() => openReschedulePopup(appointment)}>
                          <Icon name="pen" size="sm" />
                          Reschedule
                        </Button>
                        <Button type="button" size="md" color="translight" onClick={() => openCancelPopup(appointment)}>
                          <Icon name="trash" size="sm" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="md" color="goldoutline" onClick={() => openRebookPopup(appointment)}>
                        <Icon name="refresh" size="sm" />
                        Book again
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {/* Book Appointment Modal */}
      <Modal
        open={bookPopup}
        fields={bookFields}
        initialStepIndex={bookStepIndex}
        wide
        action={{ submit: 'Confirm booking', loading: 'Booking...' }}
        onSubmit={handleBookAppointment}
        onClose={closeBookPopup}
      >
        <Modal.Step
          validate={(fields) =>
            !fields.barber_id
              ? 'Choose a barber.'
              : !fields.services || fields.services.length === 0
                ? 'Choose at least one service.'
                : undefined
          }
        >
          <Modal.Title icon="scissors">Choose your look</Modal.Title>
          <Modal.Description>Pick a barber and the exact service you want from the visual menu.</Modal.Description>
          <VisualBarberServiceSelect />
        </Modal.Step>

        <Modal.Step
          validate={(fields) =>
            !fields.date || !fields.slot
              ? 'Choose an available date and time.'
              : fields.location_type === 'HOME' && !fields.home_address?.trim()
                ? 'Enter the address for your home visit.'
                : undefined
          }
        >
          <Modal.Title icon="calendar">When & where</Modal.Title>
          <Modal.Description>Choose a day, an AM/PM time, and your appointment location.</Modal.Description>
          <ScheduleLocationSelect />
        </Modal.Step>

        {/* Final confirmation */}
        <Modal.Step>
          <Modal.Title icon="check">Confirm</Modal.Title>
          <Modal.Description>
            <ConfirmationStep />
          </Modal.Description>
        </Modal.Step>
      </Modal>

      <Modal
        open={reschedulePopup.open}
        fields={{
          barber_id: reschedulePopup.appointment?.barber_id || '',
          date: '',
          slot: '',
        }}
        action={{ submit: 'Reschedule', loading: 'Rescheduling...' }}
        onValidate={(fields) => (!fields.date || !fields.slot ? 'Choose a new date and time.' : undefined)}
        onSubmit={(fields) => handleRescheduleAppointment(reschedulePopup.appointment?.id, fields)}
        onClose={closeReschedulePopup}
      >
        <Modal.Title icon="calendar">Reschedule Appointment</Modal.Title>
        <Modal.Description>Choose another available date and time with the same barber.</Modal.Description>
        <DateSlotSelect />
      </Modal>

      {/* Cancel Appointment Modal */}
      <Modal
        open={cancelPopup.open}
        action={{ submit: 'Cancel', loading: 'Canceling...' }}
        onSubmit={() => handleCancelAppointment(cancelPopup.appointment?.id)}
        onClose={closeCancelPopup}
      >
        <Modal.Title icon="warning">Cancel Appointment</Modal.Title>
        <Modal.Description>
          Are you sure you want to cancel your appointment at <strong>{cancelPopup.appointment?.date}</strong>? This action cannot
          be undone.
        </Modal.Description>
      </Modal>
    </>
  );
}

export default ClientAppointments;
