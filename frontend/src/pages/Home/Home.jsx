import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import api from '@api';
import styles from './Home.module.scss';

import BookingWidget from '@components/ui/BookingWidget/BookingWidget';

import heroImage from '@assets/images/portfolio/hero-barbershop.webp';
import fadeImage from '@assets/images/portfolio/skin-fade.webp';
import beardImage from '@assets/images/portfolio/beard-sculpt.webp';
import towelImage from '@assets/images/portfolio/hot-towel.webp';

const DEFAULT_SHOP = {
  name: 'BarberManager',
  tagline: 'Precision cuts. Effortless booking.',
  announcement_enabled: false,
  announcement_text: '',
  description: 'A modern barbershop built around craft, comfort, and dependable service.',
  currency_code: 'GHS',
  currency_symbol: 'GH₵',
};

const FALLBACK_PORTFOLIO = [
  { id: 'fade', image: fadeImage },
  { id: 'beard', image: beardImage },
  { id: 'towel', image: towelImage },
];

const FALLBACK_SERVICES = [
  {
    id: 'service-fade',
    name: 'Signature fade',
    description: 'Consultation, tailored fade, line-up, and styled finish.',
    image: fadeImage,
    duration_minutes: 60,
    price: 120,
  },
  {
    id: 'service-beard',
    name: 'Beard sculpt',
    description: 'Precision shaping, clean detailing, and conditioning.',
    image: beardImage,
    duration_minutes: 30,
    price: 80,
  },
  {
    id: 'service-ritual',
    name: 'Cut & hot towel ritual',
    description: 'A complete cut followed by a refined hot towel finish.',
    image: towelImage,
    duration_minutes: 75,
    price: 180,
  },
];

const getServiceImage = (service, index) => {
  if (service.image) return service.image;
  const name = service.name?.toLowerCase() || '';
  if (name.includes('beard')) return beardImage;
  if (name.includes('towel') || name.includes('shave')) return towelImage;
  if (name.includes('fade') || name.includes('cut')) return fadeImage;
  return FALLBACK_PORTFOLIO[index % FALLBACK_PORTFOLIO.length].image;
};

const LOGIN_PATH = '/login?next=%2Fclient%2Fdashboard';

function Home() {
  const { isAuthenticated, isLoggingOut } = useAuth();
  const navigate = useNavigate();
  const [shop, setShop] = useState(DEFAULT_SHOP);
  const [services, setServices] = useState(FALLBACK_SERVICES);

  useEffect(() => {
    if (!isLoggingOut && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, isLoggingOut, navigate]);

  const hydrateLanding = useCallback(async () => {
    const [shopResult, barberResult] = await Promise.allSettled([api.pub.getShopSettings(), api.pub.getBarbersPublic()]);

    if (shopResult.status === 'fulfilled') setShop({ ...DEFAULT_SHOP, ...shopResult.value.shop });
    if (barberResult.status === 'fulfilled') {
      const activeBarbers = barberResult.value.barbers || [];
      const serviceResults = await Promise.allSettled(
        activeBarbers.slice(0, 8).map((barber) => api.pub.getBarberServicesPublic(barber.id)),
      );
      const serviceMap = new Map();
      serviceResults.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        (result.value.services || []).forEach((service) => {
          const key = service.name.trim().toLowerCase();
          const current = serviceMap.get(key);
          if (!current || Number(service.price) < Number(current.price)) serviceMap.set(key, service);
        });
      });
      if (serviceMap.size) setServices(Array.from(serviceMap.values()).slice(0, 6));
    }
  }, []);

  useEffect(() => {
    hydrateLanding();
  }, [hydrateLanding]);

  const formatPrice = (price) => `${shop.currency_symbol || shop.currency_code} ${Number(price || 0).toFixed(0)}`;

  const handleBookingComplete = (bookingDetails) => {
    // Generate a redirect URL with the selected date and time to maintain context after login
    const dateStr = bookingDetails.date.toISOString().split('T')[0];
    const timeStr = bookingDetails.time;
    const nextPath = encodeURIComponent(`/client/appointments?book=1&date=${dateStr}&time=${timeStr}`);
    navigate(`/login?next=${nextPath}`);
  };

  if (isLoggingOut || isAuthenticated) return null;

  return (
    <div className={styles.home}>
      {shop.announcement_enabled && shop.announcement_text && (
        <aside className={styles.promoBanner} aria-label="Current promotion">
          <span>{shop.announcement_text}</span>
        </aside>
      )}
      <section className={styles.hero}>
        <img className={styles.heroImage} src={heroImage} alt="Barber finishing a precision fade" />
        <div className={styles.heroShade} />

        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Accra-ready booking · phone-secure account</span>
          <p className={styles.kicker}>{shop.tagline}</p>
          <h1>
            Look sharp.
            <br />
            <span className="text-gradient-gold">Feel unmistakable.</span>
          </h1>
          <p className={styles.heroCopy}>
            Choose your time in one clear flow. Your booking stays connected to your phone and easy to manage.
          </p>

          <p className={styles.returningPrompt}>
            Already booked before? <a href={LOGIN_PATH}>Sign in to your account</a>
          </p>

          <div className={styles.bookingWidgetWrapper}>
            <BookingWidget onBookingComplete={handleBookingComplete} />
          </div>
        </div>
      </section>

      <main>
        <section id="services" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>The service menu</span>
              <h2>Know what you are booking.</h2>
            </div>
            <p>Clear timing and starting prices help you choose the right service before you reach the chair.</p>
          </div>

          <div className={styles.serviceGrid}>
            {services.map((service, index) => (
              <article className={styles.serviceCard} key={service.id}>
                <div className={styles.serviceImageWrap}>
                  <img
                    className={styles.serviceImage}
                    src={getServiceImage(service, index)}
                    alt={`${service.name} service`}
                    loading={index > 2 ? 'lazy' : 'eager'}
                  />
                </div>
                <div className={styles.serviceContent}>
                  <div className={styles.serviceMeta}>
                    <span>{service.duration_minutes} min</span>
                    <strong>From {formatPrice(service.price)}</strong>
                  </div>
                  <h3>{service.name}</h3>
                  <p>{service.description || 'A considered service tailored to your preferred finish.'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
