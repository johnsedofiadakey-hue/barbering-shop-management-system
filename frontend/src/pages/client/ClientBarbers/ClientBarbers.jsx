import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useShopSettings } from '@hooks/useShopSettings';
import styles from './ClientBarbers.module.scss';
import api from '@api';

import Icon from '@components/common/Icon/Icon';
import Rating from '@components/ui/Rating/Rating';
import Button from '@components/common/Button/Button';
import Spinner from '@components/common/Spinner/Spinner';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';

function ClientBarbers() {
  const { profile } = useAuth();
  const shop = useShopSettings();
  const [barbers, setBarbers] = useState([]);
  const [servicesByBarber, setServicesByBarber] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchBarbers = useCallback(async () => {
    setIsLoading(true);

    try {
      const { barbers: result = [] } = await api.pub.getBarbersPublic();
      setBarbers(result);

      const serviceEntries = await Promise.all(
        result.map(async (barber) => {
          try {
            const { services = [] } = await api.pub.getBarberServicesPublic(barber.id);
            return [barber.id, services];
          } catch {
            return [barber.id, []];
          }
        }),
      );
      setServicesByBarber(Object.fromEntries(serviceEntries));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'CLIENT') fetchBarbers();
  }, [profile, fetchBarbers]);

  if (!profile || profile.role !== 'CLIENT') return null;

  return (
    <div className={styles.barberPage}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Your next appointment</span>
          <h1>Choose your barber</h1>
          <p>Pick your professional, then choose a service and an available time.</p>
        </div>
        <Button
          className={styles.refreshButton}
          type="button"
          color="primary"
          size="md"
          onClick={fetchBarbers}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : <Icon name="refresh" size="sm" />}
          <span>Refresh</span>
        </Button>
      </header>

      {isLoading && barbers.length === 0 ? (
        <div className={styles.loadingState}>
          <Spinner />
          <span>Finding available professionals…</span>
        </div>
      ) : barbers.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="barber" size="lg" />
          <h2>No barbers available yet</h2>
          <p>Please check again shortly.</p>
        </div>
      ) : (
        <section className={styles.barberGrid} aria-label="Available barbers">
          {barbers.map((barber) => {
            const services = servicesByBarber[barber.id] || [];
            const lowestPrice = services.length ? Math.min(...services.map((service) => Number(service.price))) : null;

            return (
              <article className={styles.barberCard} key={barber.id}>
                <div className={styles.cardTop}>
                  <ProfileImage src={barber.profile_image} />
                  <div className={styles.identity}>
                    <span className={styles.available}>Available to book</span>
                    <h2>{`${barber.name} ${barber.surname}`.trim() || barber.username}</h2>
                    <div className={styles.ratingLine}>
                      <Rating rating={barber.average_rating} />
                      <span>{barber.average_rating ? Number(barber.average_rating).toFixed(1) : 'New'}</span>
                    </div>
                  </div>
                </div>

                <p className={styles.description}>
                  {barber.description || 'Professional grooming with attention to every detail.'}
                </p>

                <div className={styles.servicePreview}>
                  <div>
                    <span>Services</span>
                    <strong>{services.length || '—'}</strong>
                  </div>
                  <div>
                    <span>Starting from</span>
                    <strong>{lowestPrice === null ? 'View menu' : `${shop.currency_symbol} ${lowestPrice.toFixed(0)}`}</strong>
                  </div>
                </div>

                {services.length > 0 && (
                  <div className={styles.serviceChips}>
                    {services.slice(0, 3).map((service) => (
                      <span key={service.id}>{service.name}</span>
                    ))}
                  </div>
                )}

                <Button
                  className={styles.bookButton}
                  href={`/client/appointments?bookBarber=${barber.id}`}
                  color="gold"
                  size="lg"
                  wide
                >
                  <Icon name="calendar" size="sm" />
                  Book with {barber.name || 'this barber'}
                </Button>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default ClientBarbers;
