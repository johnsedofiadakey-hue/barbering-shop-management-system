import { useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Header.module.scss';

import Logo from '@components/common/Logo/Logo';
import Spinner from '@components/common/Spinner/Spinner';
import Button from '@components/common/Button/Button';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';
import Icon from '@components/common/Icon/Icon';

function Header() {
  const { isAuthenticated, profile, logout, isFetchingProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleScrollToBooking = () => {
    setMobileMenuOpen(false);
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNavClick = (id) => (e) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <header className={`${styles.headerArea} ${isAuthenticated ? styles.authenticated : ''}`}>
      {isFetchingProfile ? (
        <Spinner />
      ) : (
        <div className={styles.header}>
          <Logo size="lg" button />

          {!isAuthenticated && isHome && (
            <nav className={styles.publicNav} aria-label="Site sections">
              <a href="#services" onClick={handleNavClick('services')}>
                Services
              </a>
              <a href="#signature-cuts" onClick={handleNavClick('signature-cuts')}>
                Our work
              </a>
              <a href="#how-it-works" onClick={handleNavClick('how-it-works')}>
                How it works
              </a>
              <a href="#faq" onClick={handleNavClick('faq')}>
                FAQ
              </a>
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

            {!isAuthenticated && isHome && (
              <>
                <Button className={styles.clientLogin} href="/login?next=%2Fclient%2Fdashboard" size="sm" color="link">
                  Sign in
                </Button>
                <Button onClick={handleScrollToBooking} size="md" color="gold" className={styles.bookBtn}>
                  Book now
                </Button>

                <Button
                  className={styles.mobileMenuBtn}
                  onClick={toggleMobileMenu}
                  color="borderless"
                  size="sm"
                  aria-label="Toggle menu"
                >
                  <Icon name={mobileMenuOpen ? 'close' : 'menu'} size="md" />
                </Button>
              </>
            )}
          </div>

          {/* Mobile Navigation Drawer */}
          {!isAuthenticated && isHome && (
            <div className={`${styles.mobileDrawer} ${mobileMenuOpen ? styles.open : ''}`}>
              <nav className={styles.mobileNav} aria-label="Mobile site sections">
                <a href="#services" onClick={handleNavClick('services')}>
                  Services
                </a>
                <a href="#signature-cuts" onClick={handleNavClick('signature-cuts')}>
                  Our work
                </a>
                <a href="#how-it-works" onClick={handleNavClick('how-it-works')}>
                  How it works
                </a>
                <a href="#faq" onClick={handleNavClick('faq')}>
                  FAQ
                </a>
                <div className={styles.mobileActions}>
                  <Button onClick={handleScrollToBooking} size="lg" color="gold" wide>
                    Book now
                  </Button>
                  <Button href="/login?next=%2Fclient%2Fdashboard" size="lg" color="secondary" wide>
                    Sign in
                  </Button>
                </div>
              </nav>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;
