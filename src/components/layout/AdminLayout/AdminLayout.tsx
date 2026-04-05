import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import Header from '@/components/layout/Header/Header';
import SetPasswordModal from '@/pages/SetPassword/SetPasswordModal';
import { useAuthStore } from '@/store/useAuthStore';
import styles from './AdminLayout.module.css';

const AdminLayout = () => {
  const { isFirstLogin } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Keep --ip-sidebar-offset in sync so the fixed Pagination bar shifts with the sidebar
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--ip-sidebar-offset',
      collapsed ? '72px' : '260px'
    );
  }, [collapsed]);

  return (
    <>
      <div className={styles.layoutWrapper}>
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} />

        <div
          className={`${styles.overlay} ${mobileOpen ? styles.overlayVisible : ''}`}
          onClick={() => setMobileOpen(false)}
        />

        <div className={`${styles.mainArea} ${collapsed ? styles.mainAreaCollapsed : ''}`}>
          <Header
            onMenuToggle={() => setMobileOpen((p) => !p)}
            onSidebarToggle={() => setCollapsed((p) => !p)}
            sidebarCollapsed={collapsed}
          />
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>

      {isFirstLogin && <SetPasswordModal />}
    </>
  );
};

export default AdminLayout;
