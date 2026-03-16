import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
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
  Users,
  type LucideIcon,
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen?: boolean;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
  /** roles allowed to see this item regardless of subscription modules */
  roles?: string[];
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: ROUTES.DASHBOARD },
  { label: 'Projects',    icon: FolderKanban,    path: ROUTES.PROJECTS },
  { label: 'Inspections', icon: ClipboardCheck,  path: ROUTES.INSPECTIONS, badge: 5 },
  { label: 'Checklists',  icon: ListChecks,      path: ROUTES.CHECKLISTS },
  { label: 'Defects',     icon: Bug,             path: ROUTES.DEFECTS, badge: 12 },
];

const systemNavItems: NavItem[] = [
  { label: 'Reports',       icon: BarChart3,  path: ROUTES.REPORTS },
  { label: 'Users',         icon: Users,      path: ROUTES.USERS,         roles: ['super_admin'] },
  { label: 'Organisation',  icon: Building2,  path: ROUTES.ORGANISATION,  roles: ['super_admin'] },
  { label: 'Subscriptions', icon: CreditCard, path: ROUTES.SUBSCRIPTIONS, roles: ['super_admin'] },
  { label: 'Settings',      icon: Settings,   path: ROUTES.SETTINGS },
];

const Sidebar = ({ collapsed, mobileOpen }: SidebarProps) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { modules, accessModules } = useModuleStore();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

  const isActive = (path: string) => location.pathname.startsWith(path);

  // Routes from org subscription plan (what the org paid for)
  const subscriptionRoutes = new Set(modules.map((m) => m.route));
  // Routes from user's assigned roles (what this user is permitted to access)
  const roleRoutes = new Set(accessModules.map((m) => m.route));

  const isVisible = (item: NavItem): boolean => {
    // Super admin sees everything
    if (isSuperAdmin) return true;
    // Items locked to specific roles (e.g. Organisation, Subscriptions — super_admin only)
    if (item.roles && !item.roles.includes(user?.role ?? '')) return false;
    // Role-based filter: user must have access via their assigned role
    if (roleRoutes.size > 0 && !roleRoutes.has(item.path)) return false;
    // Subscription filter: org must have this module in their plan
    if (subscriptionRoutes.size > 0 && !subscriptionRoutes.has(item.path)) return false;
    return true;
  };

  const visibleMain   = mainNavItems.filter(isVisible);
  const visibleSystem = systemNavItems.filter(isVisible);

  const renderNavItem = (item: NavItem) => (
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
  );

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
        {visibleMain.length > 0 && (
          <div className={styles.navSection}>
            <div className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
              Main Menu
            </div>
            {visibleMain.map(renderNavItem)}
          </div>
        )}

        {visibleSystem.length > 0 && (
          <div className={styles.navSection}>
            <div className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
              System
            </div>
            {visibleSystem.map(renderNavItem)}
          </div>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
