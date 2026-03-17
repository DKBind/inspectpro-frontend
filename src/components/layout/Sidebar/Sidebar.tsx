import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import { ROUTES } from '@/components/Constant/Route';
import {
  LayoutDashboard, FolderKanban, ClipboardCheck, ListChecks, Bug,
  BarChart3, Settings, Shield, Building2, CreditCard, GitBranch,
  Sparkles, Users, Bell, UserCircle,
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
}

// ─── Static fallback list (used for super_admin who bypasses DB filtering) ────
const ALL_MAIN_ITEMS: NavItem[] = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: ROUTES.DASHBOARD },
  { label: 'Projects',    icon: FolderKanban,    path: ROUTES.PROJECTS },
  { label: 'Inspections', icon: ClipboardCheck,  path: ROUTES.INSPECTIONS },
  { label: 'Checklists',  icon: ListChecks,      path: ROUTES.CHECKLISTS },
  { label: 'Defects',     icon: Bug,             path: ROUTES.DEFECTS },
];

const ALL_SYSTEM_ITEMS: NavItem[] = [
  { label: 'Reports',       icon: BarChart3,   path: ROUTES.REPORTS },
  { label: 'Organisation',  icon: Building2,   path: ROUTES.ORGANISATION },
  { label: 'Franchise',     icon: GitBranch,   path: ROUTES.FRANCHISE },
  { label: 'Subscriptions', icon: CreditCard,  path: ROUTES.SUBSCRIPTIONS },
  { label: 'Users & Roles', icon: Users,       path: ROUTES.USERS_ROLES },
  { label: 'Notifications', icon: Bell,        path: ROUTES.NOTIFICATIONS },
  { label: 'Profile',       icon: UserCircle,  path: ROUTES.PROFILE },
  { label: 'Settings',      icon: Settings,    path: ROUTES.SETTINGS },
];

// ─── Route → icon / label / section metadata (drives dynamic sidebar) ─────────
type SectionKey = 'main' | 'system';
const MODULE_META: Record<string, { label: string; icon: LucideIcon; section: SectionKey }> = {
  '/dashboard':     { label: 'Dashboard',     icon: LayoutDashboard, section: 'main'   },
  '/projects':      { label: 'Projects',      icon: FolderKanban,    section: 'main'   },
  '/inspections':   { label: 'Inspections',   icon: ClipboardCheck,  section: 'main'   },
  '/checklists':    { label: 'Checklists',    icon: ListChecks,      section: 'main'   },
  '/defects':       { label: 'Defects',       icon: Bug,             section: 'main'   },
  '/reports':       { label: 'Reports',       icon: BarChart3,       section: 'system' },
  '/organisation':  { label: 'Organisation',  icon: Building2,       section: 'system' },
  '/franchise':     { label: 'Franchise',     icon: GitBranch,       section: 'system' },
  '/subscriptions':           { label: 'Subscriptions',          icon: CreditCard,  section: 'system' },
  '/franchise-subscriptions': { label: 'Franchise Subscriptions', icon: Sparkles,    section: 'system' },
  '/customers':               { label: 'Customers',               icon: Users,       section: 'system' },
  '/users-roles':             { label: 'Users & Roles',           icon: Users,       section: 'system' },
  '/notifications':           { label: 'Notifications',           icon: Bell,        section: 'system' },
  '/profile':                 { label: 'Profile',                 icon: UserCircle,  section: 'system' },
  '/settings':                { label: 'Settings',                icon: Settings,    section: 'system' },
};

const Sidebar = ({ collapsed, mobileOpen }: SidebarProps) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { accessModules } = useModuleStore();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

  const isActive = (path: string) => location.pathname.startsWith(path);

  // ─── Build nav items from DB modules ──────────────────────────────────────
  const buildFromDB = () => {
    const seen = new Set<string>();
    const main: NavItem[]   = [];
    const system: NavItem[] = [];

    accessModules.forEach((m) => {
      // Map fine-grained DB routes (/organisation/create) to top-level paths (/organisation)
      const topPath = '/' + m.route.split('/').filter(Boolean)[0];
      if (seen.has(topPath)) return;
      seen.add(topPath);
      const meta = MODULE_META[topPath];
      if (!meta) return;
      const item: NavItem = { label: meta.label, icon: meta.icon, path: topPath };
      if (meta.section === 'main') main.push(item);
      else system.push(item);
    });

    // Always ensure Profile is visible
    if (!seen.has('/profile')) system.push({ label: 'Profile', icon: UserCircle, path: ROUTES.PROFILE });

    return { main, system };
  };

  let visibleMain: NavItem[];
  let visibleSystem: NavItem[];

  if (isSuperAdmin) {
    visibleMain   = ALL_MAIN_ITEMS;
    visibleSystem = ALL_SYSTEM_ITEMS;
  } else if (accessModules.length > 0) {
    const built = buildFromDB();
    visibleMain   = built.main;
    visibleSystem = built.system;
  } else {
    // Not yet loaded — show nothing except Profile
    visibleMain   = [];
    visibleSystem = [{ label: 'Profile', icon: UserCircle, path: ROUTES.PROFILE }];
  }

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
          <span>Inspection & Quality Management</span>
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
