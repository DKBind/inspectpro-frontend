import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

export function RoleSeeding() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'customRoles',
  });

  // Mocked default roles based on CommonOrgRole that backend automatically creates
  const defaultRoles = [
    { name: 'Admin', description: 'Full access to organization settings', designation: 'Administrator' },
    { name: 'Inspector', description: 'Can perform inspections', designation: 'Field Inspector' },
    { name: 'Contractor', description: 'Limited access to assigned tasks', designation: 'External Contractor' },
  ];

  return (
    <div className="space-y-8 rounded-lg border p-6">
      {/* Default Roles Section */}
      <div>
        <h3 className="text-lg font-medium">Default Roles</h3>
        <p className="text-sm text-muted-foreground mb-4">
          These roles will be automatically seeded for your new organization.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {defaultRoles.map((role, idx) => (
            <div key={idx} className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="font-semibold">{role.name}</div>
              <div className="text-muted-foreground">{role.designation}</div>
              <div className="mt-1 text-xs">{role.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Custom Roles Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">Custom Roles</h3>
            <p className="text-sm text-muted-foreground">
              Define additional custom roles needed right from the start. (Optional)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => append({ name: '', description: '', designation: '' })}
          >
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No custom roles configured yet. Click "Add Role" above to specify one.
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => {
              // Custom error extraction for array types
              const roleErrors = (errors.customRoles as any)?.[index];

              return (
                <div key={field.id} className="relative rounded-md border p-4 bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <div className="grid gap-4 md:grid-cols-3 mr-8">
                    <div className="space-y-2">
                      <Label htmlFor={`customRoles.${index}.name`}>Role Name *</Label>
                      <Input
                        id={`customRoles.${index}.name`}
                        placeholder="e.g. Auditor"
                        {...register(`customRoles.${index}.name`)}
                        className={roleErrors?.name ? 'border-destructive' : ''}
                      />
                      {roleErrors?.name && (
                        <p className="text-xs text-destructive">{roleErrors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`customRoles.${index}.designation`}>Designation *</Label>
                      <Input
                        id={`customRoles.${index}.designation`}
                        placeholder="e.g. Quality Auditor"
                        {...register(`customRoles.${index}.designation`)}
                        className={roleErrors?.designation ? 'border-destructive' : ''}
                      />
                      {roleErrors?.designation && (
                        <p className="text-xs text-destructive">{roleErrors.designation.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`customRoles.${index}.description`}>Description *</Label>
                      <Input
                        id={`customRoles.${index}.description`}
                        placeholder="What does this role do?"
                        {...register(`customRoles.${index}.description`)}
                        className={roleErrors?.description ? 'border-destructive' : ''}
                      />
                      {roleErrors?.description && (
                        <p className="text-xs text-destructive">{roleErrors.description.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
