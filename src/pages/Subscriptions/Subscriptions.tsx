import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  CreditCard, Plus, RefreshCw, IndianRupee, Clock,
  FileText, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { subscriptionService } from '@/services/subscriptionService';
import type { SubscriptionResponse } from '@/services/models/subscription';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import styles from './Subscriptions.module.css';

const PAGE_SIZE = 10;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  planName: z.string().min(1, 'Plan name is required'),
  price: z
    .string()
    .min(1, 'Price is required')
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Enter a valid price (e.g. 999.00)'),
  durationMonths: z
    .string()
    .min(1, 'Duration is required')
    .refine((v) => /^\d+$/.test(v) && parseInt(v) > 0, 'Enter a valid number of months'),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isActivePlan = (plan: SubscriptionResponse) =>
  plan.status?.name?.toUpperCase() === 'ACTIVE';

// ─── Component ────────────────────────────────────────────────────────────────

const Subscriptions = () => {
  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [viewPlan, setViewPlan] = useState<SubscriptionResponse | null>(null);
  const [editTarget, setEditTarget] = useState<SubscriptionResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const { register, reset, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { planName: '', price: '', durationMonths: '', isActive: true, notes: '' },
  });

  const watchIsActive = watch('isActive');

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      const p = await subscriptionService.listSubscriptions();
      setPlans(p);
    } catch {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Create ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    reset({ planName: '', price: '', durationMonths: '', isActive: true, notes: '' });
    setModalMode('create');
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────

  const openEdit = (plan: SubscriptionResponse) => {
    setEditTarget(plan);
    reset({
      planName: plan.planName,
      price: plan.price != null ? String(plan.price) : '',
      durationMonths: plan.durationMonths != null ? String(plan.durationMonths) : '',
      isActive: isActivePlan(plan),
      notes: plan.notes ?? '',
    });
    setModalMode('edit');
  };

  // ─── Submit (create / edit) ───────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    const payload = {
      planName: data.planName,
      price: parseFloat(data.price),
      durationMonths: parseInt(data.durationMonths),
      statusId: data.isActive ? 1 : 2,
      notes: data.notes || undefined,
    };
    try {
      if (modalMode === 'edit' && editTarget) {
        const updated = await subscriptionService.updateSubscription(editTarget.id, payload);
        setPlans((prev) => prev.map((p) => p.id === editTarget.id ? updated : p));
        toast.success('Subscription plan updated!');
      } else {
        const created = await subscriptionService.createSubscription(payload);
        setPlans((prev) => [...prev, created]);
        toast.success('Subscription plan created!');
      }
      setModalMode(null);
    } catch (e: any) {
      toast.error(e.message || `Failed to ${modalMode === 'edit' ? 'update' : 'create'} subscription plan`);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Toggle status ────────────────────────────────────────────────────────

  const handleToggleStatus = async (plan: SubscriptionResponse) => {
    setTogglingId(plan.id);
    try {
      const updated = await subscriptionService.toggleStatus(plan.id);
      setPlans((prev) => prev.map((p) => p.id === plan.id ? updated : p));
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle status');
    } finally {
      setTogglingId(null);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await subscriptionService.deleteSubscription(deleteTarget.id);
      setPlans((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success('Subscription plan deleted');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete subscription plan');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Pagination ───────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(plans.length / PAGE_SIZE));
  const paginated = plans.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Subscription Plans</h1>
          <p className={styles.pageSubtitle}>
            Create and manage global subscription plans. Assign them to organisations from the Organisation detail page.
          </p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <Plus style={{ display: 'inline', width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
          Create Plan
        </button>
      </div>

      {/* Table Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>
            <CreditCard style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }} />
            All Plans
          </h3>
          <button className={styles.refreshBtn} onClick={fetchData} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              <p style={{ marginTop: 12 }}>Loading...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className={styles.emptyState}>
              <CreditCard style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
              <p>No subscription plans yet.</p>
              <p className={styles.emptySubtext}>Click "Create Plan" to add one.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Plan Name</th>
                    <th>Price</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => (
                    <tr key={p.id} className={styles.tableRow}>
                      <td><span className={styles.planName}>{p.planName}</span></td>
                      <td className={styles.mutedCell}>
                        {p.price != null ? `₹ ${Number(p.price).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className={styles.mutedCell}>
                        {p.durationMonths != null ? `${p.durationMonths} month${p.durationMonths !== 1 ? 's' : ''}` : '—'}
                      </td>
                      <td>
                        <StatusToggle
                          active={isActivePlan(p)}
                          loading={togglingId === p.id}
                          onToggle={() => handleToggleStatus(p)}
                        />
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.actionBtn} title="View" onClick={() => setViewPlan(p)}>
                            <Eye size={14} />
                          </button>
                          <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(p)}>
                            <Pencil size={14} />
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            title="Delete"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination — always shown */}
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  {`Showing ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, plans.length)} of ${plans.length}`}
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.pageBtn}
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      className={`${styles.pageBtn} ${i === currentPage ? styles.pageBtnActive : ''}`}
                      onClick={() => setCurrentPage(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    className={styles.pageBtn}
                    disabled={currentPage === totalPages - 1}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) setModalMode(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <CreditCard size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                {modalMode === 'edit' ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 text-sm pl-12">
              {modalMode === 'edit'
                ? 'Update the details of this subscription plan.'
                : 'Define a reusable plan that can be assigned to any organisation.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors before submitting.'))}>
            <div className="px-7 py-6 space-y-5">

              <Fld label="Plan Name" required error={errors.planName?.message}>
                <Input placeholder="e.g. Professional Plan" {...register('planName')}
                  className={inputCls(!!errors.planName)} />
              </Fld>

              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="Price" required error={errors.price?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                      <IndianRupee size={14} />
                    </span>
                    <Input placeholder="0.00" {...register('price')}
                      className={inputCls(!!errors.price) + ' pl-9'} />
                  </div>
                </Fld>
                <Fld label="Duration (Months)" required error={errors.durationMonths?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                      <Clock size={14} />
                    </span>
                    <Input placeholder="e.g. 12" {...register('durationMonths')}
                      className={inputCls(!!errors.durationMonths) + ' pl-9'} />
                  </div>
                </Fld>
              </div>

              {/* Status toggle — only shown in edit mode */}
              {modalMode === 'edit' && (
                <Fld label="Status">
                  <div className="flex items-center gap-3 py-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={watchIsActive}
                      onClick={() => setValue('isActive', !watchIsActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${watchIsActive ? 'bg-green-500' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${watchIsActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-medium ${watchIsActive ? 'text-green-400' : 'text-slate-500'}`}>
                      {watchIsActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </Fld>
              )}

              <Fld label="Notes" hint="Optional" error={errors.notes?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-500 pointer-events-none z-10">
                    <FileText size={14} />
                  </span>
                  <textarea
                    rows={3}
                    placeholder="Description or notes..."
                    {...register('notes')}
                    className="w-full rounded-md bg-slate-950/60 border border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm px-3 py-2 pl-9 resize-none outline-none"
                  />
                </div>
              </Fld>

            </div>

            <DialogFooter className="px-7 py-5 border-t border-slate-800 bg-slate-900/30 rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={() => setModalMode(null)} disabled={submitting}
                className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg active:scale-95">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {modalMode === 'edit' ? 'Saving...' : 'Creating...'}
                  </span>
                ) : modalMode === 'edit' ? 'Save Changes' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Modal ── */}
      <Dialog open={viewPlan !== null} onOpenChange={(open) => { if (!open) setViewPlan(null); }}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <CreditCard size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">Plan Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewPlan && (
            <div className="px-7 py-6 space-y-1">
              <ViewRow label="Plan Name" value={viewPlan.planName} />
              <ViewRow label="Price" value={viewPlan.price != null ? `₹ ${Number(viewPlan.price).toLocaleString('en-IN')}` : '—'} />
              <ViewRow label="Duration" value={viewPlan.durationMonths != null ? `${viewPlan.durationMonths} month${viewPlan.durationMonths !== 1 ? 's' : ''}` : '—'} />
              <ViewRow label="Status" value={viewPlan.status?.name ?? '—'} />
              <ViewRow label="Notes" value={viewPlan.notes ?? '—'} />
            </div>
          )}
          <DialogFooter className="px-7 py-5 border-t border-slate-800 flex gap-3">
            <Button variant="ghost" onClick={() => setViewPlan(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Modal ── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">Delete Plan</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 text-sm pl-12">
              Are you sure you want to delete{' '}
              <strong className="text-white">{deleteTarget?.planName}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 border-t border-slate-800 flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
              Cancel
            </Button>
            <Button onClick={confirmDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold">
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Deleting...
                </span>
              ) : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Subscriptions;

// ─── Micro helpers ─────────────────────────────────────────────────────────────

const inputCls = (hasError?: boolean) =>
  `h-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${hasError ? 'border-red-500' : ''}`;

function Fld({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-slate-300 text-sm font-medium">{label}</Label>
        {required && <span className="text-red-400 text-xs">*</span>}
        {hint && <span className="text-slate-500 text-xs">({hint})</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 uppercase tracking-wide font-medium shrink-0 w-28">{label}</span>
      <span className="text-sm text-slate-200 text-right">{value}</span>
    </div>
  );
}

function StatusToggle({ active, loading, onToggle }: {
  active: boolean; loading: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={loading}
      onClick={onToggle}
      title={active ? 'Click to deactivate' : 'Click to activate'}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 cursor-pointer ${active ? 'bg-green-500' : 'bg-slate-600'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}
