import { useEffect, useState } from 'react';
import { useForm, useController, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users as UsersIcon, Plus, RefreshCw, Eye, Pencil, Trash2,
  UserCircle, Mail, Lock, User,
  ChevronDown, Building2, Shield, Wand2,
  DeleteIcon,
} from 'lucide-react';
import Pagination from '@/components/shared-ui/Pagination/Pagination';

import { userService } from '@/services/userService';
import { organisationService } from '@/services/organisationService';
import type { UserResponse, RoleResponse } from '@/services/models/user';
import type { OrganisationResponse } from '@/services/models/organisation';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Label } from '@/components/shared-ui/Label/label';
import styles from './Users.module.css';
import { inputCls } from '@/components/shared-ui/form-helpers';

const PAGE_SIZE = 10;

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().optional(),
  gender: z.string().optional(),
  orgId: z.string().min(1, 'Organisation is required'),
  roleId: z.string().min(1, 'Role is required'),
  statusId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  firstName: '', lastName: '', email: '', password: '',
  gender: '', orgId: '', roleId: '', statusId: '1',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Sec({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#33AE95]">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">{label}</span>
      </div>
      {children}
    </section>
  );
}

function Fld({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-[#263B4F] text-sm font-medium">{label}</Label>
        {required && <span className="text-[#DF453A] text-xs">*</span>}
      </div>
      {children}
      {error && <p className="text-xs text-[#DF453A]">{error}</p>}
    </div>
  );
}

function IcoInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10">{icon}</span>
      <div className="[&_input]:pl-9">{children}</div>
    </div>
  );
}

const selectCls = (hasError = false) =>
  `w-full inline-flex items-center justify-between h-10 rounded-md border bg-white px-3 text-sm font-normal text-[#263B4F] hover:bg-[#F3F4F6] focus:outline-none transition-all ${hasError ? 'border-[#DF453A]' : 'border-[#E5E7EB]'}`;

// ─── Component ────────────────────────────────────────────────────────────────

const Users = () => {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [orgs, setOrgs] = useState<OrganisationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewUser, setViewUser] = useState<UserResponse | null>(null);
  const [editTarget, setEditTarget] = useState<UserResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { reset, handleSubmit, control, setValue, watch, formState: { errors } } = methods;

  const { field: firstNameField } = useController({ name: 'firstName', control });
  const { field: lastNameField } = useController({ name: 'lastName', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: passwordField } = useController({ name: 'password', control });

  const selectedOrgId = watch('orgId');
  const selectedRoleId = watch('roleId');
  const selectedGender = watch('gender');
  const selectedStatus = watch('statusId');

  const selectedOrg = orgs.find((o) => o.uuid === selectedOrgId);
  const selectedRole = roles.find((r) => String(r.roleId) === selectedRoleId);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [userData, orgsData, rolesData] = await Promise.all([
        userService.listUsers(currentPage - 1, pageSize),
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

  useEffect(() => { fetchAll(); }, [currentPage, pageSize]);

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
      lastName: u.lastName,
      email: u.email,
      password: '',
      gender: u.gender ?? '',
      orgId: u.orgId ?? '',
      roleId: u.roleId ? String(u.roleId) : '',
      statusId: u.statusId ? String(u.statusId) : '1',
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
        lastName: values.lastName,
        email: values.email,
        ...(values.password?.trim() && { password: values.password.trim() }),
        gender: values.gender || undefined,
        orgId: values.orgId,
        roleId: Number(values.roleId),
        statusId: values.statusId ? Number(values.statusId) : 1,
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
                        <span className={styles.orgName}>{u.firstName} {u.lastName}</span>
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

          <div className={styles.paginationArea}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center">
                <UsersIcon size={18} className="text-[#33AE95]" />
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
              <div className="px-7 py-6 space-y-6">

                {/* Personal Info */}
                <Sec icon={<User size={13} />} label="Personal Information">
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
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
                            className="shrink-0 h-10 px-3 rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#33AE95] hover:border-[#33AE95] transition-all flex items-center gap-1.5 text-xs font-medium"
                          >
                            <Wand2 size={13} />
                            Generate
                          </button>
                        </div>
                      </Fld>
                      <Fld label="Gender">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls()}>
                            <span className={selectedGender ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                              {selectedGender || '— Select gender —'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            {['Male', 'Female', 'Other'].map((g) => (
                              <DropdownMenuItem key={g} onSelect={() => setValue('gender', g)} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">
                                {g}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                      <Fld label="Status">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls()}>
                            <span className="text-[#263B4F]">
                              {selectedStatus === '2' ? 'Inactive' : 'Active'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            <DropdownMenuItem onSelect={() => setValue('statusId', '1')} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">Active</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setValue('statusId', '2')} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">Inactive</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                    </div>
                  </div>
                </Sec>

                {/* Organisation & Role */}
                <Sec icon={<Shield size={13} />} label="Organisation & Role">
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Org — show picker only for super_admin; others see their own org */}
                      <Fld label="Organisation" required error={errors.orgId?.message}>
                        {isSuperAdmin ? (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className={selectCls(!!errors.orgId)}>
                              <span className={selectedOrg ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                                {selectedOrg ? selectedOrg.name : '— Select organisation —'}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                              {orgs.map((o) => (
                                <DropdownMenuItem key={o.uuid} onSelect={() => setValue('orgId', o.uuid, { shouldValidate: true })} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">
                                  {o.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          /* Non-super-admin: show their org read-only */
                          <div className="h-10 rounded-md border border-[#E5E7EB] bg-[#F3F4F6] px-3 flex items-center gap-2 text-sm text-[#263B4F]">
                            <Building2 size={14} className="text-[#6B7280]" />
                            {orgs.find((o) => o.uuid === authUser?.orgId)?.name ?? authUser?.orgId ?? '—'}
                          </div>
                        )}
                      </Fld>

                      <Fld label="Role" required error={errors.roleId?.message}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls(!!errors.roleId)}>
                            <span className={selectedRole ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                              {selectedRole ? selectedRole.name : '— Select role —'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                            {roles.map((r) => (
                              <DropdownMenuItem key={r.roleId} onSelect={() => setValue('roleId', String(r.roleId), { shouldValidate: true })} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">
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

              <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}
                  className="flex-1 sm:flex-none sm:min-w-44 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg active:scale-95">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center">
                <UserCircle size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-[#263B4F] text-lg font-bold">User Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-3 mt-2">
              {[
                ['Name', `${viewUser.firstName} ${viewUser.lastName}`],
                ['Email', viewUser.email],
                ['Gender', viewUser.gender ?? '—'],
                ['Organisation', viewUser.orgName ?? '—'],
                ['Role', viewUser.roleName ?? '—'],
                ['Status', viewUser.statusName ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3 py-2 border-b border-[#E5E7EB] last:border-0">
                  <span className="text-[#6B7280] min-w-28 text-sm">{label}</span>
                  <span className="text-[#263B4F] font-medium text-sm">{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-[#DF453A]/10 border border-[#DF453A]/30 flex items-center justify-center shrink-0">
                <DeleteIcon size={18} className="text-[#DF453A]" />
              </div>
              <DialogTitle className="text-[#263B4F]">Delete User</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              Are you sure you want to delete{' '}
              <span className="text-[#263B4F] font-medium">{deleteTarget?.firstName} {deleteTarget?.lastName}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-[#DF453A] hover:bg-[#c73c32] text-white font-semibold min-w-28">
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
