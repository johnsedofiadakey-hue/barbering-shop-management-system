import styles from './Footer.module.scss';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';

import Logo from '@components/common/Logo/Logo';

function Footer() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const showStaffAccess = !isAuthenticated && location.pathname !== '/staff-login';

  return (
    <footer className={`${styles.footerArea} ${isAuthenticated ? styles.authenticated : ''}`}>
      <div className={styles.footer}>
        <Logo size="sm" />
        <p className={styles.promise}>Craft. Care. Consistency.</p>
        <div className={styles.footerEnd}>
          <span className={styles.copyright}>&copy; {new Date().getFullYear()} BarberManager</span>
          {showStaffAccess && (
            <a className={styles.staffAccess} href="/staff-login">
              Team access
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
