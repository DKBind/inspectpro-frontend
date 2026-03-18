import UsersRoles from '../Settings/UsersRoles/UsersRoles';
import styles from '../Settings/Settings.module.css';

const UsersRolesPage = () => (
  <div className={styles.settingsPage}>
    <div className={styles.pageHeader}>
      {/* <div>
        <h1 className={styles.pageTitle}>Users & Roles</h1>
        <p className={styles.pageSubtitle}>Manage team members and their access permissions</p>
      </div> */}
    </div>
    <UsersRoles />
  </div>
);

export default UsersRolesPage;
