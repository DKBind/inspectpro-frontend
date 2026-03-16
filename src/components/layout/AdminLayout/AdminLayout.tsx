import { useState, useEffect } from 'react';
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
  const { accessModules, setAccessModules } = useModuleStore();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Re-fetch sidebar modules when authenticated but the store is empty
  // (happens after a page refresh since the previous session's store may have been cleared)
  useEffect(() => {
    if (!isAuthenticated || !user || isSuperAdmin) return;
    if (accessModules.length > 0) return;
    moduleService.getMyAccess(user.id).then(setAccessModules).catch(() => {});
  }, [isAuthenticated, user?.id]);

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
