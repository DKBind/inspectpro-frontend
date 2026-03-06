import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/components/Constant/Route';
import styles from './NotFound.module.css';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.notFoundWrapper}>
      {/* Background orbs */}
      <div className={styles.decoration}>
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
      </div>

      {/* 404 */}
      <div className={styles.errorCode}>404</div>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.description}>
        The page you're looking for doesn't exist or has been moved.
        Let's get you back on track.
      </p>

      <div className={styles.actions}>
        <button className={styles.primaryBtn} onClick={() => navigate(ROUTES.DASHBOARD)}>
          <Home />
          Go to Dashboard
        </button>
        <button className={styles.secondaryBtn} onClick={() => navigate(-1)}>
          <ArrowLeft />
          Go Back
        </button>
      </div>
    </div>
  );
};

export default NotFound;
