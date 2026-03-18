import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  CreditCard, Plus, RefreshCw, IndianRupee, Clock,
  FileText, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Users, Package, LayoutGrid,
} from 'lucide-react';

import { subscriptionService } from '@/services/subscriptionService';
import type { SubscriptionResponse } from '@/services/models/subscription';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import styles from './Subscriptions.module.css';

import { Fld, ViewRow, inputCls } from '@/components/shared-ui/form-helpers';

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
  maxUsers: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && parseInt(v) > 0), 'Enter a valid number'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isActivePlan = (plan: SubscriptionResponse) =>
  plan.status?.name?.toUpperCase() === 'ACTIVE';

// ─── Component ────────────────────────────────────────────────────────────────

const Subscriptions = () => {
  const { user } = useAuthStore();
  const { accessModules } = useModuleStore();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

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
  const [toggleTarget, setToggleTarget] = useState<{ plan: SubscriptionResponse; newActive: boolean } | null>(null);
  const [selectedModuleIds, setSelectedModuleIds] = useState<number[]>([]);

  const { register, reset, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { planName: '', price: '', durationMonths: '', maxUsers: '', billingCycle: 'MONTHLY', isActive: true, notes: '' },
  });

  const watchIsActive = watch('isActive');

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Backend is caller-aware: super admin gets global plans, org admin gets
      // their org's plans — resolved from JWT claims server-side, no orgId needed here.
      const p = await subscriptionService.listSubscriptions();
      setPlans(p);
    } catch {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  // Re-run whenever the user identity changes (important: Zustand rehydration
  // after page refresh may happen slightly after the first render).
  useEffect(() => { fetchData(); }, [user?.id]);

  // ─── Create ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setSelectedModuleIds([]);
    reset({ planName: '', price: '', durationMonths: '', maxUsers: '', billingCycle: 'MONTHLY', isActive: true, notes: '' });
    setModalMode('create');
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────

  const openEdit = (plan: SubscriptionResponse) => {
    setEditTarget(plan);
    setSelectedModuleIds((plan.modules ?? []).map((m) => m.id));
    reset({
      planName: plan.planName,
      price: plan.price != null ? String(plan.price) : '',
      durationMonths: plan.durationMonths != null ? String(plan.durationMonths) : '',
      maxUsers: plan.maxUsers != null ? String(plan.maxUsers) : '',
      billingCycle: (plan.billingCycle as 'MONTHLY' | 'YEARLY') ?? 'MONTHLY',
      isActive: isActivePlan(plan),
      notes: plan.notes ?? '',
    });
    setModalMode('edit');
  };

  // ─── Module toggle ────────────────────────────────────────────────────────

  const toggleModule = (id: number) => {
    setSelectedModuleIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  // ─── Submit (create / edit) ───────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    const payload = {
      planName: data.planName,
      price: parseFloat(data.price),
      durationMonths: parseInt(data.durationMonths),
      maxUsers: data.maxUsers ? parseInt(data.maxUsers) : undefined,
      billingCycle: data.billingCycle,
      statusId: data.isActive ? 1 : 2,
      notes: data.notes || undefined,
      moduleIds: selectedModuleIds,
      // createdByOrgId is derived server-side from JWT claims
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

  const handleToggleStatus = (plan: SubscriptionResponse) => {
    setToggleTarget({ plan, newActive: !isActivePlan(plan) });
  };

  const confirmToggleStatus = async () => {
    if (!toggleTarget) return;
    const { plan } = toggleTarget;
    setTogglingId(plan.id);
    try {
      const updated = await subscriptionService.toggleStatus(plan.id);
      setPlans((prev) => prev.map((p) => p.id === plan.id ? updated : p));
      toast.success(`Plan marked as ${toggleTarget.newActive ? 'Active' : 'Inactive'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle status');
    } finally {
      setTogglingId(null);
      setToggleTarget(null);
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

  const modulePickerItems = accessModules
    .map((m) => ({ id: m.moduleId, name: m.name, category: m.category ?? '' }));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Subscription Plans</h1>
          {/* <p className={styles.pageSubtitle}>
            {isSuperAdmin
              ? 'Create and manage global subscription plans with features (modules) and user limits.'
              : 'Create and manage subscription plans for your franchise branches.'}
          </p> */}
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
                    <th>Max Users</th>
                    <th>Modules</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => (
                    <tr key={p.id} className={styles.tableRow}>
                      <td><span className={styles.planName}>{p.planName}</span></td>
                      <td className={styles.mutedCell}>
                        {p.price != null ? `\u20B9 ${Number(p.price).toLocaleString('en-IN')}` : '\u2014'}
                      </td>
                      <td className={styles.mutedCell}>
                        {p.durationMonths != null
                          ? `${p.durationMonths} mo${p.billingCycle ? ` \u00B7 ${p.billingCycle.charAt(0) + p.billingCycle.slice(1).toLowerCase()}` : ''}`
                          : '\u2014'}
                      </td>
                      <td className={styles.mutedCell}>
                        {p.maxUsers != null ? p.maxUsers.toLocaleString() : '\u2014'}
                      </td>
                      <td className={styles.mutedCell}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                          <Package style={{ width: 12, height: 12 }} />
                          {p.modules?.length ?? 0}
                        </span>
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

              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  {`Showing ${currentPage * PAGE_SIZE + 1}\u2013${Math.min((currentPage + 1) * PAGE_SIZE, plans.length)} of ${plans.length}`}
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

      {/* Create / Edit Modal */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) setModalMode(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <CreditCard size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {modalMode === 'edit' ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {modalMode === 'edit'
                ? 'Update the plan details and its assigned modules.'
                : 'Define a reusable plan with pricing, limits, and features.'}
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                      <IndianRupee size={14} />
                    </span>
                    <Input placeholder="0.00" {...register('price')}
                      className={inputCls(!!errors.price) + ' pl-9'} />
                  </div>
                </Fld>
                <Fld label="Duration (Months)" required error={errors.durationMonths?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                      <Clock size={14} />
                    </span>
                    <Input placeholder="e.g. 12" {...register('durationMonths')}
                      className={inputCls(!!errors.durationMonths) + ' pl-9'} />
                  </div>
                </Fld>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="Max Users" hint="Optional" error={errors.maxUsers?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                      <Users size={14} />
                    </span>
                    <Input placeholder="e.g. 50" {...register('maxUsers')}
                      className={inputCls(!!errors.maxUsers) + ' pl-9'} />
                  </div>
                </Fld>
                <Fld label="Billing Cycle">
                  <div className="flex gap-2">
                    {(['MONTHLY', 'YEARLY'] as const).map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setValue('billingCycle', cycle)}
                        className={`flex-1 h-10 rounded-md text-sm font-medium border transition-all ${watch('billingCycle') === cycle
                          ? 'bg-blue-600/20 border-blue-500/60 text-blue-400'
                          : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]'
                          }`}
                      >
                        {cycle.charAt(0) + cycle.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </Fld>
              </div>

              {modalMode === 'edit' && (
                <Fld label="Status">
                  <div className="flex items-center gap-3 py-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={watchIsActive}
                      onClick={() => setValue('isActive', !watchIsActive)}
                      className={`${styles.statusToggle} ${watchIsActive ? styles.toggleOn : styles.toggleOff}`}
                    />
                    <span className={`text-sm font-medium ${watchIsActive ? 'text-green-600' : 'text-[#6B7280]'}`}>
                      {watchIsActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </Fld>
              )}

              <Fld label="Features (Modules)" hint="Select which features this plan includes">
                {modulePickerItems.length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-2">
                    No modules available. Create modules on the Modules page first.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 mt-1">
                    {modulePickerItems.map((m) => {
                      const checked = selectedModuleIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleModule(m.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: `1px solid ${checked ? 'rgba(59,130,246,0.4)' : '#E5E7EB'}`,
                            background: checked ? 'rgba(59,130,246,0.06)' : '#F9FAFB',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{
                            marginTop: 2, flexShrink: 0, width: 16, height: 16,
                            borderRadius: 4, border: `1px solid ${checked ? '#3b82f6' : '#D1D5DB'}`,
                            background: checked ? '#3b82f6' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {checked && <CheckCircle size={10} color="white" />}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: checked ? '#2563eb' : '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.name}
                            </p>
                            {m.category && (
                              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.category}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedModuleIds.length > 0 && (
                  <p style={{ fontSize: 12, color: '#60a5fa', marginTop: 8 }}>
                    {selectedModuleIds.length} module{selectedModuleIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </Fld>

              <Fld label="Notes" hint="Optional" error={errors.notes?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400 pointer-events-none z-10">
                    <FileText size={14} />
                  </span>
                  <textarea
                    rows={3}
                    placeholder="Description or notes..."
                    {...register('notes')}
                    className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 transition-all text-sm px-3 py-2 pl-9 resize-none outline-none"
                  />
                </div>
              </Fld>

            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={() => setModalMode(null)} disabled={submitting}
                className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">
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

      {/* View Modal */}
      <Dialog open={viewPlan !== null} onOpenChange={(open) => { if (!open) setViewPlan(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <CreditCard size={18} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Plan Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewPlan && (
            <div className="px-7 py-6 space-y-5">
              <div>
                <ViewRow label="Plan Name" value={viewPlan.planName} />
                <ViewRow label="Price" value={viewPlan.price != null ? `\u20B9 ${Number(viewPlan.price).toLocaleString('en-IN')}` : '\u2014'} />
                <ViewRow label="Duration" value={viewPlan.durationMonths != null ? `${viewPlan.durationMonths} month${viewPlan.durationMonths !== 1 ? 's' : ''}` : '\u2014'} />
                <ViewRow label="Billing Cycle" value={viewPlan.billingCycle ?? '\u2014'} />
                <ViewRow label="Max Users" value={viewPlan.maxUsers != null ? String(viewPlan.maxUsers) : 'Unlimited'} />
                <ViewRow label="Status" value={viewPlan.status?.name ?? '\u2014'} />
                <ViewRow label="Notes" value={viewPlan.notes ?? '\u2014'} />
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LayoutGrid size={12} />
                  Features / Modules ({(viewPlan.modules ?? []).length})
                </p>
                {(viewPlan.modules ?? []).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#6B7280' }}>No modules assigned to this plan.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {viewPlan.modules!.map((m) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px' }}>
                        <Package size={13} color="#3b82f6" style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#263B4F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                          {m.category && <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{m.category}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="ghost" onClick={() => setViewPlan(null)}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Confirm Modal */}
      <Dialog open={toggleTarget !== null} onOpenChange={(open) => { if (!open) setToggleTarget(null); }}>
        <DialogContent className="sm:max-w-sm shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${toggleTarget?.newActive ? 'bg-green-600/20 border border-green-500/30' : 'bg-orange-600/20 border border-orange-500/30'}`}>
                {toggleTarget?.newActive
                  ? <CheckCircle size={18} className="text-green-500" />
                  : <XCircle size={18} className="text-orange-500" />}
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {toggleTarget?.newActive ? 'Activate Plan' : 'Deactivate Plan'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              Are you sure you want to{' '}
              <strong className="text-[#263B4F]">{toggleTarget?.newActive ? 'activate' : 'deactivate'}</strong>{' '}
              <strong className="text-[#263B4F]">{toggleTarget?.plan.planName}</strong>?
              {!toggleTarget?.newActive && ' Inactive plans will not be available for new organisations.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="ghost" onClick={() => setToggleTarget(null)} disabled={!!togglingId}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">
              Cancel
            </Button>
            <Button
              onClick={confirmToggleStatus}
              disabled={!!togglingId}
              className={toggleTarget?.newActive
                ? 'bg-green-600 hover:bg-green-500 text-white font-semibold'
                : 'bg-orange-600 hover:bg-orange-500 text-white font-semibold'}
            >
              {togglingId ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Updating...
                </span>
              ) : toggleTarget?.newActive ? 'Activate' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Delete Plan</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              Are you sure you want to delete{' '}
              <strong className="text-[#263B4F]">{deleteTarget?.planName}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">
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
      className={`${styles.statusToggle} ${active ? styles.toggleOn : styles.toggleOff}`}
    />
  );
}
