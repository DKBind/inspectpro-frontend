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
import { userService } from '@/services/userService';
import type { ProjectResponse, ProjectAssignmentInput } from '@/services/models/project';
import type { UserResponse, RoleResponse } from '@/services/models/user';
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
  PLANNING: { label: 'Planning', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  IN_PROGRESS: { label: 'In Progress', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  ON_HOLD: { label: 'On Hold', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  COMPLETED: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(250, 'Max 250 characters'),
  propertyTypeId: z.string().min(1, 'Property type is required'),
  propertySubTypeId: z.string().min(1, 'Property sub type is required'),
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
  name: '', propertyTypeId: '', propertySubTypeId: '',
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

  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeResponse[]>([]);
  const [subTypes, setSubTypes] = useState<any[]>([]);
  const [allOrgUsers, setAllOrgUsers] = useState<UserResponse[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleResponse[]>([]);
  const [dynamicAssignments, setDynamicAssignments] = useState<Array<{ roleId: number; userIds: string[] }>>([]);
  const [extraTimelines, setExtraTimelines] = useState<Array<{ label: string; date: string }>>([]);
  const [extraFinancials, setExtraFinancials] = useState<Array<{ label: string; amount: string }>>([]);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null);
  const [editingMilestoneIdx, setEditingMilestoneIdx] = useState<number | null>(null);
  const [editingFinancialIdx, setEditingFinancialIdx] = useState<number | null>(null);
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
    register, handleSubmit, watch, control, reset, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onBlur',
  });

  const selectedPropertyTypeId = watch('propertyTypeId');
  const selectedSubTypeId = watch('propertySubTypeId');
  const selectedStatus = watch('projectStatus');
  const selectedPropertyType = propertyTypes.find(pt => String(pt.id) === selectedPropertyTypeId);
  const selectedSubType = subTypes.find(st => String(st.id) === selectedSubTypeId);
  const specFields: SpecField[] = parseSpecFields(selectedSubType?.specTemplate);
  const statusMeta = STATUS_META[selectedStatus] ?? STATUS_META['PLANNING'];

  // ── Load project data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setPageLoading(true);

    Promise.all([
      projectService.getProject(id),
      propertyTypeService.listPropertyTypes(),
      userService.listRoles(),
    ]).then(async ([proj, ptypes, rolesData]) => {
      setProject(proj);
      setPropertyTypes(ptypes);
      setAvailableRoles(rolesData);

      // Load sub types for initial property type
      if (proj.propertyTypeId) {
        try {
          const sTypes = await propertyTypeService.listPropertySubTypes(proj.propertyTypeId);
          setSubTypes(sTypes);
        } catch { }
      }

      // Load all org users for assignment dropdowns — try new endpoint, fall back to listUsers
      (proj.organisationId
        ? userService.listUsersForAssignment(proj.organisationId)
        : userService.listUsers(0, 500).then(d => d.users)
      ).then(setAllOrgUsers)
        .catch(() => userService.listUsers(0, 500).then(d => setAllOrgUsers(d.users)).catch(() => { }));

      // Load org-scoped roles if available
      if (proj.organisationId) {
        userService.listRoles(proj.organisationId).then(setAvailableRoles).catch(() => { });
      }

      // Pre-populate dynamic assignments: group flat {roleId, userId} into {roleId, userIds[]}
      const flatAssignments = (proj.assignments ?? []).filter(a => a.roleId != null && a.userId != null);
      const roleMap = new Map<number, string[]>();

      // For backward compat: if project has managerId, inject it first
      if (proj.managerId) {
        const managerRole = rolesData.find(r => r.name.toLowerCase() === 'manager');
        if (managerRole) {
          const alreadyPresent = flatAssignments.some(
            a => a.roleId === managerRole.roleId && a.userId === proj.managerId
          );
          if (!alreadyPresent) {
            flatAssignments.unshift({ roleId: managerRole.roleId, userId: proj.managerId });
          }
        }
      }

      // Group by roleId
      flatAssignments.forEach(a => {
        const existing = roleMap.get(a.roleId!) ?? [];
        if (!existing.includes(a.userId!)) existing.push(a.userId!);
        roleMap.set(a.roleId!, existing);
      });
      const initialAssignments = Array.from(roleMap.entries()).map(([roleId, userIds]) => ({ roleId, userIds }));
      setDynamicAssignments(initialAssignments);

      // Pre-populate form
      reset({
        name: proj.name ?? '',
        propertyTypeId: proj.propertyTypeId ? String(proj.propertyTypeId) : '',
        propertySubTypeId: proj.propertySubTypeId ? String(proj.propertySubTypeId) : '',
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

      // Pre-populate spec values & extra items
      if (proj.projectSpecs) {
        const specs = proj.projectSpecs;
        const sType = subTypes.find(st => st.id === proj.propertySubTypeId);
        const baseFieldLabels = parseSpecFields(sType?.specTemplate).map(f => f.label);

        const t: Array<{ label: string; date: string }> = [];
        const f: Array<{ label: string; amount: string }> = [];
        const c: Array<{ label: string; value: string }> = [];
        const b: Record<string, string> = {};

        Object.entries(specs).forEach(([k, v]) => {
          if (k.startsWith('Timeline: ')) {
            t.push({ label: k.replace('Timeline: ', ''), date: v });
          } else if (k.startsWith('Finance: ')) {
            f.push({ label: k.replace('Finance: ', ''), amount: v });
          } else if (!baseFieldLabels.includes(k)) {
            c.push({ label: k, value: v });
          } else {
            b[k] = v;
          }
        });

        setExtraTimelines(t);
        setExtraFinancials(f);
        setCustomFields(c);
        setSpecValues(b);
      }

    }).catch(e => {
      setLoadError(e.message || 'Failed to load project');
    }).finally(() => setPageLoading(false));
  }, [id, subTypes.length > 0]);

  // Fetch sub types when property type changes
  useEffect(() => {
    if (!selectedPropertyTypeId || pageLoading) return;
    propertyTypeService.listPropertySubTypes(Number(selectedPropertyTypeId))
      .then(setSubTypes)
      .catch(() => setSubTypes([]));
  }, [selectedPropertyTypeId]);

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
    }).catch(() => { }).finally(() => setTemplatesLoading(false));
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

  const propertyTypeOptions = propertyTypes.map(pt => ({ value: String(pt.id), label: pt.name }));
  const toUserOptions = (users: UserResponse[]) => users.map(u => {
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    const label = u.employeeId ? `[${u.employeeId}] ${name}` : name;
    const meta = [u.roleName, u.email].filter(Boolean).join(' · ');
    return { value: u.id, label, meta: meta || undefined };
  });
  const subTypeOptions = subTypes.map(st => ({ value: String(st.id), label: st.name }));
  // Exclude platform-scope and system-generated roles
  const roleOptions = availableRoles
    .filter(r => r.scope !== 'PLATFORM' && !r.isSystemRole)
    .map(r => ({ value: r.roleId, label: r.name }));

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    if (!id) return;

    // Validate Client assignment (required by backend)
    const clientRole = availableRoles.find(r => r.name.toLowerCase() === 'client');
    const hasClient = clientRole && dynamicAssignments.some(a => a.roleId === clientRole.roleId && a.userIds.some(uid => uid));
    if (!hasClient) {
      toast.error('Please assign at least one Client to the project');
      return;
    }

    setSubmitting(true);

    const specs: Record<string, string> = {};
    Object.entries(specValues).forEach(([k, v]) => { if (v?.trim()) specs[k] = v.trim(); });
    customFields.forEach(cf => { if (cf.label.trim() && cf.value.trim()) specs[cf.label.trim()] = cf.value.trim(); });
    extraTimelines.forEach(t => { if (t.label.trim() && t.date) specs[`Timeline: ${t.label.trim()}`] = t.date; });
    extraFinancials.forEach(f => { if (f.label.trim() && f.amount.trim()) specs[`Finance: ${f.label.trim()}`] = f.amount.trim(); });

    const flatAssignments = dynamicAssignments.flatMap(a =>
      a.userIds.filter(uid => uid).map(uid => ({ roleId: a.roleId, userId: uid }))
    );
    const validAssignments = flatAssignments.filter(a => a.roleId && a.userId);
    const managerRole = availableRoles.find(r => r.name.toLowerCase() === 'manager');
    const managerUserId = managerRole
      ? validAssignments.find(a => a.roleId === managerRole.roleId)?.userId
      : undefined;

    const clientUserId = clientRole
      ? validAssignments.find(a => a.roleId === clientRole.roleId)?.userId
      : undefined;

    const assignments: ProjectAssignmentInput[] = validAssignments.map(a => ({ userId: a.userId, roleId: a.roleId }));

    const payload = {
      name: data.name.trim(),
      managerId: managerUserId || undefined,
      clientId: clientUserId || undefined,
      assignments: assignments.length > 0 ? assignments : undefined,
      propertyTypeId: data.propertyTypeId ? Number(data.propertyTypeId) : undefined,
      propertySubTypeId: data.propertySubTypeId ? Number(data.propertySubTypeId) : undefined,
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
                            setValue('propertySubTypeId', '');
                            setSpecValues({});
                          }}
                          placeholder="Select property type…"
                          searchable
                          searchPlaceholder="Search types…"
                        />
                      )}
                    />
                  </Fld>

                  {selectedPropertyTypeId && (
                    <Fld label="Property Sub Type" required error={errors.propertySubTypeId?.message}>
                      <Controller
                        name="propertySubTypeId"
                        control={control}
                        render={({ field }) => (
                          <DropdownSelect
                            options={subTypeOptions}
                            value={field.value || null}
                            onChange={val => {
                              field.onChange(val ?? '');
                              setSpecValues({});
                            }}
                            placeholder="Select sub type…"
                            searchable
                            searchPlaceholder="Search sub types…"
                          />
                        )}
                      />
                    </Fld>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

              {/* Team card */}
              <div className={styles.sectionCard} style={{ flex: 1 }}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><Users size={13} color="#6B7280" /></span>
                  <span className={styles.sectionTitle}>Team Assignments</span>
                </div>
                <div className={styles.sectionBody}>
                  {/* ── Role Assignments Panel ─────────────────────────── */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dynamicAssignments.length > 0 ? 12 : 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={13} color="#6B7280" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                          Role Assignments
                          {dynamicAssignments.length > 0 && (
                            <span style={{ marginLeft: 6, fontWeight: 400, color: '#9CA3AF', fontSize: 11 }}>
                              · {dynamicAssignments.length} {dynamicAssignments.length === 1 ? 'role' : 'roles'}
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDynamicAssignments(prev => [...prev, { roleId: 0, userIds: [] }])}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                          color: '#33AE95', background: 'rgba(51,174,149,0.08)',
                          border: '1px solid rgba(51,174,149,0.3)', borderRadius: 6,
                          cursor: 'pointer', fontWeight: 500, padding: '4px 10px', lineHeight: 1,
                        }}
                      >
                        <PlusCircle size={12} /> Add Role
                      </button>
                    </div>

                    {/* Empty state */}
                    {dynamicAssignments.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                        <Users size={22} color="#D1D5DB" style={{ margin: '0 auto 6px', display: 'block' }} />
                        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                          No role assignments — click <strong style={{ color: '#33AE95' }}>Add Role</strong> to begin.
                        </p>
                      </div>
                    )}

                    {/* Assignment rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {dynamicAssignments.map((row, idx) => {
                        const roleObj = availableRoles.find(r => r.roleId === row.roleId);
                        const isMulti = !roleObj || roleObj.allowMultipleUsers !== false;
                        return (
                          <div key={idx} style={{
                            background: '#fff', border: '1px solid #E5E7EB',
                            borderRadius: 8, padding: '10px 12px',
                          }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              {/* Role selector */}
                              <div style={{ flex: '0 0 175px', minWidth: 0 }}>
                                <DropdownSelect
                                  options={roleOptions}
                                  value={row.roleId || null}
                                  onChange={val => setDynamicAssignments(prev => prev.map((a, i) => i === idx ? { ...a, roleId: Number(val), userIds: [] } : a))}
                                  placeholder="Select role…"
                                  searchable
                                  searchPlaceholder="Search roles…"
                                />
                                {roleObj?.allowMultipleUsers && (
                                  <span style={{ fontSize: 10, color: '#6B7280', marginTop: 2, display: 'block' }}>
                                    Multi-user allowed
                                  </span>
                                )}
                              </div>
                              {/* User multi-select */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {isMulti ? (
                                  <DropdownSelect
                                    multiple={true}
                                    options={toUserOptions(allOrgUsers)}
                                    value={row.userIds as (string | number)[]}
                                    onChange={val => setDynamicAssignments(prev => prev.map((a, i) =>
                                      i === idx ? { ...a, userIds: val as string[] } : a
                                    ))}
                                    placeholder={allOrgUsers.length === 0 ? 'Loading users…' : 'Select one or more users…'}
                                    searchable
                                    searchPlaceholder="Name, employee ID or role…"
                                  />
                                ) : (
                                  <DropdownSelect
                                    options={toUserOptions(allOrgUsers)}
                                    value={row.userIds[0] ?? null}
                                    onChange={val => setDynamicAssignments(prev => prev.map((a, i) =>
                                      i === idx ? { ...a, userIds: val ? [String(val)] : [] } : a
                                    ))}
                                    placeholder={allOrgUsers.length === 0 ? 'Loading users…' : 'Select user…'}
                                    searchable
                                    searchPlaceholder="Name, employee ID or role…"
                                  />
                                )}
                              </div>
                              {/* Remove row */}
                              <button
                                type="button"
                                onClick={() => setDynamicAssignments(prev => prev.filter((_, i) => i !== idx))}
                                style={{ flexShrink: 0, padding: 6, color: '#CBD5E1', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s', marginTop: 2 }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
                                title="Remove"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Full-width sections ──────────────────────────────────────── */}
          <div className={styles.fullSections}>

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
                        {/* <p style={{ margin: 0, fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Layers size={10} />{projectTemplate.sectionCount} section{projectTemplate.sectionCount !== 1 ? 's' : ''}&nbsp;·&nbsp;PROJECT copy
                        </p> */}
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

            {/* Property Specifications */}
            {selectedPropertyTypeId && selectedSubTypeId && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><ClipboardList size={13} color="#6B7280" /></span>
                  <span className={styles.sectionTitle}>
                    {selectedSubType?.name ?? selectedPropertyType?.name ?? 'Property'} Specifications
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
                  <Fld label="District / City">
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

                  {/* Extra milestone entries — in the same grid */}
                  {extraTimelines.map((entry, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5 h-[20px]">
                        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                          {editingMilestoneIdx === i ? (
                            <input
                              autoFocus
                              placeholder="Type milestone…"
                              value={entry.label}
                              onChange={e => setExtraTimelines(prev => prev.map((t, ti) => ti === i ? { ...t, label: e.target.value } : t))}
                              onBlur={() => setEditingMilestoneIdx(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingMilestoneIdx(null)}
                              className="text-xs font-medium text-[#263B4F] bg-transparent border-b border-[#33AE95] outline-none w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setEditingMilestoneIdx(i)}>
                              <label
                                className="text-[#263B4F] text-sm font-medium group-hover:text-[#33AE95] transition-colors truncate cursor-pointer"
                                title="Click to rename"
                              >
                                {entry.label || 'Unnamed Milestone'}
                              </label>
                              <Pencil size={10} className="text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExtraTimelines(prev => prev.filter((_, ti) => ti !== i))}
                          className="text-[#9CA3AF] hover:text-[#EF4444] transition-colors p-1"
                          title="Remove milestone"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <Input
                        type="date"
                        value={entry.date}
                        onChange={e => setExtraTimelines(prev => prev.map((t, ti) => ti === i ? { ...t, date: e.target.value } : t))}
                        className={inputCls(false)}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    className={styles.addCustomBtn}
                    style={{ alignSelf: 'end', minHeight: 42 }}
                    onClick={() => {
                      const newIdx = extraTimelines.length;
                      setExtraTimelines(prev => [...prev, { label: '', date: '' }]);
                      setEditingMilestoneIdx(newIdx);
                    }}
                  >
                    <PlusCircle size={14} /> Add Milestone
                  </button>
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

                  {/* Extra financial entries — in the same grid */}
                  {extraFinancials.map((entry, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5 h-[20px]">
                        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                          {editingFinancialIdx === i ? (
                            <input
                              autoFocus
                              placeholder="Type label…"
                              value={entry.label}
                              onChange={e => setExtraFinancials(prev => prev.map((f, fi) => fi === i ? { ...f, label: e.target.value } : f))}
                              onBlur={() => setEditingFinancialIdx(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingFinancialIdx(null)}
                              className="text-xs font-medium text-[#263B4F] bg-transparent border-b border-[#33AE95] outline-none w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setEditingFinancialIdx(i)}>
                              <label
                                className="text-[#263B4F] text-sm font-medium group-hover:text-[#33AE95] transition-colors truncate cursor-pointer"
                                title="Click to rename"
                              >
                                {entry.label || 'Unnamed Line Item'}
                              </label>
                              <Pencil size={10} className="text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExtraFinancials(prev => prev.filter((_, fi) => fi !== i))}
                          className="text-[#9CA3AF] hover:text-[#EF4444] transition-colors p-1"
                          title="Remove line item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="relative">
                        <IndianRupee style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        <Input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={entry.amount}
                          onChange={e => setExtraFinancials(prev => prev.map((f, fi) => fi === i ? { ...f, amount: e.target.value } : f))}
                          className={inputCls(false) + ' pl-9'}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className={styles.addCustomBtn}
                    style={{ alignSelf: 'end', minHeight: 42 }}
                    onClick={() => {
                      const newIdx = extraFinancials.length;
                      setExtraFinancials(prev => [...prev, { label: '', amount: '' }]);
                      setEditingFinancialIdx(newIdx);
                    }}
                  >
                    <PlusCircle size={14} /> Add Line Item
                  </button>
              </div>
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
