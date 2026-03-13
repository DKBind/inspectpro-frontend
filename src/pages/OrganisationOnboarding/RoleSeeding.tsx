import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Check, X, ShieldCheck, Users } from 'lucide-react';

export function RoleSeeding() {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'customRoles' });

  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [pendingDesignation, setPendingDesignation] = useState('');
  const [pendingDescription, setPendingDescription] = useState('');
  const [pendingErrors, setPendingErrors] = useState<Record<string, string>>({});

  const handleAdd = () => {
    const errs: Record<string, string> = {};
    if (!pendingName || pendingName.trim().length < 2)
      errs.name = 'Name must be at least 2 characters';
    if (!pendingDesignation || pendingDesignation.trim().length < 2)
      errs.designation = 'Designation must be at least 2 characters';
    if (!pendingDescription || pendingDescription.trim().length < 5)
      errs.description = 'Description must be at least 5 characters';

    if (Object.keys(errs).length > 0) {
      setPendingErrors(errs);
      return;
    }

    append({
      name: pendingName.trim(),
      designation: pendingDesignation.trim(),
      description: pendingDescription.trim(),
    });
    resetPending();
  };

  const resetPending = () => {
    setPendingName('');
    setPendingDesignation('');
    setPendingDescription('');
    setPendingErrors({});
    setShowAddForm(false);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      {/* Section Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Users size={13} className="text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Custom Roles
          </span>
          <span className="text-xs text-slate-500 normal-case tracking-normal font-normal">
            — Optional
          </span>
        </div>
        {!showAddForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="h-7 px-3 text-xs border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-blue-600/20 hover:border-blue-500/50 hover:text-blue-300 transition-all gap-1.5"
          >
            <Plus size={12} />
            Add Role
          </Button>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Added roles list */}
        {fields.length > 0 && (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/30 px-4 py-3 group"
              >
                <div className="h-7 w-7 rounded-md bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck size={13} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {(field as any).name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {(field as any).designation}
                    {(field as any).description && (
                      <span className="text-slate-500"> · {(field as any).description}</span>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-slate-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                  onClick={() => remove(index)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Inline add form */}
        {showAddForm && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-600/5 p-4 space-y-4">
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
              New Role
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <RoleField
                label="Role Name"
                placeholder="e.g. Auditor"
                value={pendingName}
                onChange={(v) => {
                  setPendingName(v);
                  if (pendingErrors.name) setPendingErrors((p) => ({ ...p, name: '' }));
                }}
                error={pendingErrors.name}
              />
              <RoleField
                label="Designation"
                placeholder="e.g. Quality Auditor"
                value={pendingDesignation}
                onChange={(v) => {
                  setPendingDesignation(v);
                  if (pendingErrors.designation)
                    setPendingErrors((p) => ({ ...p, designation: '' }));
                }}
                error={pendingErrors.designation}
              />
              <RoleField
                label="Description"
                placeholder="What does this role do?"
                value={pendingDescription}
                onChange={(v) => {
                  setPendingDescription(v);
                  if (pendingErrors.description)
                    setPendingErrors((p) => ({ ...p, description: '' }));
                }}
                error={pendingErrors.description}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetPending}
                className="h-8 px-3 text-xs text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X size={12} className="mr-1" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white"
              >
                <Check size={12} className="mr-1" />
                Add Role
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {fields.length === 0 && !showAddForm && (
          <div className="rounded-lg border border-dashed border-slate-700 py-7 text-center">
            <Users size={20} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-500">No custom roles added yet.</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Default system roles will be seeded automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function RoleField({
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400 font-medium">
        {label} <span className="text-red-400">*</span>
      </Label>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 text-sm bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${
          error ? 'border-red-500' : ''
        }`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
