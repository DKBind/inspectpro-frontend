import { useEffect, useState } from 'react';
import { useForm, useController, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Shield, Loader2, Eye, Pencil, Trash2, Plus, UserCircle,
  Mail, Lock, User, ChevronDown, Wand2, RefreshCw, AlertTriangle,
} from 'lucide-react';

import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserResponse, RoleResponse, RoleModuleAssignment } from '@/services/models/user';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import styles from './UsersRoles.module.css';
import { Fld, IcoInput, inputCls } from '@/components/shared-ui/form-helpers';

// ─── Permission badge colours ──────────────────────────────────────────────────
const PERM_STYLE: Record<string, { bg: string; color: string }> = {
  All:    { bg: 'hsla(262,83%,58%,0.15)', color: 'hsl(262,83%,72%)' },
  Write:  { bg: 'hsla(221,83%,53%,0.15)', color: 'hsl(221,83%,68%)' },
  Read:   { bg: 'hsla(142,71%,45%,0.15)', color: 'hsl(142,71%,55%)' },
  Delete: { bg: 'hsla(0,84%,60%,0.15)',   color: 'hsl(0,84%,65%)' },
  None:   { bg: 'hsla(215,20%,40%,0.15)', color: 'hsl(215,20%,55%)' },
};
const permStyle = (name?: string) => PERM_STYLE[name ?? ''] ?? PERM_STYLE.None;

// ─── Group module assignments by moduleId (Set deduplicates same permission) ──
const groupByModule = (mods: RoleModuleAssignment[]) => {
  const map = new Map<number, { moduleName: string; permissions: Set<string> }>();
  for (const m of mods) {
    if (!map.has(m.moduleId)) map.set(m.moduleId, { moduleName: m.moduleName, permissions: new Set() });
    if (m.permissionName) map.get(m.moduleId)!.permissions.add(m.permissionName);
  }
  return Array.from(map.entries()).map(([id, v]) => ({
    moduleId: id,
    moduleName: v.moduleName,
    permissions: Array.from(v.permissions),
  }));
};

// ─── Schema (no org required) ─────────────────────────────────────────────────
const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Enter a valid email'),
  password:  z.string().optional(),
  gender:    z.string().optional(),
  roleId:    z.string().min(1, 'Role is required'),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { firstName: '', lastName: '', email: '', password: '', gender: '', roleId: '' };

const selectCls = (hasError = false) =>
  `w-full inline-flex items-center justify-between h-10 rounded-md border bg-white px-3 text-sm font-normal text-[#263B4F] hover:bg-[#F3F4F6] focus:outline-none transition-all ${hasError ? 'border-red-500' : 'border-[#E5E7EB]'}`;

const PAGE_SIZE = 10;

// ─── Component ────────────────────────────────────────────────────────────────
type SubTab = 'users' | 'roles';

