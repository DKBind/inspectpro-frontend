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
  const { accessModules } = useModuleStore();

  const isActive = (path: string) => location.pathname.startsWith(path);

  // ─── Build sections dynamically from DB categories ────────────────────────
  const buildSections = (): { label: string; items: NavItem[] }[] => {
    const seenPaths = new Set<string>();
    // Ordered map: category label → items
    const sectionMap = new Map<string, NavItem[]>();

    accessModules.forEach((m) => {
      if (!m.route) return;
      const topPath = '/' + m.route.split('/').filter(Boolean)[0];
      if (seenPaths.has(topPath)) return;
      seenPaths.add(topPath);

      const category = m.category || 'Other';
      if (!sectionMap.has(category)) sectionMap.set(category, []);
      sectionMap.get(category)!.push({
        label: m.name,
        icon: resolveIcon(m.icon),
        path: topPath,
      });
    });

    // Profile always present
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
