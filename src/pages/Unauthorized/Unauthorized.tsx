import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { ROUTES } from '@/components/Constant/Route';
import styles from './Unauthorized.module.css';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <ShieldX className={styles.icon} />
        </div>
        <h1 className={styles.title}>Access Denied</h1>
        <p className={styles.description}>
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <div className={styles.actions}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Go Back
          </button>
          <button className={styles.homeBtn} onClick={() => navigate(ROUTES.DASHBOARD)}>
            <Home size={16} />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
