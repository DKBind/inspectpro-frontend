import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/store/useAuthStore';
import { Menu, Search, Bell, LogOut, PanelLeftClose, PanelLeftOpen, ChevronDown, Check } from 'lucide-react';
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

const Header = ({ onMenuToggle, onSidebarToggle, sidebarCollapsed }: HeaderProps) => {
  const { user, clearAuth, switchRole } = useAuthStore();
  const location = useLocation();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
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

  const handleRoleSwitch = (role: UserRole) => {
    if (user?.role === role) return;
    switchRole(role);
    setShowRoleMenu(false);
    // Reload the page and route to dashboard as requested
    window.location.href = '/dashboard';
  };

  const hasMultipleRoles = user?.roles && user.roles.length > 1;

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        {/* Mobile menu toggle */}
        <button className={styles.menuBtn} onClick={onMenuToggle}>
          <Menu />
        </button>

        {/* Desktop sidebar toggle */}
        <button
          className={styles.sidebarToggleBtn}
          onClick={onSidebarToggle}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>

        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbItem}>
            <span className={styles.breadcrumbLink}>Home</span>
            <span className={styles.breadcrumbSep}>/</span>
          </span>
          <span className={styles.breadcrumbCurrent}>{pageLabel}</span>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchBar}>
        <Search className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search anything..."
          className={styles.searchInput}
        />
        <kbd className={styles.searchKbd}>⌘K</kbd>
      </div>

      {/* Right Section */}
      <div className={styles.rightSection}>
        <button className={styles.iconBtn} title="Notifications">
          <Bell />
          <span className={styles.notifBadge} />
        </button>

        <div className={styles.divider} />

        <div className={styles.userMenuWrapper} ref={menuRef}>
          <button 
            className={`${styles.userMenu} ${hasMultipleRoles ? styles.userMenuClickable : ''}`}
            onClick={() => hasMultipleRoles && setShowRoleMenu(!showRoleMenu)}
          >
            <div className={styles.avatar}>
              {getInitials(user?.name, user?.email)}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.name || user?.email || 'Admin'}</span>
              <span className={styles.userRole}>
                {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
            {hasMultipleRoles && (
              <ChevronDown className={`${styles.chevron} ${showRoleMenu ? styles.chevronUp : ''}`} />
            )}
          </button>

          {/* Role Dropdown */}
          {showRoleMenu && hasMultipleRoles && (
            <div className={styles.roleDropdown}>
              <div className={styles.dropdownHeader}>Switch Role</div>
              <div className={styles.roleList}>
                {user.roles.map((r) => (
                  <button
                    key={r}
                    className={`${styles.roleItem} ${user.role === r ? styles.roleItemActive : ''}`}
                    onClick={() => handleRoleSwitch(r)}
                  >
                    <span>{r === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                    {user.role === r && <Check className={styles.checkIcon} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className={styles.iconBtn} title="Logout" onClick={clearAuth}>
          <LogOut />
        </button>
      </div>
    </header>
  );
};

export default Header;
