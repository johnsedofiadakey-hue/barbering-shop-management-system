import { useAuth } from '@hooks/useAuth';
import styles from './Layout.module.scss';

import Header from '@components/layout/Header/Header';
import Sidebar from '@components/layout/Sidebar/Sidebar';
import Page from '@components/layout/Page/Page';

function Layout() {
  const { isAuthenticated, profile } = useAuth();

  return (
    <div className={`${styles.app} ${profile?.role === 'CLIENT' ? styles.clientApp : ''}`}>
      <Header />

      <div className={styles.content}>
        {isAuthenticated && <Sidebar />}

        <main className={styles.main}>
          <Page />
        </main>
      </div>
    </div>
  );
}

export default Layout;
