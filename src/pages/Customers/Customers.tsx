import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users, Plus, RefreshCw, Eye, Pencil, Trash2, Mail, Phone,
  Building2, AlertTriangle, User, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { customerService } from '@/services/customerService';
import type { CustomerResponse } from '@/services/models/customer';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Fld, ViewRow, inputCls } from '@/components/shared-ui/form-helpers';
import styles from './Customers.module.css';

const PAGE_SIZE = 10;

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().optional().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { firstName: '', lastName: '', email: '', phoneNumber: '', companyName: '', notes: '' };

const Clients = () => {
  const { user } = useAuthStore();

  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerResponse | null>(null);
  const [viewTarget, setViewTarget] = useState<CustomerResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, reset, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  // ─── Fetch ────────────────────────────────────────────────────────────────

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

  useEffect(() => { fetchClients(currentPage); }, [currentPage, user?.id]);

  // ─── Open forms ───────────────────────────────────────────────────────────

  const openCreate = () => { setEditTarget(null); reset(EMPTY); setFormOpen(true); };

  const openEdit = (c: CustomerResponse) => {
    setEditTarget(c);
    reset({
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      email: c.email ?? '',
      phoneNumber: c.phoneNumber ?? '',
      companyName: c.companyName ?? '',
      notes: c.notes ?? '',
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditTarget(null); reset(EMPTY); };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
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
      if (editTarget) {
        const updated = await customerService.updateClient(editTarget.id, payload);
        setClients((prev) => prev.map((c) => c.id === editTarget.id ? updated : c));
        toast.success('Client updated!');
      } else {
        const created = await customerService.createClient(payload);
        setClients((prev) => [created, ...prev]);
        toast.success('Client created!');
      }
      closeForm();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save client');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────

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

              {/* Pagination */}
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

      {/* Create / Edit Modal */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/15 border border-[#33AE95]/30 flex items-center justify-center">
                <User size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {editTarget ? 'Edit Client' : 'Add Client'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {editTarget ? 'Update the client details.' : 'Add a new client to your organisation.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors.'))}>
            <div className="px-7 py-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="First Name" required error={errors.firstName?.message}>
                  <Input placeholder="John" {...register('firstName')} className={inputCls(!!errors.firstName)} />
                </Fld>
                <Fld label="Last Name">
                  <Input placeholder="Doe" {...register('lastName')} className={inputCls(false)} />
                </Fld>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="Email" error={errors.email?.message}>
                  <Input type="email" placeholder="john@company.com" {...register('email')} className={inputCls(!!errors.email)} />
                </Fld>
                <Fld label="Phone">
                  <Input placeholder="+91 98765 43210" {...register('phoneNumber')} className={inputCls(false)} />
                </Fld>
              </div>
              <Fld label="Company Name">
                <Input placeholder="Company Pvt. Ltd." {...register('companyName')} className={inputCls(false)} />
              </Fld>
              <Fld label="Notes" hint="Optional">
                <textarea rows={3} placeholder="Any additional notes..." {...register('notes')}
                  className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none" />
              </Fld>
            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={closeForm} disabled={submitting}
                className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg">
                {submitting
                  ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{editTarget ? 'Updating...' : 'Adding...'}</span>
                  : editTarget ? 'Update Client' : 'Add Client'}
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
