import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ROUTES } from '@/components/Constant/Route';
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardCheck,
  ListChecks,
  Bug,
  BarChart3,
  Settings,
  Shield,
  Building2,
  CreditCard,
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen?: boolean;
}

const mainNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.DASHBOARD },
  { label: 'Projects', icon: FolderKanban, path: ROUTES.PROJECTS },
  { label: 'Inspections', icon: ClipboardCheck, path: ROUTES.INSPECTIONS, badge: 5 },
  { label: 'Checklists', icon: ListChecks, path: ROUTES.CHECKLISTS },
  { label: 'Defects', icon: Bug, path: ROUTES.DEFECTS, badge: 12 },
];

const Sidebar = ({ collapsed, mobileOpen }: SidebarProps) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  const isActive = (path: string) => location.pathname.startsWith(path);

  // Build secondary items based on role
  const secondaryNavItems = [
    { label: 'Reports', icon: BarChart3, path: ROUTES.REPORTS },
    ...(isSuperAdmin
      ? [
          { label: 'Organisation', icon: Building2, path: ROUTES.ORGANISATION },
          { label: 'Subscriptions', icon: CreditCard, path: ROUTES.SUBSCRIPTIONS },
        ]
      : []),
    { label: 'Settings', icon: Settings, path: ROUTES.SETTINGS },
  ];

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${
        mobileOpen ? styles.sidebarMobileOpen : ''
      }`}
    >
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.logoIcon}>
          <Shield />
        </div>
        <div className={`${styles.brandText} ${collapsed ? styles.hideBrandText : ''}`}>
          <h1>InspectWisePro</h1>
          <span>Admin Panel</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {/* Main */}
        <div className={styles.navSection}>
          <div className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
            Main Menu
          </div>
          {mainNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`${styles.navItem} ${isActive(item.path) ? styles.navItemActive : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.navIcon}>
                <item.icon />
              </span>
              <span className={`${styles.navText} ${collapsed ? styles.navTextHidden : ''}`}>
                {item.label}
              </span>
              {item.badge && (
                <span className={`${styles.badge} ${collapsed ? styles.badgeHidden : ''}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* Secondary */}
        <div className={styles.navSection}>
          <div className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
            System
          </div>
          {secondaryNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`${styles.navItem} ${isActive(item.path) ? styles.navItemActive : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.navIcon}>
                <item.icon />
              </span>
              <span className={`${styles.navText} ${collapsed ? styles.navTextHidden : ''}`}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
