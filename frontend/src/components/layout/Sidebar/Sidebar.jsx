import { useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import styles from './Sidebar.module.scss';

import Spinner from '@components/common/Spinner/Spinner';
import Button from '@components/common/Button/Button';
import Icon from '@components/common/Icon/Icon';
import ProfileImage from '@components/ui/ProfileImage/ProfileImage';

// Define role-based navigation
const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/barbers', label: 'Barbers', icon: 'barber' },
  { to: '/admin/clients', label: 'Clients', icon: 'client' },
  { to: '/admin/appointments', label: 'Appointments', icon: 'appointment' },
  { to: '/admin/catalog', label: 'Services & cuts', icon: 'service' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];
const barberNav = [
  { to: '/barber/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/barber/services', label: 'Services', icon: 'service' },
  { to: '/barber/appointments', label: 'Appointments', icon: 'appointment' },
  { to: '/barber/availabilities', label: 'Availabilities', icon: 'availability' },
  { to: '/barber/reviews', label: 'Reviews', icon: 'review' },
  { to: '/barber/settings', label: 'Settings', icon: 'settings' },
];
const clientNav = [
  { to: '/client/dashboard', label: 'Home', icon: 'dashboard' },
  { to: '/client/appointments?book=1', label: 'Book', icon: 'scissors', primary: true },
  { to: '/client/appointments', label: 'Appointments', icon: 'appointment' },
  { to: '/client/settings', label: 'Account', icon: 'user' },
];

function Sidebar() {
  const { isAuthenticated, profile, isFetchingProfile } = useAuth();
  const [open, setOpen] = useState(true); // Sidebar open/collapsed state

  // Get role specific nav items
  let navItems = [];
  if (!isFetchingProfile && profile) {
    if (profile.role === 'ADMIN') navItems = adminNav;
    else if (profile.role === 'BARBER') navItems = barberNav;
    else if (profile.role === 'CLIENT') navItems = clientNav;
  }
  const profileLabel =
    profile?.role === 'CLIENT'
      ? `${profile.name || ''} ${profile.surname || ''}`.trim() || 'Your account'
      : profile?.username || profile?.email;

  return (
    <aside
      className={`${styles.sidebar} ${profile?.role === 'CLIENT' ? styles.clientSidebar : ''} ${open ? styles.open : styles.close}`}
    >
      {isFetchingProfile ? (
        <Spinner />
      ) : (
        <div className={styles.sidebarContent}>
          <div className={`${styles.inner} ${open ? styles.show : styles.hide}`}>
            <div className={styles.top}>
              {isAuthenticated && profile && (
                <div className={styles.profile}>
                  <ProfileImage src={profile.profile_image} />

                  <div className={styles.profileText}>
                    <div className={styles.username}>{profileLabel}</div>
                    <div className={styles.role}>{profile.role?.toLowerCase() || ''}</div>
                  </div>
                </div>
              )}
            </div>

            <nav className={styles.nav}>
              <ul>
                {navItems.map((item) => (
                  <li key={item.to}>
                    <Button
                      className={`${styles.navBtn} ${item.primary ? styles.primaryNav : ''}`}
                      nav
                      href={item.to}
                      size="md"
                      activeClassName={styles.active}
                      color="borderless"
                      wide
                    >
                      <span className={styles.line}>
                        <span className={styles.navIcon}>
                          <Icon name={item.icon} size={'md'} />
                        </span>
                        {item.label}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <Button
            className={styles.toggleBtn}
            onClick={() => setOpen((v) => !v)}
            size="sm"
            color="primary"
            type="button"
            width="content"
          >
            <Icon name="menu" size="ty" />
          </Button>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
