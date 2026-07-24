import { useAuth } from '@hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.scss';

import Logo from '@components/common/Logo/Logo';
import Spinner from '@components/common/Spinner/Spinner';
import Button from '@components/common/Button/Button';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';

function Header() {
  const { isAuthenticated, profile, logout, isFetchingProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className={`${styles.headerArea} ${isAuthenticated ? styles.authenticated : ''}`}>
      {isFetchingProfile ? (
        <Spinner />
      ) : (
        <div className={styles.header}>
          <Logo size="lg" button />

          {!isAuthenticated && isHome && (
            <nav className={styles.publicNav} aria-label="Public site">
              <a href="#services">Services</a>
              <a href="#signature-cuts">Our work</a>
              <a href="#how-it-works">How it works</a>
              <a href="#faq">FAQ</a>
            </nav>
          )}

          <div className={styles.actions}>
            {isAuthenticated && profile && (
              <>
                <Button className={styles.logoutBtn} onClick={handleLogout} size="md" color="transdark">
                  Logout
                </Button>

                <Button
                  className={styles.profileBtn}
                  href={`/${profile.role.toLowerCase()}/settings`}
                  color="borderless"
                  aria-label="Open account settings"
                >
                  <ProfileImage src={profile.profile_image} />
                </Button>
              </>
            )}

            {!isAuthenticated && (
              <>
                {isHome && (
                  <Button className={styles.clientLogin} href="/login?next=%2Fclient%2Fdashboard" size="sm" color="link">
                    Sign in
                  </Button>
                )}
                <Button href={isHome ? '/login?next=%2Fclient%2Fappointments%3Fbook%3D1' : '/'} size="md" color="gold">
                  {isHome ? 'Book now' : 'Public site'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
