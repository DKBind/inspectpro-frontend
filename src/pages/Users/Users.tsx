import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users as UsersIcon, Plus, RefreshCw, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, Loader2, UserCircle,
} from 'lucide-react';

import { userService } from '@/services/userService';
import { organisationService } from '@/services/organisationService';
import type { UserResponse, RoleResponse } from '@/services/models/user';
import type { OrganisationResponse } from '@/services/models/organisation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
});

type FormValues = z.infer<typeof schema>;

const Users = () => {
  const [users,     setUsers]     = useState<UserResponse[]>([]);
  const [total,     setTotal]     = useState(0);
  const [roles,     setRoles]     = useState<RoleResponse[]>([]);
  const [orgs,      setOrgs]      = useState<OrganisationResponse[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewUser,  setViewUser]  = useState<UserResponse | null>(null);
  const [editTarget, setEditTarget] = useState<UserResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const { register, reset, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', gender: '', orgId: '', roleId: '' },
  });

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

  // ─── Open modals ───────────────────────────────────────────────────────────

  const openCreate = () => {
    reset({ firstName: '', lastName: '', email: '', password: '', gender: '', orgId: '', roleId: '' });
    setEditTarget(null);
    setModalMode('create');
  };

  const openEdit = (u: UserResponse) => {
    reset({
      firstName: u.firstName,
      lastName:  u.lastName,
      email:     u.email,
      gender:    u.gender ?? '',
      orgId:     u.orgId  ?? '',
      roleId:    u.roleId ? String(u.roleId) : '',
    });
    setEditTarget(u);
    setModalMode('edit');
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        firstName: values.firstName,
        lastName:  values.lastName,
        email:     values.email,
        // Only send password if provided (never send empty string)
        ...(values.password?.trim() && { password: values.password.trim() }),
        gender:    values.gender,
        orgId:     values.orgId,
        roleId:    Number(values.roleId),
      };

      if (modalMode === 'create') {
        await userService.createUser(payload);
        toast.success('User created successfully');
      } else if (editTarget) {
        await userService.updateUser(editTarget.id, payload);
        toast.success('User updated successfully');
      }

      setModalMode(null);
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
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
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
                      {u.roleName ? (
                        <span className={`${styles.planBadge} ${styles.planPro}`}>{u.roleName}</span>
                      ) : (
                        <span className={styles.mutedCell}>—</span>
                      )}
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
                      ) : (
                        <span className={styles.mutedCell}>—</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionBtns} style={{ justifyContent: 'center' }}>
                        <button
                          className={styles.actionBtn}
                          title="View"
                          onClick={() => setViewUser(u)}
                        ><Eye size={14} /></button>
                        <button
                          className={styles.actionBtn}
                          title="Edit"
                          onClick={() => openEdit(u)}
                        ><Pencil size={14} /></button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          title="Delete"
                          onClick={() => setDeleteTarget(u)}
                        ><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.paginationArea} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}>
              <button
                className={styles.actionBtn}
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => p - 1)}
              ><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 13, color: 'hsl(215,20%,60%)' }}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                className={styles.actionBtn}
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => p + 1)}
              ><ChevronRight size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => !open && setModalMode(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>{modalMode === 'create' ? 'Add User' : 'Edit User'}</DialogTitle>
            <DialogDescription>
              {modalMode === 'create'
                ? 'Fill in the details to create a new user.'
                : 'Update the user information below.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>First Name *</Label>
                <Input {...register('firstName')} placeholder="John" />
                {errors.firstName && <span style={{ color: 'hsl(0,84%,60%)', fontSize: 12 }}>{errors.firstName.message}</span>}
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input {...register('lastName')} placeholder="Doe" />
                {errors.lastName && <span style={{ color: 'hsl(0,84%,60%)', fontSize: 12 }}>{errors.lastName.message}</span>}
              </div>
            </div>

            <div>
              <Label>Email *</Label>
              <Input {...register('email')} type="email" placeholder="john@example.com" />
              {errors.email && <span style={{ color: 'hsl(0,84%,60%)', fontSize: 12 }}>{errors.email.message}</span>}
            </div>

            <div>
              <Label>{modalMode === 'create' ? 'Password' : 'New Password'}</Label>
              <Input
                {...register('password')}
                type="password"
                placeholder={modalMode === 'create' ? 'Set a password' : 'Leave blank to keep current'}
              />
            </div>

            <div>
              <Label>Gender</Label>
              <select
                {...register('gender')}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
                  background: 'hsl(222,47%,8%)', border: '1px solid hsl(217,33%,18%)',
                  color: 'hsl(210,40%,85%)', outline: 'none',
                }}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <Label>Organisation *</Label>
              <select
                {...register('orgId')}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
                  background: 'hsl(222,47%,8%)', border: '1px solid hsl(217,33%,18%)',
                  color: 'hsl(210,40%,85%)', outline: 'none',
                }}
              >
                <option value="">Select organisation</option>
                {orgs.map((o) => (
                  <option key={o.uuid} value={o.uuid}>{o.name}</option>
                ))}
              </select>
              {errors.orgId && <span style={{ color: 'hsl(0,84%,60%)', fontSize: 12 }}>{errors.orgId.message}</span>}
            </div>

            <div>
              <Label>Role *</Label>
              <select
                {...register('roleId')}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
                  background: 'hsl(222,47%,8%)', border: '1px solid hsl(217,33%,18%)',
                  color: 'hsl(210,40%,85%)', outline: 'none',
                }}
              >
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>{r.name}</option>
                ))}
              </select>
              {errors.roleId && <span style={{ color: 'hsl(0,84%,60%)', fontSize: 12 }}>{errors.roleId.message}</span>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalMode(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 size={14} style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />}
                {modalMode === 'create' ? 'Create User' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5 }}>
              {[
                ['Name',         `${viewUser.firstName} ${viewUser.lastName}`],
                ['Email',        viewUser.email],
                ['Gender',       viewUser.gender  ?? '—'],
                ['Organisation', viewUser.orgName ?? '—'],
                ['Role',         viewUser.roleName ?? '—'],
                ['Status',       viewUser.statusName ?? '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: 'hsl(215,20%,45%)', minWidth: 110 }}>{label}</span>
                  <span style={{ color: 'hsl(210,40%,88%)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
