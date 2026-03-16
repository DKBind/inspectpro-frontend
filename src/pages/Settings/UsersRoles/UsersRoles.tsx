import { useEffect, useState } from 'react';
import { useForm, useController, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Shield, Loader2, Eye, Pencil, Trash2, Plus, UserCircle,
  Mail, Lock, User, ChevronDown, Building2, Wand2, RefreshCw,
} from 'lucide-react';

import { userService } from '@/services/userService';
import { organisationService } from '@/services/organisationService';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserResponse, RoleResponse, RoleModuleAssignment } from '@/services/models/user';
import type { OrganisationResponse } from '@/services/models/organisation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Fld, IcoInput, inputCls } from '@/components/ui/form-helpers';
import styles from './UsersRoles.module.css';

// ─── Permission badge ─────────────────────────────────────────────────────────
const PERM_STYLE: Record<string, { bg: string; color: string }> = {
  All:    { bg: 'hsla(262,83%,58%,0.15)', color: 'hsl(262,83%,72%)' },
  Write:  { bg: 'hsla(221,83%,53%,0.15)', color: 'hsl(221,83%,68%)' },
  Read:   { bg: 'hsla(142,71%,45%,0.15)', color: 'hsl(142,71%,55%)' },
  Delete: { bg: 'hsla(0,84%,60%,0.15)',   color: 'hsl(0,84%,65%)'   },
  None:   { bg: 'hsla(215,20%,40%,0.15)', color: 'hsl(215,20%,55%)' },
};
const permStyle = (name?: string) => PERM_STYLE[name ?? ''] ?? PERM_STYLE.None;

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Enter a valid email'),
  password:  z.string().optional(),
  gender:    z.string().optional(),
  orgId:     z.string().min(1, 'Organisation is required'),
  roleId:    z.string().min(1, 'Role is required'),
  statusId:  z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { firstName: '', lastName: '', email: '', password: '', gender: '', orgId: '', roleId: '', statusId: '1' };

const selectCls = (hasError = false) =>
  `w-full inline-flex items-center justify-between h-10 rounded-md border bg-slate-950/60 px-3 text-sm font-normal text-white hover:bg-slate-900 focus:outline-none transition-all ${hasError ? 'border-red-500' : 'border-slate-700'}`;

// ─── Component ────────────────────────────────────────────────────────────────
type SubTab = 'users' | 'roles';

