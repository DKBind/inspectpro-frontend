import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

import { organisationService } from '@/services/organisationService';
import type { OrganisationCreateRequest } from '@/services/models/organisation';
import { PlanType } from '@/services/models/organisation';

import { PlanSelector } from './PlanSelector';
import { OrgDetailsForm } from './OrgDetailsForm';
import { RoleSeeding } from './RoleSeeding';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Zod Validation Schema
const customRoleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  designation: z.string().min(2, 'Designation must be at least 2 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
});

const onboardingSchema = z.object({
  name: z.string().min(2, 'Organization Name is required'),
  slug: z
    .string()
    .min(2, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and dashes'),
  domain: z.string().optional(),
  planType: z.nativeEnum(PlanType).refine((val) => val !== undefined, { message: 'Please select a plan' }),
  customRoles: z.array(customRoleSchema).optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function OrganisationOnboarding() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<OnboardingFormValues>({
    // resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      slug: '',
      domain: '',
      planType: PlanType.STARTER,
      customRoles: [],
    },
  });


  // remove
  const currentValues = methods.watch();
  console.log("Current Form State:", currentValues);
  const currentErrors = methods.formState.errors;
  console.log("Current Errors:", currentErrors);

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsSubmitting(true);

    // Transform optional empty values back to correct structure if needed
    const payload: OrganisationCreateRequest = {
      name: data.name,
      slug: data.slug,
      domain: data.domain || undefined,
      planType: data.planType,
      customRoles: data.customRoles?.length ? data.customRoles : undefined,
    };

    try {
      const response = await organisationService.createOrganisation(payload);
      toast.success('Organization Created Successfully!', {
        description: `${response.name} has been set up with default roles and ${response.planType} plan.`,
      });
      navigate('/dashboard'); // or dynamic route if applicable
    } catch (error: any) {
      toast.error('Failed to create organization', {
        description: error?.message || 'Please check your inputs and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Organization Onboarding</h1>
        <p className="text-muted-foreground mt-2">
          Setup a new organization, define its subscription, and provision its default user roles instantly.
        </p>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit, (errors) => {
          console.log(errors);
          toast.error("Please check the form for errors.");
        })} className="space-y-8">

          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>
                Select the billing template and capabilities for this organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanSelector />
            </CardContent>
          </Card>

          <OrgDetailsForm />

          <RoleSeeding />

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              size="lg"
              className="min-w-[200px]"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing Transaction...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
