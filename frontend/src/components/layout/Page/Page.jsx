import { Outlet } from 'react-router-dom';
import Footer from '@components/layout/Footer/Footer';
import styles from './Page.module.scss';

function Page() {
  return (
    <div className={styles.page}>
      <Outlet />
      <Footer />
    </div>
  );
}

export default Page;
