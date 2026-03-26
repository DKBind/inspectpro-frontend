import { useEffect, useState, useId } from 'react';
import { useForm, FormProvider, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Building2, Globe, Mail, Sparkles, User, FileText, MapPin,
  ChevronDown, Calendar, Crown, Plus, Save, Pencil, Trash2, Info,
} from 'lucide-react';

import { organisationService } from '@/services/organisationService';
import { subscriptionService } from '@/services/subscriptionService';
import type { OrganisationResponse } from '@/services/models/organisation';
import type { SubscriptionResponse } from '@/services/models/subscription';
import { useAuthStore } from '@/store/useAuthStore';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Label } from '@/components/shared-ui/Label/label';

// ─── Extra Info row type (local state only) ────────────────────────────────────

interface ExtraRow {
  id: string;
  label: string;
  value: string;
  saved: boolean;
}

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
  // Organisation Details
  name: z.string().min(2, 'Organisation name must be at least 2 characters'),
  email: z.string().min(1, 'Organisation email is required').email('Please enter a valid email address'),
  phoneNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^[0-9]{10}$/.test(val), 'Phone number must be exactly 10 digits'),
  domain: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(val),
      'Please enter a valid domain (e.g. acme.com)'
    ),

  // Subscription
  subscriptionId: z.string().optional(),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),

  // Primary Contact (→ becomes admin)
  contactedPersonName: z.string().min(1, 'Primary contact name is required'),
  contactedPersonEmail: z
    .string()
    .min(1, 'Primary contact email is required')
    .email('Enter a valid email address'),
  contactedPersonPhoneNumber: z
    .string()
    .min(1, 'Primary contact phone is required')
    .refine((val) => /^[0-9]{10}$/.test(val), 'Phone number must be exactly 10 digits'),

  // Alternate Contact (optional)
  altContactPersonName: z.string().optional(),
  altContactPersonEmail: z
    .string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Enter a valid email address'),
  altContactPersonPhoneNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^[0-9]{10}$/.test(val), 'Phone number must be exactly 10 digits'),

  // Business Identifiers
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

  // Address
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
  name: '', email: '', phoneNumber: '', domain: '',
  subscriptionId: '', subscriptionStartDate: '', subscriptionEndDate: '',
  contactedPersonName: '', contactedPersonEmail: '', contactedPersonPhoneNumber: '',
  altContactPersonName: '', altContactPersonEmail: '', altContactPersonPhoneNumber: '',
  gstin: '', pan: '', tan: '',
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
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);
  const isEditMode = !!editOrg;

  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_DEFAULTS });
  const { control, formState: { errors }, setError, reset, register, watch, setValue } = methods;

  const { field: nameField } = useController({ name: 'name', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: domainField } = useController({ name: 'domain', control });
  const { field: phoneField } = useController({ name: 'phoneNumber', control });
  const { field: cpNameField } = useController({ name: 'contactedPersonName', control });
  const { field: cpEmailField } = useController({ name: 'contactedPersonEmail', control });
  const { field: cpPhoneField } = useController({ name: 'contactedPersonPhoneNumber', control });
  const { field: altNameField } = useController({ name: 'altContactPersonName', control });
  const { field: altEmailField } = useController({ name: 'altContactPersonEmail', control });
  const { field: altPhoneField } = useController({ name: 'altContactPersonPhoneNumber', control });
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

  useEffect(() => {
    if (open && editOrg) {
      reset({
        name: editOrg.name ?? '',
        email: editOrg.email ?? '',
        phoneNumber: editOrg.phoneNumber ?? '',
        domain: editOrg.domain ?? '',
        subscriptionId: '', subscriptionStartDate: '', subscriptionEndDate: '',
        contactedPersonName: editOrg.contactedPersonName ?? '',
        contactedPersonEmail: editOrg.contactedPersonEmail ?? '',
        contactedPersonPhoneNumber: editOrg.contactedPersonPhoneNumber ?? '',
        altContactPersonName: editOrg.altContactPersonName ?? '',
        altContactPersonEmail: editOrg.altContactPersonEmail ?? '',
        altContactPersonPhoneNumber: editOrg.altContactPersonPhoneNumber ?? '',
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
      // Parse saved extraInfo
      try {
        const parsed = editOrg.extraInfo ? JSON.parse(editOrg.extraInfo) : [];
        setExtraRows(
          (parsed as { label: string; value: string }[]).map((r, i) => ({
            id: `${i}`, label: r.label, value: r.value, saved: true,
          }))
        );
      } catch {
        setExtraRows([]);
      }
    } else if (open && !editOrg) {
      reset(EMPTY_DEFAULTS);
      setExtraRows([]);
    }
  }, [open, editOrg, reset]);

  const handleClose = () => {
    reset(EMPTY_DEFAULTS);
    setExtraRows([]);
    onOpenChange(false);
  };

  // ─── Extra Info CRUD ──────────────────────────────────────────────────────

  const addExtraRow = () => {
    setExtraRows((prev) => [...prev, { id: crypto.randomUUID(), label: '', value: '', saved: false }]);
  };

  const updateRow = (id: string, field: 'label' | 'value', val: string) => {
    setExtraRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: val } : r));
  };

  const saveRow = (id: string) => {
    const row = extraRows.find((r) => r.id === id);
    if (!row?.label.trim()) { toast.error('Label is required'); return; }
    setExtraRows((prev) => prev.map((r) => r.id === id ? { ...r, saved: true } : r));
  };

  const editRow = (id: string) => {
    setExtraRows((prev) => prev.map((r) => r.id === id ? { ...r, saved: false } : r));
  };

  const deleteRow = (id: string) => {
    setExtraRows((prev) => prev.filter((r) => r.id !== id));
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    if (!isEditMode && data.subscriptionId && !data.subscriptionStartDate) {
      methods.setError('subscriptionStartDate', { type: 'manual', message: 'Start date is required' });
      return;
    }

    // Ensure all extra rows are saved
    const unsaved = extraRows.filter((r) => !r.saved);
    if (unsaved.length > 0) {
      toast.error('Please save all extra information rows before submitting.');
      return;
    }

    const extraInfoJson = extraRows.length > 0
      ? JSON.stringify(extraRows.map(({ label, value }) => ({ label, value })))
      : undefined;

    setIsSubmitting(true);
    const clean = (val?: string) => (val?.trim() ? val.trim() : undefined);
    const rawAddr = data.address;
    const cleanAddr = rawAddr ? {
      addressLine1: clean(rawAddr.addressLine1),
      addressLine2: clean(rawAddr.addressLine2),
      street: clean(rawAddr.street),
      district: clean(rawAddr.district),
      state: clean(rawAddr.state),
      country: clean(rawAddr.country),
      pincode: clean(rawAddr.pincode),
    } : undefined;
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
          altContactPersonName: clean(data.altContactPersonName),
          altContactPersonEmail: clean(data.altContactPersonEmail),
          altContactPersonPhoneNumber: clean(data.altContactPersonPhoneNumber),
          extraInfo: extraInfoJson,
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
          altContactPersonName: clean(data.altContactPersonName),
          altContactPersonEmail: clean(data.altContactPersonEmail),
          altContactPersonPhoneNumber: clean(data.altContactPersonPhoneNumber),
          extraInfo: extraInfoJson,
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

              {/* Subscription Plan */}
              <Sec icon={<Sparkles size={13} />} label="Subscription Plan">
                {isEditMode ? (
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
                            <Input type="date" {...register('subscriptionStartDate')}
                              className={`pl-9 h-10 border-[#E5E7EB] text-[#263B4F] bg-white focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 ${(errors as any).subscriptionStartDate ? 'border-[#DF453A]' : ''}`} />
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

              {/* Organisation Details */}
              <Sec icon={<Building2 size={13} />} label="Organisation Details">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Organisation Name" required error={errors.name?.message}>
                      <IcoInput icon={<Building2 size={15} />}>
                        <Input placeholder="Acme Corp" {...nameField} className={inputCls(!!errors.name)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Organisation Email" required error={errors.email?.message}>
                      <IcoInput icon={<Mail size={15} />}>
                        <Input type="email" placeholder="info@acme.com" {...emailField} className={inputCls(!!errors.email)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Phone Number" error={errors.phoneNumber?.message}>
                      <PhoneInput field={phoneField} hasError={!!errors.phoneNumber} />
                    </Fld>
                    <Fld label="Website" hint="Optional" error={errors.domain?.message}>
                      <IcoInput icon={<Globe size={15} />}>
                        <Input placeholder="acme.com" {...domainField} className={inputCls(!!errors.domain)} />
                      </IcoInput>
                    </Fld>
                  </div>
                </div>
              </Sec>

              {/* Primary Contact */}
              <Sec icon={<User size={13} />} label="Primary Contact">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-[#33AE95] font-medium bg-[#33AE95]/8 border border-[#33AE95]/20 rounded-lg px-3 py-2">
                    <Info size={13} />
                    This contact person will become the Admin for this organisation.
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Full Name" required error={errors.contactedPersonName?.message}>
                      <IcoInput icon={<User size={15} />}>
                        <Input placeholder="John Doe" {...cpNameField} className={inputCls(!!errors.contactedPersonName)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Email (Admin Login)" required error={errors.contactedPersonEmail?.message}>
                      <IcoInput icon={<Mail size={15} />}>
                        <Input type="email" placeholder="john@acme.com" {...cpEmailField} className={inputCls(!!errors.contactedPersonEmail)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Phone" required error={errors.contactedPersonPhoneNumber?.message}>
                      <PhoneInput field={cpPhoneField} hasError={!!errors.contactedPersonPhoneNumber} />
                    </Fld>
                  </div>
                </div>
              </Sec>

              {/* Alternate Contact */}
              <Sec icon={<User size={13} />} label="Alternate Contact">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5">
                  <p className="text-xs text-[#6B7280] mb-3">Optional secondary point of contact.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Full Name" error={errors.altContactPersonName?.message}>
                      <IcoInput icon={<User size={15} />}>
                        <Input placeholder="Jane Doe" {...altNameField} className={inputCls(!!errors.altContactPersonName)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Email" error={(errors as any).altContactPersonEmail?.message}>
                      <IcoInput icon={<Mail size={15} />}>
                        <Input type="email" placeholder="jane@acme.com" {...altEmailField} className={inputCls(!!(errors as any).altContactPersonEmail)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Phone" error={(errors as any).altContactPersonPhoneNumber?.message}>
                      <PhoneInput field={altPhoneField} hasError={!!(errors as any).altContactPersonPhoneNumber} />
                    </Fld>
                  </div>
                </div>
              </Sec>

              {/* Extra Information */}
              <Sec icon={<Info size={13} />} label="Extra Information">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-5 space-y-3">
                  {extraRows.length > 0 && (
                    <div className="space-y-2">
                      {extraRows.map((row) => (
                        <ExtraInfoRow
                          key={row.id}
                          row={row}
                          onLabelChange={(v) => updateRow(row.id, 'label', v)}
                          onValueChange={(v) => updateRow(row.id, 'value', v)}
                          onSave={() => saveRow(row.id)}
                          onEdit={() => editRow(row.id)}
                          onDelete={() => deleteRow(row.id)}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addExtraRow}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#33AE95]/50 text-[#33AE95] text-sm font-medium hover:bg-[#33AE95]/8 transition-colors"
                  >
                    <Plus size={14} />
                    Add Question
                  </button>
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
                        {...pincodeField} className={inputCls(!!errors.address?.pincode)} />
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

// ─── Extra Info Row ────────────────────────────────────────────────────────────

function ExtraInfoRow({
  row, onLabelChange, onValueChange, onSave, onEdit, onDelete,
}: {
  row: ExtraRow;
  onLabelChange: (v: string) => void;
  onValueChange: (v: string) => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const inputBase = 'h-9 rounded-md border border-[#E5E7EB] px-3 text-sm text-[#263B4F] bg-white focus:outline-none focus:ring-1 focus:ring-[#33AE95]/30 focus:border-[#33AE95] placeholder:text-[#9CA3AF]';

  if (row.saved) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
        <span className="text-xs font-semibold text-[#263B4F] min-w-[120px] shrink-0">{row.label}</span>
        <span className="text-xs text-[#4B5563] flex-1 border-l border-[#E5E7EB] pl-3">{row.value || '—'}</span>
        <button type="button" onClick={onEdit}
          className="p-1 rounded text-[#6B7280] hover:text-[#263B4F] hover:bg-[#F3F4F6] transition-colors" title="Edit">
          <Pencil size={13} />
        </button>
        <button type="button" onClick={onDelete}
          className="p-1 rounded text-[#6B7280] hover:text-[#DF453A] hover:bg-[#DF453A]/8 transition-colors" title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={row.label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="Label (e.g. Landmark)"
        className={`${inputBase} w-40 shrink-0`}
      />
      <input
        type="text"
        value={row.value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Value"
        className={`${inputBase} flex-1`}
      />
      <button type="button" onClick={onSave}
        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-[#33AE95] text-white text-xs font-semibold hover:bg-[#2a9a84] transition-colors shrink-0">
        <Save size={12} />
        Save
      </button>
      <button type="button" onClick={onDelete}
        className="p-2 rounded text-[#6B7280] hover:text-[#DF453A] hover:bg-[#DF453A]/8 transition-colors" title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
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
    if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key)) e.preventDefault();
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
