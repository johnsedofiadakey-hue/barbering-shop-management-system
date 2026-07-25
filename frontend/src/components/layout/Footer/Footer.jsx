import { useEffect, useState } from 'react';
import styles from './Footer.module.scss';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import api from '@api';

import Logo from '@components/common/Logo/Logo';
import Icon from '@components/common/Icon/Icon';

function Footer() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const showStaffAccess = !isAuthenticated && location.pathname !== '/staff-login';

  // Contact/social links only ever show real shop details an admin has actually filled in —
  // never placeholders — so this fetch is skipped entirely for the authenticated app shell.
  const [shop, setShop] = useState(null);
  useEffect(() => {
    if (isAuthenticated) return;
    api.pub
      .getShopSettings()
      .then(({ shop }) => setShop(shop))
      .catch(() => {});
  }, [isAuthenticated]);

  return (
    <footer className={`${styles.footerArea} ${isAuthenticated ? styles.authenticated : ''}`}>
      <div className={styles.footer}>
        <div className={styles.footerBrand}>
          <Logo size="sm" />
          <p className={styles.promise}>Craft. Care. Consistency.</p>
        </div>

        {!isAuthenticated && shop && (shop.phone_number || shop.email || shop.instagram_url) && (
          <div className={styles.footerLinks}>
            {(shop.phone_number || shop.email) && (
              <div className={styles.linkGroup}>
                <h4>Contact</h4>
                {shop.phone_number && <a href={`tel:${shop.phone_number}`}>{shop.phone_number}</a>}
                {shop.email && <a href={`mailto:${shop.email}`}>{shop.email}</a>}
              </div>
            )}
            {shop.instagram_url && (
              <div className={styles.socialGroup}>
                <a href={shop.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                  <Icon name="instagram" size="sm" />
                </a>
              </div>
            )}
          </div>
        )}

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
