import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { userService } from '@/services/userService';
import type { UserResponse, RoleResponse, RoleModuleAssignment } from '@/services/models/user';
import { ROUTES } from '@/components/Constant/Route';
import { Plus, Shield, Loader2, ExternalLink } from 'lucide-react';
import styles from './UsersRoles.module.css';

type SubTab = 'users' | 'roles';

/** Permission badge colour by name */
const PERM_STYLE: Record<string, { bg: string; color: string }> = {
  All:    { bg: 'hsla(262,83%,58%,0.15)', color: 'hsl(262,83%,72%)' },
  Write:  { bg: 'hsla(221,83%,53%,0.15)', color: 'hsl(221,83%,68%)' },
  Read:   { bg: 'hsla(142,71%,45%,0.15)', color: 'hsl(142,71%,55%)' },
  Delete: { bg: 'hsla(0,84%,60%,0.15)',   color: 'hsl(0,84%,65%)'   },
  None:   { bg: 'hsla(215,20%,40%,0.15)', color: 'hsl(215,20%,55%)' },
};

const permStyle = (name?: string) =>
  PERM_STYLE[name ?? ''] ?? { bg: 'hsla(215,20%,40%,0.1)', color: 'hsl(215,20%,55%)' };

const UsersRoles = () => {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const [subTab, setSubTab] = useState<SubTab>('users');
  const isSuperAdmin = user?.role === 'super_admin';

  // ── Users tab ────────────────────────────────────────────────────────────
  const [users,       setUsers]       = useState<UserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // ── Roles tab ────────────────────────────────────────────────────────────
  const [roles,       setRoles]       = useState<RoleResponse[]>([]);
  const [roleModules, setRoleModules] = useState<Record<number, RoleModuleAssignment[]>>({});
  const [rolesLoading, setRolesLoading] = useState(false);

  // ── Fetch users ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (subTab !== 'users') return;
    setUsersLoading(true);
    userService.listUsers(0, 50)
      .then(({ users }) => setUsers(users))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [subTab]);

  // ── Fetch roles + their module-permission assignments ────────────────────
  useEffect(() => {
    if (subTab !== 'roles') return;
    setRolesLoading(true);
    userService.listRoles()
      .then(async (fetchedRoles) => {
        setRoles(fetchedRoles);
        // Load module assignments for every role in parallel
        const entries = await Promise.all(
          fetchedRoles.map(async (r) => {
            try {
              const mods = await userService.getRoleModules(r.roleId);
              return [r.roleId, mods] as [number, RoleModuleAssignment[]];
            } catch {
              return [r.roleId, []] as [number, RoleModuleAssignment[]];
            }
          })
        );
        setRoleModules(Object.fromEntries(entries));
      })
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  }, [subTab]);

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
          Roles &amp; Permissions
        </button>
      </div>

      {/* ── Users tab ─────────────────────────────────────────────────────── */}
      {subTab === 'users' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Team Members</h3>
            {isSuperAdmin && (
              <button
                className={styles.addBtn}
                onClick={() => navigate(ROUTES.USERS)}
              >
                <ExternalLink size={14} style={{ marginRight: 5 }} />
                Manage Users
              </button>
            )}
          </div>

          {usersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'hsl(215,20%,45%)' }} />
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'hsl(215,20%,45%)', fontSize: 13.5 }}>
              No users found.{' '}
              {isSuperAdmin && (
                <button
                  onClick={() => navigate(ROUTES.USERS)}
                  style={{ background: 'none', border: 'none', color: 'hsl(221,83%,63%)', cursor: 'pointer', fontSize: 13.5 }}
                >
                  Add one →
                </button>
              )}
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Organisation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className={styles.userName}>{u.firstName} {u.lastName}</div>
                      <div className={styles.userEmail}>{u.email}</div>
                    </td>
                    <td>
                      {u.roleName ? (
                        <span className={styles.roleBadge}>{u.roleName}</span>
                      ) : (
                        <span style={{ color: 'hsl(215,20%,40%)', fontSize: 12.5 }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'hsl(215,20%,60%)', fontSize: 13 }}>
                      {u.orgName ?? '—'}
                    </td>
                    <td>
                      {u.statusName ? (
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: u.statusColourCode ? `${u.statusColourCode}22` : undefined,
                            color: u.statusColourCode ?? undefined,
                          }}
                        >
                          {u.statusName}
                        </span>
                      ) : (
                        <span style={{ color: 'hsl(215,20%,40%)', fontSize: 12.5 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {isSuperAdmin && users.length > 0 && (
            <div style={{ padding: '10px 24px 16px' }}>
              <button
                onClick={() => navigate(ROUTES.USERS)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none',
                  border: '1px solid hsl(217,33%,18%)', borderRadius: 7, padding: '6px 14px',
                  color: 'hsl(221,83%,63%)', cursor: 'pointer', fontSize: 13,
                }}
              >
                <Plus size={13} /> Add / Manage Users
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Roles & Permissions tab ───────────────────────────────────────── */}
      {subTab === 'roles' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <Shield size={15} style={{ marginRight: 7, verticalAlign: 'middle' }} />
              Role Definitions
            </h3>
            <span style={{ fontSize: 12, color: 'hsl(215,20%,45%)' }}>
              Managed via DB · role_module table
            </span>
          </div>

          {rolesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'hsl(215,20%,45%)' }} />
            </div>
          ) : roles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'hsl(215,20%,45%)', fontSize: 13.5 }}>
              No roles found in database.
            </div>
          ) : (
            <div className={styles.rolesGrid}>
              {roles.map((role) => {
                const mods = roleModules[role.roleId] ?? [];
                return (
                  <div key={role.roleId} className={styles.roleCard}>
                    <div className={styles.roleCardHeader}>
                      <div>
                        <div className={styles.roleCardTitle}>
                          <Shield size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                          {role.name}
                        </div>
                        {role.description && (
                          <div className={styles.roleCardDesc}>{role.description}</div>
                        )}
                        {role.designation && (
                          <div style={{ fontSize: 11.5, color: 'hsl(215,20%,40%)', marginTop: 2 }}>
                            {role.designation}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11, background: 'hsla(221,83%,53%,0.12)',
                        color: 'hsl(221,83%,63%)', padding: '2px 8px', borderRadius: 5,
                      }}>
                        {mods.length} module{mods.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {mods.length === 0 ? (
                      <p style={{ fontSize: 12.5, color: 'hsl(215,20%,38%)', padding: '0 0 4px' }}>
                        No modules assigned to this role yet.
                      </p>
                    ) : (
                      <div className={styles.permissionsGrid}>
                        {mods.map((m) => {
                          const ps = permStyle(m.permissionName);
                          return (
                            <div key={m.moduleId} className={styles.permissionItem}>
                              <span style={{ color: 'hsl(210,40%,80%)', fontSize: 13 }}>
                                {m.moduleName}
                              </span>
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px',
                                borderRadius: 5, background: ps.bg, color: ps.color,
                              }}>
                                {m.permissionName ?? 'None'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UsersRoles;
