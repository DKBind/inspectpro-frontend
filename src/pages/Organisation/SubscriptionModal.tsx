import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { CreditCard, DollarSign, Users, Calendar, FileText } from 'lucide-react';

import { subscriptionService } from '@/services/subscriptionService';
import type { OrgSubscriptionResponse, SubscriptionResponse } from '@/services/models/subscription';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  subscriptionId: z.string().min(1, 'Please select a subscription plan'),
  priceOverride: z.string().optional().refine(
    (v) => !v || /^\d+(\.\d{1,2})?$/.test(v),
    'Enter a valid price'
  ),
  currency: z.string().max(3).optional(),
  maxUsers: z.string().optional().refine(
    (v) => !v || /^\d+$/.test(v),
    'Must be a whole number'
  ),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgUuid: string;
  orgName: string;
  existing: OrgSubscriptionResponse | null;
  onSuccess: (sub: OrgSubscriptionResponse) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateInput = (iso: string | undefined) => {
  if (!iso) return '';
  try { return new Date(iso).toISOString().slice(0, 16); } catch { return ''; }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionModal({
  open, onOpenChange, orgUuid, orgName, existing, onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const isEdit = !!existing;

  const { register, reset, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subscriptionId: '',
      priceOverride: '',
      currency: 'INR',
      maxUsers: '',
      periodStart: '',
      periodEnd: '',
      notes: '',
    },
  });

  // Fetch available global plans when modal opens
  useEffect(() => {
    if (!open) return;
    setPlansLoading(true);
    subscriptionService.listSubscriptions()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [open]);

  // Reset form with existing data when modal opens
  useEffect(() => {
    if (open) {
      reset({
        subscriptionId: existing?.subscriptionId ?? '',
        priceOverride: existing?.price != null ? String(existing.price) : '',
        currency: existing?.currency ?? 'INR',
        maxUsers: existing?.maxUsers != null ? String(existing.maxUsers) : '',
        periodStart: toDateInput(existing?.periodStart),
        periodEnd: toDateInput(existing?.periodEnd),
        notes: existing?.notes ?? '',
      });
    }
  }, [open, existing, reset]);

  // Auto-fill price/currency from the selected plan (only on new assignment)
  const selectedPlanId = watch('subscriptionId');
  useEffect(() => {
    if (!selectedPlanId || isEdit) return;
    const plan: any = plans.find((p: any) => p.id === selectedPlanId);
    if (!plan) return;
    if (plan.price != null) setValue('priceOverride', String(plan.price));
    if (plan.currency) setValue('currency', plan.currency);
    if (plan.periodStart) setValue('periodStart', toDateInput(plan.periodStart));
    if (plan.periodEnd) setValue('periodEnd', toDateInput(plan.periodEnd));
  }, [selectedPlanId, plans, isEdit, setValue]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const updated = await subscriptionService.assignOrgSubscription(orgUuid, {
        subscriptionId: data.subscriptionId,
        priceOverride: data.priceOverride ? parseFloat(data.priceOverride) : undefined,
        currency: data.currency || 'INR',
        maxUsers: data.maxUsers ? parseInt(data.maxUsers) : undefined,
        periodStart: data.periodStart ? new Date(data.periodStart).toISOString() : undefined,
        periodEnd: data.periodEnd ? new Date(data.periodEnd).toISOString() : undefined,
        notes: data.notes || undefined,
      });
      toast.success(isEdit ? 'Subscription updated!' : 'Subscription assigned!');
      onSuccess(updated);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save subscription');
    } finally {
      setSubmitting(false);
    }
  };

  const selectCls =
    'h-10 w-full rounded-md bg-slate-950/60 border border-slate-700 text-white text-sm px-3 focus:border-blue-500 focus:outline-none appearance-none cursor-pointer';

  const inputCls = (hasError?: boolean) =>
    `h-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${hasError ? 'border-red-500' : ''}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0">
        <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <CreditCard size={18} className="text-blue-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-white">
              {isEdit ? 'Manage Subscription' : 'Assign Subscription'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-sm pl-12">
            {isEdit
              ? `Update the subscription for ${orgName}.`
              : `Select a subscription plan to assign to ${orgName}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors before submitting.'))}>
          <div className="px-7 py-6 space-y-6">

            {/* Plan picker */}
            <Fld label="Subscription Plan" required error={errors.subscriptionId?.message}>
              {plansLoading ? (
                <div className="h-10 flex items-center text-slate-400 text-sm">Loading plans...</div>
              ) : (
                <select {...register('subscriptionId')} className={selectCls}>
                  <option value="">— Select a plan —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.planName}
                      {p.price != null ? ` — ${p.currency ?? 'INR'} ${Number(p.price).toLocaleString()}` : ''}
                      {p.status?.name ? ` [${p.status.name}]` : ''}
                    </option>
                  ))}
                </select>
              )}
            </Fld>

            {/* Price override, Currency, Max Users */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Fld label="Price Override" hint="Optional" error={errors.priceOverride?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                    <DollarSign size={14} />
                  </span>
                  <Input
                    placeholder="0.00"
                    {...register('priceOverride')}
                    className={inputCls(!!errors.priceOverride) + ' pl-9'}
                  />
                </div>
              </Fld>
              <Fld label="Currency" hint="Optional" error={errors.currency?.message}>
                <Input
                  placeholder="INR"
                  maxLength={3}
                  {...register('currency')}
                  className={inputCls(!!errors.currency) + ' uppercase'}
                />
              </Fld>
              <Fld label="Max Users" hint="Optional" error={errors.maxUsers?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                    <Users size={14} />
                  </span>
                  <Input
                    placeholder="100"
                    {...register('maxUsers')}
                    className={inputCls(!!errors.maxUsers) + ' pl-9'}
                  />
                </div>
              </Fld>
            </div>

            {/* Period Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Fld label="Period Start" hint="Optional" error={errors.periodStart?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                    <Calendar size={14} />
                  </span>
                  <Input
                    type="datetime-local"
                    {...register('periodStart')}
                    className={inputCls(!!errors.periodStart) + ' pl-9 [color-scheme:dark]'}
                  />
                </div>
              </Fld>
              <Fld label="Period End" hint="Optional" error={errors.periodEnd?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                    <Calendar size={14} />
                  </span>
                  <Input
                    type="datetime-local"
                    {...register('periodEnd')}
                    className={inputCls(!!errors.periodEnd) + ' pl-9 [color-scheme:dark]'}
                  />
                </div>
              </Fld>
            </div>

            {/* Notes */}
            <Fld label="Notes" hint="Optional" error={errors.notes?.message}>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-500 pointer-events-none z-10">
                  <FileText size={14} />
                </span>
                <textarea
                  rows={3}
                  placeholder="Any additional notes..."
                  {...register('notes')}
                  className="w-full rounded-md bg-slate-950/60 border border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm px-3 py-2 pl-9 resize-none outline-none"
                />
              </div>
            </Fld>

          </div>

          <DialogFooter className="px-7 py-5 border-t border-slate-800 bg-slate-900/30 rounded-b-2xl flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-none sm:min-w-44 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg active:scale-95"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isEdit ? 'Updating...' : 'Assigning...'}
                </span>
              ) : isEdit ? 'Update Subscription' : 'Assign Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Micro helper ─────────────────────────────────────────────────────────────

function Fld({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
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
