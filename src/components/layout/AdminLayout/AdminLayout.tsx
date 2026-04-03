import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import Header from '@/components/layout/Header/Header';
import SetPasswordModal from '@/pages/SetPassword/SetPasswordModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import { moduleService } from '@/services/moduleService';
import styles from './AdminLayout.module.css';

const AdminLayout = () => {
  const { user, isAuthenticated, isFirstLogin } = useAuthStore();
  const { modules, accessModules, setAccessModules, setModules } = useModuleStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasFetchedRef = useRef(false);

  // Re-fetch sidebar modules when authenticated but the store is empty.
  // useRef guard prevents React StrictMode from firing this twice on mount.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    if (accessModules.length === 0) {
      moduleService.getMyAccess(user.id).then(setAccessModules).catch(() => {});
    }
    if (modules.length === 0 && user.orgId) {
      moduleService.getMyModules(user.orgId).then(setModules).catch(() => {});
    }
  }, [isAuthenticated, user?.id]);

  // Keep --ip-sidebar-offset in sync so the fixed Pagination bar shifts with the sidebar
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--ip-sidebar-offset',
      collapsed ? '72px' : '260px'
    );
  }, [collapsed]);

  const handleToggleSidebar = () => {
    setCollapsed((prev) => !prev);
  };

  const handleMobileToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleOverlayClick = () => {
    setMobileOpen(false);
  };

  return (
    <>
      <div className={styles.layoutWrapper}>
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
        />

        {/* Mobile overlay */}
        <div
          className={`${styles.overlay} ${mobileOpen ? styles.overlayVisible : ''}`}
          onClick={handleOverlayClick}
        />

        <div
          className={`${styles.mainArea} ${collapsed ? styles.mainAreaCollapsed : ''}`}
        >
          <Header
            onMenuToggle={handleMobileToggle}
            onSidebarToggle={handleToggleSidebar}
            sidebarCollapsed={collapsed}
          />
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* First-time login: force user to set a new password */}
      {isFirstLogin && <SetPasswordModal />}
    </>
  );
};

export default AdminLayout;
