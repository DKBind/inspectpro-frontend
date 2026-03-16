import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import { userService } from '@/services/userService';
import type { UserModuleAccessDTO } from '@/services/models/module';
import type { RoleModuleAssignment } from '@/services/models/user';
import { ROUTES } from '@/components/Constant/Route';
import { Menu, Search, Bell, LogOut, PanelLeftClose, PanelLeftOpen, ChevronDown, Check, Loader2 } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  onMenuToggle: () => void;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
}

const routeLabelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  inspections: 'Inspections',
  checklists: 'Checklists',
  defects: 'Defects',
  reports: 'Reports',
  settings: 'Settings',
  organisation: 'Organisation',
  users: 'Users',
  profile: 'Profile',
};

/** Aggregate flat role-module rows into access module DTOs (one entry per module) */
function toAccessModules(rows: RoleModuleAssignment[]): UserModuleAccessDTO[] {
  const map = new Map<number, UserModuleAccessDTO>();
  for (const row of rows) {
    if (!map.has(row.moduleId)) {
      map.set(row.moduleId, {
        moduleId: row.moduleId,
        name: row.moduleName,
        route: row.moduleRoute,
        icon: '',
        category: row.moduleCategory ?? '',
        permissions: [],
      });
    }
    if (row.permissionName) {
      map.get(row.moduleId)!.permissions.push(row.permissionName);
    }
  }
  return Array.from(map.values());
}

const Header = ({ onMenuToggle, onSidebarToggle, sidebarCollapsed }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, clearAuth, switchRole } = useAuthStore();
  const { clearModules, setAccessModules } = useModuleStore();
  const location = useLocation();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentPage = pathSegments[pathSegments.length - 1] || 'dashboard';
  const pageLabel = routeLabelMap[currentPage] || currentPage;

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSwitch = async (roleName: string, roleId: number) => {
    if (!user || user.role === roleName || switching) return;
    setSwitching(true);
    setShowRoleMenu(false);
    try {
      // 1. Update active role in store (in-memory, no page reload)
      switchRole(roleName, roleId);
      // 2. Re-fetch access modules for the newly selected role
      const rows = await userService.getRoleModules(roleId);
      setAccessModules(toAccessModules(rows));
    } catch {
      clearModules();
    } finally {
      setSwitching(false);
      navigate(ROUTES.DASHBOARD);
    }
  };

  const hasMultipleRoles = (user?.roles?.length ?? 0) > 1;

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <button className={styles.menuBtn} onClick={onMenuToggle}>
          <Menu />
        </button>

        <button
          className={styles.sidebarToggleBtn}
          onClick={onSidebarToggle}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>

        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbItem}>
            <span className={styles.breadcrumbLink}>Home</span>
            <span className={styles.breadcrumbSep}>/</span>
          </span>
          <span className={styles.breadcrumbCurrent}>{pageLabel}</span>
        </div>
      </div>

      <div className={styles.searchBar}>
        <Search className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search anything..."
          className={styles.searchInput}
        />
        <kbd className={styles.searchKbd}>⌘K</kbd>
      </div>

      <div className={styles.rightSection}>
        <button className={styles.iconBtn} title="Notifications">
          <Bell />
          <span className={styles.notifBadge} />
        </button>

        <div className={styles.divider} />

        <div className={styles.userMenuWrapper} ref={menuRef}>
          <button
            className={`${styles.userMenu} ${hasMultipleRoles ? styles.userMenuClickable : ''}`}
            onClick={() => hasMultipleRoles && !switching && setShowRoleMenu(!showRoleMenu)}
          >
            <div className={styles.avatar}>
              {switching
                ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                : getInitials(user?.name, user?.email)
              }
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.name || user?.email || 'User'}</span>
              {/* Show the actual current role name from DB */}
              <span className={styles.userRole}>{user?.role ?? 'User'}</span>
            </div>
            {hasMultipleRoles && (
              <ChevronDown className={`${styles.chevron} ${showRoleMenu ? styles.chevronUp : ''}`} />
            )}
          </button>

          {/* Role Switcher Dropdown */}
          {showRoleMenu && hasMultipleRoles && (
            <div className={styles.roleDropdown}>
              <div className={styles.dropdownHeader}>Switch Role</div>
              <div className={styles.roleList}>
                {user!.roles.map((r) => (
                  <button
                    key={r.roleId}
                    className={`${styles.roleItem} ${user!.role === r.roleName ? styles.roleItemActive : ''}`}
                    onClick={() => handleRoleSwitch(r.roleName, r.roleId)}
                  >
                    <span>{r.roleName}</span>
                    {user!.role === r.roleName && <Check className={styles.checkIcon} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className={styles.iconBtn}
          title="Logout"
          onClick={() => { clearAuth(); clearModules(); navigate('/login'); }}
        >
          <LogOut />
        </button>
      </div>
    </header>
  );
};

export default Header;
