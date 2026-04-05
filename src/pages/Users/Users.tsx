import React, { useEffect, useRef, useState } from 'react';
import { useForm, useController, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users as UsersIcon, Plus, RefreshCw, Eye, Pencil, Trash2,
  UserCircle, Mail, Lock, User,
  ChevronDown, Building2, Shield, Wand2,
  DeleteIcon, SlidersHorizontal,
} from 'lucide-react';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import Loader from '@/components/shared-ui/Loader/Loader';

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
  orgId: z.string().optional(),
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
        <span className="text-[#1a7bbd]">{icon}</span>
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

  // ── Filter state ─────────────────────────────────────────────────────────
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFranchiseId, setFilterFranchiseId] = useState('');
  // Pending (not applied yet)
  const [pendingRoleId, setPendingRoleId] = useState('');
  const [pendingOrgId, setPendingOrgId] = useState('');
  const [pendingFranchiseId, setPendingFranchiseId] = useState('');
  const [pendingFranchises, setPendingFranchises] = useState<OrganisationResponse[]>([]);
  const [pendingStatus, setPendingStatus] = useState('');

  // Account type for create modal (super admin only) — default: 'internal'
  const [accountType, setAccountType] = useState<'internal' | 'organisation' | 'franchise'>('internal');
  const [parentOrgIdForUser, setParentOrgIdForUser] = useState('');
  const [franchisesForUser, setFranchisesForUser] = useState<OrganisationResponse[]>([]);
  const [orgAdminFranchises, setOrgAdminFranchises] = useState<OrganisationResponse[]>([]);

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

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

  // Computed: is the logged-in user an Org Admin (top-level org, not a franchise)?
  const authOrg = orgs.find(o => o.uuid === authUser?.orgId);
  const isOrgAdmin = !isSuperAdmin && !!authOrg && !authOrg.parentOrgId;

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

  // Load org admin's own franchises (for create modal)
  useEffect(() => {
    if (orgs.length === 0) return;
    const authOrgData = orgs.find(o => o.uuid === authUser?.orgId);
    if (!isSuperAdmin && authOrgData && !authOrgData.parentOrgId && authUser?.orgId) {
      organisationService.getFranchises(0, 500, authUser.orgId)
        .then(d => setOrgAdminFranchises(d.content ?? []))
        .catch(() => setOrgAdminFranchises([]));
    }
  }, [orgs]);

  // Load franchises when parent org is selected (franchise flow)
  useEffect(() => {
    if (!isSuperAdmin || !parentOrgIdForUser) { setFranchisesForUser([]); return; }
    organisationService.getFranchises(0, 500, parentOrgIdForUser)
      .then(d => setFranchisesForUser(d.content ?? []))
      .catch(() => setFranchisesForUser([]));
  }, [parentOrgIdForUser]);

  // ── Filter helpers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const isFilterActive = !!filterRoleId || !!filterOrgId || !!filterFranchiseId || !!filterStatus;

  const openFilter = () => {
    setPendingRoleId(filterRoleId);
    setPendingOrgId(filterOrgId);
    setPendingFranchiseId(filterFranchiseId);
    setPendingFranchises([]);
    setPendingStatus(filterStatus);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setFilterRoleId(pendingRoleId);
    setFilterOrgId(pendingOrgId);
    setFilterFranchiseId(pendingFranchiseId);
    setFilterStatus(pendingStatus);
    setCurrentPage(1);
    setFilterOpen(false);
  };

  const clearFilter = () => {
    setFilterRoleId(''); setFilterOrgId(''); setFilterFranchiseId(''); setFilterStatus('');
    setPendingRoleId(''); setPendingOrgId(''); setPendingFranchiseId(''); setPendingFranchises([]); setPendingStatus('');
    setCurrentPage(1);
    setFilterOpen(false);
  };

  // Load franchises when org is selected in filter panel
  useEffect(() => {
    if (!pendingOrgId) { setPendingFranchises([]); setPendingFranchiseId(''); return; }
    organisationService.getFranchises(0, 500, pendingOrgId)
      .then(d => setPendingFranchises(d.content ?? []))
      .catch(() => setPendingFranchises([]));
  }, [pendingOrgId]);

  const filteredUsers = users.filter(u => {
    if (u.roleName?.toLowerCase() === 'client') return false;
    if (filterRoleId && String(u.roleId) !== filterRoleId) return false;
    if (filterFranchiseId && u.orgId !== filterFranchiseId) return false;
    else if (!filterFranchiseId && filterOrgId) {
      // filter by parent org: include users whose org is the org itself or a franchise under it
      const userOrg = orgs.find(o => o.uuid === u.orgId);
      if (u.orgId !== filterOrgId && userOrg?.parentOrgId !== filterOrgId) return false;
    }
    if (filterStatus === 'active' && (u.statusId ?? 1) !== 1) return false;
    if (filterStatus === 'inactive' && (u.statusId ?? 1) === 1) return false;
    return true;
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setValue('password', pwd);
  };

  const badgeParentStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 20, fontSize: 9.5, fontWeight: 700, background: 'rgba(59,130,246,0.10)', color: '#2563EB', border: '1px solid rgba(59,130,246,0.22)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 };
  const badgeSubOrgStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 20, fontSize: 9.5, fontWeight: 700, background: 'rgba(34,197,94,0.10)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.22)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 };

  // Returns hierarchical org display badge for a user row
  const renderOrgBadge = (u: UserResponse) => {
    if (!u.orgId) return <span style={{ color: '#9CA3AF', fontSize: 13 }}>InspectPro Internal</span>;
    const org = orgs.find(o => o.uuid === u.orgId);
    if (!org) return <span style={{ fontSize: 13 }}>{u.orgName ?? '—'}</span>;
    if (org.parentOrgId) {
      const parent = orgs.find(o => o.uuid === org.parentOrgId);
      const parentName = parent?.name ?? org.parentOrgName ?? '?';
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>{parentName}</span>
          <span style={badgeParentStyle}>Parent</span>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>{org.name}</span>
          <span style={badgeSubOrgStyle}>Sub-Org</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>{org.name}</span>
        <span style={badgeParentStyle}>Parent</span>
      </div>
    );
  };

  const emptyForm = (): FormValues => {
    // Org admin must pick a franchise in create mode — start with empty orgId
    const authOrgData = orgs.find(o => o.uuid === authUser?.orgId);
    const isOrgAdm = !isSuperAdmin && !!authOrgData && !authOrgData.parentOrgId;
    return {
      ...EMPTY,
      orgId: (!isSuperAdmin && !isOrgAdm && authUser?.orgId) ? authUser.orgId : '',
    };
  };

  // ─── Open Modals ───────────────────────────────────────────────────────────

  const openCreate = () => {
    reset(emptyForm());
    setEditTarget(null);
    setAccountType('internal');
    setParentOrgIdForUser('');
    setFranchisesForUser([]);
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
    setAccountType('internal');
    setParentOrgIdForUser('');
    setFranchisesForUser([]);
    reset(emptyForm());
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    // Determine final orgId based on account type
    let finalOrgId = values.orgId;
    if (modalMode === 'create' && isSuperAdmin) {
      if (accountType === 'internal') {
        finalOrgId = authUser?.orgId || '';
      }
    }
    if (!finalOrgId) {
      toast.error('Organisation is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        ...(values.password?.trim() && { password: values.password.trim() }),
        gender: values.gender || undefined,
        orgId: finalOrgId,
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
            <span className={styles.countBadge}>{filteredUsers.length}</span>
            {isFilterActive && <span className={styles.filterActiveBadge}>Filtered</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div ref={filterRef} style={{ position: 'relative' }}>
              <button
                className={`${styles.filterBtn} ${isFilterActive ? styles.filterBtnActive : ''}`}
                onClick={openFilter}
              >
                <SlidersHorizontal size={14} />
                Filter
                {isFilterActive && <span className={styles.filterDot} />}
              </button>
              {filterOpen && (
                <div className={styles.filterPanel}>
                  <div className={styles.filterSection}>
                    <span className={styles.filterSectionLabel}>Role</span>
                    <DropdownSelect
                      options={[{ value: '', label: 'All Roles' }, ...roles.map(r => ({ value: String(r.roleId), label: r.roleName ?? r.name }))]}
                      value={pendingRoleId || null}
                      onChange={v => setPendingRoleId(v == null ? '' : String(v))}
                      searchable={false}
                      clearable={false}
                      dropUp
                    />
                  </div>
                  {isSuperAdmin && (
                    <div className={styles.filterSection}>
                      <span className={styles.filterSectionLabel}>Organisation</span>
                      <DropdownSelect
                        options={[{ value: '', label: 'All Organisations' }, ...orgs.filter(o => !o.parentOrgId).map(o => ({ value: o.uuid, label: o.name }))]}
                        value={pendingOrgId || null}
                        onChange={v => { setPendingOrgId(v == null ? '' : String(v)); setPendingFranchiseId(''); }}
                        searchable
                        clearable={false}
                        dropUp
                      />
                    </div>
                  )}

                  {/* Franchise filter — super admin (requires org selected) or org admin */}
                  {isSuperAdmin ? (
                    pendingOrgId ? (
                      <div className={styles.filterSection}>
                        <span className={styles.filterSectionLabel}>Franchise</span>
                        {pendingFranchises.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--ip-text-muted)', fontStyle: 'italic', padding: '4px 2px' }}>
                            Loading franchises…
                          </span>
                        ) : (
                          <DropdownSelect
                            options={[{ value: '', label: 'All Franchises' }, ...pendingFranchises.map(f => ({ value: f.uuid, label: f.name }))]}
                            value={pendingFranchiseId || null}
                            onChange={v => setPendingFranchiseId(v == null ? '' : String(v))}
                            searchable
                            clearable={false}
                            dropUp
                          />
                        )}
                      </div>
                    ) : (
                      <div className={styles.filterSection}>
                        <span className={styles.filterSectionLabel}>Franchise</span>
                        <span style={{ fontSize: 12, color: 'var(--ip-text-muted)', fontStyle: 'italic', padding: '4px 2px' }}>
                          Select an organisation first
                        </span>
                      </div>
                    )
                  ) : isOrgAdmin && orgAdminFranchises.length > 0 ? (
                    <div className={styles.filterSection}>
                      <span className={styles.filterSectionLabel}>Franchise</span>
                      <DropdownSelect
                        options={[{ value: '', label: 'All Franchises' }, ...orgAdminFranchises.map(f => ({ value: f.uuid, label: f.name }))]}
                        value={pendingFranchiseId || null}
                        onChange={v => setPendingFranchiseId(v == null ? '' : String(v))}
                        searchable
                        clearable={false}
                        dropUp
                      />
                    </div>
                  ) : null}
                  <div className={styles.filterSection}>
                    <span className={styles.filterSectionLabel}>Status</span>
                    <DropdownSelect
                      options={[
                        { value: '', label: 'All Statuses' },
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                      ]}
                      value={pendingStatus || null}
                      onChange={v => setPendingStatus(v == null ? '' : String(v))}
                      searchable={false}
                      clearable={false}
                      dropUp
                    />
                  </div>
                  <div className={styles.filterDivider} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.filterClose} onClick={() => setFilterOpen(false)}>Close</button>
                    <button className={styles.filterApply} onClick={applyFilter}>Apply</button>
                  </div>
                  {isFilterActive && (
                    <button className={styles.filterClear} onClick={clearFilter}>Clear Filters</button>
                  )}
                </div>
              )}
            </div>
            <button className={styles.refreshBtn} onClick={fetchAll} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader variant="inline" type="spinner" text="Loading users…" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>
              {isFilterActive ? 'No users match the current filters.' : 'No users found.'}
              <span className={styles.emptySubtext}>{isFilterActive ? 'Try adjusting or clearing the filters.' : 'Click "Add User" to create the first one.'}</span>
            </div>
          ) : (
            <div className={styles.tableScroll}>
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
                  {filteredUsers.map((u) => (
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
                      <td>{renderOrgBadge(u)}</td>
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
            </div>
          )}

          <div className={styles.paginationArea}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#1a7bbd]/10 border border-[#1a7bbd]/30 flex items-center justify-center">
                <UsersIcon size={18} className="text-[#1a7bbd]" />
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

              {/* ── "Create user for" tab bar — super admin create only, pinned to top ── */}
              {isSuperAdmin && modalMode === 'create' && (
                <div style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB', padding: '0 28px' }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', paddingTop: 14, marginBottom: 8 }}>
                    Creating user for
                  </p>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {([
                      { value: 'internal', label: 'Super Admin' },
                      { value: 'organisation', label: 'Organisation' },
                      { value: 'franchise', label: 'Franchise' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setAccountType(opt.value);
                          setParentOrgIdForUser('');
                          setFranchisesForUser([]);
                          setValue('orgId', '');
                        }}
                        style={{
                          padding: '10px 20px 12px',
                          fontSize: 13,
                          fontWeight: accountType === opt.value ? 700 : 500,
                          color: accountType === opt.value ? '#1a7bbd' : '#6B7280',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: accountType === opt.value ? '2.5px solid #1a7bbd' : '2.5px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          lineHeight: 1.3,
                          marginBottom: -1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <span>{opt.label}</span>
                        {/* <span style={{ fontSize: 10, fontWeight: 400, color: accountType === opt.value ? '#6EE0CB' : '#9CA3AF' }}>{opt.desc}</span> */}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                            className="shrink-0 h-10 px-3 rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#1a7bbd] hover:border-[#1a7bbd] transition-all flex items-center gap-1.5 text-xs font-medium"
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

                {/* Account Type + Organisation & Role — super admin create only */}
                <Sec icon={<Shield size={13} />} label="Organisation & Role">
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5 space-y-4">

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Org/Franchise pickers — conditional on accountType */}
                      {isSuperAdmin && modalMode === 'create' ? (
                        <>
                          {accountType === 'organisation' && (
                            <Fld label="Organisation" required>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger className={selectCls(!selectedOrgId && submitting)}>
                                  <span className={selectedOrg ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                                    {selectedOrg ? selectedOrg.name : '— Select organisation —'}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                                  {orgs.filter(o => !o.parentOrgId).map((o) => (
                                    <DropdownMenuItem key={o.uuid} onSelect={() => setValue('orgId', o.uuid, { shouldValidate: true })} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">
                                      {o.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </Fld>
                          )}

                          {accountType === 'franchise' && (
                            <>
                              <Fld label="Parent Organisation" required>
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger className={selectCls(false)}>
                                    <span className={parentOrgIdForUser ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                                      {orgs.find(o => o.uuid === parentOrgIdForUser)?.name ?? '— Select organisation —'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                                    {orgs.filter(o => !o.parentOrgId).map((o) => (
                                      <DropdownMenuItem key={o.uuid} onSelect={() => { setParentOrgIdForUser(o.uuid); setValue('orgId', ''); }} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">
                                        {o.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </Fld>

                              <Fld label="Franchise" required>
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger className={selectCls(false)} disabled={!parentOrgIdForUser}>
                                    <span className={selectedOrg ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                                      {selectedOrg ? selectedOrg.name : parentOrgIdForUser ? '— Select franchise —' : '— Select organisation first —'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                                    {franchisesForUser.length === 0
                                      ? <DropdownMenuItem disabled>No franchises found</DropdownMenuItem>
                                      : franchisesForUser.map((f) => (
                                        <DropdownMenuItem key={f.uuid} onSelect={() => setValue('orgId', f.uuid, { shouldValidate: true })} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">
                                          {f.name}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </Fld>
                            </>
                          )}

                          {accountType === 'internal' && (
                            <div className="sm:col-span-2">
                              <div className="h-10 rounded-md border border-[#E5E7EB] bg-white px-3 flex items-center gap-2 text-sm text-[#6B7280]">
                                <Building2 size={14} />
                                Internal / Super Admin — no organisation selection required
                              </div>
                            </div>
                          )}
                        </>
                      ) : isOrgAdmin && modalMode === 'create' ? (
                        /* Org Admin create: pick a franchise */
                        <Fld label="Franchise" required>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className={selectCls(!selectedOrgId && submitting)}>
                              <span className={selectedOrg ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                                {selectedOrg ? selectedOrg.name : '— Select franchise —'}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]" style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                              {orgAdminFranchises.length === 0
                                ? <DropdownMenuItem disabled>No franchises found</DropdownMenuItem>
                                : orgAdminFranchises.map(f => (
                                  <DropdownMenuItem key={f.uuid} onSelect={() => setValue('orgId', f.uuid, { shouldValidate: true })} className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5">
                                    {f.name}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Fld>
                      ) : !isSuperAdmin ? (
                        /* Non-org-admin, non-super-admin: show org read-only */
                        <Fld label="Organisation" required>
                          <div className="h-10 rounded-md border border-[#E5E7EB] bg-[#F3F4F6] px-3 flex items-center gap-2 text-sm text-[#263B4F]">
                            <Building2 size={14} className="text-[#6B7280]" />
                            {orgs.find((o) => o.uuid === authUser?.orgId)?.name ?? authUser?.orgId ?? '—'}
                          </div>
                        </Fld>
                      ) : (
                        /* Super admin in edit mode */
                        <Fld label="Organisation" required error={errors.orgId?.message}>
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
                        </Fld>
                      )}

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
                <Button type="submit" disabled={submitting || (
                  isSuperAdmin && modalMode === 'create' && (
                    (accountType === 'organisation' && !selectedOrgId) ||
                    (accountType === 'franchise' && (!parentOrgIdForUser || !selectedOrgId))
                  )
                ) || (isOrgAdmin && modalMode === 'create' && !selectedOrgId)}
                  className="flex-1 sm:flex-none sm:min-w-44 bg-[#1a7bbd] hover:bg-[#2a9a84] text-white font-semibold shadow-lg active:scale-95">
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
              <div className="h-9 w-9 rounded-xl bg-[#1a7bbd]/10 border border-[#1a7bbd]/30 flex items-center justify-center">
                <UserCircle size={18} className="text-[#1a7bbd]" />
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
