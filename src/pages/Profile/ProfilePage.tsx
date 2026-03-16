import Profile from '../Settings/Profile/Profile';
import styles from '../Settings/Settings.module.css';

const ProfilePage = () => (
  <div className={styles.settingsPage}>
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>Profile</h1>
        <p className={styles.pageSubtitle}>View and update your personal information and password</p>
      </div>
    </div>
    <Profile />
  </div>
);

export default ProfilePage;
