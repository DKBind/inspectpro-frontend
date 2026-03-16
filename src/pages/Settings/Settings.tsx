import { Globe, Moon, Clock } from 'lucide-react';
import styles from './Settings.module.css';

const generalPrefs = [
  { icon: Globe,  title: 'Language',  desc: 'English (US)' },
  { icon: Moon,   title: 'Theme',     desc: 'Dark mode enabled' },
  { icon: Clock,  title: 'Timezone',  desc: 'Asia/Kolkata (IST)' },
];

const Settings = () => (
  <div className={styles.settingsPage}>
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>General Settings</h1>
        <p className={styles.pageSubtitle}>Application-wide preferences</p>
      </div>
    </div>

    <div className={styles.notifSection}>
      <h3 className={styles.notifSectionTitle}>Preferences</h3>
      {generalPrefs.map((pref) => (
        <div key={pref.title} className={styles.notifItem}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <pref.icon size={18} style={{ color: 'var(--ip-text-secondary)', flexShrink: 0 }} />
            <div className={styles.notifInfo}>
              <h4>{pref.title}</h4>
              <p>{pref.desc}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Settings;
