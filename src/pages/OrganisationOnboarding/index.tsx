import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

import { organisationService } from '@/services/organisationService';

import { PlanSelector } from './PlanSelector';
import { OrgDetailsForm } from './OrgDetailsForm';

import { Button } from '@/components/shared-ui/Button/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared-ui/Card/card';

// ─── Schema ───────────────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  name: z.string().min(2, 'Organisation name is required'),
  email: z.string().email('Please enter a valid contact email'),
  domain: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(val),
      'Please enter a valid domain (e.g. acme.com)'
    ),
  subscriptionId: z.string().min(1, 'Please select a plan'),
  subscriptionStartDate: z.string().min(1, 'Start date is required'),
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

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const clean = (val?: string) => (val?.trim() ? val.trim() : undefined);

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrganisationOnboarding() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<OnboardingFormValues, unknown, OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      email: '',
      domain: '',
      subscriptionId: '',
      subscriptionStartDate: '',
      phoneNumber: '',
      contactedPersonName: '',
      gstin: '',
      pan: '',
      tan: '',
      address: {
        addressLine1: '',
        addressLine2: '',
        street: '',
        district: '',
        state: '',
        country: '',
        pincode: '',
      },
    },
  });

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsSubmitting(true);

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
      const response = await organisationService.createOrganisation({
        name: data.name,
        email: data.email,
        domain: clean(data.domain),
        subscriptionId: data.subscriptionId,
        subscriptionStartDate: data.subscriptionStartDate
          ? data.subscriptionStartDate + 'T00:00:00'
          : undefined,
        phoneNumber: clean(data.phoneNumber),
        contactedPersonName: clean(data.contactedPersonName),
        gstin: clean(data.gstin),
        pan: clean(data.pan),
        tan: clean(data.tan),
        address: hasAddress ? cleanAddr : undefined,
      });
      toast.success('Organisation created successfully!', {
        description: `${response.name} has been set up with the ${response.planType} plan.`,
      });
      navigate('/organisation');
    } catch (error: any) {
      const message = error?.message || 'Please check your inputs and try again.';
      if (message.toLowerCase().includes('email')) {
        methods.setError('email', { type: 'manual', message: 'This email is already registered.' });
      } else {
        toast.error('Failed to create organisation', { description: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Organisation Onboarding</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new organisation, define its subscription plan, and provide contact details.
        </p>
      </div>

      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit, () =>
            toast.error('Please fix the errors before submitting.')
          )}
          className="space-y-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>
                Select the billing template and capabilities for this organisation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanSelector />
            </CardContent>
          </Card>

          <OrgDetailsForm />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate('/organisation')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="min-w-[200px]"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Organisation'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
