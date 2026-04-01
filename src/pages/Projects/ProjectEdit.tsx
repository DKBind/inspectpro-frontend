import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  ArrowLeft, FolderOpen, ClipboardList, MapPin, Calendar,
  IndianRupee, Loader2, Users, Building2, Navigation,
  Banknote, PlusCircle, Pencil, Trash2, ChevronDown, AlertTriangle,
  Globe, Search, Layers, X, CheckCircle2, RefreshCw,
} from 'lucide-react';

import { projectService } from '@/services/projectService';
import { checklistService } from '@/services/checklistService';
import { customerService } from '@/services/customerService';
import { userService } from '@/services/userService';
import type { ProjectResponse, ProjectAssignmentInput } from '@/services/models/project';
import type { CustomerResponse } from '@/services/models/customer';
import type { UserResponse } from '@/services/models/user';
import type { TemplateResponse } from '@/services/models/checklist';
import { useAuthStore } from '@/store/useAuthStore';
import { propertyTypeService, parseSpecFields } from '@/services/propertyTypeService';
import type { PropertyTypeResponse, SpecField } from '@/services/propertyTypeService';
import { Input } from '@/components/shared-ui/Input/input';
import { Fld, inputCls } from '@/components/shared-ui/form-helpers';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import styles from './ProjectCreate.module.css';
import { ROUTES } from '@/components/Constant/Route';

const positiveNumber = z
  .string()
  .optional()
  .refine((v) => !v || (/^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) >= 0), 'Enter a valid positive number');

const PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PLANNING:    { label: 'Planning',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  IN_PROGRESS: { label: 'In Progress', color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  ON_HOLD:     { label: 'On Hold',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  COMPLETED:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  CANCELLED:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(250, 'Max 250 characters'),
  clientId: z.string().min(1, 'Client is required'),
  managerId: z.string().min(1, 'Manager is required'),
  qaId: z.string().min(1, 'QA is required'),
  inspectorId: z.string().min(1, 'Inspector is required'),
  contractorId: z.string().min(1, 'Contractor is required'),
  propertyTypeId: z.string().min(1, 'Property type is required'),
  projectStatus: z.string().min(1, 'Status is required'),
  description: z.string().max(250, 'Max 250 characters').optional(),
  addressLine1: z.string().max(250).optional(),
  addressLine2: z.string().max(250).optional(),
  street: z.string().max(250).optional(),
  city: z.string().max(250).optional(),
  state: z.string().max(250).optional(),
  country: z.string().max(250).optional(),
  pincode: z.string().max(10).optional(),
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
  name: '', clientId: '', managerId: '', qaId: '',
  inspectorId: '', contractorId: '', propertyTypeId: '',
  projectStatus: 'PLANNING',
  description: '', addressLine1: '', addressLine2: '', street: '',
  city: '', state: '', country: '', pincode: '', latitude: '', longitude: '',
  startDatePlanned: '', startDateActual: '',
  estimatedCompletionDate: '', actualCompletionDate: '',
  totalBudget: '', contractValue: '',
};

const ProjectEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuthStore(); // keep store subscription without unused var

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // ── Template state ───────────────────────────────────────────────────────
  const [pickerTemplates, setPickerTemplates] = useState<TemplateResponse[]>([]);
  const [projectTemplate, setProjectTemplate] = useState<TemplateResponse | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState<TemplateResponse | null>(null);
  const [tplSearch, setTplSearch] = useState('');
  const [tplDropdownOpen, setTplDropdownOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const tplDropdownRef = useRef<HTMLDivElement>(null);

  const {
    register, handleSubmit, watch, control, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onBlur',
  });

  const selectedPropertyTypeId = watch('propertyTypeId');
  const selectedStatus = watch('projectStatus');
  const selectedPropertyType = propertyTypes.find(pt => String(pt.id) === selectedPropertyTypeId);
  const specFields: SpecField[] = parseSpecFields(selectedPropertyType?.specTemplate);
  const statusMeta = STATUS_META[selectedStatus] ?? STATUS_META['PLANNING'];

  // ── Load project data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setPageLoading(true);

    Promise.all([
      projectService.getProject(id),
      propertyTypeService.listPropertyTypes(),
      customerService.listClients(0, 500),
      userService.listRoles(),
    ]).then(([proj, ptypes, clientsData, rolesData]) => {
      setProject(proj);
      setPropertyTypes(ptypes);
      setClients(clientsData.content ?? []);

      const map: Record<string, number> = {};
      rolesData.forEach(r => { map[r.name.toLowerCase()] = r.roleId; });
      setRoleMap(map);

      // Load role-based users
      const loadUsers = (name: string, setter: (u: UserResponse[]) => void) => {
        const rid = map[name.toLowerCase()];
        if (rid) userService.listUsersByRole(rid, proj.organisationId).then(setter).catch(() => setter([]));
      };
      loadUsers('manager', setManagerUsers);
      loadUsers('qa', setQaUsers);
      loadUsers('inspector', setInspectorUsers);
      loadUsers('contractor', setContractorUsers);

      // Find assignments
      const qaUser = proj.assignments?.find(a => a.roleName?.toLowerCase() === 'qa');
      const inspUser = proj.assignments?.find(a => a.roleName?.toLowerCase() === 'inspector');
      const conUser = proj.assignments?.find(a => a.roleName?.toLowerCase() === 'contractor');

      // Pre-populate form
      reset({
        name: proj.name ?? '',
        clientId: proj.clientId ?? '',
        managerId: proj.managerId ?? '',
        qaId: qaUser?.userId ?? '',
        inspectorId: inspUser?.userId ?? '',
        contractorId: conUser?.userId ?? '',
        propertyTypeId: proj.propertyTypeId ? String(proj.propertyTypeId) : '',
        projectStatus: proj.projectStatus ?? 'PLANNING',
        description: proj.description ?? '',
        addressLine1: proj.addressLine1 ?? '',
        addressLine2: proj.addressLine2 ?? '',
        street: proj.street ?? '',
        city: proj.city ?? '',
        state: proj.state ?? '',
        country: proj.country ?? '',
        pincode: proj.pincode ?? '',
        latitude: proj.latitude != null ? String(proj.latitude) : '',
        longitude: proj.longitude != null ? String(proj.longitude) : '',
        startDatePlanned: proj.startDatePlanned?.split('T')[0] ?? '',
        startDateActual: proj.startDateActual?.split('T')[0] ?? '',
        estimatedCompletionDate: proj.estimatedCompletionDate?.split('T')[0] ?? '',
        actualCompletionDate: proj.actualCompletionDate?.split('T')[0] ?? '',
        totalBudget: proj.totalBudget != null ? String(proj.totalBudget) : '',
        contractValue: proj.contractValue != null ? String(proj.contractValue) : '',
      });

      // Pre-populate spec values
      if (proj.projectSpecs) setSpecValues(proj.projectSpecs);

    }).catch(e => {
      setLoadError(e.message || 'Failed to load project');
    }).finally(() => setPageLoading(false));
  }, [id]);

  // ── Template loading ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setTemplatesLoading(true);
    Promise.all([
      checklistService.getPickerTemplates(),
      checklistService.listProjectTemplates(id),
    ]).then(([picker, projTpls]) => {
      setPickerTemplates(picker.filter(t => t.id !== null && t.scope !== 'SCRATCH'));
      if (projTpls.length > 0) setProjectTemplate(projTpls[0]);
    }).catch(() => {}).finally(() => setTemplatesLoading(false));
  }, [id]);

  // Close template dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tplDropdownRef.current && !tplDropdownRef.current.contains(e.target as Node))
        setTplDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredTpls = tplSearch.trim()
    ? pickerTemplates.filter(t => t.title.toLowerCase().includes(tplSearch.toLowerCase()))
    : pickerTemplates;

  const handleAssignTemplate = async () => {
    if (!selectedTpl?.id || !id) return;
    setAssigning(true);
    try {
      const cloned = await checklistService.cloneTemplateToProject(selectedTpl.id, id);
      toast.success('Template assigned! Customise it in the builder.');
      setShowPicker(false);
      navigate(`/templates/${cloned.projectTemplateId}/builder?back=/projects/${id}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to assign template');
    } finally {
      setAssigning(false);
    }
  };

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

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    if (!id) return;
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
      await projectService.updateProject(id, payload);
      toast.success('Project updated!');
      navigate(`/projects/${id}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error states ───────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <Loader2 size={32} className={styles.spin} color="#3B82F6" />
        <p style={{ color: '#64748B', fontSize: 14 }}>Loading project…</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <AlertTriangle size={32} color="#EF4444" />
        <p style={{ color: '#EF4444', fontSize: 14 }}>{loadError ?? 'Project not found'}</p>
        <button className={styles.backBtn} onClick={() => navigate(ROUTES.PROJECTS)} style={{ marginTop: 8 }}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(`/projects/${id}`)}>
          <ArrowLeft size={14} /> Back to Project
        </button>
      </div>

      {/* Hero header — matches ProjectDetail style */}
      <div className={styles.pageHeader} style={{ borderTopColor: statusMeta.color }}>
        <div className={styles.pageHeaderIcon} style={{ background: statusMeta.bg }}>
          <FolderOpen size={26} color={statusMeta.color} />
        </div>
        <div className={styles.pageHeaderText}>
          <h1>{project.name}</h1>
          <div className={styles.pageHeaderMeta}>
            <span className={styles.planningBadge} style={{
              background: `${statusMeta.color}14`,
              color: statusMeta.color,
              borderColor: `${statusMeta.color}40`,
            }}>
              <span className={styles.planningDot} style={{ background: statusMeta.color }} />
              {statusMeta.label}
            </span>
            {project.propertyTypeName && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6, background: '#F1F5F9',
                border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 500, color: '#64748B',
              }}>
                <Building2 size={11} /> {project.propertyTypeName}
              </span>
            )}
          </div>
          <p>Update the project details below and save your changes.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.body}>

          {/* ── Two-column area ─────────────────────────────────────────── */}
          <div className={styles.twoCol}>

            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Basic Info card */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><FolderOpen size={13} color="#6B7280" /></span>
                  <span className={styles.sectionTitle}>Project Info</span>
                </div>
                <div className={styles.sectionBody}>

                  {/* Status selector */}
                  <Fld label="Status" required error={errors.projectStatus?.message}>
                    <Controller
                      name="projectStatus"
                      control={control}
                      render={({ field }) => (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={`h-10 w-full rounded-md border px-3 flex items-center justify-between text-sm transition-all outline-none ${inputCls(!!errors.projectStatus)}`}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[field.value]?.color ?? '#64748B', flexShrink: 0 }} />
                                {STATUS_META[field.value]?.label ?? field.value}
                              </span>
                              <ChevronDown size={14} className="text-[#9CA3AF] shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" style={{ minWidth: 'var(--radix-dropdown-menu-trigger-width)' }} className="bg-white border border-[#E5E7EB] shadow-lg z-[200]">
                            {PROJECT_STATUSES.map(s => (
                              <DropdownMenuItem
                                key={s}
                                onSelect={() => field.onChange(s)}
                                className={field.value === s ? 'bg-[#EFF6FF] font-medium' : ''}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[s]?.color, flexShrink: 0 }} />
                                  {STATUS_META[s]?.label}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    />
                  </Fld>

                  <Fld label="Project Name" required error={errors.name?.message}>
                    <Input
                      placeholder="e.g. Site Inspection Phase 1"
                      {...register('name')}
                      className={inputCls(!!errors.name)}
                    />
                  </Fld>

                  <Fld label="Description">
                    <div className={styles.descWrap}>
                      <textarea
                        rows={3}
                        placeholder="Brief description of the project…"
                        {...register('description')}
                        maxLength={300}
                        className={styles.descTextarea}
                      />
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
                        />
                      )}
                    />
                  </Fld>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

              {/* Team card */}
              <div className={styles.sectionCard} style={{ flex: 1 }}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><Users size={13} color="#6B7280" /></span>
                  <span className={styles.sectionTitle}>Team & Client</span>
                </div>
                <div className={styles.sectionBody}>
                  <Fld label="Client" required error={errors.clientId?.message}>
                    <Controller
                      name="clientId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={clientOptions}
                          value={field.value || null}
                          onChange={val => field.onChange(val ?? '')}
                          placeholder="Select a client…"
                          searchable
                          searchPlaceholder="Search clients…"
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
                          placeholder="Select manager…"
                          searchable
                          searchPlaceholder="Search managers…"
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
                          placeholder="Select QA…"
                          searchable
                          searchPlaceholder="Search QA…"
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
                          placeholder="Select inspector…"
                          searchable
                          searchPlaceholder="Search inspectors…"
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
                          placeholder="Select contractor…"
                          searchable
                          searchPlaceholder="Search contractors…"
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

            {/* Property Specifications */}
            {selectedPropertyTypeId && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><ClipboardList size={13} color="#6B7280" /></span>
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
                              <DropdownMenuContent align="start" style={{ minWidth: 'var(--radix-dropdown-menu-trigger-width)' }} className="bg-white border border-[#E5E7EB] shadow-lg z-[200]">
                                {opts.map(o => (
                                  <DropdownMenuItem key={o} onSelect={() => setSpecValues(prev => ({ ...prev, [f.label]: o }))} className={specValues[f.label] === o ? 'bg-[#EFF6FF] text-[#3B82F6] font-medium' : ''}>
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
                              onClick={() => { setCustomFields(prev => prev.filter((_, i) => i !== idx)); if (editingLabelIdx === idx) setEditingLabelIdx(null); }}
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
                <span className={styles.sectionIcon}><MapPin size={13} color="#6B7280" /></span>
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
                <span className={styles.sectionIcon}><Calendar size={13} color="#6B7280" /></span>
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
                <span className={styles.sectionIcon}><IndianRupee size={13} color="#6B7280" /></span>
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

            {/* ── Inspection Template Management ──────────────────────────── */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionIcon}><ClipboardList size={13} color="#33AE95" /></span>
                <span className={styles.sectionTitle}>Inspection Template</span>
              </div>
              <div className={styles.sectionBody}>
                {templatesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13 }}>
                    <Loader2 size={14} className={styles.spin} /> Loading…
                  </div>
                ) : projectTemplate && !showPicker ? (
                  /* Template already assigned */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <CheckCircle2 size={18} color="#33AE95" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectTemplate.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Layers size={10} />{projectTemplate.sectionCount} section{projectTemplate.sectionCount !== 1 ? 's' : ''}&nbsp;·&nbsp;PROJECT copy
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, borderColor: '#33AE95', color: '#33AE95' }}
                        onClick={() => navigate(`/templates/${projectTemplate.id}/builder?back=/projects/${id}`)}
                      >
                        <Pencil size={11} /> Edit Template
                      </button>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        onClick={() => { setShowPicker(true); setSelectedTpl(null); setTplSearch(''); }}
                      >
                        <RefreshCw size={11} /> Re-assign
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Picker — no template yet, or re-assigning */
                  <div>
                    {showPicker && projectTemplate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 12, fontSize: 12, color: '#92400E' }}>
                        <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0 }} />
                        A template is already assigned. Re-assigning will create a new copy.
                        <button type="button" onClick={() => setShowPicker(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#64748B' }}>
                          <X size={11} /> Cancel
                        </button>
                      </div>
                    )}
                    <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#64748B' }}>
                      {projectTemplate ? 'Select a new master template to assign:' : 'No template assigned. Select a master template:'}
                    </p>
                    {/* Searchable dropdown */}
                    <div className={styles.tplDropdownWrap} ref={tplDropdownRef}>
                      <div className={styles.tplDropdownTrigger} onClick={() => setTplDropdownOpen(o => !o)}>
                        <Search size={13} className={styles.tplSearchIcon} />
                        <input
                          className={styles.tplSearchInput}
                          placeholder={selectedTpl ? selectedTpl.title : 'Search templates…'}
                          value={tplSearch}
                          onChange={e => { setTplSearch(e.target.value); setTplDropdownOpen(true); setSelectedTpl(null); }}
                          onFocus={() => setTplDropdownOpen(true)}
                        />
                        {selectedTpl
                          ? <button type="button" className={styles.tplClearBtn} onClick={e => { e.stopPropagation(); setSelectedTpl(null); setTplSearch(''); }}><X size={11} /></button>
                          : <ChevronDown size={13} className={`${styles.tplChevron} ${tplDropdownOpen ? styles.tplChevronOpen : ''}`} />}
                      </div>
                      {tplDropdownOpen && (
                        <div className={styles.tplDropdown}>
                          {filteredTpls.length === 0
                            ? <div className={styles.tplDropdownEmpty}>No templates found</div>
                            : filteredTpls.map(t => (
                              <button key={t.id} type="button" className={styles.tplDropdownItem} onClick={() => { setSelectedTpl(t); setTplSearch(''); setTplDropdownOpen(false); }}>
                                <Globe size={12} style={{ flexShrink: 0, color: '#9CA3AF' }} />
                                <span className={styles.tplDropdownName}>{t.title}</span>
                                <span className={styles.tplDropdownScope}>{t.scope}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    {selectedTpl && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className={styles.tplMapBtn}
                          disabled={assigning}
                          onClick={handleAssignTemplate}
                        >
                          {assigning ? <><Loader2 size={13} className={styles.spin} /> Assigning…</> : <><ClipboardList size={13} /> Assign Template</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate(`/projects/${id}`)}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={submitting}>
            {submitting
              ? <><Loader2 size={14} className={styles.spin} /> Saving…</>
              : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectEdit;