const UsersRoles = () => {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [subTab, setSubTab] = useState<SubTab>('users');

  // ── Users state ────────────────────────────────────────────────────────────
  const [users,        setUsers]        = useState<UserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [orgs,         setOrgs]         = useState<OrganisationResponse[]>([]);
  const [roles,        setRoles]        = useState<RoleResponse[]>([]);
  const [modalMode,    setModalMode]    = useState<'create' | 'edit' | null>(null);
  const [viewUser,     setViewUser]     = useState<UserResponse | null>(null);
  const [editTarget,   setEditTarget]   = useState<UserResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  // ── Roles state ────────────────────────────────────────────────────────────
  const [roleList,    setRoleList]    = useState<RoleResponse[]>([]);
  const [roleModules, setRoleModules] = useState<Record<number, RoleModuleAssignment[]>>({});
  const [rolesLoading, setRolesLoading] = useState(false);

  // ── Form ───────────────────────────────────────────────────────────────────
  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { reset, handleSubmit, control, setValue, watch, formState: { errors } } = methods;

  const { field: firstNameField } = useController({ name: 'firstName', control });
  const { field: lastNameField  } = useController({ name: 'lastName',  control });
  const { field: emailField     } = useController({ name: 'email',     control });
  const { field: passwordField  } = useController({ name: 'password',  control });

  const selectedOrgId  = watch('orgId');
  const selectedRoleId = watch('roleId');
  const selectedGender = watch('gender');
  const selectedStatus = watch('statusId');
  const selectedOrg    = orgs.find((o) => o.uuid === selectedOrgId);
  const selectedRole   = roles.find((r) => String(r.roleId) === selectedRoleId);

  // ── Fetch users tab data ────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const [userData, orgsData, rolesData] = await Promise.all([
        userService.listUsers(0, 100),
        organisationService.getOrganisations(0, 1000),
        userService.listRoles(),
      ]);
      setUsers(userData.users);
      setOrgs(orgsData.content ?? []);
      setRoles(rolesData);
    } catch { toast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  useEffect(() => { if (subTab === 'users') fetchUsers(); }, [subTab]);

  // ── Fetch roles tab data ────────────────────────────────────────────────────
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

  // ── Form helpers ───────────────────────────────────────────────────────────
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    setValue('password', Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
  };

  const emptyForm = (): FormValues => ({
    ...EMPTY,
    orgId: !isSuperAdmin && authUser?.orgId ? authUser.orgId : '',
  });

  const openCreate = () => { reset(emptyForm()); setEditTarget(null); setModalMode('create'); };

  const openEdit = (u: UserResponse) => {
    reset({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', gender: u.gender ?? '', orgId: u.orgId ?? '', roleId: u.roleId ? String(u.roleId) : '', statusId: u.statusId ? String(u.statusId) : '1' });
    setEditTarget(u);
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditTarget(null); reset(emptyForm()); };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        firstName: values.firstName, lastName: values.lastName, email: values.email,
        ...(values.password?.trim() && { password: values.password.trim() }),
        gender: values.gender || undefined, orgId: values.orgId,
        roleId: Number(values.roleId), statusId: values.statusId ? Number(values.statusId) : 1,
      };
      if (modalMode === 'create') {
        await userService.createUser(payload);
        toast.success('User created successfully');
      } else if (editTarget) {
        await userService.updateUser(editTarget.id, payload);
        toast.success('User updated successfully');
      }
      closeModal();
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await userService.deleteUser(deleteTarget.id);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally { setDeleting(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.usersRolesPage}>
      {/* Sub-tabs */}
      <div className={styles.subTabs}>
        <button className={`${styles.subTab} ${subTab === 'users' ? styles.subTabActive : ''}`} onClick={() => setSubTab('users')}>Users</button>
        <button className={`${styles.subTab} ${subTab === 'roles' ? styles.subTabActive : ''}`} onClick={() => setSubTab('roles')}>Roles &amp; Permissions</button>
      </div>

      {/* ── Users tab ───────────────────────────────────────────────────────── */}
      {subTab === 'users' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Team Members</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.addBtn} onClick={fetchUsers} title="Refresh" style={{ padding: '0 10px' }}>
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
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Organisation</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
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
                      {u.roleName
                        ? <span className={styles.roleBadge}>{u.roleName}</span>
                        : <span style={{ color: 'hsl(215,20%,40%)', fontSize: 12.5 }}>—</span>}
                    </td>
                    <td style={{ color: 'hsl(215,20%,60%)', fontSize: 13 }}>{u.orgName ?? '—'}</td>
                    <td>
                      {u.statusName
                        ? <span className={styles.statusBadge} style={{ background: u.statusColourCode ? `${u.statusColourCode}22` : undefined, color: u.statusColourCode ?? undefined }}>{u.statusName}</span>
                        : <span style={{ color: 'hsl(215,20%,40%)', fontSize: 12.5 }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <button className={styles.actionBtn} title="View" onClick={() => setViewUser(u)}><Eye size={13} /></button>
                        <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(u)}><Pencil size={13} /></button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Delete" onClick={() => setDeleteTarget(u)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Roles tab ───────────────────────────────────────────────────────── */}
      {subTab === 'roles' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <Shield size={15} style={{ marginRight: 7, verticalAlign: 'middle' }} />
              Role Definitions
            </h3>
            <span style={{ fontSize: 12, color: 'hsl(215,20%,45%)' }}>Managed via DB · role_module table</span>
          </div>

          {rolesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'hsl(215,20%,45%)' }} />
            </div>
          ) : roleList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'hsl(215,20%,45%)', fontSize: 13.5 }}>No roles found.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Role</th>
                  <th>Module</th>
                  <th style={{ width: 120 }}>Permission</th>
                </tr>
              </thead>
              <tbody>
                {roleList.map((role) => {
                  const mods = roleModules[role.roleId] ?? [];
                  if (mods.length === 0) {
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
                  return mods.map((m, idx) => {
                    const ps = permStyle(m.permissionName);
                    return (
                      <tr key={`${role.roleId}-${m.moduleId}`}>
                        {idx === 0 && (
                          <td rowSpan={mods.length} style={{ verticalAlign: 'top', paddingTop: 16 }}>
                            <span className={styles.roleBadge}>
                              <Shield size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                              {role.name}
                            </span>
                          </td>
                        )}
                        <td style={{ color: 'hsl(210,40%,75%)', fontSize: 13 }}>{m.moduleName}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: ps.bg, color: ps.color }}>
                            {m.permissionName ?? 'None'}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <UserCircle size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                {modalMode === 'create' ? 'Add User' : 'Edit User'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 text-sm pl-12">
              {modalMode === 'create' ? 'Fill in the details to create a new user.' : 'Update the user information below.'}
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
              <div className="px-7 py-6 space-y-6">

                {/* Personal */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-blue-400"><User size={13} /></span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Personal Information</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
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
                          <button type="button" onClick={generatePassword} title="Generate password"
                            className="shrink-0 h-10 px-3 rounded-md border border-slate-700 bg-slate-900 text-slate-400 hover:text-blue-400 hover:border-blue-500 transition-all flex items-center gap-1.5 text-xs font-medium">
                            <Wand2 size={13} />Generate
                          </button>
                        </div>
                      </Fld>
                      <Fld label="Gender">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls()}>
                            <span className={selectedGender ? 'text-white' : 'text-slate-400'}>{selectedGender || '— Select gender —'}</span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="!bg-[#1e293b] border-slate-700 text-white z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            {['Male', 'Female', 'Other'].map((g) => (
                              <DropdownMenuItem key={g} onSelect={() => setValue('gender', g)} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">{g}</DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                      <Fld label="Status">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls()}>
                            <span className="text-white">{selectedStatus === '2' ? 'Inactive' : 'Active'}</span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="!bg-[#1e293b] border-slate-700 text-white z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            <DropdownMenuItem onSelect={() => setValue('statusId', '1')} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">Active</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setValue('statusId', '2')} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">Inactive</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                    </div>
                  </div>
                </section>

                {/* Org & Role */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-blue-400"><Shield size={13} /></span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Organisation &amp; Role</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Fld label="Organisation" required error={errors.orgId?.message}>
                        {isSuperAdmin ? (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className={selectCls(!!errors.orgId)}>
                              <span className={selectedOrg ? 'text-white' : 'text-slate-400'}>{selectedOrg ? selectedOrg.name : '— Select organisation —'}</span>
                              <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="!bg-[#1e293b] border-slate-700 text-white z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                              {orgs.map((o) => (
                                <DropdownMenuItem key={o.uuid} onSelect={() => setValue('orgId', o.uuid, { shouldValidate: true })} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">{o.name}</DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <div className="h-10 rounded-md border border-slate-700 bg-slate-950/30 px-3 flex items-center gap-2 text-sm text-slate-300">
                            <Building2 size={14} className="text-slate-500" />
                            {orgs.find((o) => o.uuid === authUser?.orgId)?.name ?? authUser?.orgId ?? '—'}
                          </div>
                        )}
                      </Fld>
                      <Fld label="Role" required error={errors.roleId?.message}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls(!!errors.roleId)}>
                            <span className={selectedRole ? 'text-white' : 'text-slate-400'}>{selectedRole ? selectedRole.name : '— Select role —'}</span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="!bg-[#1e293b] border-slate-700 text-white z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            {roles.map((r) => (
                              <DropdownMenuItem key={r.roleId} onSelect={() => setValue('roleId', String(r.roleId), { shouldValidate: true })} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">{r.name}</DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                    </div>
                  </div>
                </section>
              </div>

              <DialogFooter className="px-7 py-5 border-t border-slate-800 bg-slate-900/30 rounded-b-2xl flex gap-3">
                <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">Cancel</Button>
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

      {/* ── View Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <UserCircle size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-white text-lg font-bold">User Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-1 mt-2">
              {([['Name', `${viewUser.firstName} ${viewUser.lastName}`], ['Email', viewUser.email], ['Gender', viewUser.gender ?? '—'], ['Organisation', viewUser.orgName ?? '—'], ['Role', viewUser.roleName ?? '—'], ['Status', viewUser.statusName ?? '—']] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex gap-3 py-2 border-b border-slate-800 last:border-0">
                  <span className="text-slate-500 min-w-28 text-sm">{label}</span>
                  <span className="text-slate-200 font-medium text-sm">{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setViewUser(null)} className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Modal ────────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-white">Delete User</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 pl-[52px]">
              Are you sure you want to delete <span className="text-white font-medium">{deleteTarget?.firstName} {deleteTarget?.lastName}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersRoles;
