import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users, Plus, RefreshCw, Eye, Pencil, Trash2, Mail, Phone,
  Building2, AlertTriangle, User, Loader2, ChevronLeft, ChevronRight,
  Lock, Wand2, ChevronDown, GitBranch,
} from 'lucide-react';

import { customerService } from '@/services/customerService';
import { organisationService } from '@/services/organisationService';
import type { CustomerResponse } from '@/services/models/customer';
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
import { Fld, ViewRow, inputCls } from '@/components/shared-ui/form-helpers';
import styles from './Customers.module.css';

const PAGE_SIZE = 10;

// ─── Ownership types (super admin only) ────────────────────────────────────

type Ownership = 'own' | 'org' | 'franchise';

// ─── Create schema ─────────────────────────────────────────────────────────

const createSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().optional().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
  password: z.string().optional(),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
});

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().optional().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

const EMPTY_CREATE: CreateValues = { firstName: '', lastName: '', email: '', password: '', phoneNumber: '', companyName: '', notes: '' };
const EMPTY_EDIT: EditValues = { firstName: '', lastName: '', email: '', phoneNumber: '', companyName: '', notes: '' };

// ─── Helpers ────────────────────────────────────────────────────────────────

const selectCls = (hasError = false) =>
  `w-full inline-flex items-center justify-between h-10 rounded-md border bg-white px-3 text-sm font-normal text-[#263B4F] hover:bg-[#F3F4F6] focus:outline-none transition-all ${hasError ? 'border-[#DF453A]' : 'border-[#E5E7EB]'}`;

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Component ─────────────────────────────────────────────────────────────

