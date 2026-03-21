import { useEffect, useState } from 'react';
import { useForm, FormProvider, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  GitBranch, Globe, Mail, Phone, User, MapPin,
  Building2, Sparkles, Calendar, Crown,
} from 'lucide-react';

import { organisationService } from '@/services/organisationService';
import { subscriptionService } from '@/services/subscriptionService';
import type { OrganisationResponse } from '@/services/models/organisation';
import type { SubscriptionResponse } from '@/services/models/subscription';
import { useAuthStore } from '@/store/useAuthStore';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Sec, Fld, IcoInput } from '@/components/shared-ui/form-helpers';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatEndDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDisplayDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function planBadgeStyle(planName?: string): string {
  const p = (planName ?? '').toUpperCase();
  if (p.includes('FREE')) return 'text-slate-400 bg-slate-800/60 border-slate-700';
  if (p.includes('STARTER') || p.includes('BASIC')) return 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40';
  if (p.includes('PRO') || p.includes('PROFESSIONAL')) return 'text-blue-400 bg-blue-900/20 border-blue-800/40';
  if (p.includes('ENTERPRISE') || p.includes('PREMIUM')) return 'text-purple-400 bg-purple-900/20 border-purple-800/40';
  const palettes = [
    'text-amber-400 bg-amber-900/20 border-amber-800/40',
    'text-cyan-400 bg-cyan-900/20 border-cyan-800/40',
    'text-rose-400 bg-rose-900/20 border-rose-800/40',
    'text-indigo-400 bg-indigo-900/20 border-indigo-800/40',
  ];
  const hash = (planName ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Franchise name must be at least 2 characters'),
  email: z.string().min(1, 'Contact email is required').email('Please enter a valid email'),
  parentOrgId: z.string().min(1, 'Parent organisation is required'),
  subscriptionId: z.string().optional(),
  subscriptionStartDate: z.string().optional(),
  domain: z.string().optional(),
  phoneNumber: z.string().optional(),
  contactedPersonName: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  address: z.object({
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    street: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional().refine((v) => !v || /^[0-9]{6}$/.test(v), 'Pincode must be 6 digits'),
  }).optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '', email: '', parentOrgId: '', subscriptionId: '', subscriptionStartDate: '',
  domain: '', phoneNumber: '', contactedPersonName: '', gstin: '', pan: '',
  address: { addressLine1: '', addressLine2: '', street: '', district: '', state: '', country: '', pincode: '' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editOrg?: OrganisationResponse | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FranchiseCreateModal({ open, onOpenChange, onSuccess, editOrg }: Props) {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentOrgs, setParentOrgs] = useState<OrganisationResponse[]>([]);
  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const isEditMode = !!editOrg;

  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { control, formState: { errors }, setError, reset, register, watch, setValue } = methods;

  const { field: nameField } = useController({ name: 'name', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: domainField } = useController({ name: 'domain', control });
  const { field: phoneField } = useController({ name: 'phoneNumber', control });
  const { field: contactPersonField } = useController({ name: 'contactedPersonName', control });
  const { field: gstinField } = useController({ name: 'gstin', control });
  const { field: panField } = useController({ name: 'pan', control });
  const { field: addrLine1Field } = useController({ name: 'address.addressLine1', control });
  const { field: streetField } = useController({ name: 'address.street', control });
  const { field: districtField } = useController({ name: 'address.district', control });
  const { field: stateField } = useController({ name: 'address.state', control });
  const { field: countryField } = useController({ name: 'address.country', control });
  const { field: pincodeField } = useController({ name: 'address.pincode', control });

  const selectedParentId = watch('parentOrgId');
  const selectedPlanId = watch('subscriptionId');
  const subscriptionStartDate = watch('subscriptionStartDate');
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const computedEndDate = (() => {
    if (!subscriptionStartDate || !selectedPlan?.durationMonths) return '';
    const d = new Date(subscriptionStartDate);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + selectedPlan.durationMonths);
    return formatEndDate(d);
  })();

  // Load parent orgs
  useEffect(() => {
    if (!open) return;
    organisationService.getOrganisations(0, 1000)
      .then((data) => setParentOrgs(data.content ?? []))
      .catch(() => setParentOrgs([]));
  }, [open]);

  // Load subscription plans whenever the parent org changes (create mode only).
  // Plans are always scoped to the parent org — the org that created them for its franchises.
  useEffect(() => {
    if (!open || isEditMode) return;
    // For super_admin: use whichever parent org is selected in the dropdown.
    // For org users: always use their own orgId (they are the parent).
    const targetOrgId = isSuperAdmin ? selectedParentId : authUser?.orgId;
    if (!targetOrgId) {
      setPlans([]);
      return;
    }
    setPlansLoading(true);
    setValue('subscriptionId', ''); // reset plan selection when parent changes
    subscriptionService.listActiveSubscriptionsByOrgId(targetOrgId)
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [open, isEditMode, selectedParentId]);

  useEffect(() => {
    if (open && editOrg) {
      reset({
        name: editOrg.name ?? '',
        email: editOrg.email ?? '',
        parentOrgId: editOrg.parentOrgId ?? '',
        subscriptionId: '',
        subscriptionStartDate: '',
        domain: editOrg.domain ?? '',
        phoneNumber: editOrg.phoneNumber ?? '',
        contactedPersonName: editOrg.contactedPersonName ?? '',
        gstin: editOrg.gstin ?? '',
        pan: editOrg.pan ?? '',
        address: {
          addressLine1: editOrg.address?.addressLine1 ?? '',
          addressLine2: editOrg.address?.addressLine2 ?? '',
          street: editOrg.address?.street ?? '',
          district: editOrg.address?.district ?? '',
          state: editOrg.address?.state ?? '',
          country: editOrg.address?.country ?? '',
          pincode: editOrg.address?.pincode ?? '',
        },
      });
    } else if (open && !editOrg) {
      reset({
        ...EMPTY,
        parentOrgId: !isSuperAdmin && authUser?.orgId ? authUser.orgId : '',
      });
    }
  }, [open, editOrg, reset]);

  const handleClose = () => { reset(EMPTY); onOpenChange(false); };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    const clean = (v?: string) => (v?.trim() ? v.trim() : undefined);
    const addr = data.address;
    const cleanAddr = addr ? {
      addressLine1: clean(addr.addressLine1), addressLine2: clean(addr.addressLine2),
      street: clean(addr.street), district: clean(addr.district),
      state: clean(addr.state), country: clean(addr.country), pincode: clean(addr.pincode),
    } : undefined;
    const hasAddress = cleanAddr && Object.values(cleanAddr).some(Boolean);

    try {
      if (isEditMode && editOrg) {
        await organisationService.updateOrganisation(editOrg.uuid, {
          name: data.name, email: data.email,
          domain: clean(data.domain), phoneNumber: clean(data.phoneNumber),
          contactedPersonName: clean(data.contactedPersonName),
          gstin: clean(data.gstin), pan: clean(data.pan),
          address: hasAddress ? cleanAddr : undefined,
        });
        toast.success('Franchise updated!');
      } else {
        await organisationService.createOrganisation({
          name: data.name, email: data.email,
          domain: clean(data.domain), phoneNumber: clean(data.phoneNumber),
          contactedPersonName: clean(data.contactedPersonName),
          gstin: clean(data.gstin), pan: clean(data.pan),
          parentOrgId: data.parentOrgId,
          subscriptionId: data.subscriptionId || undefined,
          subscriptionStartDate: data.subscriptionStartDate
            ? data.subscriptionStartDate + 'T00:00:00'
            : undefined,
          address: hasAddress ? cleanAddr : undefined,
        });
        toast.success('Franchise created!');
      }
      handleClose();
      onSuccess();
    } catch (error: any) {
      const message: string = error?.message || 'Something went wrong';
      if (message.toLowerCase().includes('email')) {
        setError('email', { type: 'manual', message: 'This email is already registered.' });
      } else {
        toast.error(isEditMode ? 'Failed to update' : 'Failed to create', { description: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inp = (hasError: boolean) =>
    `h-10 bg-white border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 transition-all ${hasError ? '!border-[#DF453A]' : ''}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
        <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center">
              <GitBranch size={18} className="text-[#33AE95]" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#263B4F]">
              {isEditMode ? 'Edit Franchise' : 'Create Franchise'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[#6B7280] text-sm pl-12">
            {isEditMode ? 'Update the franchise details below.' : 'Set up a new franchise under a parent organisation.'}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit, () => toast.error('Please fix the errors before submitting.'))}>
            <div className="px-7 py-6 space-y-6">

              {/* Parent Organisation */}
              {!isEditMode && (
                <Sec icon={<Building2 size={13} />} label="Parent Organisation">
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <Fld label="Parent Organisation" required error={(errors as any).parentOrgId?.message}>
                      {isSuperAdmin ? (
                        <DropdownSelect
                          options={parentOrgs.map((o) => ({ value: o.uuid, label: o.name }))}
                          value={selectedParentId || null}
                          onChange={(val: string | number | null) => setValue('parentOrgId', String(val ?? ''), { shouldValidate: true })}
                          placeholder="— Select organisation —"
                          searchable
                          error={(errors as any).parentOrgId?.message}
                        />
                      ) : (
                        <div className="h-10 rounded-md border border-[#E5E7EB] bg-white px-3 flex items-center gap-2 text-sm text-[#263B4F]">
                          <Building2 size={14} className="text-[#6B7280]" />
                          {authUser?.orgName ?? parentOrgs.find((o) => o.uuid === authUser?.orgId)?.name ?? '—'}
                        </div>
                      )}
                    </Fld>
                  </div>
                </Sec>
              )}

              {/* Subscription Plan */}
              <Sec icon={<Sparkles size={13} />} label="Subscription Plan">
                {isEditMode ? (
                  /* Read-only in edit mode */
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#6B7280] uppercase tracking-wide">Plan</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${planBadgeStyle(editOrg?.subscriptionPlanName ?? editOrg?.planType)}`}>
                        <Crown size={11} />
                        {editOrg?.subscriptionPlanName ?? editOrg?.planType ?? '—'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#6B7280] uppercase tracking-wide">Start Date</p>
                      <p className="text-sm text-[#263B4F] font-medium">{formatDisplayDate(editOrg?.periodStart)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#6B7280] uppercase tracking-wide">End Date</p>
                      <p className="text-sm text-[#263B4F] font-medium">{formatDisplayDate(editOrg?.periodEnd)}</p>
                    </div>
                  </div>
                ) : (
                  /* Create mode: plan selector + dates */
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-4">
                    <Fld label="Select Plan" hint="Optional">
                      <DropdownSelect
                        options={plans.map((p) => ({
                          value: p.id,
                          label: p.planName,
                          meta: p.maxUsers != null ? `${p.maxUsers} users` : undefined,
                        }))}
                        value={selectedPlanId || null}
                        onChange={(val: string | number | null) => setValue('subscriptionId', String(val ?? ''), { shouldValidate: true })}
                        placeholder="— Select a subscription plan —"
                        searchable
                        loading={plansLoading}
                      />
                      {plans.length === 0 && !plansLoading && (
                        <p className="text-xs text-amber-600 mt-1">
                          No subscription plans found. Go to Subscriptions to create plans for your franchises.
                        </p>
                      )}
                    </Fld>

                    {selectedPlan && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Fld label="Start Date">
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none z-10" />
                            <Input
                              type="date"
                              {...register('subscriptionStartDate')}
                              className="pl-9 h-10 bg-white border-[#E5E7EB] text-[#263B4F] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20"
                            />
                          </div>
                        </Fld>
                        <Fld label="End Date">
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none z-10" />
                            <div className={`pl-9 h-10 bg-[#F3F4F6] border border-[#E5E7EB] rounded-md flex items-center text-sm ${computedEndDate ? 'text-[#263B4F]' : 'text-[#9CA3AF]'}`}>
                              {computedEndDate || (selectedPlan?.durationMonths ? 'Select a start date' : 'No duration set')}
                            </div>
                          </div>
                          <p className="text-xs text-[#6B7280] mt-1">Auto-calculated ({selectedPlan?.durationMonths ?? '?'} months)</p>
                        </Fld>
                      </div>
                    )}
                  </div>
                )}
              </Sec>

              {/* Franchise Details */}
              <Sec icon={<GitBranch size={13} />} label="Franchise Details">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Franchise Name" required error={errors.name?.message}>
                      <IcoInput icon={<GitBranch size={15} />}>
                        <Input placeholder="Branch Name" {...nameField} className={inp(!!errors.name)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Contact Email" required error={errors.email?.message}>
                      <IcoInput icon={<Mail size={15} />}>
                        <Input type="email" placeholder="branch@acme.com" {...emailField} className={inp(!!errors.email)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Phone Number" error={errors.phoneNumber?.message}>
                      <IcoInput icon={<Phone size={15} />}>
                        <Input placeholder="+91 98765 43210" {...phoneField} className={inp(!!errors.phoneNumber)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Contact Person" error={errors.contactedPersonName?.message}>
                      <IcoInput icon={<User size={15} />}>
                        <Input placeholder="John Doe" {...contactPersonField} className={inp(!!errors.contactedPersonName)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Domain" hint="Optional" error={errors.domain?.message}>
                      <IcoInput icon={<Globe size={15} />}>
                        <Input placeholder="branch.acme.com" {...domainField} className={inp(!!errors.domain)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="GSTIN" hint="Optional">
                      <Input placeholder="22AAAAA0000A1Z5" {...gstinField} className={inp(false) + ' uppercase'} maxLength={15} />
                    </Fld>
                    <Fld label="PAN" hint="Optional">
                      <Input placeholder="ABCDE1234F" {...panField} className={inp(false) + ' uppercase'} maxLength={10} />
                    </Fld>
                  </div>
                </div>
              </Sec>

              {/* Address */}
              <Sec icon={<MapPin size={13} />} label="Address">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Address Line 1">
                      <Input placeholder="Flat / House no., Building name" {...addrLine1Field} className={inp(false)} />
                    </Fld>
                    <Fld label="Address Line 2">
                      <Input placeholder="Area, Colony, Locality" {...register('address.addressLine2')} className={inp(false)} />
                    </Fld>
                    <Fld label="Street">
                      <Input placeholder="Street name" {...streetField} className={inp(false)} />
                    </Fld>
                    <Fld label="District">
                      <Input placeholder="District" {...districtField} className={inp(false)} />
                    </Fld>
                    <Fld label="State">
                      <Input placeholder="State" {...stateField} className={inp(false)} />
                    </Fld>
                    <Fld label="Country">
                      <Input placeholder="Country" {...countryField} className={inp(false)} />
                    </Fld>
                    <Fld label="Pincode" error={(errors.address as any)?.pincode?.message}>
                      <Input placeholder="110001" maxLength={6} {...pincodeField}
                        className={inp(!!(errors.address as any)?.pincode)} />
                    </Fld>
                  </div>
                </div>
              </Sec>
            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F3F4F6] rounded-b-2xl flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}
                className="flex-1 sm:flex-none sm:min-w-44 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg active:scale-95">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </span>
                ) : isEditMode ? 'Update Franchise' : 'Create Franchise'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
