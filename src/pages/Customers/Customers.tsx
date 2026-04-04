import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users, Plus, Eye, Pencil, Trash2, Mail, Phone,
  Building2, AlertTriangle, User, Loader2,
  Lock, Wand2, ChevronDown, GitBranch, SlidersHorizontal,
} from 'lucide-react';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';

import { customerService } from '@/services/customerService';
import { organisationService } from '@/services/organisationService';
import type { CustomerResponse } from '@/services/models/customer';
import type { OrganisationResponse } from '@/services/models/organisation';
import { useAuthStore } from '@/store/useAuthStore';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Fld, ViewRow, inputCls } from '@/components/shared-ui/form-helpers';
import styles from './Customers.module.css';

// Super admin must pick 'org' or 'franchise'. Org admin may also pick 'own'.
type Ownership = 'own' | 'org' | 'franchise';

// ─── Schemas ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().optional().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
  phoneNumber: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

const EMPTY_CREATE: CreateValues = { firstName: '', lastName: '', email: '', password: '', phoneNumber: '' };
const EMPTY_EDIT: EditValues = { firstName: '', lastName: '', email: '', phoneNumber: '' };

const selectCls = (err = false) =>
  `w-full inline-flex items-center justify-between h-10 rounded-md border bg-white px-3 text-sm font-normal text-[#263B4F] hover:bg-[#F3F4F6] focus:outline-none transition-all ${err ? 'border-[#DF453A]' : 'border-[#E5E7EB]'}`;

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Component ─────────────────────────────────────────────────────────────

