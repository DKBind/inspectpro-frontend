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
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Label } from '@/components/shared-ui/Label/label';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import styles from './SubscriptionModal.module.css';

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

  const planOptions = plans.map((p) => ({
    value: p.id,
    label: p.planName,
    meta: [
      p.price != null ? `${p.currency ?? 'INR'} ${Number(p.price).toLocaleString()}` : null,
      p.status?.name ? p.status.name : null,
    ].filter(Boolean).join(' · '),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
        <DialogHeader className={styles.modalHeader}>
          <div className="flex items-center gap-3 mb-1">
            <div className={styles.iconBox}>
              <CreditCard size={18} className={styles.iconColor} />
            </div>
            <DialogTitle className={styles.modalTitle}>
              {isEdit ? 'Manage Subscription' : 'Assign Subscription'}
            </DialogTitle>
          </div>
          <DialogDescription className={styles.modalDesc}>
            {isEdit
              ? `Update the subscription for ${orgName}.`
              : `Select a subscription plan to assign to ${orgName}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors before submitting.'))}>
          <div className={styles.formBody}>

            {/* Plan picker */}
            <Fld label="Subscription Plan" required error={errors.subscriptionId?.message}>
              {plansLoading ? (
                <div className={styles.loadingPlaceholder}>Loading plans...</div>
              ) : (
                <DropdownSelect
                  options={planOptions}
                  value={selectedPlanId || null}
                  onChange={(val: string | number | null) =>
                    setValue('subscriptionId', String(val ?? ''), { shouldValidate: true })
                  }
                  placeholder="— Select a plan —"
                  searchable
                  error={errors.subscriptionId?.message}
                />
              )}
            </Fld>

            {/* Price override, Currency, Max Users */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Fld label="Price Override" hint="Optional" error={errors.priceOverride?.message}>
                <div className="relative">
                  <span className={styles.iconAddon}><DollarSign size={14} /></span>
                  <Input
                    placeholder="0.00"
                    {...register('priceOverride')}
                    className={`${styles.formInput}${errors.priceOverride ? ` ${styles.hasError}` : ''} pl-9`}
                  />
                </div>
              </Fld>
              <Fld label="Currency" hint="Optional" error={errors.currency?.message}>
                <Input
                  placeholder="INR"
                  maxLength={3}
                  {...register('currency')}
                  className={`${styles.formInput}${errors.currency ? ` ${styles.hasError}` : ''} uppercase`}
                />
              </Fld>
              <Fld label="Max Users" hint="Optional" error={errors.maxUsers?.message}>
                <div className="relative">
                  <span className={styles.iconAddon}><Users size={14} /></span>
                  <Input
                    placeholder="100"
                    {...register('maxUsers')}
                    className={`${styles.formInput}${errors.maxUsers ? ` ${styles.hasError}` : ''} pl-9`}
                  />
                </div>
              </Fld>
            </div>

            {/* Period Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Fld label="Period Start" hint="Optional" error={errors.periodStart?.message}>
                <div className="relative">
                  <span className={styles.iconAddon}><Calendar size={14} /></span>
                  <Input
                    type="datetime-local"
                    {...register('periodStart')}
                    className={`${styles.formInput}${errors.periodStart ? ` ${styles.hasError}` : ''} pl-9`}
                  />
                </div>
              </Fld>
              <Fld label="Period End" hint="Optional" error={errors.periodEnd?.message}>
                <div className="relative">
                  <span className={styles.iconAddon}><Calendar size={14} /></span>
                  <Input
                    type="datetime-local"
                    {...register('periodEnd')}
                    className={`${styles.formInput}${errors.periodEnd ? ` ${styles.hasError}` : ''} pl-9`}
                  />
                </div>
              </Fld>
            </div>

            {/* Notes */}
            <Fld label="Notes" hint="Optional" error={errors.notes?.message}>
              <div className="relative">
                <span className={styles.iconAddonTop}><FileText size={14} /></span>
                <textarea
                  rows={3}
                  placeholder="Any additional notes..."
                  {...register('notes')}
                  className={styles.textarea}
                />
              </div>
            </Fld>

          </div>

          <DialogFooter className={styles.footer}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={styles.submitBtn}
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
        <Label className={styles.fieldLabel}>{label}</Label>
        {required && <span className={styles.requiredMark}>*</span>}
        {hint && <span className={styles.fieldHint}>({hint})</span>}
      </div>
      {children}
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