const Clients = () => {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerResponse | null>(null);
  const [viewTarget, setViewTarget] = useState<CustomerResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Super admin ownership
  const [ownership, setOwnership] = useState<Ownership>('own');
  const [allOrgs, setAllOrgs] = useState<OrganisationResponse[]>([]);
  const [allFranchises, setAllFranchises] = useState<OrganisationResponse[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');

  const createForm = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: EMPTY_CREATE });
  const editForm = useForm<EditValues>({ resolver: zodResolver(editSchema), defaultValues: EMPTY_EDIT });

  const { register: regCreate, reset: resetCreate, handleSubmit: handleCreate,
    setValue: setCreateValue, watch: watchCreate, formState: { errors: createErrors } } = createForm;
  const { register: regEdit, reset: resetEdit, handleSubmit: handleEdit,
    formState: { errors: editErrors } } = editForm;

  const passwordValue = watchCreate('password');

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchClients = async (page = currentPage) => {
    setLoading(true);
    try {
      const data = await customerService.listClients(page, PAGE_SIZE);
      setClients(data.content);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalElements);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(currentPage); }, [currentPage, authUser?.id]);

  // Load orgs/franchises for super admin ownership toggle
  useEffect(() => {
    if (!isSuperAdmin) return;
    organisationService.getOrganisations(0, 1000)
      .then((d) => setAllOrgs(d.content ?? []))
      .catch(() => {});
    organisationService.getFranchises(0, 1000)
      .then((d) => setAllFranchises(d.content ?? []))
      .catch(() => {});
  }, [isSuperAdmin]);

  // ─── Modals ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    resetCreate(EMPTY_CREATE);
    setOwnership('own');
    setSelectedTargetId('');
    setCreateOpen(true);
  };

  const openEdit = (c: CustomerResponse) => {
    resetEdit({
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      email: c.email ?? '',
      phoneNumber: c.phoneNumber ?? '',
      companyName: c.companyName ?? '',
      notes: c.notes ?? '',
    });
    setEditTarget(c);
  };

  const closeCreate = () => { setCreateOpen(false); resetCreate(EMPTY_CREATE); setOwnership('own'); setSelectedTargetId(''); };
  const closeEdit = () => { setEditTarget(null); resetEdit(EMPTY_EDIT); };

  // ─── Submit Create ───────────────────────────────────────────────────────

  const onSubmitCreate = async (data: CreateValues) => {
    // Validate ownership selection for super admin
    if (isSuperAdmin && (ownership === 'org' || ownership === 'franchise') && !selectedTargetId) {
      toast.error(ownership === 'org' ? 'Please select an organisation.' : 'Please select a franchise.');
      return;
    }

    setSubmitting(true);
    const payload = {
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim() || undefined,
      email: data.email?.trim() || undefined,
      password: data.password?.trim() || undefined,
      phoneNumber: data.phoneNumber?.trim() || undefined,
      companyName: data.companyName?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      franchiseId: (isSuperAdmin && (ownership === 'org' || ownership === 'franchise') && selectedTargetId)
        ? selectedTargetId
        : undefined,
    };
    try {
      await customerService.createClient(payload);
      toast.success('Client created!');
      closeCreate();
      fetchClients(0);
      setCurrentPage(0);
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
    const payload = {
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phoneNumber: data.phoneNumber?.trim() || undefined,
      companyName: data.companyName?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
    };
    try {
      await customerService.updateClient(editTarget.id, payload);
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

  // ─── Ownership target label ──────────────────────────────────────────────

  const ownershipTargets = ownership === 'org' ? allOrgs : allFranchises;
  const selectedTarget = ownershipTargets.find((o) => o.uuid === selectedTargetId);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Clients</h1>
          <p className={styles.subtitle}>{totalItems} client{totalItems !== 1 ? 's' : ''} total</p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <Plus style={{ width: 15, height: 15 }} />
          Add Client
        </button>
      </div>

      {/* Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Users style={{ width: 16, height: 16, color: '#33AE95' }} />
            All Clients
          </div>
          <button className={styles.refreshBtn} onClick={() => fetchClients(currentPage)} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.spinner} />
              <p>Loading clients...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><Users style={{ width: 28, height: 28 }} /></div>
              <p className={styles.emptyTitle}>No clients yet</p>
              <p className={styles.emptySubtitle}>Click "Add Client" to add your first client.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Company</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className={styles.row}>
                      <td>
                        <div className={styles.clientCell}>
                          <div className={styles.avatar}>
                            {(c.firstName?.[0] ?? '?').toUpperCase()}
                          </div>
                          <div>
                            <p className={styles.clientName}>{c.fullName || c.firstName}</p>
                            {c.email && (
                              <p className={styles.clientEmail}>
                                <Mail style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} />
                                {c.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={styles.muted}>
                        {c.companyName
                          ? <span className={styles.company}><Building2 style={{ width: 12, height: 12 }} />{c.companyName}</span>
                          : '—'}
                      </td>
                      <td className={styles.muted}>
                        {c.phoneNumber
                          ? <span className={styles.company}><Phone style={{ width: 12, height: 12 }} />{c.phoneNumber}</span>
                          : '—'}
                      </td>
                      <td>
                        <span className={c.isActive ? styles.badgeActive : styles.badgeInactive}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
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

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationInfo}>
                    Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalItems)} of {totalItems}
                  </span>
                  <div className={styles.paginationControls}>
                    <button className={styles.pageBtn} disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button key={i} className={`${styles.pageBtn} ${i === currentPage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(i)}>
                        {i + 1}
                      </button>
                    ))}
                    <button className={styles.pageBtn} disabled={currentPage === totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create Client Modal ────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center">
                <User size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Add Client</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              Add a new client. Their role is set to <strong>Client</strong> by default.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createForm.handleSubmit(onSubmitCreate, () => toast.error('Please fix the errors.'))}>
            <div className="px-7 py-6 space-y-6">

              {/* Personal Info */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#33AE95]"><User size={13} /></span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Personal Information</span>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="First Name" required error={createErrors.firstName?.message}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><User size={15} /></span>
                        <Input placeholder="John" {...regCreate('firstName')} className={`${inputCls(!!createErrors.firstName)} pl-9`} />
                      </div>
                    </Fld>
                    <Fld label="Last Name">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><User size={15} /></span>
                        <Input placeholder="Doe" {...regCreate('lastName')} className={`${inputCls(false)} pl-9`} />
                      </div>
                    </Fld>
                    <Fld label="Email" error={createErrors.email?.message}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><Mail size={15} /></span>
                        <Input type="email" autoComplete="off" placeholder="john@example.com" {...regCreate('email')} className={`${inputCls(!!createErrors.email)} pl-9`} />
                      </div>
                    </Fld>
                    <Fld label="Password">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><Lock size={15} /></span>
                          <Input type="text" autoComplete="new-password" placeholder="Set a password" {...regCreate('password')} className={`${inputCls(false)} pl-9`} />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCreateValue('password', generatePassword())}
                          className="shrink-0 h-10 px-3 rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#33AE95] hover:border-[#33AE95] transition-all flex items-center gap-1.5 text-xs font-medium"
                        >
                          <Wand2 size={13} />
                          Generate
                        </button>
                      </div>
                      {passwordValue && (
                        <p className="text-xs text-[#6B7280] mt-1 font-mono break-all">{passwordValue}</p>
                      )}
                    </Fld>
                    <Fld label="Phone">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><Phone size={15} /></span>
                        <Input placeholder="+91 98765 43210" {...regCreate('phoneNumber')} className={`${inputCls(false)} pl-9`} />
                      </div>
                    </Fld>
                    <Fld label="Company Name">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10"><Building2 size={15} /></span>
                        <Input placeholder="Company Pvt. Ltd." {...regCreate('companyName')} className={`${inputCls(false)} pl-9`} />
                      </div>
                    </Fld>
                  </div>
                  <div className="mt-4">
                    <Fld label="Notes">
                      <textarea rows={2} placeholder="Any additional notes..." {...regCreate('notes')}
                        className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none" />
                    </Fld>
                  </div>
                </div>
              </section>

              {/* Role — locked to Client */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#33AE95]"><Lock size={13} /></span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Role</span>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-5 py-3 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#33AE95]/10 border border-[#33AE95]/30 text-[#33AE95] text-xs font-semibold">
                    <User size={12} /> Client
                  </span>
                  <span className="text-xs text-[#9CA3AF]">Role is fixed — clients are end users of your organisation.</span>
                </div>
              </section>

              {/* Ownership — super admin only */}
              {isSuperAdmin && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[#33AE95]"><Building2 size={13} /></span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Assign To</span>
                  </div>
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5 space-y-4">
                    {/* Toggle buttons */}
                    <div className="flex gap-2">
                      {(['own', 'org', 'franchise'] as Ownership[]).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => { setOwnership(o); setSelectedTargetId(''); }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                            ownership === o
                              ? 'bg-[#33AE95] text-white border-[#33AE95]'
                              : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#33AE95] hover:text-[#33AE95]'
                          }`}
                        >
                          {o === 'own' ? 'My Own' : o === 'org' ? 'Organisation' : 'Franchise'}
                        </button>
                      ))}
                    </div>

                    {ownership === 'own' && (
                      <p className="text-xs text-[#9CA3AF]">Client will be created without a specific organisation.</p>
                    )}

                    {(ownership === 'org' || ownership === 'franchise') && (
                      <Fld
                        label={ownership === 'org' ? 'Select Organisation' : 'Select Franchise'}
                        required
                      >
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className={selectCls(!selectedTargetId && submitting)}>
                            <span className={selectedTarget ? 'text-[#263B4F]' : 'text-[#9CA3AF]'}>
                              {selectedTarget
                                ? <span className="flex items-center gap-2">
                                    {ownership === 'franchise' ? <GitBranch size={13} /> : <Building2 size={13} />}
                                    {selectedTarget.name}
                                  </span>
                                : `— Select ${ownership === 'org' ? 'organisation' : 'franchise'} —`}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999] max-h-52 overflow-y-auto"
                            style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
                          >
                            {ownershipTargets.length === 0 ? (
                              <DropdownMenuItem disabled className="text-[#9CA3AF]">
                                No {ownership === 'org' ? 'organisations' : 'franchises'} found
                              </DropdownMenuItem>
                            ) : ownershipTargets.map((o) => (
                              <DropdownMenuItem
                                key={o.uuid}
                                onSelect={() => setSelectedTargetId(o.uuid)}
                                className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-2.5"
                              >
                                {o.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Fld>
                    )}
                  </div>
                </section>
              )}
            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={closeCreate} disabled={submitting}
                className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg">
                {submitting
                  ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Adding...</span>
                  : 'Add Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/15 border border-[#33AE95]/30 flex items-center justify-center">
                <User size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Edit Client</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">Update the client details.</DialogDescription>
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
              <Fld label="Company Name">
                <Input placeholder="Company Pvt. Ltd." {...regEdit('companyName')} className={inputCls(false)} />
              </Fld>
              <Fld label="Notes">
                <textarea rows={3} placeholder="Any additional notes..." {...regEdit('notes')}
                  className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none" />
              </Fld>
            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={closeEdit} disabled={submitting}
                className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg">
                {submitting
                  ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Updating...</span>
                  : 'Update Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-md shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/15 border border-[#33AE95]/30 flex items-center justify-center">
                <User size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Client Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewTarget && (
            <div className="px-7 py-5 space-y-0">
              <ViewRow label="Name" value={viewTarget.fullName || viewTarget.firstName} />
              <ViewRow label="Email" value={viewTarget.email ?? '—'} />
              <ViewRow label="Phone" value={viewTarget.phoneNumber ?? '—'} />
              <ViewRow label="Company" value={viewTarget.companyName ?? '—'} />
              <ViewRow label="Organisation" value={viewTarget.franchiseName ?? '—'} />
              <ViewRow label="Status" value={viewTarget.isActive ? 'Active' : 'Inactive'} />
              {viewTarget.notes && <ViewRow label="Notes" value={viewTarget.notes} />}
            </div>
          )}
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="ghost" onClick={() => setViewTarget(null)}
              className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Close</Button>
            {viewTarget && (
              <Button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                className="bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold">
                <Pencil size={14} className="mr-2" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
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
              {deleting ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
