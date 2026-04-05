import styles from './FullPageLoader.module.css';
import { Shield } from 'lucide-react';

const FullPageLoader = () => (
  <div className={styles.root}>
    <div className={styles.card}>
      <div className={styles.logoWrap}>
        <Shield className={styles.logoIcon} />
      </div>
      <p className={styles.appName}>InspectWise Pro</p>
      <div className={styles.spinnerWrap}>
        <div className={styles.spinnerRing} />
        <div className={styles.spinnerGlow} />
      </div>
      <p className={styles.label}>Loading your workspace…</p>
    </div>
  </div>
);

export default FullPageLoader;
