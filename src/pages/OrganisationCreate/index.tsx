import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Mail, Phone, User, Globe, FileText, MapPin, Sparkles, ChevronDown, Calendar } from 'lucide-react';

import { organisationService } from '@/services/organisationService';
import { subscriptionService } from '@/services/subscriptionService';
import type { SubscriptionResponse } from '@/services/models/subscription';
import { ROUTES } from '@/components/Constant/Route';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Schema ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(2, 'Organisation name must be at least 2 characters'),
  email: z.string().min(1, 'Contact email is required').email('Please enter a valid email address'),
  domain: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(val),
      'Please enter a valid domain (e.g. acme.com)'
    ),
  subscriptionId: z.string().min(1, 'Please select a plan'),
  subscriptionStartDate: z.string().min(1, 'Start date is required'),
  subscriptionEndDate: z.string().min(1, 'End date is required'),
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
});

type CreateFormValues = z.infer<typeof createSchema>;

const clean = (val?: string) => (val?.trim() ? val.trim() : undefined);

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrganisationCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    subscriptionService.listActiveSubscriptions()
      .then(setPlans)
      .catch(() => toast.error('Failed to load subscription plans'))
      .finally(() => setPlansLoading(false));
  }, []);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    setError,
    register,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      email: '',
      domain: '',
      subscriptionId: '',
      subscriptionStartDate: '',
      subscriptionEndDate: '',
      phoneNumber: '',
      contactedPersonName: '',
      gstin: '',
      pan: '',
      tan: '',
      addressLine1: '',
      addressLine2: '',
      street: '',
      district: '',
      state: '',
      country: '',
      pincode: '',
    },
  });

  const { field: nameField } = useController({ name: 'name', control });
  const { field: emailField } = useController({ name: 'email', control });
  const { field: domainField } = useController({ name: 'domain', control });

  const selectedPlanId = watch('subscriptionId');
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const onSubmit = async (data: CreateFormValues) => {
    setIsSubmitting(true);

    const cleanAddr = {
      addressLine1: clean(data.addressLine1),
      addressLine2: clean(data.addressLine2),
      street: clean(data.street),
      district: clean(data.district),
      state: clean(data.state),
      country: clean(data.country),
      pincode: clean(data.pincode),
    };
    const hasAddress = Object.values(cleanAddr).some(Boolean);

    try {
      await organisationService.createOrganisation({
        name: data.name,
        email: data.email,
        domain: clean(data.domain),
        subscriptionId: data.subscriptionId,
        subscriptionStartDate: data.subscriptionStartDate
          ? data.subscriptionStartDate + 'T00:00:00'
          : undefined,
        subscriptionEndDate: data.subscriptionEndDate
          ? data.subscriptionEndDate + 'T00:00:00'
          : undefined,
        phoneNumber: clean(data.phoneNumber),
        contactedPersonName: clean(data.contactedPersonName),
        gstin: clean(data.gstin),
        pan: clean(data.pan),
        tan: clean(data.tan),
        address: hasAddress ? cleanAddr : undefined,
      });
      toast.success('Organisation created successfully!');
      navigate(ROUTES.ORGANISATION);
    } catch (error: any) {
      const message = error?.message || 'Something went wrong';
      if (message.toLowerCase().includes('email')) {
        setError('email', { type: 'manual', message: 'This email is already registered.' });
      } else {
        toast.error('Failed to create organisation', { description: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (hasError: boolean) => (hasError ? 'border-destructive' : '');

  return (
    <div className="container mx-auto max-w-3xl py-10">
      {/* Page Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(ROUTES.ORGANISATION)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Organisation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set up a new organisation and choose a subscription plan.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" /> Subscription Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Plan selector via DropdownMenu */}
            <div className="space-y-2">
              <Label>Plan <span className="text-destructive">*</span></Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={plansLoading}
                    className={`w-full justify-between font-normal ${errors.subscriptionId ? 'border-destructive' : ''}`}
                  >
                    <span className={selectedPlan ? '' : 'text-muted-foreground'}>
                      {plansLoading ? 'Loading plans...' : selectedPlan ? selectedPlan.planName : 'Select a plan'}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[280px] w-full">
                  {plans.length === 0 ? (
                    <DropdownMenuItem disabled>No active plans available</DropdownMenuItem>
                  ) : (
                    plans.map((plan) => (
                      <DropdownMenuItem
                        key={plan.id}
                        onSelect={() => setValue('subscriptionId', plan.id, { shouldValidate: true })}
                        className="flex justify-between cursor-pointer"
                      >
                        <span className="font-medium">{plan.planName}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.subscriptionId && (
                <p className="text-sm text-destructive">{errors.subscriptionId.message}</p>
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="subscriptionStartDate">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="subscriptionStartDate"
                  type="date"
                  {...register('subscriptionStartDate')}
                  className={`pl-9 ${inputCls(!!errors.subscriptionStartDate)}`}
                />
              </div>
              {errors.subscriptionStartDate && (
                <p className="text-sm text-destructive">{errors.subscriptionStartDate.message}</p>
              )}
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="subscriptionEndDate">
                End Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="subscriptionEndDate"
                  type="date"
                  {...register('subscriptionEndDate')}
                  className={`pl-9 ${inputCls(!!errors.subscriptionEndDate)}`}
                />
              </div>
              {errors.subscriptionEndDate && (
                <p className="text-sm text-destructive">{errors.subscriptionEndDate.message}</p>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Organisation Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Organisation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Organisation Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" placeholder="Acme Corp" {...nameField} className={`pl-9 ${inputCls(!!errors.name)}`} />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Contact Email <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="admin@acme.com" {...emailField} className={`pl-9 ${inputCls(!!errors.email)}`} />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="phoneNumber" placeholder="+91 98765 43210" {...register('phoneNumber')} className={`pl-9 ${inputCls(!!errors.phoneNumber)}`} />
              </div>
              {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactedPersonName">Contact Person</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="contactedPersonName" placeholder="John Doe" {...register('contactedPersonName')} className="pl-9" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain <span className="text-muted-foreground text-xs">(Optional)</span></Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="domain" placeholder="acme.com" {...domainField} className={`pl-9 ${inputCls(!!errors.domain)}`} />
              </div>
              {errors.domain && <p className="text-sm text-destructive">{errors.domain.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Business Identifiers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Business Identifiers <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" placeholder="22AAAAA0000A1Z5" maxLength={15}
                {...register('gstin')} className={`uppercase ${inputCls(!!errors.gstin)}`} />
              {errors.gstin && <p className="text-sm text-destructive">{errors.gstin.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" placeholder="ABCDE1234F" maxLength={10}
                {...register('pan')} className={`uppercase ${inputCls(!!errors.pan)}`} />
              {errors.pan && <p className="text-sm text-destructive">{errors.pan.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tan">TAN</Label>
              <Input id="tan" placeholder="ABCD12345E" maxLength={10}
                {...register('tan')} className={`uppercase ${inputCls(!!errors.tan)}`} />
              {errors.tan && <p className="text-sm text-destructive">{errors.tan.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Address <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input id="addressLine1" placeholder="Flat / House no., Building name" {...register('addressLine1')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" placeholder="Area, Colony, Locality" {...register('addressLine2')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="street">Street</Label>
              <Input id="street" placeholder="Street name" {...register('street')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input id="district" placeholder="District" {...register('district')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" placeholder="State" {...register('state')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="Country" {...register('country')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" placeholder="110001" maxLength={6}
                {...register('pincode')} className={inputCls(!!errors.pincode)} />
              {errors.pincode && <p className="text-sm text-destructive">{errors.pincode.message}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.ORGANISATION)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-36">
            {isSubmitting ? 'Creating...' : 'Create Organisation'}
          </Button>
        </div>
      </form>
    </div>
  );
}
