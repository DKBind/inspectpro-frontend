import { NavLink, useLocation } from 'react-router-dom';
import { useModuleStore } from '@/store/useModuleStore';
import { ROUTES } from '@/components/Constant/Route';
import {
  LayoutDashboard, FolderKanban, ClipboardCheck, ListChecks, Bug,
  BarChart3, Settings, Shield, Building2, CreditCard, GitBranch,
  Sparkles, Users, Bell, UserCircle, FileText, Home,
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
  locked?: boolean;
}

// ─── Icon registry — maps DB icon string → Lucide component ──────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  ClipboardCheck,
  ListChecks,
  Bug,
  BarChart3,
  Settings,
  Building2,
  CreditCard,
  GitBranch,
  Sparkles,
  Users,
  Bell,
  UserCircle,
  FileText,
  Home,
  Shield,
};

function resolveIcon(iconName: string | undefined | null): LucideIcon {
  if (!iconName) return LayoutDashboard;
  return ICON_MAP[iconName] ?? LayoutDashboard;
}

// ─── "Main" always comes first; other categories follow in DB order ───────────
const CATEGORY_ORDER: Record<string, number> = { main: 0 };

const Sidebar = ({ collapsed, mobileOpen }: SidebarProps) => {
  const location = useLocation();
  const { modules, accessModules } = useModuleStore();

  const isActive = (path: string) => location.pathname.startsWith(path);

  // ─── Build sections dynamically from DB categories ────────────────────────
  const buildSections = (): { label: string; items: NavItem[] }[] => {
    const seenPaths = new Set<string>();
    const sectionMap = new Map<string, NavItem[]>();

    // Accessible paths set for O(1) lookup (only modules that have a real route)
    const accessiblePaths = new Set(
      accessModules
        .filter((m) => !!m.route?.trim())
        .map((m) => '/' + m.route.split('/').filter(Boolean)[0])
    );

    // Use org modules (full list) when available; fall back to accessModules
    const source = modules.length > 0 ? modules : accessModules;

    source.forEach((m) => {
      const hasRoute = !!m.route?.trim();
      // Use route-based key for real routes; name-based key for empty-route modules
      const dedupeKey = hasRoute
        ? '/' + m.route.split('/').filter(Boolean)[0]
        : `__noroute__${m.name}`;

      if (seenPaths.has(dedupeKey)) return;
      seenPaths.add(dedupeKey);

      const topPath = hasRoute ? '/' + m.route.split('/').filter(Boolean)[0] : null;
      const isLocked = !hasRoute || (topPath !== null && !accessiblePaths.has(topPath));

      const category = m.category || 'Other';
      if (!sectionMap.has(category)) sectionMap.set(category, []);
      sectionMap.get(category)!.push({
        label: m.name,
        icon: resolveIcon(m.icon),
        path: topPath ?? '.',
        locked: isLocked,
      });
    });

    // Profile always present and always accessible
    if (!seenPaths.has('/profile')) {
      const systemKey = [...sectionMap.keys()].find(k => k.toLowerCase() !== 'main') ?? 'System';
      if (!sectionMap.has(systemKey)) sectionMap.set(systemKey, []);
      sectionMap.get(systemKey)!.push({ label: 'Profile', icon: UserCircle, path: ROUTES.PROFILE });
    }

    // Sort sections: Main first, rest in DB encounter order
    return [...sectionMap.entries()]
      .sort(([a], [b]) => {
        const ao = CATEGORY_ORDER[a.toLowerCase()] ?? 1;
        const bo = CATEGORY_ORDER[b.toLowerCase()] ?? 1;
        return ao - bo;
      })
      .map(([label, items]) => ({ label, items }));
  };

  const sections = buildSections();

  const renderNavItem = (item: NavItem) => {
    if (item.locked) {
      const tooltipLabel = collapsed
        ? item.label
        : (item.path === '.' ? `${item.label} — coming soon` : undefined);
      return (
        <div
          key={item.path}
          className={`${styles.navItem} ${styles.navItemLocked}`}
          title={tooltipLabel}
        >
          <span className={styles.navIcon}>
            <item.icon />
          </span>
          <span className={`${styles.navText} ${collapsed ? styles.navTextHidden : ''}`}>
            {item.label}
          </span>
          {/* <Lock size={11} className={`${styles.lockIcon} ${collapsed ? styles.navTextHidden : ''}`} /> */}
        </div>
      );
    }
    return (
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
  };

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}
    >
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.logoIcon}>
          <Shield />
        </div>
        <div className={`${styles.brandText} ${collapsed ? styles.hideBrandText : ''}`}>
          <h1>InspectWisePro</h1>
        </div>
      </div>

      {/* Navigation — one section per DB category */}
      <nav className={styles.nav}>
        {sections.map(({ label, items }) => (
          <div key={label} className={styles.navSection}>
            <div className={`${styles.navLabel} ${collapsed ? styles.navLabelHidden : ''}`}>
              {label}
            </div>
            {items.map(renderNavItem)}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
