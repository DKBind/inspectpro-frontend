import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Users, Bell, UserCircle } from 'lucide-react';
import UsersRoles from './UsersRoles/UsersRoles';
import Profile from './Profile/Profile';
import styles from './Settings.module.css';

type TabKey = 'users-roles' | 'notifications' | 'profile';

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}

const notificationPrefs = [
  { id: 'email-inspection', title: 'Inspection Assignments', desc: 'Get notified when an inspection is assigned to you', defaultOn: true },
  { id: 'email-defect', title: 'Defect Updates', desc: 'Get notified when a defect status changes', defaultOn: true },
  { id: 'email-report', title: 'Report Generation', desc: 'Get notified when a report is ready for download', defaultOn: false },
  { id: 'email-approval', title: 'Approval Requests', desc: 'Get notified when you have pending approvals', defaultOn: true },
  { id: 'push-reminders', title: 'Task Reminders', desc: 'Receive push reminders for upcoming deadlines', defaultOn: false },
  { id: 'push-mentions', title: 'Mentions & Comments', desc: 'Get notified when someone mentions you in a comment', defaultOn: true },
];

const Settings = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('users-roles');
  const [toggled, setToggled] = useState<Record<string, boolean>>(
    Object.fromEntries(notificationPrefs.map((p) => [p.id, p.defaultOn]))
  );

  const tabs: TabItem[] = [
    { key: 'users-roles', label: 'Users & Roles', icon: Users },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'profile', label: 'Profile', icon: UserCircle },
  ];

  const handleToggle = (id: string) => {
    setToggled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>
            Manage your account, team, and notification preferences
          </p>
        </div>
      </div>

      <div className={styles.settingsLayout}>
        {/* Sidebar Nav */}
        <aside className={styles.settingsSidebar}>
          <nav className={styles.navMenu}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.navItem} ${activeTab === tab.key ? styles.navItemActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <tab.icon className={styles.navIcon} />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <main className={styles.settingsContent}>
          {activeTab === 'users-roles' && <UsersRoles />}

          {activeTab === 'notifications' && (
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
          )}

          {activeTab === 'profile' && <Profile />}
        </main>
      </div>
    </div>
  );
};

export default Settings;
