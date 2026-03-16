import { useEffect, useState } from 'react';
import { useForm, useController, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users as UsersIcon, Plus, RefreshCw, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, UserCircle, Mail, Lock, User,
  ChevronDown, Building2, Shield, Trash2 as DeleteIcon, Wand2,
} from 'lucide-react';

import { userService } from '@/services/userService';
import { organisationService } from '@/services/organisationService';
import type { UserResponse, RoleResponse } from '@/services/models/user';
import type { OrganisationResponse } from '@/services/models/organisation';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sec, Fld, IcoInput, inputCls } from '@/components/ui/form-helpers';
import styles from './Users.module.css';

const PAGE_SIZE = 10;

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

const EMPTY: FormValues = {
  firstName: '', lastName: '', email: '', password: '',
  gender: '', orgId: '', roleId: '', statusId: '1',
};

const selectCls = (hasError = false) =>
  `w-full inline-flex items-center justify-between h-10 rounded-md border bg-slate-950/60 px-3 text-sm font-normal text-white hover:bg-slate-900 focus:outline-none transition-all ${hasError ? 'border-red-500' : 'border-slate-700'}`;

// ─── Component ────────────────────────────────────────────────────────────────

const Users = () => {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [users,       setUsers]       = useState<UserResponse[]>([]);
  const [total,       setTotal]       = useState(0);
  const [roles,       setRoles]       = useState<RoleResponse[]>([]);
  const [orgs,        setOrgs]        = useState<OrganisationResponse[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [modalMode,   setModalMode]   = useState<'create' | 'edit' | null>(null);
  const [viewUser,    setViewUser]    = useState<UserResponse | null>(null);
  const [editTarget,  setEditTarget]  = useState<UserResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

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

  const selectedOrg  = orgs.find((o) => o.uuid === selectedOrgId);
  const selectedRole = roles.find((r) => String(r.roleId) === selectedRoleId);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [userData, orgsData, rolesData] = await Promise.all([
        userService.listUsers(currentPage, PAGE_SIZE),
        organisationService.getOrganisations(0, 1000),
        userService.listRoles(),
      ]);
      setUsers(userData.users);
      setTotal(userData.total);
      setOrgs(orgsData.content ?? []);
      setRoles(rolesData);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [currentPage]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setValue('password', pwd);
  };

  const emptyForm = (): FormValues => ({
    ...EMPTY,
    // Auto-set org for non-super-admin users
    orgId: !isSuperAdmin && authUser?.orgId ? authUser.orgId : '',
  });

  // ─── Open Modals ───────────────────────────────────────────────────────────

  const openCreate = () => {
    reset(emptyForm());
    setEditTarget(null);
    setModalMode('create');
  };

  const openEdit = (u: UserResponse) => {
    reset({
      firstName: u.firstName,
      lastName:  u.lastName,
      email:     u.email,
      password:  '',
      gender:    u.gender ?? '',
      orgId:     u.orgId  ?? '',
      roleId:    u.roleId ? String(u.roleId) : '',
      statusId:  u.statusId ? String(u.statusId) : '1',
    });
    setEditTarget(u);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditTarget(null);
    reset(emptyForm());
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        firstName: values.firstName,
        lastName:  values.lastName,
        email:     values.email,
        ...(values.password?.trim() && { password: values.password.trim() }),
        gender:    values.gender || undefined,
        orgId:     values.orgId,
        roleId:    Number(values.roleId),
        statusId:  values.statusId ? Number(values.statusId) : 1,
      };

      if (modalMode === 'create') {
        await userService.createUser(payload);
        toast.success('User created successfully');
      } else if (editTarget) {
        await userService.updateUser(editTarget.id, payload);
        toast.success('User updated successfully');
      }

      closeModal();
      fetchAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await userService.deleteUser(deleteTarget.id);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Users</h1>
          <p className={styles.pageSubtitle}>Manage users and assign roles</p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <Plus size={15} style={{ marginRight: 6 }} /> Add User
        </button>
      </div>

      {/* Table panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            <UsersIcon size={16} style={{ marginRight: 8 }} />
            All Users
            <span className={styles.countBadge}>{total}</span>
          </span>
          <button className={styles.refreshBtn} onClick={fetchAll} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
            </div>
          ) : users.length === 0 ? (
            <div className={styles.emptyState}>
              No users found.
              <span className={styles.emptySubtext}>Click "Add User" to create the first one.</span>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Organisation</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={styles.tableRow}>
                    <td>
                      <div className={styles.orgCell}>
                        <div className={styles.orgIcon}><UserCircle size={16} /></div>
                        <div>
                          <span className={styles.orgName}>{u.firstName} {u.lastName}</span>
                          <span className={styles.orgMeta}>{u.gender ?? '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.mutedCell}>{u.email}</td>
                    <td>
                      {u.roleName
                        ? <span className={`${styles.planBadge} ${styles.planPro}`}>{u.roleName}</span>
                        : <span className={styles.mutedCell}>—</span>}
                    </td>
                    <td className={styles.mutedCell}>{u.orgName ?? '—'}</td>
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
                      ) : <span className={styles.mutedCell}>—</span>}
                    </td>
                    <td>
                      <div className={styles.actionBtns} style={{ justifyContent: 'center' }}>
                        <button className={styles.actionBtn} title="View" onClick={() => setViewUser(u)}><Eye size={14} /></button>
                        <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(u)}><Pencil size={14} /></button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Delete" onClick={() => setDeleteTarget(u)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className={styles.paginationArea} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}>
              <button className={styles.actionBtn} disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 13, color: 'hsl(215,20%,60%)' }}>Page {currentPage + 1} of {totalPages}</span>
              <button className={styles.actionBtn} disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}><ChevronRight size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <UsersIcon size={18} className="text-blue-400" />
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

                {/* Personal Info */}
                <Sec icon={<User size={13} />} label="Personal Information">
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
                            <Input
                              type="text"
                              autoComplete="new-password"
                              placeholder={modalMode === 'create' ? 'Set a password' : 'Leave blank to keep current'}
                              {...passwordField}
                              className={inputCls(false)}
                            />
                          </IcoInput>
                          <button
                            type="button"
                            onClick={generatePassword}
                            title="Generate password"
                            className="shrink-0 h-10 px-3 rounded-md border border-slate-700 bg-slate-900 text-slate-400 hover:text-blue-400 hover:border-blue-500 transition-all flex items-center gap-1.5 text-xs font-medium"
                          >
                            <Wand2 size={13} />
                            Generate
                          </button>
                        </div>
                      </Fld>
                      <Fld label="Gender">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls()}>
                            <span className={selectedGender ? 'text-white' : 'text-slate-400'}>
                              {selectedGender || '— Select gender —'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="!bg-[#1e293b] border-slate-700 text-white z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            {['Male', 'Female', 'Other'].map((g) => (
                              <DropdownMenuItem key={g} onSelect={() => setValue('gender', g)} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">
                                {g}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                      <Fld label="Status">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls()}>
                            <span className="text-white">
                              {selectedStatus === '2' ? 'Inactive' : 'Active'}
                            </span>
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
                </Sec>

                {/* Organisation & Role */}
                <Sec icon={<Shield size={13} />} label="Organisation & Role">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Org — show picker only for super_admin; others see their own org */}
                      <Fld label="Organisation" required error={errors.orgId?.message}>
                        {isSuperAdmin ? (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className={selectCls(!!errors.orgId)}>
                              <span className={selectedOrg ? 'text-white' : 'text-slate-400'}>
                                {selectedOrg ? selectedOrg.name : '— Select organisation —'}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="!bg-[#1e293b] border-slate-700 text-white z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                              {orgs.map((o) => (
                                <DropdownMenuItem key={o.uuid} onSelect={() => setValue('orgId', o.uuid, { shouldValidate: true })} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">
                                  {o.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          /* Non-super-admin: show their org read-only */
                          <div className="h-10 rounded-md border border-slate-700 bg-slate-950/30 px-3 flex items-center gap-2 text-sm text-slate-300">
                            <Building2 size={14} className="text-slate-500" />
                            {orgs.find((o) => o.uuid === authUser?.orgId)?.name ?? authUser?.orgId ?? '—'}
                          </div>
                        )}
                      </Fld>

                      <Fld label="Role" required error={errors.roleId?.message}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls(!!errors.roleId)}>
                            <span className={selectedRole ? 'text-white' : 'text-slate-400'}>
                              {selectedRole ? selectedRole.name : '— Select role —'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="!bg-[#1e293b] border-slate-700 text-white z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            {roles.map((r) => (
                              <DropdownMenuItem key={r.roleId} onSelect={() => setValue('roleId', String(r.roleId), { shouldValidate: true })} className="cursor-pointer focus:bg-slate-800 focus:text-white py-2.5">
                                {r.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                    </div>
                  </div>
                </Sec>

              </div>

              <DialogFooter className="px-7 py-5 border-t border-slate-800 bg-slate-900/30 rounded-b-2xl flex gap-3">
                <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}
                  className="flex-1 sm:flex-none sm:min-w-44 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg active:scale-95">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {modalMode === 'create' ? 'Creating...' : 'Saving...'}
                    </span>
                  ) : modalMode === 'create' ? 'Create User' : 'Save Changes'}
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
            <div className="space-y-3 mt-2">
              {[
                ['Name',         `${viewUser.firstName} ${viewUser.lastName}`],
                ['Email',        viewUser.email],
                ['Gender',       viewUser.gender  ?? '—'],
                ['Organisation', viewUser.orgName ?? '—'],
                ['Role',         viewUser.roleName ?? '—'],
                ['Status',       viewUser.statusName ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3 py-2 border-b border-slate-800 last:border-0">
                  <span className="text-slate-500 min-w-28 text-sm">{label}</span>
                  <span className="text-slate-200 font-medium text-sm">{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setViewUser(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <DeleteIcon size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-white">Delete User</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 pl-[52px]">
              Are you sure you want to delete{' '}
              <span className="text-white font-medium">{deleteTarget?.firstName} {deleteTarget?.lastName}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting
                ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</span>
                : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