const UsersRoles = () => {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [subTab, setSubTab] = useState<SubTab>('users');

  // ── Users state ─────────────────────────────────────────────────────────────
  const [users, setUsers]         = useState<UserResponse[]>([]);
  const [total, setTotal]         = useState(0);
  const [currentPage, setCurrentPage] = useState(1);   // 1-based for Pagination component
  const [usersLoading, setUsersLoading] = useState(false);
  const [roles, setRoles]         = useState<RoleResponse[]>([]);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewUser, setViewUser]   = useState<UserResponse | null>(null);
  const [editTarget, setEditTarget] = useState<UserResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  // Status toggle
  const [toggleTarget, setToggleTarget] = useState<{ user: UserResponse; newActive: boolean } | null>(null);
  const [toggling, setToggling]   = useState(false);

  // ── Roles state ─────────────────────────────────────────────────────────────
  const [roleList, setRoleList]   = useState<RoleResponse[]>([]);
  const [roleModules, setRoleModules] = useState<Record<number, RoleModuleAssignment[]>>({});
  const [rolesLoading, setRolesLoading] = useState(false);

  // ── Form ────────────────────────────────────────────────────────────────────
  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { reset, handleSubmit, control, setValue, watch, formState: { errors } } = methods;

  const { field: firstNameField } = useController({ name: 'firstName', control });
  const { field: lastNameField }  = useController({ name: 'lastName',  control });
  const { field: emailField }     = useController({ name: 'email',     control });
  const { field: passwordField }  = useController({ name: 'password',  control });

  const selectedRoleId  = watch('roleId');
  const selectedGender  = watch('gender');
  const selectedRole    = roles.find((r) => String(r.roleId) === selectedRoleId);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const fetchUsers = async (page = currentPage) => {
    setUsersLoading(true);
    try {
      const [userData, rolesData] = await Promise.all([
        userService.listUsers(page - 1, PAGE_SIZE),   // API is 0-based
        userService.listRoles(),
      ]);
      setUsers(userData.users);
      setTotal(userData.total);
      setRoles(rolesData);
    } catch { toast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  useEffect(() => {
    if (subTab === 'users') fetchUsers(currentPage);
  }, [subTab, currentPage]);

  // ── Fetch roles ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (subTab !== 'roles') return;
    setRolesLoading(true);
    userService.listRoles()
      .then(async (fetched) => {
        setRoleList(fetched);
        const entries = await Promise.all(
          fetched.map(async (r) => {
            try { return [r.roleId, await userService.getRoleModules(r.roleId)] as [number, RoleModuleAssignment[]]; }
            catch { return [r.roleId, []] as [number, RoleModuleAssignment[]]; }
          })
        );
        setRoleModules(Object.fromEntries(entries));
      })
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  }, [subTab]);

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    setValue('password', Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
  };

  const openCreate = () => { reset(EMPTY); setEditTarget(null); setModalMode('create'); };

  const openEdit = (u: UserResponse) => {
    reset({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', gender: u.gender ?? '', roleId: u.roleId ? String(u.roleId) : '' });
    setEditTarget(u);
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditTarget(null); reset(EMPTY); };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        firstName: values.firstName,
        lastName:  values.lastName,
        email:     values.email,
        ...(values.password?.trim() && { password: values.password.trim() }),
        gender:    values.gender || undefined,
        roleId:    Number(values.roleId),
        statusId:  1,
        // Org is auto-set on backend from caller context; non-super-admin users inherit their org
        ...(!isSuperAdmin && authUser?.orgId ? { orgId: authUser.orgId } : {}),
      };
      if (modalMode === 'create') {
        await userService.createUser(payload);
        toast.success('User created successfully');
      } else if (editTarget) {
        await userService.updateUser(editTarget.id, { ...payload, statusId: editTarget.statusId ?? 1 });
        toast.success('User updated successfully');
      }
      closeModal();
      fetchUsers(currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await userService.deleteUser(deleteTarget.id);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers(currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally { setDeleting(false); }
  };

  // ── Toggle status ────────────────────────────────────────────────────────────
  const handleToggleStatus = (u: UserResponse) => {
    const isCurrentlyActive = (u.statusId ?? 1) === 1;
    setToggleTarget({ user: u, newActive: !isCurrentlyActive });
  };

  const doToggleStatus = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const { user: u, newActive } = toggleTarget;
      const newStatusId = newActive ? 1 : 2;
      await userService.updateUser(u.id, {
        firstName: u.firstName, lastName: u.lastName, email: u.email,
        gender: u.gender || undefined, orgId: u.orgId, roleId: u.roleId, statusId: newStatusId,
      });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, statusId: newStatusId, statusName: newActive ? 'Active' : 'Inactive' } : x));
      toast.success(`User marked as ${newActive ? 'Active' : 'Inactive'}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally { setToggling(false); setToggleTarget(null); }
  };

  // ── Filter roles to logged-in user's assigned roles ─────────────────────────
  const userRoleIds = new Set((authUser?.roles ?? []).map((r) => r.roleId));
  const visibleRoles = isSuperAdmin
    ? roleList
    : roleList.filter((r) => userRoleIds.has(r.roleId));

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.usersRolesPage}>
      {/* Sub-tabs */}
      <div className={styles.subTabs}>
        <button className={`${styles.subTab} ${subTab === 'users' ? styles.subTabActive : ''}`} onClick={() => setSubTab('users')}>Users</button>
        <button className={`${styles.subTab} ${subTab === 'roles' ? styles.subTabActive : ''}`} onClick={() => setSubTab('roles')}>Roles &amp; Permissions</button>
      </div>

      {/* ── Users tab ─────────────────────────────────────────────────────────── */}
      {subTab === 'users' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Team Members</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.addBtn} onClick={() => fetchUsers(currentPage)} title="Refresh" style={{ padding: '0 10px' }}>
                <RefreshCw size={13} />
              </button>
              <button className={styles.addBtn} onClick={openCreate}>
                <Plus size={14} style={{ marginRight: 5 }} /> Add User
              </button>
            </div>
          </div>

          {usersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'hsl(215,20%,45%)' }} />
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'hsl(215,20%,45%)', fontSize: 13.5 }}>
              No users found. Click "Add User" to create one.
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Organisation</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isActive = (u.statusId ?? 1) === 1;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className={styles.userName}>{u.firstName} {u.lastName}</div>
                          {u.gender && <div className={styles.userEmail}>{u.gender}</div>}
                        </td>
                        <td style={{ color: 'hsl(210,40%,75%)', fontSize: 13 }}>{u.email}</td>
                        <td>
                          {u.roleName
                            ? <span className={styles.roleBadge}>{u.roleName}</span>
                            : <span style={{ color: 'hsl(215,20%,40%)', fontSize: 12.5 }}>—</span>}
                        </td>
                        <td style={{ color: 'hsl(215,20%,60%)', fontSize: 13 }}>{u.orgName ?? '—'}</td>
                        <td>
                          <button
                            className={`${styles.statusToggle} ${isActive ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => handleToggleStatus(u)}
                            disabled={toggling}
                            title={isActive ? 'Click to deactivate' : 'Click to activate'}
                          >
                            </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                            <button className={styles.actionBtn} title="View" onClick={() => setViewUser(u)}><Eye size={13} /></button>
                            <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(u)}><Pencil size={13} /></button>
                            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Delete" onClick={() => setDeleteTarget(u)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className={styles.paginationArea}>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={total}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Roles tab ─────────────────────────────────────────────────────────── */}
      {subTab === 'roles' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Shield size={15} />
              Role Definitions
            </h3>
          </div>

          {rolesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'hsl(215,20%,45%)' }} />
            </div>
          ) : visibleRoles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'hsl(215,20%,45%)', fontSize: 13.5 }}>No roles found.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Role</th>
                  <th>Module</th>
                  <th style={{ width: 220 }}>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRoles.map((role) => {
                  const grouped = groupByModule(roleModules[role.roleId] ?? []);
                  if (grouped.length === 0) {
                    return (
                      <tr key={role.roleId}>
                        <td>
                          <span className={styles.roleBadge}>
                            <Shield size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                            {role.name}
                          </span>
                        </td>
                        <td colSpan={2} style={{ color: 'hsl(215,20%,38%)', fontSize: 12.5, fontStyle: 'italic' }}>
                          No modules assigned
                        </td>
                      </tr>
                    );
                  }
                  return grouped.map((m, idx) => (
                    <tr key={`${role.roleId}-${m.moduleId}`}>
                      <td>
                        {idx === 0 ? (
                          <span className={styles.roleBadge}>
                            <Shield size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                            {role.name}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ color: 'hsl(210,40%,75%)', fontSize: 13 }}>{m.moduleName}</td>
                      <td>
                        <div className={styles.permBadges}>
                          {m.permissions.map((p) => {
                            const ps = permStyle(p);
                            return (
                              <span key={p} className={styles.permBadge} style={{ background: ps.bg, color: ps.color }}>
                                {p}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <UserCircle size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {modalMode === 'create' ? 'Add User' : 'Edit User'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {modalMode === 'create' ? 'Fill in the details to create a new user.' : 'Update the user information below.'}
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
              <div className="px-7 py-6 space-y-5">

                {/* Name row */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="First Name" required error={errors.firstName?.message}>
                    <IcoInput icon={<User size={15} />}>
                      <Input placeholder="John" {...firstNameField} className={inputCls(!!errors.firstName)} />
                    </IcoInput>
                  </Fld>
                  <Fld label="Last Name" required error={errors.lastName?.message}>
                    <IcoInput icon={<User size={15} />}>
                      <Input placeholder="Doe" {...lastNameField} className={inputCls(!!errors.lastName)} />
                    </IcoInput>
                  </Fld>
                </div>

                {/* Email + Password row */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="Email" required error={errors.email?.message}>
                    <IcoInput icon={<Mail size={15} />}>
                      <Input type="email" autoComplete="off" placeholder="john@example.com" {...emailField} className={inputCls(!!errors.email)} />
                    </IcoInput>
                  </Fld>
                  <Fld label={modalMode === 'create' ? 'Password' : 'New Password'}>
                    <div className="flex gap-2">
                      <IcoInput icon={<Lock size={15} />}>
                        <Input type="text" autoComplete="new-password" placeholder={modalMode === 'create' ? 'Set a password' : 'Leave blank to keep current'} {...passwordField} className={inputCls(false)} />
                      </IcoInput>
                      <button type="button" onClick={generatePassword} title="Generate"
                        className="shrink-0 h-10 px-3 rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#33AE95] hover:border-[#33AE95] transition-all flex items-center gap-1.5 text-xs font-medium">
                        <Wand2 size={13} />
                      </button>
                    </div>
                  </Fld>
                </div>

                {/* Gender + Role row */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="Gender">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className={selectCls()}>
                        <span className={selectedGender ? 'text-[#263B4F]' : 'text-[#6B7280]'}>{selectedGender || '— Select gender —'}</span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                        {['Male', 'Female', 'Other'].map((g) => (
                          <DropdownMenuItem key={g} onSelect={() => setValue('gender', g)} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">{g}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Fld>
                  <Fld label="Role" required error={errors.roleId?.message}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className={selectCls(!!errors.roleId)}>
                        <span className={selectedRole ? 'text-[#263B4F]' : 'text-[#6B7280]'}>{selectedRole ? selectedRole.name : '— Select role —'}</span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                        {roles.map((r) => (
                          <DropdownMenuItem key={r.roleId} onSelect={() => setValue('roleId', String(r.roleId), { shouldValidate: true })} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">{r.name}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Fld>
                </div>

              </div>

              <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
                <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}
                  className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
                <Button type="submit" disabled={submitting}
                  className="flex-1 sm:flex-none sm:min-w-44 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg active:scale-95">
                  {submitting
                    ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{modalMode === 'create' ? 'Creating...' : 'Saving...'}</span>
                    : modalMode === 'create' ? 'Create User' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {/* ── View Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="sm:max-w-md shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <UserCircle size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-[#263B4F] text-lg font-bold">User Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-1 mt-2">
              {([
                ['Name',         `${viewUser.firstName} ${viewUser.lastName}`],
                ['Email',        viewUser.email],
                ['Gender',       viewUser.gender ?? '—'],
                ['Organisation', viewUser.orgName ?? '—'],
                ['Role',         viewUser.roleName ?? '—'],
                ['Status',       viewUser.statusName ?? '—'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex gap-3 py-2 border-b border-[#E5E7EB] last:border-0">
                  <span className="text-[#9CA3AF] min-w-28 text-sm">{label}</span>
                  <span className="text-[#263B4F] font-medium text-sm">{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setViewUser(null)} className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-[#263B4F]">Delete User</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              Are you sure you want to delete <span className="text-[#263B4F] font-medium">{deleteTarget?.firstName} {deleteTarget?.lastName}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Status Toggle Confirmation ─────────────────────────────────────────── */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent className="sm:max-w-md shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-yellow-600/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-yellow-400" />
              </div>
              <DialogTitle className="text-[#263B4F]">Confirm Status Change</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              {toggleTarget?.newActive
                ? <>Activating <span className="text-[#263B4F] font-medium">{toggleTarget.user.firstName} {toggleTarget.user.lastName}</span> will restore their access. Proceed?</>
                : <>Deactivating <span className="text-[#263B4F] font-medium">{toggleTarget?.user.firstName} {toggleTarget?.user.lastName}</span> will remove their access. Proceed?</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setToggleTarget(null)} disabled={toggling}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={doToggleStatus} disabled={toggling}
              className={`text-white font-semibold min-w-28 ${toggleTarget?.newActive ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}>
              {toggling
                ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</span>
                : toggleTarget?.newActive ? 'Activate' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersRoles;
