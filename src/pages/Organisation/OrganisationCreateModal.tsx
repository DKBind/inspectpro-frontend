import { useEffect, useState } from 'react';
import { useForm, FormProvider, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Building2, Globe, Mail, Sparkles, Phone, User, FileText, MapPin } from 'lucide-react';

import { organisationService } from '@/services/organisationService';
import { subscriptionService } from '@/services/subscriptionService';
import type { OrganisationResponse } from '@/services/models/organisation';
import type { SubscriptionResponse } from '@/services/models/subscription';

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
  name: z.string().min(2, 'Organisation name must be at least 2 characters'),
  email: z.string().min(1, 'Contact email is required').email({ message: 'Please enter a valid email address' }),
  domain: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(val),
      'Please enter a valid domain (e.g. acme.com)'
    ),
  subscriptionId: z.string().optional(),  // required only on create
  phoneNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^[0-9+\-\s()]{7,15}$/.test(val), 'Please enter a valid phone number'),
  contactedPersonName: z.string().optional(),
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
  address: z
    .object({
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      street: z.string().optional(),
      district: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      pincode: z
        .string()
        .optional()
        .refine((val) => !val || /^[0-9]{6}$/.test(val), 'Pincode must be 6 digits'),
    })
    .optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_DEFAULTS: FormValues = {
  name: '',
  email: '',
  domain: '',
  subscriptionId: '',
  phoneNumber: '',
  contactedPersonName: '',
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const isEditMode = !!editOrg;

  const methods = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_DEFAULTS });
  const { control, formState: { errors }, setError, reset, register } = methods;

  const { field: nameField } = useController({ name: 'name', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: domainField } = useController({ name: 'domain', control });
  const { field: phoneField } = useController({ name: 'phoneNumber', control });
  const { field: contactPersonField } = useController({ name: 'contactedPersonName', control });
  const { field: gstinField } = useController({ name: 'gstin', control });
  const { field: panField } = useController({ name: 'pan', control });
  const { field: tanField } = useController({ name: 'tan', control });
  const { field: addrLine1Field } = useController({ name: 'address.addressLine1', control });
  const { field: streetField } = useController({ name: 'address.street', control });
  const { field: districtField } = useController({ name: 'address.district', control });
  const { field: stateField } = useController({ name: 'address.state', control });
  const { field: countryField } = useController({ name: 'address.country', control });
  const { field: pincodeField } = useController({ name: 'address.pincode', control });

  // Fetch subscription plans when modal opens
  useEffect(() => {
    if (!open || isEditMode) return;
    setPlansLoading(true);
    subscriptionService.listSubscriptions()
      .then(setPlans)
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
        phoneNumber: editOrg.phoneNumber ?? '',
        contactedPersonName: editOrg.contactedPersonName ?? '',
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
          phoneNumber: clean(data.phoneNumber),
          contactedPersonName: clean(data.contactedPersonName),
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
    `h-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${hasError ? 'border-red-500' : ''}`;

  const selectCls =
    'h-10 w-full rounded-md bg-slate-950/60 border border-slate-700 text-white text-sm px-3 focus:border-blue-500 focus:outline-none appearance-none cursor-pointer';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0">
        <DialogHeader className="px-7 pt-7 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Building2 size={18} className="text-blue-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-white">
              {isEditMode ? 'Edit Organisation' : 'Create Organisation'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-sm pl-12">
            {isEditMode
              ? 'Update the details below and save your changes.'
              : 'Set up a new workspace and assign a subscription plan.'}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit, () => toast.error('Please fix the errors before submitting.'))}>
            <div className="px-7 py-6 space-y-6">

              {/* Subscription Plan — shown on create only */}
              {!isEditMode && (
                <Sec icon={<Sparkles size={13} />} label="Subscription Plan">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <Fld label="Select Plan" required error={(errors as any).subscriptionId?.message}>
                      {plansLoading ? (
                        <div className="h-10 flex items-center text-slate-400 text-sm">Loading plans...</div>
                      ) : (
                        <select {...register('subscriptionId')} className={selectCls}>
                          <option value="">— Select a subscription plan —</option>
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
                  </div>
                </Sec>
              )}

              {/* Core Details */}
              <Sec icon={<Building2 size={13} />} label="Organisation Details">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
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
                      <IcoInput icon={<Phone size={15} />}>
                        <Input placeholder="+91 98765 43210" {...phoneField} className={inputCls(!!errors.phoneNumber)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Contact Person" error={errors.contactedPersonName?.message}>
                      <IcoInput icon={<User size={15} />}>
                        <Input placeholder="John Doe" {...contactPersonField} className={inputCls(!!errors.contactedPersonName)} />
                      </IcoInput>
                    </Fld>
                    <Fld label="Domain" hint="Optional" error={errors.domain?.message}>
                      <IcoInput icon={<Globe size={15} />}>
                        <Input placeholder="acme.com" {...domainField} className={inputCls(!!errors.domain)} />
                      </IcoInput>
                    </Fld>
                  </div>
                </div>
              </Sec>

              {/* Business Identifiers */}
              <Sec icon={<FileText size={13} />} label="Business Identifiers">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
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
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Address Line 1">
                      <Input placeholder="Flat / House no., Building name"
                        {...addrLine1Field} className={inputCls(false)} />
                    </Fld>
                    <Fld label="Address Line 2">
                      <Input placeholder="Area, Colony, Locality"
                        {...register('address.addressLine2')} className={inputCls(false)} />
                    </Fld>
                    <Fld label="Street">
                      <Input placeholder="Street name" {...streetField} className={inputCls(false)} />
                    </Fld>
                    <Fld label="District">
                      <Input placeholder="District" {...districtField} className={inputCls(false)} />
                    </Fld>
                    <Fld label="State">
                      <Input placeholder="State" {...stateField} className={inputCls(false)} />
                    </Fld>
                    <Fld label="Country">
                      <Input placeholder="Country" {...countryField} className={inputCls(false)} />
                    </Fld>
                    <Fld label="Pincode" error={(errors.address as any)?.pincode?.message}>
                      <Input placeholder="110001" maxLength={6}
                        {...pincodeField}
                        className={inputCls(!!(errors.address as any)?.pincode)} />
                    </Fld>
                  </div>
                </div>
              </Sec>

            </div>

            <DialogFooter className="px-7 py-5 border-t border-slate-800 bg-slate-900/30 rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}
                className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}
                className="flex-1 sm:flex-none sm:min-w-44 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg active:scale-95">
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
          {icon && <span className="text-blue-400">{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
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
        <Label className="text-slate-300 text-sm font-medium">{label}</Label>
        {required && <span className="text-red-400 text-xs">*</span>}
        {hint && <span className="text-slate-500 text-xs">({hint})</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function IcoInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">{icon}</span>
      <div className="[&_input]:pl-9">{children}</div>
    </div>
  );
}
