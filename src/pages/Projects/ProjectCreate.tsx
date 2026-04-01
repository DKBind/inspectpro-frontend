import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  ArrowLeft, FolderOpen, ClipboardList, MapPin, Calendar,
  IndianRupee, Loader2, Users, Building2, Navigation,
  Banknote, PlusCircle, Pencil, Trash2, ChevronDown,
  Globe, Search, Layers, X,
} from 'lucide-react';

import { projectService } from '@/services/projectService';
import { checklistService } from '@/services/checklistService';
import type { TemplateResponse } from '@/services/models/checklist';
import { customerService } from '@/services/customerService';
import { userService } from '@/services/userService';
import { organisationService } from '@/services/organisationService';
import type { OrganisationResponse } from '@/services/models/organisation';
import { propertyTypeService, parseSpecFields } from '@/services/propertyTypeService';
import type { PropertyTypeResponse, SpecField } from '@/services/propertyTypeService';
import type { ProjectAssignmentInput } from '@/services/models/project';
import type { CustomerResponse } from '@/services/models/customer';
import type { UserResponse, RoleResponse } from '@/services/models/user';
import { useAuthStore } from '@/store/useAuthStore';
import { Input } from '@/components/shared-ui/Input/input';
import { Fld, inputCls } from '@/components/shared-ui/form-helpers';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { ROUTES } from '@/components/Constant/Route';
import styles from './ProjectCreate.module.css';


const positiveNumber = z
  .string()
  .optional()
  .refine((v) => !v || (/^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) >= 0), 'Enter a valid positive number');

const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(250, 'Max 250 characters'),
  clientId: z.string().min(1, 'Client is required'),
  organisationId: z.string().optional(),
  propertyTypeId: z.string().min(1, 'Property type is required'),
  description: z.string().max(250, 'Max 250 characters').optional(),
  addressLine1: z.string().min(1, 'Address is required').max(250, 'Max 250 characters'),
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
  name: '', clientId: '', organisationId: '', propertyTypeId: '',
  description: '', addressLine1: '', addressLine2: '', street: '',
  city: '', state: '', country: '', pincode: '', latitude: '', longitude: '',
  startDatePlanned: '', startDateActual: '',
  estimatedCompletionDate: '', actualCompletionDate: '',
  totalBudget: '', contractValue: '',
};


const ProjectCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

  // 'organisation' = project belongs to an org, 'franchise' = project belongs to a franchise
  const [projectFor, setProjectFor] = useState<'organisation' | 'franchise'>('organisation');
  // Super-admin franchise flow: pick the parent org first, then pick the franchise
  const [franchiseOrgId, setFranchiseOrgId] = useState('');

  const [topLevelOrgs, setTopLevelOrgs] = useState<OrganisationResponse[]>([]);
  const [franchises, setFranchises] = useState<OrganisationResponse[]>([]);
  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeResponse[]>([]);
  const [allOrgUsers, setAllOrgUsers] = useState<UserResponse[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleResponse[]>([]);
  const [dynamicAssignments, setDynamicAssignments] = useState<Array<{ roleId: number; userId: string }>>([]);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tplError, setTplError] = useState('');

  // ── Template picker state ────────────────────────────────────────────────
  const [pickerTemplates, setPickerTemplates] = useState<TemplateResponse[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<TemplateResponse | null>(null);
  const [tplSearch, setTplSearch] = useState('');
  const [tplDropdownOpen, setTplDropdownOpen] = useState(false);
  const tplDropdownRef = useRef<HTMLDivElement>(null);

  const {
    register, handleSubmit, watch, setValue, control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onBlur',
  });

  const selectedPropertyTypeId = watch('propertyTypeId');
  const selectedOrgId = watch('organisationId'); // final target UUID (org or franchise)
  const selectedPropertyType = propertyTypes.find(pt => String(pt.id) === selectedPropertyTypeId);
  const specFields: SpecField[] = parseSpecFields(selectedPropertyType?.specTemplate);


  // ── Close template dropdown on outside click ────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tplDropdownRef.current && !tplDropdownRef.current.contains(e.target as Node))
        setTplDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    propertyTypeService.listPropertyTypes().then(setPropertyTypes).catch(() => { });
    checklistService.getPickerTemplates()
      .then(tpls => setPickerTemplates(tpls.filter(t => t.id !== null && t.scope !== 'SCRATCH')))
      .catch(() => { });

    // Load top-level orgs for super admin org/franchise picker
    if (isSuperAdmin) {
      organisationService.getOrganisations(0, 500)
        .then(d => setTopLevelOrgs((d.content ?? []).filter(o => !o.parentOrgId)))
        .catch(() => { });
    }

    // Org admin: load their own franchises up front
    if (!isSuperAdmin && user?.orgId) {
      organisationService.getFranchises(0, 500, user.orgId)
        .then(d => setFranchises(d.content ?? []))
        .catch(() => { });
    }

    // Load clients scoped to caller's org
    customerService.listClients(0, 500)
      .then(d => setClients(d.content ?? []))
      .catch(() => setClients([]));

    userService.listRoles().then(setAvailableRoles).catch(() => { });

    if (!isSuperAdmin) {
      userService.listUsers(0, 500).then(d => setAllOrgUsers(d.users)).catch(() => { });
    }
  }, [user?.id]);

  // Super admin: load franchises when parent org is selected in franchise mode
  useEffect(() => {
    if (!isSuperAdmin || !franchiseOrgId) { setFranchises([]); return; }
    organisationService.getFranchises(0, 500, franchiseOrgId)
      .then(d => setFranchises(d.content ?? []))
      .catch(() => setFranchises([]));
  }, [franchiseOrgId]);

  // Reload clients + users whenever the target entity (org or franchise UUID) changes.
  // Fires for super admin always, and for org admin when they pick a franchise.
  useEffect(() => {
    if (!selectedOrgId) return;
    if (!isSuperAdmin && projectFor !== 'franchise') return;

    customerService.listCustomers(selectedOrgId, 0, 500)
      .then(d => {
        const items = d.content ?? (Array.isArray(d) ? (d as CustomerResponse[]) : []);
        if (items.length > 0) setClients(items);
      })
      .catch(() => { });

    userService.listUsersForAssignment(selectedOrgId)
      .then(setAllOrgUsers)
      .catch(() => userService.listUsers(0, 500).then(d => setAllOrgUsers(d.users)).catch(() => {}));

    setValue('clientId', '');
    setDynamicAssignments([]);
  }, [selectedOrgId]);

  // When org admin switches back to 'organisation' mode, reload their own org's data
  useEffect(() => {
    if (isSuperAdmin || projectFor !== 'organisation') return;
    customerService.listClients(0, 500).then(d => setClients(d.content ?? [])).catch(() => { });
    userService.listUsers(0, 500).then(d => setAllOrgUsers(d.users)).catch(() => {});
    setValue('organisationId', '');
    setValue('clientId', '');
    setDynamicAssignments([]);
  }, [projectFor]);

  // ── Options ─────────────────────────────────────────────────────────────
  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.fullName || c.firstName || '',
    meta: c.companyName || undefined,
  }));
  const propertyTypeOptions = propertyTypes.map(pt => ({ value: String(pt.id), label: pt.name }));
  const toUserOptions = (users: UserResponse[]) => users.map(u => {
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    const label = u.employeeId ? `[${u.employeeId}] ${name}` : name;
    const meta = [u.roleName, u.email].filter(Boolean).join(' · ');
    return { value: u.id, label, meta: meta || undefined };
  });
  const roleOptions = availableRoles.map(r => ({ value: r.roleId, label: r.name }));
  const topLevelOrgOptions = topLevelOrgs.map(o => ({ value: o.uuid, label: o.name }));
  const franchiseOptions = franchises.map(o => ({ value: o.uuid, label: o.name }));
  const filteredTpls = tplSearch.trim()
    ? pickerTemplates.filter(t => t.title.toLowerCase().includes(tplSearch.toLowerCase()))
    : pickerTemplates;
  const tplTotalItems = (selectedTpl?.sections ?? []).reduce((s, sec) => s + (sec.items?.length ?? 0), 0);

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    // Validate template selection
    if (!selectedTpl) {
      setTplError('Please select an inspection template');
      return;
    }
    setTplError('');

    // Validate all spec fields are filled
    const missingSpecs = specFields.filter(f => !specValues[f.label]?.trim());
    if (missingSpecs.length > 0) {
      toast.error(`Please fill in all specifications: ${missingSpecs.map(f => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);

    const specs: Record<string, string> = {};
    Object.entries(specValues).forEach(([k, v]) => { if (v?.trim()) specs[k] = v.trim(); });
    customFields.forEach(cf => { if (cf.label.trim() && cf.value.trim()) specs[cf.label.trim()] = cf.value.trim(); });

    const validAssignments = dynamicAssignments.filter(a => a.roleId && a.userId);
    const managerRole = availableRoles.find(r => r.name.toLowerCase() === 'manager');
    const managerUserId = managerRole
      ? validAssignments.find(a => a.roleId === managerRole.roleId)?.userId
      : undefined;
    const assignments: ProjectAssignmentInput[] = validAssignments.map(a => ({ userId: a.userId, roleId: a.roleId }));

    const payload = {
      name: data.name.trim(),
      clientId: data.clientId,
      managerId: managerUserId || undefined,
      organisationId: isSuperAdmin && data.organisationId ? data.organisationId : undefined,
      assignments: assignments.length > 0 ? assignments : undefined,
      propertyTypeId: data.propertyTypeId ? Number(data.propertyTypeId) : undefined,
      projectSpecs: Object.keys(specs).length > 0 ? specs : undefined,
      projectStatus: 'PLANNING' as const,
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
      try {
        const cloned = await checklistService.cloneTemplateToProject(selectedTpl.id!, created.id!);
        toast.success('Project created! Customize your template, then create the inspection.');
        navigate(`/templates/${cloned.projectTemplateId}/builder?back=/projects/${created.id}`);
      } catch {
        toast.success('Project created!');
        toast.error('Template assignment failed — assign it from the project page');
        navigate(`/projects/${created.id}`);
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to create project');
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

      {/* Page header — hero card matching ProjectDetail style */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon}>
          <FolderOpen size={26} color="#33AE95" />
        </div>
        <div className={styles.pageHeaderText}>
          <h1>New Project</h1>
          <div className={styles.pageHeaderMeta}>
            <span className={styles.planningBadge}>
              <span className={styles.planningDot} />
              Planning
            </span>
          </div>
          <p>Fill in the details below to create a new project.</p>
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

                  {/* Create For toggle */}
                  <Fld label="Create For">
                    <div className={styles.forToggle}>
                      {(['organisation', 'franchise'] as const).map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`${styles.forToggleBtn} ${projectFor === opt ? styles.forToggleBtnActive : ''}`}
                          onClick={() => {
                            setProjectFor(opt);
                            setFranchiseOrgId('');
                            setValue('organisationId', '');
                          }}
                        >
                          {opt === 'organisation' ? <Building2 size={13} /> : <Users size={13} />}
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </Fld>

                  {/* Super admin: org picker (org mode) or org→franchise pickers (franchise mode) */}
                  {isSuperAdmin && projectFor === 'organisation' && (
                    <Fld label="Organisation" required error={errors.organisationId?.message}>
                      <Controller
                        name="organisationId"
                        control={control}
                        render={({ field }) => (
                          <DropdownSelect
                            options={topLevelOrgOptions}
                            value={field.value || null}
                            onChange={val => field.onChange(val ?? '')}
                            placeholder="Select organisation…"
                            searchable
                            searchPlaceholder="Search organisations…"
                          />
                        )}
                      />
                    </Fld>
                  )}

                  {isSuperAdmin && projectFor === 'franchise' && (
                    <>
                      <Fld label="Organisation" required>
                        <DropdownSelect
                          options={topLevelOrgOptions}
                          value={franchiseOrgId || null}
                          onChange={val => {
                            setFranchiseOrgId(String(val ?? ''));
                            setValue('organisationId', '');
                            setValue('clientId', '');
                          }}
                          placeholder="Select parent organisation…"
                          searchable
                          searchPlaceholder="Search organisations…"
                        />
                      </Fld>
                      <Fld label="Franchise" required error={errors.organisationId?.message}>
                        <Controller
                          name="organisationId"
                          control={control}
                          render={({ field }) => (
                            <DropdownSelect
                              options={franchiseOptions}
                              value={field.value || null}
                              onChange={val => field.onChange(val ?? '')}
                              placeholder={franchiseOrgId ? 'Select franchise…' : 'Select organisation first…'}
                              searchable
                              searchPlaceholder="Search franchises…"
                              error={errors.organisationId?.message}
                            />
                          )}
                        />
                      </Fld>
                    </>
                  )}

                  {/* Org admin: franchise picker (franchise mode only) */}
                  {!isSuperAdmin && projectFor === 'franchise' && (
                    <Fld label="Franchise" required error={errors.organisationId?.message}>
                      <Controller
                        name="organisationId"
                        control={control}
                        render={({ field }) => (
                          <DropdownSelect
                            options={franchiseOptions}
                            value={field.value || null}
                            onChange={val => field.onChange(val ?? '')}
                            placeholder={franchises.length === 0 ? 'No franchises found' : 'Select franchise…'}
                            searchable
                            searchPlaceholder="Search franchises…"
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
                    />
                  </Fld>

                  {/* Description with preview */}
                  <Fld label="Description">
                    <div className={styles.descWrap}>
                      <textarea
                        rows={3}
                        placeholder="Brief description of the project…"
                        {...register('description')}
                        maxLength={300}
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
                  <span className={styles.sectionIcon}><Users size={13} color="#6B7280" /></span>
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
                        />
                      )}
                    />
                  </Fld>

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
                              · {dynamicAssignments.length} {dynamicAssignments.length === 1 ? 'entry' : 'entries'}
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDynamicAssignments(prev => [...prev, { roleId: 0, userId: '' }])}
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
                          No role assignments yet — click <strong style={{ color: '#33AE95' }}>Add Role</strong> to begin.
                        </p>
                      </div>
                    )}

                    {/* Assignment rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {dynamicAssignments.map((row, idx) => (
                        <div key={idx} style={{
                          display: 'flex', gap: 8, alignItems: 'center',
                          background: '#fff', border: '1px solid #E5E7EB',
                          borderRadius: 8, padding: '8px 10px',
                        }}>
                          {/* Role selector — wider */}
                          <div style={{ flex: '0 0 175px', minWidth: 0 }}>
                            <DropdownSelect
                              options={roleOptions}
                              value={row.roleId || null}
                              onChange={val => setDynamicAssignments(prev => prev.map((a, i) => i === idx ? { ...a, roleId: Number(val) } : a))}
                              placeholder="Select role…"
                              searchable
                              searchPlaceholder="Search roles…"
                            />
                          </div>
                          {/* User selector — remaining space */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <DropdownSelect
                              options={toUserOptions(allOrgUsers)}
                              value={row.userId || null}
                              onChange={val => setDynamicAssignments(prev => prev.map((a, i) => i === idx ? { ...a, userId: String(val ?? '') } : a))}
                              placeholder={allOrgUsers.length === 0 ? 'Loading users…' : 'Search name / employee ID…'}
                              searchable
                              searchPlaceholder="Name, employee ID or role…"
                            />
                          </div>
                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => setDynamicAssignments(prev => prev.filter((_, i) => i !== idx))}
                            style={{ flexShrink: 0, padding: 6, color: '#CBD5E1', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
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

                  {/* All fields + Add Custom button in one grid so button fills empty cell */}
                  <div className={styles.grid2}>
                    {specFields.map(f => {
                      const opts = f.type === 'boolean' ? ['Yes', 'No'] : (f.options ?? []);
                      const isSelect = f.type === 'dropdown' || f.type === 'boolean';
                      return (
                        <Fld key={f.label} label={f.label} required>
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
                <span className={styles.sectionIcon}><MapPin size={13} color="#6B7280" /></span>
                <span className={styles.sectionTitle}>Address</span>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.grid2}>
                  <Fld label="Address Line 1" required error={errors.addressLine1?.message}>
                    <Input placeholder="Flat / Building no." {...register('addressLine1')} className={inputCls(!!errors.addressLine1)} />
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

            {/* Inspection Template (required) */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionIcon}><ClipboardList size={13} color="#33AE95" /></span>
                <span className={styles.sectionTitle}>
                  Inspection Template <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>
                </span>
              </div>
              <div className={styles.sectionBody}>
                <p className={styles.tplPickerHint}>
                  Select a master template to assign it when the project is created.
                  A unique project copy will be created — the master stays unchanged.
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
                    {selectedTpl ? (
                      <button
                        type="button"
                        className={styles.tplClearBtn}
                        onClick={e => { e.stopPropagation(); setSelectedTpl(null); setTplSearch(''); }}
                        title="Clear selection"
                      >
                        <X size={12} />
                      </button>
                    ) : (
                      <ChevronDown size={13} className={`${styles.tplChevron} ${tplDropdownOpen ? styles.tplChevronOpen : ''}`} />
                    )}
                  </div>
                  {tplDropdownOpen && (
                    <div className={styles.tplDropdown}>
                      {filteredTpls.length === 0 ? (
                        <div className={styles.tplDropdownEmpty}>No templates found</div>
                      ) : filteredTpls.map(t => (
                        <button key={t.id} type="button" className={styles.tplDropdownItem} onClick={() => {
                          setSelectedTpl(t); setTplSearch(''); setTplDropdownOpen(false); setTplError('');
                        }}>
                          <Globe size={12} style={{ flexShrink: 0, color: '#9CA3AF' }} />
                          <span className={styles.tplDropdownName}>{t.title}</span>
                          <span className={styles.tplDropdownScope}>{t.scope}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {tplError && (
                  <p style={{ margin: 0, fontSize: 12, color: '#EF4444' }}>{tplError}</p>
                )}

                {/* Preview card */}
                {selectedTpl && (
                  <div className={styles.tplPreviewCard}>
                    <div className={styles.tplPreviewRow}>
                      <div className={styles.tplPreviewIcon}><Globe size={15} color="#33AE95" /></div>
                      <div>
                        <p className={styles.tplPreviewTitle}>{selectedTpl.title}</p>
                        {selectedTpl.description && <p className={styles.tplPreviewDesc}>{selectedTpl.description}</p>}
                      </div>
                    </div>
                    <div className={styles.tplPreviewStats}>
                      <span><Layers size={11} />{selectedTpl.sectionCount} sections</span>
                      <span><ClipboardList size={11} />{tplTotalItems} items</span>
                      <span><Globe size={11} />{selectedTpl.scope}</span>
                    </div>
                    <div className={styles.tplPreviewAction}>
                      <button
                        type="submit"
                        className={styles.tplMapBtn}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <><Loader2 size={13} className={styles.spin} /> Mapping…</>
                        ) : (
                          <><ClipboardList size={13} /> Map Standard Template</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
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
                <Loader2 size={14} className={styles.spin} /> {selectedTpl ? 'Creating & Assigning…' : 'Creating…'}
              </>
            ) : (
              <>
                <FolderOpen size={14} /> {selectedTpl ? 'Create Project & Assign Template' : 'Create Project'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectCreate;
