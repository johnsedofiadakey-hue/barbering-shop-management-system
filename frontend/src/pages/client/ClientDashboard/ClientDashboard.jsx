import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useShopSettings } from '@hooks/useShopSettings';
import styles from './ClientDashboard.module.scss';
import api from '@api';
import { formatTime } from '@utils/dateTime';

import Button from '@components/common/Button/Button';
import Icon from '@components/common/Icon/Icon';
import Rating from '@components/ui/Rating/Rating';
import Spinner from '@components/common/Spinner/Spinner';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';

const formatDate = (value, options = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  value ? new Intl.DateTimeFormat('en-GH', options).format(new Date(`${value}T12:00:00`)) : '';

function ClientDashboard() {
  const { profile, setProfile } = useAuth();
  const shop = useShopSettings();
  const [barbers, setBarbers] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const { profile: latestProfile } = await api.client.getClientProfile();
      setProfile(latestProfile);
    } finally {
      setIsLoading(false);
    }
  }, [setProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profile) return;
    const ids = new Set([
      ...(profile.recent_appointments || []).map((appointment) => appointment.barber_id),
      ...(profile.latest_reviews || []).map((review) => review.barber_id),
      profile.upcoming_appointment?.barber_id,
    ]);
    ids.delete(undefined);
    ids.delete(null);

    Promise.all(
      [...ids].map(async (id) => {
        try {
          const { profile: barber } = await api.pub.getBarberProfilePublic(id);
          return [id, barber];
        } catch {
          return [id, null];
        }
      }),
    ).then((entries) => setBarbers(Object.fromEntries(entries)));
  }, [profile]);

  if (isLoading || !profile) return <Spinner />;

  const upcoming = profile.upcoming_appointment;
  const firstName = profile.name?.trim() || 'there';

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const recentAppointments = profile.recent_appointments || [];
  const lastCompleted = recentAppointments.find((appointment) => appointment.status === 'COMPLETED');
  const reviewedBarberIds = new Set((profile.latest_reviews || []).map((review) => review.barber_id));
  const pendingReviewAppointment = lastCompleted && !reviewedBarberIds.has(lastCompleted.barber_id) ? lastCompleted : null;

  return (
    <div className={styles.dashboard}>
      <section className={styles.welcomeCard}>
        <div className={styles.welcomeCopy}>
          <span className={styles.eyebrow}>Your grooming app</span>
          <h1>
            {timeGreeting}, {firstName}.
          </h1>
          <p>Your bookings, barber and history stay connected to this phone.</p>
          <div className={styles.sessionNote}>
            <Icon name="check" size="sm" />
            Signed in on this device until you log out
          </div>
        </div>
        <Button className={styles.primaryCta} href="/client/appointments?book=1" size="lg" color="gold">
          <Icon name="calendar" size="sm" />
          Book a cut
        </Button>
      </section>

      <section className={`${styles.nextCard} ${upcoming ? styles.hasAppointment : styles.noAppointment}`}>
        <div className={styles.sectionLabel}>
          <span>Next appointment</span>
          {upcoming && <span className={styles.status}>Confirmed</span>}
        </div>

        {upcoming ? (
          <>
            <div className={styles.nextMain}>
              <div className={styles.dateBadge}>
                <strong>{new Date(`${upcoming.date}T12:00:00`).getDate()}</strong>
                <span>{formatDate(upcoming.date, { month: 'short' })}</span>
              </div>
              <div className={styles.nextDetails}>
                <h2>{formatDate(upcoming.date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                <p>
                  {formatTime(upcoming.slot)} · {upcoming.location_type === 'HOME' ? 'Home visit' : shop.name}
                </p>
                {barbers[upcoming.barber_id] && (
                  <div className={styles.barberMini}>
                    <ProfileImage src={barbers[upcoming.barber_id].profile_image} />
                    <span>
                      {barbers[upcoming.barber_id].name} {barbers[upcoming.barber_id].surname}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button href="/client/appointments" size="md" color="goldoutline" wide>
              View or reschedule
            </Button>
          </>
        ) : lastCompleted ? (
          <div className={styles.emptyNext}>
            <span className={styles.emptyIcon}>
              <Icon name="refresh" size="lg" />
            </span>
            <div>
              <h2>Ready for your usual?</h2>
              <p>
                {lastCompleted.services.map((service) => service.name).join(', ') || 'Your last visit'}
                {barbers[lastCompleted.barber_id] &&
                  ` with ${barbers[lastCompleted.barber_id].name} ${barbers[lastCompleted.barber_id].surname}`}
              </p>
            </div>
            <Button href={`/client/appointments?bookBarber=${lastCompleted.barber_id}`} color="goldoutline" size="md">
              Find next available time
            </Button>
          </div>
        ) : (
          <div className={styles.emptyNext}>
            <span className={styles.emptyIcon}>
              <Icon name="scissors" size="lg" />
            </span>
            <div>
              <h2>Your chair is ready when you are.</h2>
              <p>Choose a barber and reserve a time in a few taps.</p>
            </div>
            <Button href="/client/appointments?book=1" color="goldoutline" size="md">
              Book now
            </Button>
          </div>
        )}
      </section>

      <nav className={styles.quickActions} aria-label="Quick actions">
        <Button href="/client/appointments?book=1" color="primary" size="md">
          <span className={styles.actionIcon}>
            <Icon name="plus" size="md" />
          </span>
          <span>
            <strong>New booking</strong>
            <small>Choose a service</small>
          </span>
        </Button>
        <Button href="/client/appointments" color="primary" size="md">
          <span className={styles.actionIcon}>
            <Icon name="appointment" size="md" />
          </span>
          <span>
            <strong>Appointments</strong>
            <small>Manage your visits</small>
          </span>
        </Button>
        <Button href="/client/settings" color="primary" size="md">
          <span className={styles.actionIcon}>
            <Icon name="user" size="md" />
          </span>
          <span>
            <strong>My account</strong>
            <small>Details and logout</small>
          </span>
        </Button>
      </nav>

      <section className={styles.historySection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Your history</span>
            <h2>Recent appointments</h2>
          </div>
          <Button href="/client/appointments" color="link" size="sm">
            See all
          </Button>
        </div>

        {(profile.recent_appointments || []).length > 0 ? (
          <div className={styles.historyList}>
            {profile.recent_appointments.slice(0, 3).map((appointment) => {
              const barber = barbers[appointment.barber_id];
              return (
                <article className={styles.historyItem} key={appointment.id}>
                  <div className={styles.historyDate}>
                    <strong>{new Date(`${appointment.date}T12:00:00`).getDate()}</strong>
                    <span>{formatDate(appointment.date, { month: 'short' })}</span>
                  </div>
                  <div className={styles.historyDetails}>
                    <strong>{appointment.services.map((service) => service.name).join(', ') || 'Barber appointment'}</strong>
                    <span>
                      {barber ? `${barber.name} ${barber.surname}` : 'Your barber'} · {formatTime(appointment.slot)}
                    </span>
                  </div>
                  <span className={styles.historyPrice}>
                    {shop.currency_symbol} {Number(appointment.amount_spent).toFixed(0)}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyList}>Your completed visits will appear here.</div>
        )}
      </section>

      {pendingReviewAppointment && (
        <section className={styles.reviewPrompt}>
          <div>
            <h2>
              How was your appointment with{' '}
              {barbers[pendingReviewAppointment.barber_id]
                ? `${barbers[pendingReviewAppointment.barber_id].name} ${barbers[pendingReviewAppointment.barber_id].surname}`
                : 'your barber'}
              ?
            </h2>
            <p>Your feedback helps other clients pick the right barber.</p>
          </div>
          <Button href={`/client/reviews?reviewBarber=${pendingReviewAppointment.barber_id}`} color="gold" size="md">
            <Icon name="review" size="sm" />
            Leave a review
          </Button>
        </section>
      )}

      {(profile.latest_reviews || []).length > 0 && (
        <section className={styles.reviewSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Your feedback</span>
              <h2>Latest review</h2>
            </div>
            <Button href="/client/reviews" color="link" size="sm">
              Manage reviews
            </Button>
          </div>
          {profile.latest_reviews.slice(0, 1).map((review) => (
            <article className={styles.reviewCard} key={review.id}>
              <Rating rating={review.rating} />
              <p>{review.comment || 'No written comment.'}</p>
              <span>{formatDate(review.created_at, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default ClientDashboard;
