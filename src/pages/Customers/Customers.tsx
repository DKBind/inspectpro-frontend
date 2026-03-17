/**
 * Customers.tsx
 *
 * Franchise-scoped customer management. Franchises create customers here;
 * each customer can be assigned to one of the franchise's subscription plans.
 * The total number of customers is limited by the franchise's own OrgSubscription.maxUsers.
 */
import { useEffect, useState } from 'react';
import { useForm, useController, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Users, Plus, RefreshCw, Eye, Pencil, Trash2, Mail, Phone,
  Building2, ChevronDown, Crown, AlertTriangle, User, Package,
} from 'lucide-react';

import { customerService } from '@/services/customerService';
import { subscriptionService } from '@/services/subscriptionService';
import type { CustomerResponse } from '@/services/models/customer';
import type { SubscriptionResponse } from '@/services/models/subscription';
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
import styles from '@/pages/Organisation/Organisation.module.css';
import { Fld, IcoInput, ViewRow, inputCls } from '@/components/shared-ui/form-helpers';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().optional().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
  subscriptionId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  firstName: '', lastName: '', email: '', phoneNumber: '',
  companyName: '', notes: '', subscriptionId: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

const Customers = () => {
  const { user } = useAuthStore();
  const orgId = user?.orgId ?? '';

  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [limitInfo, setLimitInfo] = useState<{ current: number; max: number } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerResponse | null>(null);
  const [viewTarget, setViewTarget] = useState<CustomerResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { control, formState: { errors }, reset, register, setValue } = methods;

  const { field: firstNameField } = useController({ name: 'firstName', control });
  const { field: lastNameField } = useController({ name: 'lastName', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: phoneField } = useController({ name: 'phoneNumber', control });
  const { field: companyField } = useController({ name: 'companyName', control });

  const selectedPlanId = methods.watch('subscriptionId');
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchCustomers = async (page = currentPage, size = pageSize) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await customerService.listCustomers(orgId, page - 1, size);
      setCustomers(data.content);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalElements);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    if (!orgId) return;
    try {
      const p = await subscriptionService.listActiveSubscriptionsByOrgId(orgId);
      setPlans(p);
    } catch {
      setPlans([]);
    }
  };

  const fetchLimit = async () => {
    if (!orgId) return;
    try {
      const res = await customerService.canAddCustomer(orgId);
      if (res.info) setLimitInfo({ current: res.info.current, max: res.info.max });
    } catch {
      setLimitInfo(null);
    }
  };

  useEffect(() => { fetchCustomers(currentPage, pageSize); }, [currentPage, pageSize]);
  useEffect(() => { fetchPlans(); fetchLimit(); }, [orgId]);

  // ─── Open create / edit ──────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    reset(EMPTY);
    setFormOpen(true);
  };

  const openEdit = (c: CustomerResponse) => {
    setEditTarget(c);
    reset({
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      email: c.email ?? '',
      phoneNumber: c.phoneNumber ?? '',
      companyName: c.companyName ?? '',
      notes: c.notes ?? '',
      subscriptionId: c.subscriptionId ?? '',
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditTarget(null); reset(EMPTY); };

  // ─── Submit ──────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    const payload = {
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phoneNumber: data.phoneNumber?.trim() || undefined,
      companyName: data.companyName?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      subscriptionId: data.subscriptionId || undefined,
    };
    try {
      if (editTarget) {
        const updated = await customerService.updateCustomer(orgId, editTarget.id, payload);
        setCustomers((prev) => prev.map((c) => c.id === editTarget.id ? updated : c));
        toast.success('Customer updated!');
      } else {
        await customerService.createCustomer(orgId, payload);
        toast.success('Customer created!');
        fetchCustomers(1, pageSize);
        setCurrentPage(1);
        fetchLimit();
      }
      closeForm();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await customerService.deleteCustomer(orgId, deleteTarget.id);
      toast.success('Customer deleted');
      setDeleteTarget(null);
      fetchCustomers(currentPage, pageSize);
      fetchLimit();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Customers</h1>
          <p className={styles.pageSubtitle}>
            Manage customers for your franchise.
            {limitInfo && (
              <span className={limitInfo.current >= limitInfo.max ? ' text-red-400' : ' text-[#6B7280]'}>
                {' '}· {limitInfo.current} / {limitInfo.max} used
              </span>
            )}
          </p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <Plus style={{ display: 'inline', width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
          Add Customer
        </button>
      </div>

      {/* Table panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>
            <Users style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }} />
            All Customers
          </h3>
          <button className={styles.refreshBtn} onClick={() => { fetchCustomers(currentPage, pageSize); fetchLimit(); }} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              <p style={{ marginTop: 12 }}>Loading...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className={styles.emptyState}>
              <Users style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
              <p>No customers yet.</p>
              <p className={styles.emptySubtext}>Click "Add Customer" to get started.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Company</th>
                    <th>Phone</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className={styles.tableRow}>
                      <td>
                        <div className={styles.orgCell}>
                          <div className={styles.orgIcon}>
                            <User style={{ width: 14, height: 14 }} />
                          </div>
                          <div>
                            <span className={styles.orgName}>{c.fullName || c.firstName}</span>
                            {c.email && <p className={styles.orgMeta}><Mail style={{ display: 'inline', width: 11, height: 11, marginRight: 3 }} />{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={styles.mutedCell}>
                        {c.companyName ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Building2 style={{ width: 12, height: 12, opacity: 0.5 }} />
                            {c.companyName}
                          </span>
                        ) : '—'}
                      </td>
                      <td className={styles.mutedCell}>
                        {c.phoneNumber ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Phone style={{ width: 12, height: 12, opacity: 0.5 }} />
                            {c.phoneNumber}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {c.subscriptionPlanName ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
                            <Crown style={{ width: 10, height: 10 }} />
                            {c.subscriptionPlanName}
                          </span>
                        ) : <span className={styles.mutedCell}>—</span>}
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${c.isActive ? styles.statusActive : styles.statusInactive}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button className={styles.actionBtn} onClick={() => setViewTarget(c)} title="View"><Eye size={14} /></button>
                          <button className={styles.actionBtn} onClick={() => openEdit(c)} title="Edit"><Pencil size={14} /></button>
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setDeleteTarget(c)} title="Delete"><Trash2 size={14} /></button>
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
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <Users size={18} className="text-purple-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {editTarget ? 'Edit Customer' : 'Add Customer'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {editTarget ? 'Update the customer details below.' : 'Add a new customer to your franchise.'}
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit, () => toast.error('Please fix the errors.'))}>
              <div className="px-7 py-6 space-y-4">

                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="First Name" required error={errors.firstName?.message}>
                    <IcoInput icon={<User size={14} />}>
                      <Input placeholder="John" {...firstNameField} className={inputCls(!!errors.firstName)} />
                    </IcoInput>
                  </Fld>
                  <Fld label="Last Name">
                    <IcoInput icon={<User size={14} />}>
                      <Input placeholder="Doe" {...lastNameField} className={inputCls(false)} />
                    </IcoInput>
                  </Fld>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Fld label="Email" error={errors.email?.message}>
                    <IcoInput icon={<Mail size={14} />}>
                      <Input type="email" placeholder="john@company.com" {...emailField} className={inputCls(!!errors.email)} />
                    </IcoInput>
                  </Fld>
                  <Fld label="Phone">
                    <IcoInput icon={<Phone size={14} />}>
                      <Input placeholder="+91 98765 43210" {...phoneField} className={inputCls(false)} />
                    </IcoInput>
                  </Fld>
                </div>

                <Fld label="Company Name">
                  <IcoInput icon={<Building2 size={14} />}>
                    <Input placeholder="Company Pvt. Ltd." {...companyField} className={inputCls(false)} />
                  </IcoInput>
                </Fld>

                {/* Subscription plan */}
                <Fld label="Subscription Plan" hint="Optional">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="w-full inline-flex items-center justify-between h-10 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#263B4F] hover:bg-[#F3F4F6] focus:outline-none">
                      <span className={selectedPlan ? 'text-[#263B4F]' : 'text-[#9CA3AF]'}>
                        {selectedPlan ? selectedPlan.planName : '— Select a plan —'}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]"
                      style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}>
                      <DropdownMenuItem onSelect={() => setValue('subscriptionId', '')} className="cursor-pointer focus:bg-[#F3F4F6] text-[#9CA3AF] py-3">
                        — None —
                      </DropdownMenuItem>
                      {plans.length === 0 ? (
                        <DropdownMenuItem disabled className="text-[#9CA3AF]">No active plans</DropdownMenuItem>
                      ) : (
                        plans.map((p) => (
                          <DropdownMenuItem key={p.id} onSelect={() => setValue('subscriptionId', p.id)}
                            className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-3">
                            <div>
                              <span className="font-medium">{p.planName}</span>
                              {p.maxUsers != null && <span className="ml-2 text-xs text-[#9CA3AF]">· {p.maxUsers} customers</span>}
                              {p.price != null && <span className="ml-2 text-xs text-[#9CA3AF]">· ₹{Number(p.price).toLocaleString('en-IN')}</span>}
                            </div>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {plans.length === 0 && (
                    <p className="text-xs text-amber-400/80 mt-1">No plans available. Create plans in My Subscription Plans first.</p>
                  )}
                </Fld>

                {/* Modules included in selected plan */}
                {selectedPlan && (selectedPlan.modules?.length ?? 0) > 0 && (
                  <Fld label="Included Modules" hint="From selected plan">
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedPlan.modules!.map((m) => (
                        <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                          <Package size={10} />
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </Fld>
                )}

                <Fld label="Notes" hint="Optional">
                  <textarea rows={3} placeholder="Any additional notes..." {...register('notes')}
                    className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none" />
                </Fld>

              </div>

              <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
                <Button type="button" variant="ghost" onClick={closeForm} disabled={submitting}
                  className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
                <Button type="submit" disabled={submitting}
                  className="flex-1 sm:flex-none sm:min-w-44 bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg active:scale-95">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {editTarget ? 'Updating...' : 'Creating...'}
                    </span>
                  ) : editTarget ? 'Update Customer' : 'Add Customer'}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-md shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <Users size={18} className="text-purple-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Customer Details</DialogTitle>
            </div>
          </DialogHeader>
          {viewTarget && (
            <div className="px-7 py-6 space-y-0">
              <ViewRow label="Name" value={viewTarget.fullName || viewTarget.firstName} />
              <ViewRow label="Email" value={viewTarget.email ?? '—'} />
              <ViewRow label="Phone" value={viewTarget.phoneNumber ?? '—'} />
              <ViewRow label="Company" value={viewTarget.companyName ?? '—'} />
              <ViewRow label="Plan" value={viewTarget.subscriptionPlanName ?? '—'} />
              <ViewRow label="Status" value={viewTarget.isActive ? 'Active' : 'Inactive'} />
              {viewTarget.notes && <ViewRow label="Notes" value={viewTarget.notes} />}
            </div>
          )}
          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="ghost" onClick={() => setViewTarget(null)}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Close</Button>
            {viewTarget && (
              <Button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold">
                <Pencil size={14} className="mr-2" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Delete Customer</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              Delete <span className="text-[#263B4F] font-medium">{deleteTarget?.fullName || deleteTarget?.firstName}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2 px-7 pb-5">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
