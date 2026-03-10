import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function OrgDetailsForm() {

  const {
    register,
    formState: { errors },
  } = useFormContext();



  return (
    <div className="space-y-6 rounded-lg border p-6">
      <div>
        <h3 className="text-lg font-medium">Organization Details</h3>
        <p className="text-sm text-muted-foreground">
          Enter the basic information for the new organization.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Organization Name *</Label>
          <Input
            id="name"
            placeholder="Acme Corp"
            {...register('name')}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm font-medium text-destructive">
              {errors.name.message as string}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug (URL identifier) *</Label>
          <Input
            id="slug"
            placeholder="acme-corp"
            {...register('slug')}
            className={errors.slug ? 'border-destructive' : ''}
          />
          {errors.slug && (
            <p className="text-sm font-medium text-destructive">
              {errors.slug.message as string}
            </p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="domain">Domain (Optional)</Label>
          <Input id="domain" placeholder="acme.com" {...register('domain')} />
        </div>
      </div>
    </div>
  );
}
