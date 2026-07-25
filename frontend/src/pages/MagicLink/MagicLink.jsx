import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import styles from './MagicLink.module.scss';

import Spinner from '@components/common/Spinner/Spinner';
import Button from '@components/common/Button/Button';
import Icon from '@components/common/Icon/Icon';

function MagicLink() {
  const { uidb64, token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithMagicLink } = useAuth();
  const [status, setStatus] = useState('pending'); // 'pending' | 'error'
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const requested = new URLSearchParams(location.search).get('next');
    const nextPath = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/client/dashboard';

    (async () => {
      try {
        const session = await loginWithMagicLink(uidb64, token);
        const destination = session.requires_profile_setup ? `/client/welcome?next=${encodeURIComponent(nextPath)}` : nextPath;
        navigate(destination, { replace: true });
      } catch {
        setStatus('error');
      }
    })();
  }, [uidb64, token, location.search, loginWithMagicLink, navigate]);

  if (status === 'pending') {
    return (
      <div className={styles.magicLinkPage}>
        <div className={styles.card}>
          <Spinner size="lg" />
          <h1>Signing you in…</h1>
          <p>Verifying your link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.magicLinkPage}>
      <div className={styles.card}>
        <span className={styles.errorIcon}>
          <Icon name="warning" size="lg" />
        </span>
        <h1>This link isn&rsquo;t valid anymore</h1>
        <p>Sign-in links expire after a while and only work once. Request a fresh one, or sign in with your phone instead.</p>
        <Button href="/login?next=%2Fclient%2Fdashboard" color="gold" size="lg" wide>
          Go to sign in
        </Button>
      </div>
    </div>
  );
}

export default MagicLink;
