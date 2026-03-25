import { useEffect, useState } from 'react';
import { useForm, FormProvider, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Building2, Globe, Mail, Sparkles, User, FileText, MapPin, ChevronDown, Calendar, Crown } from 'lucide-react';

import { organisationService } from '@/services/organisationService';
import { subscriptionService } from '@/services/subscriptionService';
import type { OrganisationResponse } from '@/services/models/organisation';
import type { SubscriptionResponse } from '@/services/models/subscription';
import { useAuthStore } from '@/store/useAuthStore';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Label } from '@/components/shared-ui/Label/label';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function planBadgeStyle(planName?: string): string {
  const p = (planName ?? '').toUpperCase();
  if (p.includes('FREE')) return 'text-[#6B7280] bg-[#F3F4F6] border-[#E5E7EB]';
  if (p.includes('STARTER') || p.includes('BASIC')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (p.includes('PRO') || p.includes('PROFESSIONAL')) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (p.includes('ENTERPRISE') || p.includes('PREMIUM')) return 'text-purple-600 bg-purple-50 border-purple-200';
  const palettes = [
    'text-amber-600 bg-amber-50 border-amber-200',
    'text-cyan-600 bg-cyan-50 border-cyan-200',
    'text-rose-600 bg-rose-50 border-rose-200',
    'text-indigo-600 bg-indigo-50 border-indigo-200',
  ];
  const hash = (planName ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Organisation name must be at least 2 characters'),
  email: z.string().min(1, 'Contact email is required').email({ error: 'Please enter a valid email address' }),
  domain: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(val),
      'Please enter a valid domain (e.g. acme.com)'
    ),
  subscriptionId: z.string().optional(),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
  phoneNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^[0-9]{10}$/.test(val), 'Phone number must be exactly 10 digits'),
  contactedPersonName: z.string().optional(),
  contactedPersonEmail: z
    .string()
    .min(1, 'Contact person email is required')
    .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Enter a valid email address'),
  contactedPersonPhoneNumber: z
    .string()
    .min(1, 'Contact person phone is required')
    .refine((val) => /^[0-9]{10}$/.test(val), 'Phone number must be exactly 10 digits'),
  gstin: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(val),
      'Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)'
    ),
  pan: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(val),
      'Invalid PAN format (e.g. ABCDE1234F)'
    ),
  tan: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[A-Z]{4}[0-9]{5}[A-Z]$/i.test(val),
      'Invalid TAN format (e.g. ABCD12345E)'
    ),
  address: z.object({
    addressLine1: z.string().min(1, 'Address Line 1 is required').max(250, 'Max 250 characters'),
    addressLine2: z.string().max(250, 'Max 250 characters').optional(),
    street: z.string().max(250, 'Max 250 characters').optional(),
    district: z.string().max(100, 'Max 100 characters').optional(),
    state: z.string().min(1, 'State is required').max(100, 'Max 100 characters'),
    country: z.string().min(1, 'Country is required').max(100, 'Max 100 characters'),
    pincode: z
      .string()
      .optional()
      .refine((val) => !val || /^[0-9]{6}$/.test(val), 'Pincode must be 6 digits'),
  }),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_DEFAULTS: FormValues = {
  name: '',
  email: '',
  domain: '',
  subscriptionId: '',
  subscriptionStartDate: '',
  subscriptionEndDate: '',
  phoneNumber: '',
  contactedPersonName: '',
  contactedPersonEmail: '',
  contactedPersonPhoneNumber: '',
  gstin: '',
  pan: '',
  tan: '',
  address: { addressLine1: '', addressLine2: '', street: '', district: '', state: '', country: '', pincode: '' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editOrg?: OrganisationResponse | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganisationCreateModal({ open, onOpenChange, onSuccess, editOrg }: Props) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const isEditMode = !!editOrg;

  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_DEFAULTS });
  const { control, formState: { errors }, setError, reset, register, watch, setValue } = methods;

  const { field: nameField } = useController({ name: 'name', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: domainField } = useController({ name: 'domain', control });
  const { field: phoneField } = useController({ name: 'phoneNumber', control });
  const { field: contactPersonField } = useController({ name: 'contactedPersonName', control });
  const { field: contactPersonEmailField } = useController({ name: 'contactedPersonEmail', control });
  const { field: contactPersonPhoneField } = useController({ name: 'contactedPersonPhoneNumber', control });
  const { field: gstinField } = useController({ name: 'gstin', control });
  const { field: panField } = useController({ name: 'pan', control });
  const { field: tanField } = useController({ name: 'tan', control });
  const { field: addrLine1Field } = useController({ name: 'address.addressLine1', control });
  const { field: streetField } = useController({ name: 'address.street', control });
  const { field: districtField } = useController({ name: 'address.district', control });
  const { field: stateField } = useController({ name: 'address.state', control });
  const { field: countryField } = useController({ name: 'address.country', control });
  const { field: pincodeField } = useController({ name: 'address.pincode', control });

  const selectedPlanId = watch('subscriptionId');
  const subscriptionStartDate = watch('subscriptionStartDate');
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const computedEndDate = (() => {
    if (!subscriptionStartDate || !selectedPlan?.durationMonths) return '';
    const d = new Date(subscriptionStartDate);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + selectedPlan.durationMonths);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  // Fetch active subscription plans when modal opens (create mode only).
  // Super-admins see global plans; org-admins see their own org-scoped plans.
  useEffect(() => {
    if (!open || isEditMode) return;
    setPlansLoading(true);
    const fetch = isSuperAdmin
      ? subscriptionService.listActiveSubscriptions()
      : subscriptionService.listActiveSubscriptionsByOrgId(user!.orgId!);
    fetch
      .then((data) => setPlans(data.filter((p) => p.global !== false && p.createdByOrgId == null)))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [open, isEditMode]);

  // Pre-fill when editing
  useEffect(() => {
    if (open && editOrg) {
      reset({
        name: editOrg.name ?? '',
        email: editOrg.email ?? '',
        domain: editOrg.domain ?? '',
        subscriptionId: '',
        subscriptionStartDate: '',
        subscriptionEndDate: '',
        phoneNumber: editOrg.phoneNumber ?? '',
        contactedPersonName: editOrg.contactedPersonName ?? '',
        contactedPersonEmail: editOrg.contactedPersonEmail ?? '',
        contactedPersonPhoneNumber: editOrg.contactedPersonPhoneNumber ?? '',
        gstin: editOrg.gstin ?? '',
        pan: editOrg.pan ?? '',
        tan: editOrg.tan ?? '',
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
      reset(EMPTY_DEFAULTS);
    }
  }, [open, editOrg, reset]);

  const handleClose = () => {
    reset(EMPTY_DEFAULTS);
    onOpenChange(false);
  };

  const onSubmit = async (data: FormValues) => {
    // Validate start date is required when a plan is selected in create mode
    if (!isEditMode && data.subscriptionId && !data.subscriptionStartDate) {
      methods.setError('subscriptionStartDate', { type: 'manual', message: 'Start date is required' });
      return;
    }

    setIsSubmitting(true);
    const clean = (val?: string) => (val?.trim() ? val.trim() : undefined);
    const rawAddr = data.address;
    const cleanAddr = rawAddr
      ? {
        addressLine1: clean(rawAddr.addressLine1),
        addressLine2: clean(rawAddr.addressLine2),
        street: clean(rawAddr.street),
        district: clean(rawAddr.district),
        state: clean(rawAddr.state),
        country: clean(rawAddr.country),
        pincode: clean(rawAddr.pincode),
      }
      : undefined;
    const hasAddress = cleanAddr && Object.values(cleanAddr).some(Boolean);

    try {
      if (isEditMode && editOrg) {
        await organisationService.updateOrganisation(editOrg.uuid, {
          name: data.name,
          email: data.email,
          domain: clean(data.domain),
          phoneNumber: clean(data.phoneNumber),
          contactedPersonName: clean(data.contactedPersonName),
          contactedPersonEmail: clean(data.contactedPersonEmail),
          contactedPersonPhoneNumber: clean(data.contactedPersonPhoneNumber),
          gstin: clean(data.gstin),
          pan: clean(data.pan),
          tan: clean(data.tan),
          address: hasAddress ? cleanAddr : undefined,
        });
        toast.success('Organisation updated!', { description: `${data.name} has been updated.` });
      } else {
        if (!data.subscriptionId) {
          methods.setError('subscriptionId', { type: 'manual', message: 'Please select a subscription plan' });
          setIsSubmitting(false);
          return;
        }
        await organisationService.createOrganisation({
          name: data.name,
          email: data.email,
          domain: clean(data.domain),
          subscriptionId: data.subscriptionId,
          subscriptionStartDate: data.subscriptionStartDate
            ? data.subscriptionStartDate + 'T00:00:00'
            : undefined,
          phoneNumber: clean(data.phoneNumber),
          contactedPersonName: clean(data.contactedPersonName),
          contactedPersonEmail: clean(data.contactedPersonEmail),
          contactedPersonPhoneNumber: clean(data.contactedPersonPhoneNumber),
          gstin: clean(data.gstin),
          pan: clean(data.pan),
          tan: clean(data.tan),
          address: hasAddress ? cleanAddr : undefined,
        });
        toast.success('Organisation created!', { description: `${data.name} has been set up.` });
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

  const inputCls = (hasError: boolean) =>
    `border border-[#E5E7EB] rounded-lg px-3 h-10 w-full focus:outline-none focus:ring-2 focus:ring-[#33AE95]/30 focus:border-[#33AE95] text-[#263B4F] bg-white text-sm placeholder:text-[#9CA3AF] ${hasError ? 'border-[#DF453A]' : ''}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
        <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center">
              <Building2 size={18} className="text-[#33AE95]" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#263B4F]">
              {isEditMode ? 'Edit Organisation' : 'Create Organisation'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[#6B7280] text-sm pl-12">
            {isEditMode
              ? 'Update the details below and save your changes.'
              : 'Set up a new workspace and assign a subscription plan.'}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit, () => toast.error('Please fix the errors before submitting.'))}>
            <div className="px-7 py-6 space-y-6">

              {/* Subscription Plan — create: editable dropdown; edit: read-only info */}
              <Sec icon={<Sparkles size={13} />} label="Subscription Plan">
                {isEditMode ? (
                  /* Read-only plan info in edit mode */
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-4 grid gap-4 sm:grid-cols-3">
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
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-4 space-y-4">
                    <Fld label="Select Plan" required error={(errors as any).subscriptionId?.message}>
                      {plansLoading ? (
                        <div className="h-10 flex items-center text-[#6B7280] text-sm">Loading plans...</div>
                      ) : (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger
                            className={`w-full inline-flex items-center justify-between h-10 rounded-md border bg-white px-3 text-sm font-normal text-[#263B4F] hover:bg-[#F3F4F6] focus:outline-none ${(errors as any).subscriptionId ? 'border-[#DF453A]' : 'border-[#E5E7EB]'}`}
                          >
                            <span className={selectedPlan ? 'text-[#263B4F]' : 'text-[#6B7280]'}>
                              {selectedPlan ? selectedPlan.planName : '— Select a subscription plan —'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="bg-white border-[#E5E7EB] text-[#263B4F] z-[9999]"
                            style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
                          >
                            {plans.length === 0 ? (
                              <DropdownMenuItem disabled className="text-[#6B7280]">No active plans available</DropdownMenuItem>
                            ) : (
                              plans.map((p) => (
                                <DropdownMenuItem
                                  key={p.id}
                                  onSelect={() => setValue('subscriptionId', p.id, { shouldValidate: true })}
                                  className="cursor-pointer focus:bg-[#F3F4F6] focus:text-[#263B4F] py-3"
                                >
                                  <span className="font-medium">{p.planName}</span>
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </Fld>

                    {selectedPlan && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Fld label="Start Date" required error={(errors as any).subscriptionStartDate?.message}>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none z-10" />
                            <Input
                              type="date"
                              {...register('subscriptionStartDate')}
                              className={`pl-9 h-10 border-[#E5E7EB] text-[#263B4F] bg-white focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 placeholder:text-[#9CA3AF] ${(errors as any).subscriptionStartDate ? 'border-[#DF453A]' : ''}`}
                            />
                          </div>
                        </Fld>
                        <Fld label="End Date">
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none z-10" />
                            <div className={`pl-9 h-10 bg-[#F3F4F6] border border-[#E5E7EB] rounded-md flex items-center text-sm ${computedEndDate ? 'text-[#263B4F]' : 'text-[#6B7280]'}`}>
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

              {/* Core Details */}
              <Sec icon={<Building2 size={13} />} label="Organisation Details">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Organisation Name" required error={errors.name?.message}>
                      <IcoInput icon={<Building2 size={15} />}>
                        <Input placeholder="Acme Corp" {...nameField} className={inputCls(!!errors.name)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Contact Email" required error={errors.email?.message}>
                      <IcoInput icon={<Mail size={15} />}>
                        <Input type="email" placeholder="admin@acme.com" {...emailField} className={inputCls(!!errors.email)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Phone Number" error={errors.phoneNumber?.message}>
                      <PhoneInput field={phoneField} hasError={!!errors.phoneNumber} />
                    </Fld>
                    <Fld label="Website" hint="Optional" error={errors.domain?.message}>
                      <IcoInput icon={<Globe size={15} />}>
                        <Input placeholder="https://acme.com" {...domainField} className={inputCls(!!errors.domain)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Contact Person" error={errors.contactedPersonName?.message}>
                      <IcoInput icon={<User size={15} />}>
                        <Input placeholder="John Doe" {...contactPersonField} className={inputCls(!!errors.contactedPersonName)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Contact Person Email" required error={(errors as any).contactedPersonEmail?.message}>
                      <IcoInput icon={<Mail size={15} />}>
                        <Input type="email" placeholder="john@acme.com" {...contactPersonEmailField} className={inputCls(!!(errors as any).contactedPersonEmail)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Contact Person Phone" required error={(errors as any).contactedPersonPhoneNumber?.message}>
                      <PhoneInput field={contactPersonPhoneField} hasError={!!(errors as any).contactedPersonPhoneNumber} />
                    </Fld>
                  </div>
                </div>
              </Sec>

              {/* Business Identifiers */}
              <Sec icon={<FileText size={13} />} label="Business Identifiers">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Fld label="GSTIN" hint="Optional" error={errors.gstin?.message}>
                      <Input placeholder="22AAAAA0000A1Z5" {...gstinField}
                        className={inputCls(!!errors.gstin) + ' uppercase'} maxLength={15} />
                    </Fld>
                    <Fld label="PAN" hint="Optional" error={errors.pan?.message}>
                      <Input placeholder="ABCDE1234F" {...panField}
                        className={inputCls(!!errors.pan) + ' uppercase'} maxLength={10} />
                    </Fld>
                    <Fld label="TAN" hint="Optional" error={errors.tan?.message}>
                      <Input placeholder="ABCD12345E" {...tanField}
                        className={inputCls(!!errors.tan) + ' uppercase'} maxLength={10} />
                    </Fld>
                  </div>
                </div>
              </Sec>

              {/* Address */}
              <Sec icon={<MapPin size={13} />} label="Address">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Address Line 1" required error={errors.address?.addressLine1?.message}>
                      <Input placeholder="Flat / House no., Building name" maxLength={250}
                        {...addrLine1Field} className={inputCls(!!errors.address?.addressLine1)} />
                    </Fld>
                    <Fld label="Address Line 2" error={errors.address?.addressLine2?.message}>
                      <Input placeholder="Area, Colony, Locality" maxLength={250}
                        {...register('address.addressLine2')} className={inputCls(!!errors.address?.addressLine2)} />
                    </Fld>
                    <Fld label="Street" error={errors.address?.street?.message}>
                      <Input placeholder="Street name" maxLength={250} {...streetField} className={inputCls(!!errors.address?.street)} />
                    </Fld>
                    <Fld label="District" error={errors.address?.district?.message}>
                      <Input placeholder="District" maxLength={100} {...districtField} className={inputCls(!!errors.address?.district)} />
                    </Fld>
                    <Fld label="State" required error={errors.address?.state?.message}>
                      <Input placeholder="State" maxLength={100} {...stateField} className={inputCls(!!errors.address?.state)} />
                    </Fld>
                    <Fld label="Country" required error={errors.address?.country?.message}>
                      <Input placeholder="Country" maxLength={100} {...countryField} className={inputCls(!!errors.address?.country)} />
                    </Fld>
                    <Fld label="Pincode" error={errors.address?.pincode?.message}>
                      <Input placeholder="110001" maxLength={6}
                        {...pincodeField}
                        className={inputCls(!!errors.address?.pincode)} />
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
                ) : isEditMode ? 'Update Organisation' : 'Create Organisation'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

// ─── Micro helpers ────────────────────────────────────────────────────────────

function Sec({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section>
      {label && (
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className="text-[#33AE95]">{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">{label}</span>
        </div>
      )}
      {children}
    </section>
  );
}

function Fld({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
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

function IcoInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10">{icon}</span>
      <div className="[&_input]:pl-9">{children}</div>
    </div>
  );
}

function PhoneInput({ field, hasError }: { field: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }; hasError: boolean }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/^[0-9]+$/.test(text)) e.preventDefault();
  };
  return (
    <div className={`flex items-center border rounded-lg bg-white h-10 overflow-hidden ${hasError ? 'border-[#DF453A]' : 'border-[#E5E7EB]'} focus-within:ring-2 focus-within:ring-[#33AE95]/30 focus-within:border-[#33AE95]`}>
      <span className="px-3 text-sm font-medium text-[#6B7280] border-r border-[#E5E7EB] h-full flex items-center select-none bg-[#F9FAFB]">+91</span>
      <input
        {...field}
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="9876543210"
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="flex-1 h-full px-3 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] outline-none bg-transparent"
      />
    </div>
  );
}
