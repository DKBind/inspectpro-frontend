import { useState } from 'react';
import styles from '../Settings/Settings.module.css';

const notificationPrefs = [
  { id: 'email-inspection', title: 'Inspection Assignments', desc: 'Get notified when an inspection is assigned to you', defaultOn: true },
  { id: 'email-defect',     title: 'Defect Updates',         desc: 'Get notified when a defect status changes',           defaultOn: true },
  { id: 'email-report',     title: 'Report Generation',      desc: 'Get notified when a report is ready for download',    defaultOn: false },
  { id: 'email-approval',   title: 'Approval Requests',      desc: 'Get notified when you have pending approvals',        defaultOn: true },
  { id: 'push-reminders',   title: 'Task Reminders',         desc: 'Receive push reminders for upcoming deadlines',       defaultOn: false },
  { id: 'push-mentions',    title: 'Mentions & Comments',    desc: 'Get notified when someone mentions you in a comment', defaultOn: true },
];

const Notifications = () => {
  const [toggled, setToggled] = useState<Record<string, boolean>>(
    Object.fromEntries(notificationPrefs.map((p) => [p.id, p.defaultOn]))
  );

  const handleToggle = (id: string) =>
    setToggled((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className={styles.settingsPage}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Notifications</h1>
          <p className={styles.pageSubtitle}>Manage your notification preferences</p>
        </div>
      </div>

      <div className={styles.notifSection}>
        <h3 className={styles.notifSectionTitle}>Notification Preferences</h3>
        {notificationPrefs.map((pref) => (
          <div key={pref.id} className={styles.notifItem}>
            <div className={styles.notifInfo}>
              <h4>{pref.title}</h4>
              <p>{pref.desc}</p>
            </div>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={toggled[pref.id] ?? false}
              onChange={() => handleToggle(pref.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
