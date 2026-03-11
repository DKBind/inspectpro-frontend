import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

import { organisationService } from '@/services/organisationService';
import { PlanType } from '@/services/models/organisation';
import type { OrganisationCreateRequest } from '@/services/models/organisation';
import { ROUTES } from '@/components/Constant/Route';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const createSchema = z.object({
  name: z.string().min(2, 'Organisation name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and dashes'),
  domain: z.string().optional(),
  planType: z.nativeEnum(PlanType, { required_error: 'Please select a plan' }),
});

type CreateFormValues = z.infer<typeof createSchema>;

export default function OrganisationCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      slug: '',
      domain: '',
      planType: PlanType.FREE,
    },
  });

  const { field: nameField } = useController({ name: 'name', control });
  const { field: slugField } = useController({ name: 'slug', control });
  const { field: domainField } = useController({ name: 'domain', control });
  const selectedPlan = watch('planType');

  const onSubmit = async (data: CreateFormValues) => {
    setIsSubmitting(true);
    const payload: OrganisationCreateRequest = {
      name: data.name,
      slug: data.slug,
      domain: data.domain || undefined,
      planType: data.planType,
    };

    try {
      await organisationService.createOrganisation(payload);
      toast.success('Organisation created successfully!');
      navigate(ROUTES.ORGANISATION);
    } catch (error: any) {
      toast.error('Failed to create organisation', {
        description: error?.message || 'Please check your inputs and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-10">
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
        <Card>
          <CardHeader>
            <CardTitle>Organisation Details</CardTitle>
            <CardDescription>Enter the basic information for the new organisation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organisation Name *</Label>
              <Input
                id="name"
                placeholder="Acme Corp"
                {...nameField}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                placeholder="acme-corp"
                {...slugField}
                className={errors.slug ? 'border-destructive' : ''}
              />
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain (Optional)</Label>
              <Input
                id="domain"
                placeholder="acme.com"
                {...domainField}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planType">Plan Type *</Label>
              <Select
                value={selectedPlan}
                onValueChange={(val) => setValue('planType', val as PlanType, { shouldValidate: true })}
              >
                <SelectTrigger id="planType" className={errors.planType ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PlanType.FREE}>Free</SelectItem>
                  <SelectItem value={PlanType.STARTER}>Starter</SelectItem>
                  <SelectItem value={PlanType.PRO}>Professional</SelectItem>
                  <SelectItem value={PlanType.ENTERPRISE}>Enterprise</SelectItem>
                </SelectContent>
              </Select>
              {errors.planType && (
                <p className="text-sm text-destructive">{errors.planType.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(ROUTES.ORGANISATION)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Organisation'}
          </Button>
        </div>
      </form>
    </div>
  );
}