const Clients = () => {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';
  const isOrgAdmin = !isSuperAdmin && !!authUser?.orgId;

  // Franchise admin: org admin whose own org has a parent org
  const [isFranchiseAdmin, setIsFranchiseAdmin] = useState(false);

  useEffect(() => {
    if (!isOrgAdmin || !authUser?.orgId) { setIsFranchiseAdmin(false); return; }
    organisationService.getOrganisationByUuid(authUser.orgId)
      .then((org) => setIsFranchiseAdmin(!!org.parentOrgId))
      .catch(() => setIsFranchiseAdmin(false));
  }, [isOrgAdmin, authUser?.orgId]);

  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerResponse | null>(null);
  const [viewTarget, setViewTarget] = useState<CustomerResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusToggleTarget, setStatusToggleTarget] = useState<CustomerResponse | null>(null);
  const [toggling, setToggling] = useState(false);

  // ── Filter state ─────────────────────────────────────────────────────────
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOrgId, setFilterOrgId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [pendingOrgId, setPendingOrgId] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');

  // ── "Who is this for?" state ────────────────────────────────────────────
  const [ownership, setOwnership] = useState<Ownership>('own');
  // Super admin lists
  const [allOrgs, setAllOrgs] = useState<OrganisationResponse[]>([]);
  const [_allFranchises, setAllFranchises] = useState<OrganisationResponse[]>([]);
  // For super admin "Franchise" two-step
  const [selectedParentOrgId, setSelectedParentOrgId] = useState<string>('');
  const [filteredFranchises, setFilteredFranchises] = useState<OrganisationResponse[]>([]);
  const [loadingFranchises, setLoadingFranchises] = useState(false);
  // Org admin child franchises
  const [orgFranchises, setOrgFranchises] = useState<OrganisationResponse[]>([]);
  // Final target (org ID or franchise ID) to pass to backend as franchiseId
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');

  const createForm = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: EMPTY_CREATE });
  const editForm = useForm<EditValues>({ resolver: zodResolver(editSchema), defaultValues: EMPTY_EDIT });

  const { register: regCreate, reset: resetCreate, setValue: setCreateValue,
    watch: watchCreate, formState: { errors: createErrors } } = createForm;
  const { register: regEdit, reset: resetEdit, formState: { errors: editErrors } } = editForm;

  const passwordValue = watchCreate('password');

  // ─── Fetch clients ───────────────────────────────────────────────────────

  const fetchClients = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const data = await customerService.listClients(page - 1, size);
      setClients(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalItems(data.totalElements ?? 0);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(currentPage, pageSize); }, [currentPage, pageSize, authUser?.id]);

  // ─── Load org/franchise lists ────────────────────────────────────────────

  useEffect(() => {
    if (isSuperAdmin) {
      organisationService.getOrganisations(0, 1000)
        .then((d) => setAllOrgs(d.content ?? []))
        .catch(() => { });
      organisationService.getFranchises(0, 1000)
        .then((d) => setAllFranchises(d.content ?? []))
        .catch(() => { });
    } else if (isOrgAdmin && authUser?.orgId) {
      organisationService.getFranchises(0, 200, authUser.orgId)
        .then((d) => setOrgFranchises(d.content ?? []))
        .catch(() => { });
    }
  }, [isSuperAdmin, isOrgAdmin, authUser?.orgId]);

  // When super admin picks a parent org for the "Franchise" flow, load its franchises
  useEffect(() => {
    if (!isSuperAdmin || ownership !== 'franchise' || !selectedParentOrgId) {
      setFilteredFranchises([]);
      return;
    }
    setLoadingFranchises(true);
    organisationService.getFranchises(0, 200, selectedParentOrgId)
      .then((d) => setFilteredFranchises(d.content ?? []))
      .catch(() => setFilteredFranchises([]))
      .finally(() => setLoadingFranchises(false));
  }, [isSuperAdmin, ownership, selectedParentOrgId]);

  // ─── Modal helpers ───────────────────────────────────────────────────────

  const resetOwnership = () => {
    // Super admin defaults to 'org'; franchise admin has no choice; org admin defaults to 'own'.
    setOwnership(isSuperAdmin ? 'org' : 'own');
    setSelectedTargetId('');
    setSelectedParentOrgId('');
    setFilteredFranchises([]);
  };

  // ── Filter helpers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const isFilterActive = !!filterOrgId || !!filterStatus;

  const openFilter = () => {
    setPendingOrgId(filterOrgId);
    setPendingStatus(filterStatus);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    setFilterOrgId(pendingOrgId);
    setFilterStatus(pendingStatus);
    setCurrentPage(1);
    setFilterOpen(false);
  };

  const clearFilter = () => {
    setFilterOrgId(''); setFilterStatus('');
    setPendingOrgId(''); setPendingStatus('');
    setCurrentPage(1);
    setFilterOpen(false);
  };

  const filteredClients = clients.filter(c => {
    if (filterOrgId && c.orgId !== filterOrgId) return false;
    if (filterStatus === 'active' && !c.isActive) return false;
    if (filterStatus === 'inactive' && c.isActive) return false;
    return true;
  });

  const openCreate = () => { resetCreate(EMPTY_CREATE); resetOwnership(); setCreateOpen(true); };
  const openEdit = (c: CustomerResponse) => {
    resetEdit({
      firstName: c.firstName ?? '', lastName: c.lastName ?? '',
      email: c.email ?? '', phoneNumber: c.phoneNumber ?? ''
    });
    setEditTarget(c);
  };
  const closeCreate = () => { setCreateOpen(false); resetCreate(EMPTY_CREATE); resetOwnership(); };
  const closeEdit = () => { setEditTarget(null); resetEdit(EMPTY_EDIT); };

  // ─── Submit Create ───────────────────────────────────────────────────────

  const onSubmitCreate = async (data: CreateValues) => {
    // Franchise admin: no validation needed — always their own org
    if (!isFranchiseAdmin) {
      if (isSuperAdmin) {
        if (ownership === 'org' && !selectedTargetId) { toast.error('Please select an organisation.'); return; }
        if (ownership === 'franchise' && !selectedParentOrgId) { toast.error('Please select a parent organisation first.'); return; }
        if (ownership === 'franchise' && !selectedTargetId) { toast.error('Please select a franchise.'); return; }
      } else if (isOrgAdmin && ownership === 'franchise' && !selectedTargetId) {
        toast.error('Please select a franchise.'); return;
      }
    }

    setSubmitting(true);
    const payload = {
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim() || undefined,
      email: data.email?.trim() || undefined,
      password: data.password?.trim() || undefined,
      phoneNumber: data.phoneNumber?.trim() || undefined,
      // Franchise admin sends no franchiseId — backend resolves their own org
      // "My Own" → no franchiseId; org/franchise → use selectedTargetId
      franchiseId: isFranchiseAdmin ? undefined
        : (ownership !== 'own' && selectedTargetId ? selectedTargetId : undefined),
    };
    try {
      await customerService.createClient(payload);
      toast.success('Client created!');
      closeCreate();
      setCurrentPage(1);
      fetchClients(1, pageSize);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create client');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Submit Edit ─────────────────────────────────────────────────────────

  const onSubmitEdit = async (data: EditValues) => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      await customerService.updateClient(editTarget.id, {
        firstName: data.firstName.trim(),
        lastName: data.lastName?.trim() || undefined,
        email: data.email?.trim() || undefined,
        phoneNumber: data.phoneNumber?.trim() || undefined,
      });
      toast.success('Client updated!');
      closeEdit();
      fetchClients(currentPage);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update client');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleToggleStatus = async () => {
    if (!statusToggleTarget) return;
    setToggling(true);
    try {
      const updated = await customerService.toggleClientStatus(statusToggleTarget.id);
      setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      toast.success(`Client marked as ${updated.isActive ? 'Active' : 'Inactive'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update status');
    } finally {
      setToggling(false);
      setStatusToggleTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await customerService.deleteClient(deleteTarget.id);
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success('Client deleted');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete client');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Derived helpers ─────────────────────────────────────────────────────

  // Super admin: must assign to an org or franchise (no "My Own")
  // Org admin: can create for themselves or a child franchise
  // Franchise admin: no choice — always their own franchise
  const ownershipOptions: { key: Ownership; label: string }[] = isSuperAdmin
    ? [{ key: 'org', label: 'Organisation' }, { key: 'franchise', label: 'Franchise' }]
    : [{ key: 'own', label: 'My Organisation' }, { key: 'franchise', label: 'Franchise' }];

  // For "Organisation" dropdown (super admin only)
  // const selectedOrg = allOrgs.find((o) => o.uuid === selectedTargetId);
  // // For "Franchise" parent org picker (super admin)
  // const selectedParentOrg = allOrgs.find((o) => o.uuid === selectedParentOrgId);
  // For "Franchise" final selection
  // const franchiseList = isSuperAdmin ? filteredFranchises : orgFranchises;
  // const selectedFranchise = franchiseList.find((o) => o.uuid === selectedTargetId);

  // ─── Org renderer for table ───────────────────────────────────────────────
  const renderCustomerOrgBadge = (c: CustomerResponse) => {
    if (!c.franchiseId) return <span className={styles.muted}>—</span>;
    const allOrgsList = isSuperAdmin ? allOrgs : orgFranchises;
    const org = allOrgsList.find(o => o.uuid === c.franchiseId);
    if (!org) return <span className={styles.muted}>{c.franchiseName ?? '—'}</span>;
    if (org.parentOrgId) {
      const parent = allOrgs.find(o => o.uuid === org.parentOrgId);
      const parentName = parent?.name ?? org.parentOrgName ?? '?';
      return <span className={styles.muted}>{parentName} › {org.name}</span>;
    }
    return <span className={styles.muted}>{org.name}</span>;
  };

  // ─── OrgDropdown helper ──────────────────────────────────────────────────

  const OrgDropdown = ({ list, value, placeholder, icon, onSelect }: {
    list: OrganisationResponse[];
    value: string;
    placeholder: string;
    icon: React.ReactNode;
    onSelect: (id: string) => void;
  }) => {
    const selected = list.find((o) => o.uuid === value);
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={selectCls(!value && submitting)}>
          <span className={selected ? 'text-[#263B4F]' : 'text-[#9CA3AF]'}>
            {selected
              ? <span className="flex items-center gap-2">{icon}{selected.name}</span>
              : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999] max-h-52 overflow-y-auto"
          style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
        >
          {list.length === 0
            ? <DropdownMenuItem disabled className="text-[#9CA3AF]">No items found</DropdownMenuItem>
            : list.map((o) => (
              <DropdownMenuItem key={o.uuid} onSelect={() => onSelect(o.uuid)}
                className="cursor-pointer focus:bg-[#F3F4F6] py-2.5">
                {o.name}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        {/* <button className={styles.createBtn} onClick={openCreate}>
          <Plus style={{ width: 15, height: 15 }} /> Add Client
        </button> */}
      </div>

      {/* Table panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Users style={{ width: 16, height: 16, color: '#1a7bbd' }} />
            All Clients
            <span className={styles.countBadge}>{filteredClients.length}</span>
            {isFilterActive && <span className={styles.filterActiveBadge}>Filtered</span>}
          </div>
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
                  {(isSuperAdmin || !isFranchiseAdmin) && allOrgs.length > 0 && (
                    <div className={styles.filterSection}>
                      <span className={styles.filterSectionLabel}>Organisation</span>
                      <DropdownSelect
                        options={[{ value: '', label: 'All Organisations' }, ...allOrgs.map(o => ({ value: o.uuid, label: o.name }))]}
                        value={pendingOrgId || null}
                        onChange={v => setPendingOrgId(v == null ? '' : String(v))}
                        searchable
                        clearable={false}
                        dropUp
                      />
                    </div>
                  )}
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
            <button className={styles.createBtn} onClick={openCreate}>
              <Plus style={{ width: 15, height: 15 }} /> Add Client
            </button>
          </div>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.spinner} /><p>Loading clients...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><Users style={{ width: 28, height: 28 }} /></div>
              <p className={styles.emptyTitle}>No clients yet</p>
              <p className={styles.emptySubtitle}>Click "Add Client" to get started.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Organisation</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className={styles.row}>
                      <td>
                        <div className={styles.clientCell}>
                          <div className={styles.avatar}>{(c.firstName?.[0] ?? '?').toUpperCase()}</div>
                          <p className={styles.clientName}>{c.fullName || c.firstName}</p>
                        </div>
                      </td>
                      <td className={styles.muted}>
                        {c.email
                          ? <span className={styles.company}><Mail style={{ width: 12, height: 12 }} />{c.email}</span>
                          : '—'}
                      </td>
                      <td className={styles.muted}>
                        {c.phoneNumber
                          ? <span className={styles.company}><Phone style={{ width: 12, height: 12 }} />{c.phoneNumber}</span>
                          : '—'}
                      </td>
                      <td>{renderCustomerOrgBadge(c)}</td>
                      <td>
                        <button
                          className={`${styles.statusToggle} ${c.isActive ? styles.toggleOn : styles.toggleOff}`}
                          onClick={() => setStatusToggleTarget(c)}
                          title={c.isActive ? 'Click to deactivate' : 'Click to activate'}
                        />
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.actionBtn} onClick={() => setViewTarget(c)} title="View"><Eye size={14} /></button>
                          <button className={styles.actionBtn} onClick={() => openEdit(c)} title="Edit"><Pencil size={14} /></button>
                          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => setDeleteTarget(c)} title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.paginationArea}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                  pageSizeOptions={[10, 20, 50]}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ──────────────────────── CREATE MODAL ──────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) closeCreate(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#1a7bbd]/10 border border-[#1a7bbd]/30 flex items-center justify-center">
                <User size={18} className="text-[#1a7bbd]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Add Client</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              First select who this client is for, then fill in their details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createForm.handleSubmit(onSubmitCreate, () => toast.error('Please fix the errors.'))}>
            <div className="px-7 py-6 space-y-6">

              {/* ── STEP 1: Who is this for? (hidden for franchise admin) ─ */}
              {!isFranchiseAdmin && <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#1a7bbd]"><Building2 size={13} /></span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                    Who is this client for?
                  </span>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5 space-y-4">

                  {/* Toggle buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {ownershipOptions.map(({ key, label }) => (
                      <button key={key} type="button"
                        onClick={() => { setOwnership(key); setSelectedTargetId(''); setSelectedParentOrgId(''); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${ownership === key
                          ? 'bg-[#1a7bbd] text-white border-[#1a7bbd]'
                          : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#1a7bbd] hover:text-[#1a7bbd]'
                          }`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Own — only shown for org admin */}
                  {ownership === 'own' && (
                    <p className="text-xs text-[#9CA3AF]">
                      Client will be created directly under your organisation.
                    </p>
                  )}

                  {/* Super admin → Organisation */}
                  {isSuperAdmin && ownership === 'org' && (
                    <Fld label="Select Organisation" required>
                      <OrgDropdown
                        list={allOrgs}
                        value={selectedTargetId}
                        placeholder="— Select organisation —"
                        icon={<Building2 size={13} />}
                        onSelect={setSelectedTargetId}
                      />
                    </Fld>
                  )}

                  {/* Super admin → Franchise: two-step */}
                  {isSuperAdmin && ownership === 'franchise' && (
                    <div className="space-y-3">
                      <Fld label="Step 1 — Select Parent Organisation" required>
                        <OrgDropdown
                          list={allOrgs}
                          value={selectedParentOrgId}
                          placeholder="— Select parent organisation —"
                          icon={<Building2 size={13} />}
                          onSelect={(id) => { setSelectedParentOrgId(id); setSelectedTargetId(''); }}
                        />
                      </Fld>
                      {selectedParentOrgId && (
                        <Fld label="Step 2 — Select Franchise" required>
                          {loadingFranchises
                            ? <div className="flex items-center gap-2 text-xs text-[#9CA3AF] h-10 px-3"><Loader2 size={14} className="animate-spin" />Loading franchises…</div>
                            : <OrgDropdown
                              list={filteredFranchises}
                              value={selectedTargetId}
                              placeholder={filteredFranchises.length === 0 ? 'No franchises found for this organisation' : '— Select franchise —'}
                              icon={<GitBranch size={13} />}
                              onSelect={setSelectedTargetId}
                            />
                          }
                        </Fld>
                      )}
                    </div>
                  )}

                  {/* Org admin → Franchise */}
                  {isOrgAdmin && ownership === 'franchise' && (
                    <Fld label="Select Franchise" required>
                      <OrgDropdown
                        list={orgFranchises}
                        value={selectedTargetId}
                        placeholder={orgFranchises.length === 0 ? 'No franchises under your organisation' : '— Select franchise —'}
                        icon={<GitBranch size={13} />}
                        onSelect={setSelectedTargetId}
                      />
                    </Fld>
                  )}
                </div>
              </section>}

              {/* ── STEP 2: Personal Details ───────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#1a7bbd]"><User size={13} /></span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Client Details</span>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="First Name" required error={createErrors.firstName?.message}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><User size={15} /></span>
                        <Input placeholder="John" {...regCreate('firstName')} className={`${inputCls(!!createErrors.firstName)} pl-9`} />
                      </div>
                    </Fld>
                    <Fld label="Last Name" required error={createErrors.lastName?.message}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><User size={15} /></span>
                        <Input placeholder="Doe" {...regCreate('lastName')} className={`${inputCls(!!createErrors.lastName)} pl-9`} />
                      </div>
                    </Fld>
                    <Fld label="Email" required error={createErrors.email?.message}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><Mail size={15} /></span>
                        <Input type="email" autoComplete="off" placeholder="john@example.com"
                          {...regCreate('email')} className={`${inputCls(!!createErrors.email)} pl-9`} />
                      </div>
                    </Fld>
                    <Fld label="Password">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><Lock size={15} /></span>
                          <Input type="text" autoComplete="new-password" placeholder="Set a password"
                            {...regCreate('password')} className={`${inputCls(false)} pl-9`} />
                        </div>
                        <button type="button" onClick={() => setCreateValue('password', generatePassword())}
                          className="shrink-0 h-10 px-3 rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#1a7bbd] hover:border-[#1a7bbd] transition-all flex items-center gap-1.5 text-xs font-medium">
                          <Wand2 size={13} /> Generate
                        </button>
                      </div>
                      {passwordValue && <p className="text-xs text-[#6B7280] mt-1 font-mono break-all">{passwordValue}</p>}
                    </Fld>
                    <Fld label="Phone">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><Phone size={15} /></span>
                        <Input placeholder="+91 98765 43210" {...regCreate('phoneNumber')} className={`${inputCls(false)} pl-9`} />
                      </div>
                    </Fld>
                  </div>
                </div>
              </section>

              {/* Role badge */}
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-5 py-3 flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a7bbd]/10 border border-[#1a7bbd]/30 text-[#1a7bbd] text-xs font-semibold">
                  <User size={12} /> Client
                </span>
                <span className="text-xs text-[#9CA3AF]">Role is fixed — clients are end users of the organisation.</span>
              </div>
            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={closeCreate} disabled={submitting}
                className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-[#1a7bbd] hover:bg-[#2a9a84] text-white font-semibold shadow-lg">
                {submitting
                  ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Adding…</span>
                  : 'Add Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────── EDIT MODAL ───────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) closeEdit(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#1a7bbd]/15 border border-[#1a7bbd]/30 flex items-center justify-center">
                <User size={18} className="text-[#1a7bbd]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Edit Client</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">Update client details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onSubmitEdit, () => toast.error('Please fix the errors.'))}>
            <div className="px-7 py-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="First Name" required error={editErrors.firstName?.message}>
                  <Input placeholder="John" {...regEdit('firstName')} className={inputCls(!!editErrors.firstName)} />
                </Fld>
                <Fld label="Last Name">
                  <Input placeholder="Doe" {...regEdit('lastName')} className={inputCls(false)} />
                </Fld>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="Email" error={editErrors.email?.message}>
                  <Input type="email" placeholder="john@company.com" {...regEdit('email')} className={inputCls(!!editErrors.email)} />
                </Fld>
                <Fld label="Phone">
                  <Input placeholder="+91 98765 43210" {...regEdit('phoneNumber')} className={inputCls(false)} />
                </Fld>
              </div>
            </div>
            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={closeEdit} disabled={submitting}
                className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-[#1a7bbd] hover:bg-[#2a9a84] text-white font-semibold shadow-lg">
                {submitting
                  ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Updating…</span>
                  : 'Update Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────── VIEW MODAL ────────────────────────────── */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => { if (!o) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-md shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#1a7bbd]/15 border border-[#1a7bbd]/30 flex items-center justify-center">
                <User size={18} className="text-[#1a7bbd]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Client Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewTarget && (
            <div className="px-7 py-5 space-y-0">
              <ViewRow label="Name" value={viewTarget.fullName || viewTarget.firstName} />
              <ViewRow label="Email" value={viewTarget.email ?? '—'} />
              <ViewRow label="Phone" value={viewTarget.phoneNumber ?? '—'} />
              <ViewRow label="Organisation" value={viewTarget.franchiseName ?? '—'} />
              <ViewRow label="Status" value={viewTarget.isActive ? 'Active' : 'Inactive'} />
              <ViewRow label="Created" value={viewTarget.createdAt ?? '—'} />
            </div>
          )}
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="ghost" onClick={() => setViewTarget(null)}
              className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Close</Button>
            {viewTarget && (
              <Button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                className="bg-[#1a7bbd] hover:bg-[#2a9a84] text-white font-semibold">
                <Pencil size={14} className="mr-2" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────── STATUS TOGGLE CONFIRM ─────────────────────── */}
      <Dialog open={!!statusToggleTarget} onOpenChange={(o) => { if (!o) setStatusToggleTarget(null); }}>
        <DialogContent className="sm:max-w-sm shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#E7970E]/10 border border-[#E7970E]/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-[#E7970E]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Confirm Status Change</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-12">
              Mark <strong className="text-[#263B4F]">{statusToggleTarget?.fullName || statusToggleTarget?.firstName}</strong> as{' '}
              <strong>{statusToggleTarget?.isActive ? 'Inactive' : 'Active'}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 flex gap-3">
            <Button variant="ghost" onClick={() => setStatusToggleTarget(null)} disabled={toggling}
              className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleToggleStatus} disabled={toggling}
              className="bg-[#1a7bbd] hover:bg-[#2a9a84] text-white font-semibold min-w-28">
              {toggling
                ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Updating…</span>
                : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────── DELETE CONFIRM ─────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Delete Client</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-12">
              Delete <strong className="text-[#263B4F]">{deleteTarget?.fullName || deleteTarget?.firstName}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting…</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
