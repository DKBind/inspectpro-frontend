import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  ArrowLeft, FolderOpen, ClipboardList, MapPin, Calendar,
  IndianRupee, Loader2, Users, Building2, Navigation,
  Banknote, PlusCircle, Pencil, Trash2, ChevronDown,
} from 'lucide-react';

import { projectService } from '@/services/projectService';
import { customerService } from '@/services/customerService';
import { userService } from '@/services/userService';
import { organisationService } from '@/services/organisationService';
import type { OrganisationResponse } from '@/services/models/organisation';
import { propertyTypeService, parseSpecFields } from '@/services/propertyTypeService';
import type { PropertyTypeResponse, SpecField } from '@/services/propertyTypeService';
import type { ProjectAssignmentInput } from '@/services/models/project';
import type { CustomerResponse } from '@/services/models/customer';
import type { UserResponse } from '@/services/models/user';
import { useAuthStore } from '@/store/useAuthStore';
import { Input } from '@/components/shared-ui/Input/input';
import { Fld, inputCls } from '@/components/shared-ui/form-helpers';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { ROUTES } from '@/components/Constant/Route';
import styles from './ProjectCreate.module.css';

const PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
type ProjectStatus = typeof PROJECT_STATUSES[number];

const STATUS_META: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  PLANNING: { label: 'Planning', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  IN_PROGRESS: { label: 'In Progress', color: '#33AE95', bg: 'rgba(51,174,149,0.08)' },
  ON_HOLD: { label: 'On Hold', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  COMPLETED: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
};

const positiveNumber = z
  .string()
  .optional()
  .refine((v) => !v || (/^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) >= 0), 'Enter a valid positive number');

const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(250, 'Max 250 characters'),
  clientId: z.string().min(1, 'Client is required'),
  organisationId: z.string().optional(),
  managerId: z.string().min(1, 'Manager is required'),
  qaId: z.string().min(1, 'QA is required'),
  inspectorId: z.string().min(1, 'Inspector is required'),
  contractorId: z.string().min(1, 'Contractor is required'),
  propertyTypeId: z.string().min(1, 'Property type is required'),
  projectStatus: z.enum(PROJECT_STATUSES),
  description: z.string().max(250, 'Max 250 characters').optional(),
  addressLine1: z.string().max(250, 'Max 250 characters').optional(),
  addressLine2: z.string().max(250, 'Max 250 characters').optional(),
  street: z.string().max(250, 'Max 250 characters').optional(),
  city: z.string().max(250, 'Max 250 characters').optional(),
  state: z.string().max(250, 'Max 250 characters').optional(),
  country: z.string().max(250, 'Max 250 characters').optional(),
  pincode: z.string().max(10, 'Max 10 characters').optional(),
  latitude: positiveNumber,
  longitude: positiveNumber,
  startDatePlanned: z.string().optional(),
  startDateActual: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  actualCompletionDate: z.string().optional(),
  totalBudget: positiveNumber,
  contractValue: positiveNumber,
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '', clientId: '', organisationId: '', managerId: '', qaId: '',
  inspectorId: '', contractorId: '', propertyTypeId: '', projectStatus: 'PLANNING',
  description: '', addressLine1: '', addressLine2: '', street: '',
  city: '', state: '', country: '', pincode: '', latitude: '', longitude: '',
  startDatePlanned: '', startDateActual: '',
  estimatedCompletionDate: '', actualCompletionDate: '',
  totalBudget: '', contractValue: '',
};

const DESC_MAX = 300;
const DESC_PREVIEW = 100;

const ProjectCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

  const [organisations, setOrganisations] = useState<OrganisationResponse[]>([]);
  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeResponse[]>([]);
  const [roleMap, setRoleMap] = useState<Record<string, number>>({});
  const [managerUsers, setManagerUsers] = useState<UserResponse[]>([]);
  const [qaUsers, setQaUsers] = useState<UserResponse[]>([]);
  const [inspectorUsers, setInspectorUsers] = useState<UserResponse[]>([]);
  const [contractorUsers, setContractorUsers] = useState<UserResponse[]>([]);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register, handleSubmit, watch, setValue, control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onBlur',
  });

  const selectedStatus = watch('projectStatus');
  const selectedPropertyTypeId = watch('propertyTypeId');
  const selectedOrgId = watch('organisationId');
  const descriptionVal = watch('description') ?? '';
  const selectedPropertyType = propertyTypes.find(pt => String(pt.id) === selectedPropertyTypeId);
  const specFields: SpecField[] = parseSpecFields(selectedPropertyType?.specTemplate);

  // ── Fetch on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    propertyTypeService.listPropertyTypes().then(setPropertyTypes).catch(() => { });

    // All roles (including super admin) load clients via the caller-aware endpoint
    customerService.listClients(0, 500)
      .then(d => setClients(d.content ?? []))
      .catch(() => setClients([]));

    if (isSuperAdmin) {
      organisationService.getOrganisations(0, 200)
        .then(d => setOrganisations(d.content ?? []))
        .catch(() => { });
    }

    userService.listRoles().then(roles => {
      const map: Record<string, number> = {};
      roles.forEach(r => { map[r.name.toLowerCase()] = r.roleId; });
      setRoleMap(map);

      if (!isSuperAdmin) {
        const load = (name: string, setter: (u: UserResponse[]) => void) => {
          const id = map[name.toLowerCase()];
          if (id) userService.listUsersByRole(id).then(setter).catch(() => setter([]));
        };
        load('manager', setManagerUsers);
        load('qa', setQaUsers);
        load('inspector', setInspectorUsers);
        load('contractor', setContractorUsers);
      }
    }).catch(() => { });
  }, [user?.id]);

  // Super admin: reload users (and try org-scoped clients) when org changes
  useEffect(() => {
    if (!isSuperAdmin || !selectedOrgId) return;
    // Try org-scoped clients; fall back to global list if the endpoint returns nothing
    customerService.listCustomers(selectedOrgId, 0, 500)
      .then(d => {
        const items = d.content ?? (Array.isArray(d) ? d as any[] : []);
        if (items.length > 0) setClients(items);
        // else keep the already-loaded global list
      })
      .catch(() => { /* keep global list */ });

    const load = (name: string, setter: (u: UserResponse[]) => void) => {
      const id = roleMap[name.toLowerCase()];
      if (id) userService.listUsersByRole(id, selectedOrgId).then(setter).catch(() => setter([]));
    };
    load('manager', setManagerUsers);
    load('qa', setQaUsers);
    load('inspector', setInspectorUsers);
    load('contractor', setContractorUsers);

    setValue('clientId', '');
    setValue('managerId', '');
    setValue('qaId', '');
    setValue('inspectorId', '');
    setValue('contractorId', '');
  }, [selectedOrgId]);

  // ── Options ─────────────────────────────────────────────────────────────
  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.fullName || c.firstName || '',
    meta: c.companyName || undefined,
  }));
  const propertyTypeOptions = propertyTypes.map(pt => ({ value: String(pt.id), label: pt.name }));
  const toUserOptions = (users: UserResponse[]) => users.map(u => ({
    value: u.id,
    label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
    meta: u.email || undefined,
  }));
  const orgOptions = organisations.map(o => ({
    value: o.uuid,
    label: o.name,
    meta: o.parentOrgId ? 'Franchise' : 'Organisation',
  }));

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);

    const specs: Record<string, string> = {};
    Object.entries(specValues).forEach(([k, v]) => { if (v?.trim()) specs[k] = v.trim(); });
    customFields.forEach(cf => { if (cf.label.trim() && cf.value.trim()) specs[cf.label.trim()] = cf.value.trim(); });

    const assignments: ProjectAssignmentInput[] = [];
    if (data.qaId && roleMap['qa']) assignments.push({ userId: data.qaId, roleId: roleMap['qa'] });
    if (data.inspectorId && roleMap['inspector']) assignments.push({ userId: data.inspectorId, roleId: roleMap['inspector'] });
    if (data.contractorId && roleMap['contractor']) assignments.push({ userId: data.contractorId, roleId: roleMap['contractor'] });

    const payload = {
      name: data.name.trim(),
      clientId: data.clientId,
      managerId: data.managerId || undefined,
      organisationId: isSuperAdmin && data.organisationId ? data.organisationId : undefined,
      assignments: assignments.length > 0 ? assignments : undefined,
      propertyTypeId: data.propertyTypeId ? Number(data.propertyTypeId) : undefined,
      projectSpecs: Object.keys(specs).length > 0 ? specs : undefined,
      projectStatus: data.projectStatus,
      description: data.description?.trim() || undefined,
      addressLine1: data.addressLine1?.trim() || undefined,
      addressLine2: data.addressLine2?.trim() || undefined,
      street: data.street?.trim() || undefined,
      city: data.city?.trim() || undefined,
      state: data.state?.trim() || undefined,
      country: data.country?.trim() || undefined,
      pincode: data.pincode?.trim() || undefined,
      latitude: data.latitude ? parseFloat(data.latitude) : undefined,
      longitude: data.longitude ? parseFloat(data.longitude) : undefined,
      startDatePlanned: data.startDatePlanned || undefined,
      startDateActual: data.startDateActual || undefined,
      estimatedCompletionDate: data.estimatedCompletionDate || undefined,
      actualCompletionDate: data.actualCompletionDate || undefined,
      totalBudget: data.totalBudget ? parseFloat(data.totalBudget) : undefined,
      contractValue: data.contractValue ? parseFloat(data.contractValue) : undefined,
    };

    try {
      const created = await projectService.createProject(payload);
      toast.success('Project created!');
      navigate(`/projects/${created.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(ROUTES.PROJECTS)}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
      </div>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon}>
          <FolderOpen size={22} color="white" />
        </div>
        <div className={styles.pageHeaderText}>
          <h1>New Project</h1>
          <p>Fill in the details below to create a new project.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors.'))}>
        <div className={styles.body}>

          {/* ── Two-column area ─────────────────────────────────────────── */}
          <div className={styles.twoCol}>

            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Basic Info card */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><FolderOpen size={13} color="#3B82F6" /></span>
                  <span className={styles.sectionTitle}>Project Info</span>
                </div>
                <div className={styles.sectionBody}>
                  {/* Organisation — super admin only */}
                  {isSuperAdmin && (
                    <Fld label="Organisation" required error={errors.organisationId?.message}>
                      <Controller
                        name="organisationId"
                        control={control}
                        render={({ field }) => (
                          <DropdownSelect
                            options={orgOptions}
                            value={field.value || null}
                            onChange={val => field.onChange(val ?? '')}
                            placeholder="Select organisation…"
                            searchable
                            searchPlaceholder="Search organisations…"
                            error={errors.organisationId?.message}
                          />
                        )}
                      />
                    </Fld>
                  )}

                  <Fld label="Project Name" required error={errors.name?.message}>
                    <Input
                      placeholder="e.g. Site Inspection Phase 1"
                      {...register('name')}
                      className={inputCls(!!errors.name)}
                      style={errors.name ? undefined : { borderColor: undefined }}
                    />
                  </Fld>

                  {/* Status */}
                  <Fld label="Status">
                    <div className={styles.statusChips}>
                      {PROJECT_STATUSES.map(s => {
                        const meta = STATUS_META[s];
                        const active = selectedStatus === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            className={styles.statusChip}
                            onClick={() => setValue('projectStatus', s)}
                            style={{
                              border: `1.5px solid ${active ? meta.color : '#E5E7EB'}`,
                              background: active ? meta.bg : 'white',
                              color: active ? meta.color : '#6B7280',
                              boxShadow: active ? `0 0 0 2px ${meta.color}20` : 'none',
                            }}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </Fld>

                  {/* Description with preview */}
                  <Fld label="Description">
                    <div className={styles.descWrap}>
                      <textarea
                        rows={3}
                        placeholder="Brief description of the project…"
                        {...register('description')}
                        maxLength={DESC_MAX}
                        className={styles.descTextarea}
                      />
                      {/* <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        {descriptionVal && descriptionVal.length > DESC_PREVIEW ? (
                          <span className={styles.descPreview}>
                            Preview: {descriptionVal.slice(0, DESC_PREVIEW)}…
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className={`${styles.descCounter} ${descriptionVal.length > DESC_MAX * 0.85 ? styles.descCounterWarn : ''}`}>
                          {descriptionVal.length}/{DESC_MAX}
                        </span>
                      </div> */}
                    </div>
                  </Fld>
                </div>
              </div>

              {/* Property Type card */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><Building2 size={13} color="#6B7280" /></span>
                  <span className={styles.sectionTitle}>Property Type</span>
                </div>
                <div className={styles.sectionBody}>
                  <Fld label="Property Type" required error={errors.propertyTypeId?.message}>
                    <Controller
                      name="propertyTypeId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={propertyTypeOptions}
                          value={field.value || null}
                          onChange={val => {
                            field.onChange(val ?? '');
                            setSpecValues({});
                          }}
                          placeholder="Select property type…"
                          searchable
                          searchPlaceholder="Search types…"
                          error={errors.propertyTypeId?.message}
                        />
                      )}
                    />
                  </Fld>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

              {/* Team card — flex: 1 so it stretches to match left column height */}
              <div className={styles.sectionCard} style={{ flex: 1 }}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><Users size={13} color="#3B82F6" /></span>
                  <span className={styles.sectionTitle}>Team & Client</span>
                </div>
                <div className={styles.sectionBody}>
                  {/* Client — full width */}
                  <Fld label="Client" required error={errors.clientId?.message}>
                    <Controller
                      name="clientId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={clientOptions}
                          value={field.value || null}
                          onChange={val => field.onChange(val ?? '')}
                          placeholder={clients.length === 0 ? 'No clients yet' : 'Select a client…'}
                          searchable
                          searchPlaceholder="Search clients…"
                          error={errors.clientId?.message}
                        />
                      )}
                    />
                  </Fld>

                  <Fld label="Manager" required error={errors.managerId?.message}>
                    <Controller
                      name="managerId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={toUserOptions(managerUsers)}
                          value={field.value || null}
                          onChange={val => field.onChange(val ?? '')}
                          placeholder={managerUsers.length === 0 ? 'No managers in org' : 'Select manager…'}
                          searchable
                          searchPlaceholder="Search managers…"
                          error={errors.managerId?.message}
                        />
                      )}
                    />
                  </Fld>

                  <Fld label="QA" required error={errors.qaId?.message}>
                    <Controller
                      name="qaId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={toUserOptions(qaUsers)}
                          value={field.value || null}
                          onChange={val => field.onChange(val ?? '')}
                          placeholder={qaUsers.length === 0 ? 'No QA users in org' : 'Select QA…'}
                          searchable
                          searchPlaceholder="Search QA…"
                          error={errors.qaId?.message}
                        />
                      )}
                    />
                  </Fld>

                  <Fld label="Inspector" required error={errors.inspectorId?.message}>
                    <Controller
                      name="inspectorId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={toUserOptions(inspectorUsers)}
                          value={field.value || null}
                          onChange={val => field.onChange(val ?? '')}
                          placeholder={inspectorUsers.length === 0 ? 'No inspectors in org' : 'Select inspector…'}
                          searchable
                          searchPlaceholder="Search inspectors…"
                          error={errors.inspectorId?.message}
                        />
                      )}
                    />
                  </Fld>

                  <Fld label="Contractor" required error={errors.contractorId?.message}>
                    <Controller
                      name="contractorId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={toUserOptions(contractorUsers)}
                          value={field.value || null}
                          onChange={val => field.onChange(val ?? '')}
                          placeholder={contractorUsers.length === 0 ? 'No contractors in org' : 'Select contractor…'}
                          searchable
                          searchPlaceholder="Search contractors…"
                          error={errors.contractorId?.message}
                        />
                      )}
                    />
                  </Fld>
                </div>
              </div>

            </div>
          </div>

          {/* ── Full-width sections ──────────────────────────────────────── */}
          <div className={styles.fullSections}>

            {/* Property Specifications — full-width, 2-column grid */}
            {selectedPropertyTypeId && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><ClipboardList size={13} color="#3B82F6" /></span>
                  <span className={styles.sectionTitle}>
                    {selectedPropertyType?.name ?? 'Property'} Specifications
                    {(specFields.length + customFields.length) > 0 && (
                      <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                        · {specFields.length + customFields.length} question{specFields.length + customFields.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </div>
                <div className={styles.sectionBody}>

                  {/* All fields + Add Custom button in one grid so button fills empty cell */}
                  <div className={styles.grid2}>
                    {specFields.map(f => {
                      const opts = f.type === 'boolean' ? ['Yes', 'No'] : (f.options ?? []);
                      const isSelect = f.type === 'dropdown' || f.type === 'boolean';
                      return (
                        <Fld key={f.label} label={f.label} required={f.required}>
                          {isSelect ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={`h-10 w-full rounded-md border px-3 flex items-center justify-between text-sm transition-all outline-none data-[state=open]:border-[#3B82F6] data-[state=open]:ring-1 data-[state=open]:ring-[#3B82F6]/20 ${inputCls(false)}`}
                                >
                                  <span className={specValues[f.label] ? 'text-[#263B4F]' : 'text-[#9CA3AF]'}>
                                    {specValues[f.label] || 'Select…'}
                                  </span>
                                  <ChevronDown size={14} className="text-[#9CA3AF] shrink-0" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                style={{ minWidth: 'var(--radix-dropdown-menu-trigger-width)' }}
                                className="bg-white border border-[#E5E7EB] shadow-lg z-[200]"
                              >
                                {opts.map(o => (
                                  <DropdownMenuItem
                                    key={o}
                                    onSelect={() => setSpecValues(prev => ({ ...prev, [f.label]: o }))}
                                    className={specValues[f.label] === o ? 'bg-[#EFF6FF] text-[#3B82F6] font-medium' : ''}
                                  >
                                    {o}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Input
                              type={f.type === 'number' ? 'number' : 'text'}
                              placeholder={`Enter ${f.label.toLowerCase()}…`}
                              value={specValues[f.label] ?? ''}
                              onChange={e => setSpecValues(prev => ({ ...prev, [f.label]: e.target.value }))}
                              className={inputCls(false)}
                            />
                          )}
                        </Fld>
                      );
                    })}

                    {/* Custom fields — in the same grid */}
                    {customFields.map((cf, idx) => (
                      <div key={idx} className={styles.customFieldCard}>
                        <div className={styles.customFieldHeader}>
                          {editingLabelIdx === idx ? (
                            <input
                              autoFocus
                              placeholder="Type question label…"
                              value={cf.label}
                              onChange={e => setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, label: e.target.value } : f))}
                              onBlur={() => setEditingLabelIdx(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingLabelIdx(null)}
                              className={styles.customFieldLabelInput}
                            />
                          ) : (
                            <span className={styles.customFieldLabelText}>
                              {cf.label || <span style={{ color: '#9CA3AF' }}>Unnamed question</span>}
                            </span>
                          )}
                          <div className={styles.customFieldActions}>
                            <button type="button" title="Edit label"
                              onClick={() => setEditingLabelIdx(editingLabelIdx === idx ? null : idx)}
                              className={styles.customFieldActionBtn}><Pencil size={11} /></button>
                            <button type="button" title="Remove"
                              onClick={() => {
                                setCustomFields(prev => prev.filter((_, i) => i !== idx));
                                if (editingLabelIdx === idx) setEditingLabelIdx(null);
                              }}
                              className={`${styles.customFieldActionBtn} ${styles.danger}`}><Trash2 size={11} /></button>
                          </div>
                        </div>
                        <Input
                          placeholder="Enter value…"
                          value={cf.value}
                          onChange={e => setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value: e.target.value } : f))}
                          className={inputCls(false)}
                        />
                      </div>
                    ))}

                    {/* Add Custom Detail — next available grid cell */}
                    <button
                      type="button"
                      className={styles.addCustomBtn}
                      style={{ alignSelf: 'end', minHeight: 42 }}
                      onClick={() => {
                        const newIdx = customFields.length;
                        setCustomFields(prev => [...prev, { label: '', value: '' }]);
                        setEditingLabelIdx(newIdx);
                      }}
                    >
                      <PlusCircle size={14} /> Add Custom Detail
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Address */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionIcon}><MapPin size={13} color="#F97316" /></span>
                <span className={styles.sectionTitle}>Address</span>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.grid2}>
                  <Fld label="Address Line 1">
                    <Input placeholder="Flat / Building no." {...register('addressLine1')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="Address Line 2">
                    <Input placeholder="Area / Colony" {...register('addressLine2')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="Street">
                    <Input placeholder="Street name" {...register('street')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="City / District">
                    <Input placeholder="Mumbai" {...register('city')} className={inputCls(false)} />
                  </Fld>
                </div>
                <div className={styles.grid3}>
                  <Fld label="State">
                    <Input placeholder="Maharashtra" {...register('state')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="Country">
                    <Input placeholder="India" {...register('country')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="Pincode">
                    <Input placeholder="400001" {...register('pincode')} className={inputCls(false)} />
                  </Fld>
                </div>
                <div className={styles.grid2}>
                  <Fld label="Latitude" error={errors.latitude?.message}>
                    <div className="relative">
                      <Navigation style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                      <Input type="number" step="any" placeholder="19.0760" {...register('latitude')} className={inputCls(!!errors.latitude) + ' pl-9'} />
                    </div>
                  </Fld>
                  <Fld label="Longitude" error={errors.longitude?.message}>
                    <div className="relative">
                      <Navigation style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none rotate-90" />
                      <Input type="number" step="any" placeholder="72.8777" {...register('longitude')} className={inputCls(!!errors.longitude) + ' pl-9'} />
                    </div>
                  </Fld>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionIcon}><Calendar size={13} color="#7C3AED" /></span>
                <span className={styles.sectionTitle}>Timeline</span>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.grid2}>
                  <Fld label="Planned Start Date">
                    <Input type="date" {...register('startDatePlanned')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="Actual Start Date">
                    <Input type="date" {...register('startDateActual')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="Estimated End Date">
                    <Input type="date" {...register('estimatedCompletionDate')} className={inputCls(false)} />
                  </Fld>
                  <Fld label="Actual End Date">
                    <Input type="date" {...register('actualCompletionDate')} className={inputCls(false)} />
                  </Fld>
                </div>
              </div>
            </div>

            {/* Financials */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionIcon}><IndianRupee size={13} color="#16A34A" /></span>
                <span className={styles.sectionTitle}>Financials</span>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.grid2}>
                  <Fld label="Total Budget" error={errors.totalBudget?.message}>
                    <div className="relative">
                      <IndianRupee style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                      <Input type="number" step="any" placeholder="0.00" {...register('totalBudget')} className={inputCls(!!errors.totalBudget) + ' pl-9'} />
                    </div>
                  </Fld>
                  <Fld label="Contract Value" error={errors.contractValue?.message}>
                    <div className="relative">
                      <Banknote style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                      <Input type="number" step="any" placeholder="0.00" {...register('contractValue')} className={inputCls(!!errors.contractValue) + ' pl-9'} />
                    </div>
                  </Fld>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate(ROUTES.PROJECTS)}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={14} className={styles.spin} /> Creating…
              </>
            ) : (
              <>
                <FolderOpen size={14} /> Create Project
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectCreate;
