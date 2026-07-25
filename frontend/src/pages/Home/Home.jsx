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
  home_visits_enabled: true,
  home_visit_fee: 0,
  cancellation_notice_hours: 2,
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

  const handleBookingComplete = (booking) => {
    // Carry the full selection through login (and onboarding, if needed) so the client
    // lands straight on a pre-filled confirmation instead of redoing the booking wizard.
    const params = new URLSearchParams({
      book: '1',
      bookBarber: booking.barberId,
      bookServices: booking.serviceIds.join(','),
      bookDate: booking.date,
      bookSlot: booking.slot,
      bookLocation: booking.locationType,
      bookPayment: booking.paymentChoice || 'NONE',
    });
    if (booking.locationType === 'HOME' && booking.homeAddress) {
      params.set('bookAddress', booking.homeAddress);
    }
    const nextPath = encodeURIComponent(`/client/appointments?${params.toString()}`);
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

          <div id="book" className={styles.bookingWidgetWrapper}>
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

        <section id="signature-cuts" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Our work</span>
              <h2>Signature cuts, in the chair.</h2>
            </div>
            <p>The same finishes you can book above — a look at what the team delivers most.</p>
          </div>

          <div className={styles.lookbook}>
            <article className={`${styles.cutCard} ${styles.cutCardFeature}`}>
              <img src={fadeImage} alt="Signature fade finish" />
              <div className={styles.cutOverlay}>
                <div>
                  <span>Signature style</span>
                  <h3>Tailored fade</h3>
                  <p>Consultation, fade, and a sharp line-up.</p>
                </div>
              </div>
            </article>
            <article className={styles.cutCard}>
              <img src={beardImage} alt="Beard sculpt finish" />
              <div className={styles.cutOverlay}>
                <div>
                  <span>Detail work</span>
                  <h3>Beard sculpt</h3>
                </div>
              </div>
            </article>
            <article className={styles.cutCard}>
              <img src={towelImage} alt="Hot towel finish" />
              <div className={styles.cutOverlay}>
                <div>
                  <span>Finishing touch</span>
                  <h3>Hot towel ritual</h3>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="how-it-works" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>How it works</span>
              <h2>Three steps. No guesswork.</h2>
            </div>
            <p>Nothing here is a placeholder — every slot you pick below is live from the shop&rsquo;s real schedule.</p>
          </div>

          <div className={styles.steps}>
            <article>
              <span>1</span>
              <h3>Pick your barber & service</h3>
              <p>Choose from the team and the exact service you want, with prices and durations shown up front.</p>
            </article>
            <article>
              <span>2</span>
              <h3>Choose a real open slot</h3>
              <p>Every date and time shown is pulled from that barber&rsquo;s actual availability, not a mockup.</p>
            </article>
            <article>
              <span>3</span>
              <h3>Confirm with your phone</h3>
              <p>Verify with a one-time SMS code — no password to set or remember — and your slot is locked in.</p>
            </article>
          </div>
        </section>

        <section id="faq" className={styles.section}>
          <div className={styles.faqSection}>
            <div className={styles.faqHeading}>
              <span className={styles.eyebrow}>FAQ</span>
              <h2>Good to know</h2>
              <p>The short version of how booking, visits, and payment work.</p>
            </div>

            <div className={styles.faqList}>
              <details>
                <summary>Do I need a password?</summary>
                <p>No. Clients sign in with just a phone number and a one-time SMS code — nothing to remember or reset.</p>
              </details>
              <details>
                <summary>Can I cancel or reschedule?</summary>
                <p>
                  Yes, from your account, up until {shop.cancellation_notice_hours} hour
                  {shop.cancellation_notice_hours === 1 ? '' : 's'} before your appointment.
                </p>
              </details>
              {shop.home_visits_enabled && (
                <details>
                  <summary>Do you offer home visits?</summary>
                  <p>
                    Yes — choose &ldquo;Home visit&rdquo; when picking your appointment location, for a{' '}
                    {formatPrice(shop.home_visit_fee)} travel fee.
                  </p>
                </details>
              )}
              <details>
                <summary>How do I pay?</summary>
                <p>In person, at the end of your visit. No card details are needed to book.</p>
              </details>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
