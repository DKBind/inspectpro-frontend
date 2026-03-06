import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import Header from '@/components/layout/Header/Header';
import styles from './AdminLayout.module.css';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
  );
};

export default AdminLayout;
