import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import api from '@api';
import styles from './ClientOnboarding.module.scss';

import Button from '@components/common/Button/Button';
import Error from '@components/common/Error/Error';
import Form from '@components/common/Form/Form';
import Icon from '@components/common/Icon/Icon';
import Input from '@components/common/Input/Input';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';
import Spinner from '@components/common/Spinner/Spinner';

function ClientOnboarding() {
  const { profile, setProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const nextPath = useMemo(() => {
    const requested = new URLSearchParams(location.search).get('next');
    return requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/client/appointments?book=1';
  }, [location.search]);
  const continueLabel = nextPath.startsWith('/client/appointments') ? 'Continue to booking' : 'Continue to my account';

  const handleCompleteProfile = async ({ name, surname, email, image }) => {
    setIsSaving(true);
    try {
      const payload = { name: name.trim(), surname: surname.trim() };
      if (email && email.trim() !== '') payload.email = email.trim();
      await api.client.updateClientProfile(payload);
      if (image) await api.image.uploadProfileImage(image);
      const { profile: updatedProfile } = await api.client.getClientProfile();
      setProfile(updatedProfile);
      navigate(nextPath, { replace: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.onboardingPage}>
      <section className={styles.onboardingCard}>
        <div className={styles.progress}>Your account · 1 minute setup</div>
        <div className={styles.intro}>
          <ProfileImage src={profile?.profile_image} size="7rem" />
          <div>
            <span>Make it yours</span>
            <h1>What should your barber call you?</h1>
            <p>Your verified phone already protects the account. Add your name now; a photo is optional.</p>
          </div>
        </div>

        <Form
          className={styles.form}
          initialFields={{ name: profile?.name || '', surname: profile?.surname || '', email: '', image: null }}
          onSubmit={handleCompleteProfile}
          validate={({ name, surname }) => (!name?.trim() || !surname?.trim() ? 'Enter your first and last name.' : undefined)}
        >
          <div className={styles.nameGrid}>
            <Input label="First name" name="name" type="text" autoComplete="given-name" required disabled={isSaving} size="md" />
            <Input
              label="Last name"
              name="surname"
              type="text"
              autoComplete="family-name"
              required
              disabled={isSaving}
              size="md"
            />
          </div>
          <Input
            label="Email (optional)"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            helperText="Get an order confirmation and a one-tap link to your portal. Your phone still does the signing in."
            disabled={isSaving}
            size="md"
          />
          <div className={styles.photoField}>
            <span className={styles.photoIcon}>
              <Icon name="image" size="md" />
            </span>
            <div>
              <strong>Add a profile photo</strong>
              <p>Optional. It helps the team recognize you when you arrive.</p>
            </div>
            <Input type="file" name="image" accept="image/*" placeholder="Choose photo" disabled={isSaving} />
          </div>
          <Button type="submit" color="gold" size="lg" disabled={isSaving} wide>
            {isSaving ? (
              <span className={styles.saving}>
                <Spinner size="sm" /> Saving your account…
              </span>
            ) : (
              continueLabel
            )}
          </Button>
          <Error />
        </Form>

        <div className={styles.trustRow}>
          <span>
            <Icon name="check" size="sm" /> Same account every visit
          </span>
          <span>
            <Icon name="dial" size="sm" /> No password to remember
          </span>
        </div>
      </section>
    </div>
  );
}

export default ClientOnboarding;
