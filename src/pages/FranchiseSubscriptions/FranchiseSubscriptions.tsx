/**
 * FranchiseSubscriptions.tsx
 *
 * Dedicated page for franchise users to manage the subscription plans
 * they offer to their customers. Plans created here are tagged with
 * createdByOrgId = authUser.orgId so they're isolated from global plans.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  CreditCard, Plus, RefreshCw, IndianRupee, Clock, FileText, Loader2,
  Eye, Pencil, Trash2, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Users, Package, LayoutGrid, Sparkles,
} from 'lucide-react';

import { subscriptionService } from '@/services/subscriptionService';
import { moduleService } from '@/services/moduleService';
import { organisationService } from '@/services/organisationService';
import type { SubscriptionResponse } from '@/services/models/subscription';
import type { ModuleResponse } from '@/services/models/module';
import type { OrganisationResponse } from '@/services/models/organisation';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Label } from '@/components/shared-ui/Label/label';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import styles from '@/pages/Subscriptions/Subscriptions.module.css';

const PAGE_SIZE = 10;

const schema = z.object({
  planName: z.string().min(1, 'Plan name is required'),
  price: z.string().min(1, 'Price is required')
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Enter a valid price (e.g. 999.00)'),
  durationMonths: z.string().min(1, 'Duration is required')
    .refine((v) => /^\d+$/.test(v) && parseInt(v) > 0, 'Enter a valid number of months'),
  maxUsers: z.string().optional()
    .refine((v) => !v || (/^\d+$/.test(v) && parseInt(v) > 0), 'Enter a valid number'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  isActive: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const isActivePlan = (plan: SubscriptionResponse) =>
  plan.status?.name?.toUpperCase() === 'ACTIVE';

const FranchiseSubscriptions = () => {
  const { user } = useAuthStore();
  const { accessModules } = useModuleStore();
  const isSuperAdmin = user?.isSuperAdmin === true || (user as any)?.role === 'super_admin';

  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [organisations, setOrganisations] = useState<OrganisationResponse[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(false);
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
  const [allDbModules, setAllDbModules] = useState<ModuleResponse[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

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
      const p = isSuperAdmin
        ? await subscriptionService.listSubscriptions()
        : await subscriptionService.listMySubscriptions();
      // Show only franchise plans (non-global or org-owned)
      setPlans(p.filter((plan) => plan.global === false || plan.createdByOrgId != null));
    } catch {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (isSuperAdmin) {
      organisationService.getOrganisations(0, 200)
        .then((d) => setOrganisations(d.content ?? []))
        .catch(() => { });
    }
  }, [user?.id]);

  // ─── Load all DB modules for the picker ──────────────────────────────────

  const loadModules = async () => {
    // Org admin: only show modules they themselves have access to (can't grant more than they have)
    if (!isSuperAdmin) {
      setAllDbModules(
        accessModules.map((m) => ({
          id: m.moduleId,
          name: m.name,
          route: m.route,
          icon: m.icon ?? null,
          category: m.category ?? null,
          active: true,
        } as ModuleResponse))
      );
      return;
    }
    // Super admin: load franchise-eligible modules from DB
    setModulesLoading(true);
    try {
      const mods = await moduleService.listModules('FRANCHISE');
      setAllDbModules(mods);
    } catch {
      toast.error('Failed to load modules');
    } finally {
      setModulesLoading(false);
    }
  };

  // ─── Create / Edit ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setSelectedModuleIds([]);
    setSelectedOrgId('');
    reset({ planName: '', price: '', durationMonths: '', maxUsers: '', billingCycle: 'MONTHLY', isActive: true, notes: '' });
    setModalMode('create');
    loadModules();
  };

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
    loadModules();
  };

  const toggleModule = (id: number) =>
    setSelectedModuleIds((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);

  const onSubmit = async (data: FormValues) => {
    if (isSuperAdmin && modalMode === 'create' && !selectedOrgId) {
      toast.error('Please select an organisation for this plan');
      return;
    }
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
      createdByOrgId: isSuperAdmin && modalMode === 'create' ? selectedOrgId : undefined,
    };
    try {
      if (modalMode === 'edit' && editTarget) {
        const updated = await subscriptionService.updateSubscription(editTarget.id, payload);
        setPlans((prev) => prev.map((p) => p.id === editTarget.id ? updated : p));
        toast.success('Plan updated!');
      } else {
        const created = await subscriptionService.createSubscription(payload);
        setPlans((prev) => [...prev, created]);
        toast.success('Plan created!');
      }
      setModalMode(null);
    } catch (e: any) {
      toast.error(e.message || `Failed to ${modalMode === 'edit' ? 'update' : 'create'} plan`);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Toggle status ────────────────────────────────────────────────────────

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
      toast.success('Plan deleted');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete plan');
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
          {/* <h1 className={styles.pageTitle}>My Subscription Plans</h1> */}
          <p className={styles.pageSubtitle}>
            {/* Create and manage subscription plans to offer your customers. Each plan defines features and user limits. */}
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
            <Sparkles style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }} />
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
              <p className={styles.emptySubtext}>Click "Create Plan" to add one for your customers.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Plan Name</th>
                    <th>Price</th>
                    <th>Duration</th>
                    <th>Max Customers</th>
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
                        {p.price != null ? `₹ ${Number(p.price).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className={styles.mutedCell}>
                        {p.durationMonths != null
                          ? `${p.durationMonths} mo${p.billingCycle ? ` · ${p.billingCycle.charAt(0) + p.billingCycle.slice(1).toLowerCase()}` : ''}`
                          : '—'}
                      </td>
                      <td className={styles.mutedCell}>
                        {p.maxUsers != null ? p.maxUsers.toLocaleString() : '—'}
                      </td>
                      <td className={styles.mutedCell}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7280' }}>
                          <Package style={{ width: 12, height: 12 }} />
                          {p.modules?.length ?? 0}
                        </span>
                      </td>
                      <td>
                        <StatusToggle
                          active={isActivePlan(p)}
                          loading={togglingId === p.id}
                          onToggle={() => setToggleTarget({ plan: p, newActive: !isActivePlan(p) })}
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
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Delete" onClick={() => setDeleteTarget(p)}>
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
                  {`Showing ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, plans.length)} of ${plans.length}`}
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
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalMode !== null} onOpenChange={(open) => { if (!open) setModalMode(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center">
                <Sparkles size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {modalMode === 'edit' ? 'Edit Plan' : 'Create Subscription Plan'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {modalMode === 'edit' ? 'Update the plan details.' : 'Define a plan to offer your customers — set pricing, limits, and features.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors before submitting.'))}>
            <div className="px-7 py-6 space-y-5">

              {/* Organisation selector — super admin only, create mode only */}
              {isSuperAdmin && modalMode === 'create' && (
                <Fld label="Organisation" required>
                  <DropdownSelect
                    options={organisations.map((o) => ({
                      value: o.uuid,
                      label: o.name,
                      meta: o.parentOrgId ? 'Franchise' : 'Organisation',
                    }))}
                    value={selectedOrgId || null}
                    onChange={(val) => setSelectedOrgId(String(val ?? ''))}
                    placeholder="— Select organisation —"
                    searchable
                  />
                  {!selectedOrgId && (
                    <p className="text-xs text-[#6B7280] mt-1">This plan will be available as a subscription for the selected organisation's franchises.</p>
                  )}
                </Fld>
              )}

              <Fld label="Plan Name" required error={errors.planName?.message}>
                <Input placeholder="e.g. Basic Plan" {...register('planName')} className={inputCls(!!errors.planName)} />
              </Fld>

              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="Price" required error={errors.price?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10">
                      <IndianRupee size={14} />
                    </span>
                    <Input placeholder="0.00" {...register('price')} className={inputCls(!!errors.price) + ' pl-9'} />
                  </div>
                </Fld>
                <Fld label="Duration (Months)" required error={errors.durationMonths?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10">
                      <Clock size={14} />
                    </span>
                    <Input placeholder="e.g. 12" {...register('durationMonths')} className={inputCls(!!errors.durationMonths) + ' pl-9'} />
                  </div>
                </Fld>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="Max Customers" hint="Optional" error={errors.maxUsers?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10">
                      <Users size={14} />
                    </span>
                    <Input placeholder="e.g. 50" {...register('maxUsers')} className={inputCls(!!errors.maxUsers) + ' pl-9'} />
                  </div>
                </Fld>
                <Fld label="Billing Cycle">
                  <div className="flex gap-2">
                    {(['MONTHLY', 'YEARLY'] as const).map((cycle) => (
                      <button key={cycle} type="button" onClick={() => setValue('billingCycle', cycle)}
                        className={`flex-1 h-10 rounded-md text-sm font-medium border transition-all ${watch('billingCycle') === cycle ? 'bg-[#33AE95]/10 border-[#33AE95]/60 text-[#33AE95]' : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#33AE95]/40'}`}>
                        {cycle.charAt(0) + cycle.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </Fld>
              </div>

              {modalMode === 'edit' && (
                <Fld label="Status">
                  <div className="flex items-center gap-3 py-1">
                    <button type="button" role="switch" aria-checked={watchIsActive}
                      onClick={() => setValue('isActive', !watchIsActive)}
                      className={`${styles.statusToggle} ${watchIsActive ? styles.toggleOn : styles.toggleOff}`}
                    />
                    <span className={`text-sm font-medium ${watchIsActive ? 'text-[#33AE95]' : 'text-[#6B7280]'}`}>
                      {watchIsActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </Fld>
              )}

              <Fld label="Features (Modules)" hint="Select which features this plan includes">
                {modulesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#6B7280', fontSize: 13 }}>
                    <Loader2 size={14} className="animate-spin" /> Loading modules…
                  </div>
                ) : allDbModules.length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-2">No modules available.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#F0FDF9', border: '1px solid #CCFBEF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 22, padding: '0 7px', borderRadius: 11, background: selectedModuleIds.length > 0 ? '#33AE95' : '#D1FAF0', color: selectedModuleIds.length > 0 ? 'white' : '#9CA3AF', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                          {selectedModuleIds.length}
                        </span>
                        <span style={{ fontSize: 12, color: '#374151' }}>
                          of <strong style={{ color: '#1E293B' }}>{allDbModules.length}</strong> modules selected
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectedModuleIds.length === allDbModules.length
                          ? setSelectedModuleIds([])
                          : setSelectedModuleIds(allDbModules.map((m) => m.id))}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: selectedModuleIds.length === allDbModules.length ? '#6B7280' : '#33AE95', background: selectedModuleIds.length === allDbModules.length ? '#E5E7EB' : 'rgba(51,174,149,0.1)', border: `1px solid ${selectedModuleIds.length === allDbModules.length ? '#D1D5DB' : 'rgba(51,174,149,0.35)'}`, borderRadius: 6, cursor: 'pointer', padding: '4px 10px', transition: 'all 0.15s' }}
                      >
                        {selectedModuleIds.length === allDbModules.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {allDbModules.map((m) => {
                        const checked = selectedModuleIds.includes(m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => toggleModule(m.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${checked ? 'rgba(51,174,149,0.4)' : '#E5E7EB'}`, background: checked ? 'rgba(51,174,149,0.08)' : '#F3F4F6', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
                            <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, border: `1px solid ${checked ? '#33AE95' : '#E5E7EB'}`, background: checked ? '#33AE95' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {checked && <CheckCircle size={10} color="white" />}
                            </span>
                            <p style={{ fontSize: 12, fontWeight: 600, color: checked ? '#33AE95' : '#6B7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </Fld>

              <Fld label="Notes" hint="Optional">
                <div className="relative">
                  <span className="absolute left-3 top-3 text-[#6B7280] pointer-events-none z-10"><FileText size={14} /></span>
                  <textarea rows={3} placeholder="Description or notes..." {...register('notes')}
                    className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#6B7280] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 transition-all text-sm px-3 py-2 pl-9 resize-none outline-none" />
                </div>
              </Fld>
            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
              <Button type="button" variant="outline" onClick={() => setModalMode(null)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg active:scale-95">
                {submitting ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{modalMode === 'edit' ? 'Saving...' : 'Creating...'}</span>
                  : modalMode === 'edit' ? 'Save Changes' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={viewPlan !== null} onOpenChange={(open) => { if (!open) setViewPlan(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center">
                <Sparkles size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Plan Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewPlan && (
            <div className="px-7 py-6 space-y-5">
              <div>
                <ViewRow label="Plan Name" value={viewPlan.planName} />
                <ViewRow label="Price" value={viewPlan.price != null ? `₹ ${Number(viewPlan.price).toLocaleString('en-IN')}` : '—'} />
                <ViewRow label="Duration" value={viewPlan.durationMonths != null ? `${viewPlan.durationMonths} month${viewPlan.durationMonths !== 1 ? 's' : ''}` : '—'} />
                <ViewRow label="Billing Cycle" value={viewPlan.billingCycle ?? '—'} />
                <ViewRow label="Max Customers" value={viewPlan.maxUsers != null ? String(viewPlan.maxUsers) : 'Unlimited'} />
                <ViewRow label="Status" value={viewPlan.status?.name ?? '—'} />
                <ViewRow label="Notes" value={viewPlan.notes ?? '—'} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LayoutGrid size={12} />Features / Modules ({(viewPlan.modules ?? []).length})
                </p>
                {(viewPlan.modules ?? []).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#6B7280' }}>No modules assigned.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {viewPlan.modules!.map((m) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px' }}>
                        <Package size={13} color="#33AE95" style={{ flexShrink: 0 }} />
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#263B4F', margin: 0 }}>{m.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="outline" onClick={() => setViewPlan(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Confirm */}
      <Dialog open={toggleTarget !== null} onOpenChange={(open) => { if (!open) setToggleTarget(null); }}>
        <DialogContent className="sm:max-w-sm shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${toggleTarget?.newActive ? 'bg-[#33AE95]/10 border border-[#33AE95]/30' : 'bg-[#E7970E]/10 border border-[#E7970E]/30'}`}>
                {toggleTarget?.newActive ? <CheckCircle size={18} className="text-[#33AE95]" /> : <XCircle size={18} className="text-[#E7970E]" />}
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">{toggleTarget?.newActive ? 'Activate Plan' : 'Deactivate Plan'}</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              Are you sure you want to <strong className="text-[#263B4F]">{toggleTarget?.newActive ? 'activate' : 'deactivate'}</strong> <strong className="text-[#263B4F]">{toggleTarget?.plan.planName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="outline" onClick={() => setToggleTarget(null)} disabled={!!togglingId}>Cancel</Button>
            <Button onClick={confirmToggleStatus} disabled={!!togglingId}
              className={toggleTarget?.newActive ? 'bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold' : 'bg-[#E7970E] hover:bg-[#d08a0d] text-white font-semibold'}>
              {togglingId ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Updating...</span> : toggleTarget?.newActive ? 'Activate' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#DF453A]/10 border border-[#DF453A]/30 flex items-center justify-center">
                <Trash2 size={18} className="text-[#DF453A]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Delete Plan</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              Are you sure you want to delete <strong className="text-[#263B4F]">{deleteTarget?.planName}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button onClick={confirmDelete} disabled={deleting} className="bg-[#DF453A] hover:bg-[#c73c32] text-white font-semibold">
              {deleting ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FranchiseSubscriptions;

// ─── Micro helpers ─────────────────────────────────────────────────────────────

const inputCls = (hasError?: boolean) =>
  `border border-[#E5E7EB] rounded-lg px-3 h-10 w-full focus:outline-none focus:ring-2 focus:ring-[#33AE95]/30 focus:border-[#33AE95] text-[#263B4F] bg-white text-sm ${hasError ? 'border-[#DF453A]' : ''}`;

function Fld({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-[#263B4F] text-sm font-medium">{label}</Label>
        {required && <span className="text-[#DF453A] text-xs">*</span>}
        {hint && <span className="text-[#6B7280] text-xs">({hint})</span>}
      </div>
      {children}
      {error && <p className="text-xs text-[#DF453A]">{error}</p>}
    </div>
  );
}

function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[#E5E7EB] last:border-0">
      <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium shrink-0 w-28">{label}</span>
      <span className="text-sm text-[#263B4F] text-right">{value}</span>
    </div>
  );
}

function StatusToggle({ active, loading, onToggle }: { active: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={active} disabled={loading} onClick={onToggle}
      title={active ? 'Click to deactivate' : 'Click to activate'}
      className={`${styles.statusToggle} ${active ? styles.toggleOn : styles.toggleOff}`}
    />
  );
}
