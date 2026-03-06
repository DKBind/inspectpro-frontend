import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Plus, Pencil, Trash2, Shield, ShieldCheck } from 'lucide-react';
import styles from './UsersRoles.module.css';

// Dummy users data
const dummyUsers = [
  { id: '1', name: 'Rajesh Kumar', email: 'rajesh@inspectpro.com', role: 'super_admin', status: 'Active' },
  { id: '2', name: 'Priya Sharma', email: 'priya@inspectpro.com', role: 'admin', status: 'Active' },
  { id: '3', name: 'Amit Patel', email: 'amit@inspectpro.com', role: 'admin', status: 'Active' },
  { id: '4', name: 'Sneha Gupta', email: 'sneha@inspectpro.com', role: 'admin', status: 'Inactive' },
  { id: '5', name: 'Vikram Singh', email: 'vikram@inspectpro.com', role: 'admin', status: 'Pending' },
];

const permissions = [
  'View Dashboard',
  'Manage Projects',
  'Manage Inspections',
  'Manage Checklists',
  'Manage Defects',
  'View Reports',
  'Generate Reports',
  'Manage Users',
  'Manage Roles',
  'Manage Organisation',
  'Manage Notifications',
  'Manage Settings',
];

const roleDefinitions = [
  {
    key: 'super_admin',
    title: 'Super Admin',
    desc: 'Full access including organisation management and account renewal',
    icon: ShieldCheck,
    perms: permissions, // all permissions
  },
  {
    key: 'admin',
    title: 'Admin',
    desc: 'Full access excluding organisation management',
    icon: Shield,
    perms: permissions.filter((p) => p !== 'Manage Organisation'),
  },
];

type SubTab = 'users' | 'roles';

const getStatusClass = (status: string) => {
  switch (status) {
    case 'Active': return styles.statusActive;
    case 'Inactive': return styles.statusInactive;
    case 'Pending': return styles.statusPending;
    default: return '';
  }
};

const UsersRoles = () => {
  const { user } = useAuthStore();
  const [subTab, setSubTab] = useState<SubTab>('users');
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className={styles.usersRolesPage}>
      {/* Sub-tabs */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTab} ${subTab === 'users' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('users')}
        >
          Users
        </button>
        <button
          className={`${styles.subTab} ${subTab === 'roles' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('roles')}
        >
          Roles & Permissions
        </button>
      </div>

      {/* Users tab */}
      {subTab === 'users' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Team Members</h3>
            {isSuperAdmin && (
              <button className={styles.addBtn}>
                <Plus /> Add User
              </button>
            )}
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dummyUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userName}>{u.name}</div>
                    <div className={styles.userEmail}>{u.email}</div>
                  </td>
                  <td>
                    <span
                      className={`${styles.roleBadge} ${
                        u.role === 'super_admin' ? styles.roleSuperAdmin : ''
                      }`}
                    >
                      {u.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusClass(u.status)}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className={styles.actionBtn} title="Edit">
                        <Pencil />
                      </button>
                      {isSuperAdmin && u.role !== 'super_admin' && (
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          title="Delete"
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Roles tab */}
      {subTab === 'roles' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Role Definitions</h3>
          </div>
          <div className={styles.rolesGrid}>
            {roleDefinitions.map((role) => (
              <div key={role.key} className={styles.roleCard}>
                <div className={styles.roleCardHeader}>
                  <div>
                    <div className={styles.roleCardTitle}>
                      <role.icon style={{ display: 'inline', width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
                      {role.title}
                    </div>
                    <div className={styles.roleCardDesc}>{role.desc}</div>
                  </div>
                </div>
                <div className={styles.permissionsGrid}>
                  {permissions.map((perm) => (
                    <label key={perm} className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={role.perms.includes(perm)}
                        disabled
                        readOnly
                      />
                      {perm}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersRoles;
