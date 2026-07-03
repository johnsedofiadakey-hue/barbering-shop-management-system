import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import styles from './Home.module.scss';
import api from '@api';

import Spinner from '@components/common/Spinner/Spinner';
import Button from '@components/common/Button/Button';
import Icon from '@components/common/Icon/Icon';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';

/**
 * Static showcase content (no photography assets available yet — styled as a lookbook of tiles).
 */
const FEATURED_CUTS = [
  { icon: 'scissors', name: 'Skin Fade', tag: '30 min', price: 25 },
  { icon: 'scissors', name: 'Classic Crop', tag: '30 min', price: 20 },
  { icon: 'user', name: 'Beard Sculpt', tag: '20 min', price: 15 },
  { icon: 'hourglass', name: 'Hot Towel Shave', tag: '25 min', price: 20 },
  { icon: 'client', name: 'Kids Cut', tag: '20 min', price: 12 },
  { icon: 'availability', name: 'Home Visit Special', tag: 'At your door', price: 35 },
];

const HOW_IT_WORKS = [
  { icon: 'dial', title: 'Enter your number', text: 'No password, no forms. Just your phone.' },
  { icon: 'barber', title: 'Pick barber & time', text: 'Browse real availability and choose what suits you.' },
  { icon: 'email_base', title: 'Get an SMS confirmation', text: 'And a reminder 90 minutes before your cut.' },
  { icon: 'check', title: 'Show up. Fresh cut.', text: 'Reschedule or cancel anytime from your phone.' },
];

function Home() {
  const { isAuthenticated, isLoggingOut } = useAuth();
  const navigate = useNavigate();

  const [barbers, setBarbers] = useState([]);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);

  /**
   * On authentication state change, redirect authenticated users away from home.
   */
  useEffect(() => {
    if (!isLoggingOut && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, isLoggingOut, navigate]);

  /**
   * Fetches real barbers for the "Meet the team" section (falls back to an empty section on error).
   */
  const fetchBarbers = useCallback(async () => {
    setIsLoadingBarbers(true);

    try {
      const { barbers } = await api.pub.getBarbersPublic();
      setBarbers((barbers || []).slice(0, 4));
    } catch {
      setBarbers([]);
    } finally {
      setIsLoadingBarbers(false);
    }
  }, []);

  useEffect(() => {
    fetchBarbers();
  }, [fetchBarbers]);

  // Don't show landing if redirecting
  if (isLoggingOut || isAuthenticated) return <Spinner />;

  return (
    <div className={styles.home}>
      {/* Hero */}
      <section className={styles.hero}>
        <span className={styles.eyebrow}>
          <Icon name="availability" size="sm" /> Walk-ins welcome &middot; Home visits available
        </span>

        <h1 className={styles.headline}>
          Fresh cut, <span className={styles.gold}>booked in under a minute</span>
        </h1>

        <p className={styles.subheadline}>
          No account, no password. Enter your name and phone number, pick your barber and time — we&apos;ll text you a
          confirmation and a reminder before your cut.
        </p>

        <div className={styles.heroActions}>
          <Button href="/login" size="lg" color="gold">
            Book appointment
          </Button>
          <Button href="#cuts" size="lg" color="goldoutline">
            View services
          </Button>
        </div>

        <div className={styles.badges}>
          <div className={styles.badge}>
            <Icon name="check" size="sm" /> Expert barbers
          </div>
          <div className={styles.badge}>
            <Icon name="review" size="sm" /> Real client reviews
          </div>
          <div className={styles.badge}>
            <Icon name="email_base" size="sm" /> SMS reminders
          </div>
        </div>
      </section>

      {/* Cuts of the week */}
      <section id="cuts" className={styles.cuts}>
        <h2 className={styles.sectionTitle}>Cuts of the week</h2>
        <p className={styles.sectionSubtitle}>A taste of what our barbers offer — full pricing shown at booking.</p>

        <div className={styles.cutsGrid}>
          {FEATURED_CUTS.map((cut) => (
            <div className={styles.cutTile} key={cut.name}>
              <div className={styles.cutIcon}>
                <Icon name={cut.icon} size="lg" />
              </div>
              <div className={styles.cutName}>{cut.name}</div>
              <div className={styles.cutMeta}>
                <span>{cut.tag}</span>
                <span className={styles.cutPrice}>${cut.price}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>Fast. Intuitive. Built for modern clients.</h2>

        <div className={styles.stepsRow}>
          {HOW_IT_WORKS.map((step, i) => (
            <div className={styles.step} key={step.title}>
              <div className={styles.stepNumber}>{i + 1}</div>
              <div className={styles.stepIcon}>
                <Icon name={step.icon} size="lg" />
              </div>
              <div className={styles.stepTitle}>{step.title}</div>
              <div className={styles.stepText}>{step.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Meet the team */}
      {(isLoadingBarbers || barbers.length > 0) && (
        <section className={styles.team}>
          <h2 className={styles.sectionTitle}>Meet the team</h2>

          {isLoadingBarbers ? (
            <Spinner />
          ) : (
            <div className={styles.teamRow}>
              {barbers.map((barber) => (
                <div className={styles.teamCard} key={barber.id}>
                  <ProfileImage src={barber.profile_image} size="6rem" />
                  <div className={styles.teamName}>
                    {barber.name} {barber.surname}
                  </div>
                  <div className={styles.teamRating}>
                    <Icon name="rating" size="sm" /> {Number(barber.average_rating || 0).toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>Ready for your next cut?</h2>
        <Button href="/login" size="lg" color="gold">
          Book appointment
        </Button>
      </section>
    </div>
  );
}

export default Home;
