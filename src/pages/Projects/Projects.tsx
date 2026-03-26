import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  FolderOpen, Plus, RefreshCw, Eye, Pencil, Trash2,
  User, Calendar, IndianRupee, MapPin, Loader2,
  ChevronLeft, ChevronRight, AlertTriangle, Users, Building2,
  Banknote, Navigation, ClipboardList, PlusCircle, ChevronDown,
} from 'lucide-react';

import { projectService } from '@/services/projectService';
import { customerService } from '@/services/customerService';
import { userService } from '@/services/userService';
import { organisationService } from '@/services/organisationService';
import type { OrganisationResponse } from '@/services/models/organisation';
import { propertyTypeService, parseSpecFields } from '@/services/propertyTypeService';
import type { PropertyTypeResponse, SpecField } from '@/services/propertyTypeService';
import type { ProjectResponse, ProjectAssignmentInput } from '@/services/models/project';
import type { CustomerResponse } from '@/services/models/customer';
import type { UserResponse } from '@/services/models/user';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Fld, inputCls } from '@/components/shared-ui/form-helpers';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { ROUTES } from '@/components/Constant/Route';
import styles from './Projects.module.css';

const PAGE_SIZE = 12;

const PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
type ProjectStatus = typeof PROJECT_STATUSES[number];

const STATUS_META: Record<ProjectStatus, { label: string; color: string; bg: string; gradient: string }> = {
  PLANNING: { label: 'Planning', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)' },
  IN_PROGRESS: { label: 'In Progress', color: '#33AE95', bg: 'rgba(51,174,149,0.1)', gradient: 'linear-gradient(135deg,#33AE95,#2a9a84)' },
  ON_HOLD: { label: 'On Hold', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  COMPLETED: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', gradient: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', gradient: 'linear-gradient(135deg,#ef4444,#dc2626)' },
};

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  clientId: z.string().min(1, 'Client is required'),
  organisationId: z.string().optional(),
  managerId: z.string().min(1, 'Manager is required'),
  qaId: z.string().min(1, 'QA is required'),
  inspectorId: z.string().min(1, 'Inspector is required'),
  contractorId: z.string().min(1, 'Contractor is required'),
  propertyTypeId: z.string().min(1, 'Property type is required'),
  projectStatus: z.enum(PROJECT_STATUSES),
  description: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  startDatePlanned: z.string().optional(),
  startDateActual: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  actualCompletionDate: z.string().optional(),
  totalBudget: z.string().optional(),
  contractValue: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '', clientId: '', organisationId: '', managerId: '', qaId: '', inspectorId: '', contractorId: '',
  propertyTypeId: '', projectStatus: 'PLANNING',
  description: '', addressLine1: '', addressLine2: '', street: '',
  city: '', state: '', country: '', pincode: '', latitude: '', longitude: '',
  startDatePlanned: '', startDateActual: '',
  estimatedCompletionDate: '', actualCompletionDate: '', totalBudget: '', contractValue: '',
};

const StatusBadge = ({ status }: { status?: string }) => {
  const meta = STATUS_META[status as ProjectStatus] ?? { label: status ?? 'Unknown', color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg,
      border: `1px solid ${meta.color}30`,
    }}>
      {meta.label}
    </span>
  );
};

const fmt = (date?: string) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtMoney = (v?: number) =>
  v != null ? `₹ ${Number(v).toLocaleString('en-IN')}` : '—';

const Projects = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [organisations, setOrganisations] = useState<OrganisationResponse[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeResponse[]>([]);
  // role-id map: lowercase name → roleId
  const [roleMap, setRoleMap] = useState<Record<string, number>>({});
  const [managerUsers, setManagerUsers] = useState<UserResponse[]>([]);
  const [qaUsers, setQaUsers] = useState<UserResponse[]>([]);
  const [inspectorUsers, setInspectorUsers] = useState<UserResponse[]>([]);
  const [contractorUsers, setContractorUsers] = useState<UserResponse[]>([]);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectResponse | null>(null);
  const [viewTarget, setViewTarget] = useState<ProjectResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, reset, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onBlur',
  });

  const selectedStatus = watch('projectStatus');
  const selectedPropertyTypeId = watch('propertyTypeId');
  const selectedOrgId = watch('organisationId');
  const selectedPropertyType = propertyTypes.find(pt => String(pt.id) === selectedPropertyTypeId);
  const specFields: SpecField[] = parseSpecFields(selectedPropertyType?.specTemplate);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchProjects = async (page = currentPage) => {
    setLoading(true);
    try {
      const data = await projectService.listProjects(page, PAGE_SIZE);
      setProjects(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalItems(data.totalElements ?? 0);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(currentPage); }, [currentPage, user?.id]);

  useEffect(() => {
    propertyTypeService.listPropertyTypes().then(setPropertyTypes).catch(() => setPropertyTypes([]));

    if (isSuperAdmin) {
      // Super admin: load orgs list; clients/users loaded after org selection
      organisationService.getOrganisations(0, 200).then(d => setOrganisations(d.content ?? [])).catch(() => { });
    } else {
      // Regular user: load clients + users for their own org
      customerService.listClients(0, 200).then(d => setClients(d.content ?? [])).catch(() => setClients([]));
    }

    // Fetch roles → build name→id map
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

  // When super admin picks an org → reload clients and team dropdowns for that org
  useEffect(() => {
    if (!isSuperAdmin || !selectedOrgId) return;
    customerService.listCustomers(selectedOrgId, 0, 200).then(d => setClients(d.content ?? [])).catch(() => setClients([]));
    const load = (name: string, setter: (u: UserResponse[]) => void) => {
      const id = roleMap[name.toLowerCase()];
      if (id) userService.listUsersByRole(id, selectedOrgId).then(setter).catch(() => setter([]));
    };
    load('manager', setManagerUsers);
    load('qa', setQaUsers);
    load('inspector', setInspectorUsers);
    load('contractor', setContractorUsers);
    // Reset dependent fields when org changes
    setValue('clientId', '');
    setValue('managerId', '');
    setValue('qaId', '');
    setValue('inspectorId', '');
    setValue('contractorId', '');
  }, [selectedOrgId]);

  // ─── Dropdown options ─────────────────────────────────────────────────────

  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.fullName || c.firstName || '',
    meta: c.companyName || undefined,
  }));

  const propertyTypeOptions = propertyTypes.map(pt => ({
    value: String(pt.id),
    label: pt.name,
  }));

  const toUserOptions = (users: UserResponse[]) => users.map(u => ({
    value: u.id,
    label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
    meta: u.email || undefined,
  }));
  const managerOptions = toUserOptions(managerUsers);
  const qaOptions = toUserOptions(qaUsers);
  const inspectorOptions = toUserOptions(inspectorUsers);
  const contractorOptions = toUserOptions(contractorUsers);

  // ─── Form helpers ─────────────────────────────────────────────────────────

  const openCreate = () => navigate(ROUTES.PROJECT_CREATE);

  const openEdit = (p: ProjectResponse) => {
    navigate(`/projects/edit/${p.id}`);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditTarget(null);
    reset(EMPTY);
    setSpecValues({});
    setCustomFields([]);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);

    // Merge template spec values + custom fields into projectSpecs
    const specs: Record<string, string> = {};
    Object.entries(specValues).forEach(([k, v]) => { if (v?.trim()) specs[k] = v.trim(); });
    customFields.forEach(cf => { if (cf.label.trim() && cf.value.trim()) specs[cf.label.trim()] = cf.value.trim(); });

    // Build role-based assignments for QA / Inspector / Contractor
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
      if (editTarget) {
        const updated = await projectService.updateProject(editTarget.id, payload);
        setProjects(prev => prev.map(p => p.id === editTarget.id ? updated : p));
        toast.success('Project updated!');
      } else {
        const created = await projectService.createProject(payload);
        setProjects(prev => [created, ...prev]);
        toast.success('Project created!');
      }
      closeForm();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectService.deleteProject(deleteTarget.id);
      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
      toast.success('Project deleted');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* Page Header */}
      <div className={styles.header}>
        <div>
          {/* <h1 className={styles.title}>Projects</h1> */}
          {/* <p className={styles.subtitle}>{totalItems} project{totalItems !== 1 ? 's' : ''}</p> */}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={() => fetchProjects(currentPage)} title="Refresh">
            <RefreshCw style={{ width: 15, height: 15 }} />
          </button>
          <button className={styles.createBtn} onClick={openCreate}>
            <Plus style={{ width: 15, height: 15 }} />
            New Project
          </button>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className={styles.emptyState}>
          <Loader2 className={styles.spinner} />
          <p>Loading projects…</p>
        </div>
      ) : projects.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><FolderOpen style={{ width: 30, height: 30 }} /></div>
          <p className={styles.emptyTitle}>No projects yet</p>
          <p className={styles.emptySubtitle}>Click "New Project" to create your first project.</p>
        </div>
      ) : (
        <>
          <div className={styles.cardGrid}>
            {projects.map(p => {
              const statusMeta = STATUS_META[p.projectStatus as ProjectStatus]
                ?? { color: '#6B7280', bg: '#F3F4F6', label: p.projectStatus, gradient: 'linear-gradient(135deg,#6B7280,#4B5563)' };
              return (
                <div key={p.id} className={styles.card}>
                  <div className={styles.cardStrip} style={{ background: statusMeta.gradient }} />
                  <div className={styles.cardContent}>
                    {/* Header: Project Name (left) + Status Badge (right) */}
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>{p.name}</h3>
                      <StatusBadge status={p.projectStatus} />
                    </div>

                    {/* Description — truncate at 100 chars */}
                    {p.description && (
                      <p className={styles.cardDesc}>
                        {p.description.length > 100
                          ? <>{p.description.slice(0, 100)}<span className={styles.descMore}>…more</span></>
                          : p.description}
                      </p>
                    )}

                    {/* Two-column split */}
                    <div className={styles.cardSplit}>
                      {/* Left: Client Name + Property Type */}
                      <div className={styles.cardLeft}>
                        {p.clientName && (
                          <div className={styles.infoRow}>
                            <User style={{ width: 12, height: 12, color: '#33AE95', flexShrink: 0 }} />
                            <span>{p.clientName}</span>
                          </div>
                        )}
                        {p.propertyTypeName && (
                          <div className={styles.infoRow}>
                            <Building2 style={{ width: 12, height: 12, color: '#6B7280', flexShrink: 0 }} />
                            <span className={styles.infoMeta}>{p.propertyTypeName}</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Team (Manager, QA, Inspector) */}
                      <div className={styles.cardRight}>
                        <p className={styles.cardTeamLabel}>Team</p>
                        {p.managerName && (
                          <div className={styles.teamRow}>
                            <Users style={{ width: 11, height: 11, color: '#3B82F6', flexShrink: 0 }} />
                            <span className={styles.teamRoleTag}>Mgr</span>
                            <span>{p.managerName}</span>
                          </div>
                        )}
                        {p.assignments?.filter(a => ['qa', 'inspector'].includes(a.roleName?.toLowerCase() ?? '')).map(a => (
                          <div key={a.userId} className={styles.teamRow}>
                            <User style={{ width: 11, height: 11, color: '#6B7280', flexShrink: 0 }} />
                            <span className={styles.teamRoleTag}>{a.roleName?.slice(0, 3)}</span>
                            <span>{a.userName}</span>
                          </div>
                        ))}
                        {!p.managerName && (!p.assignments || p.assignments.filter(a => ['qa', 'inspector'].includes(a.roleName?.toLowerCase() ?? '')).length === 0) && (
                          <span className={styles.teamEmpty}>No team assigned</span>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className={styles.cardFooter}>
                      <button className={styles.viewBtn} onClick={() => navigate(`/projects/${p.id}`)}>
                        <Eye style={{ width: 13, height: 13 }} /> View Details
                      </button>
                      <div className={styles.cardActions}>
                        <button className={styles.iconBtn} onClick={() => openEdit(p)} title="Edit">
                          <Pencil style={{ width: 13, height: 13 }} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.dangerBtn}`} onClick={() => setDeleteTarget(p)} title="Delete">
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalItems)} of {totalItems}
              </span>
              <div className={styles.paginationControls}>
                <button className={styles.pageBtn} disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} className={`${styles.pageBtn} ${i === currentPage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(i)}>
                    {i + 1}
                  </button>
                ))}
                <button className={styles.pageBtn} disabled={currentPage === totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit Modal removed — edit navigates to /projects/edit/:id full page ── */}

      {/* ── View Detail Modal ───────────────────────────────────────────────── */}
      {false && <Dialog open={formOpen} onOpenChange={open => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/15 border border-[#33AE95]/30 flex items-center justify-center">
                <FolderOpen size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">
                {editTarget ? 'Edit Project' : 'New Project'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] text-sm pl-12">
              {editTarget ? 'Update the project details.' : 'Create a new project for a client.'}
            </DialogDescription>
          </DialogHeader>

          {formOpen && (
            <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors.'))}>
              <div className="px-7 py-6 space-y-4">

                {/* Basic Info */}
                <div className={styles.formSection}>
                  <div className={styles.formSectionHead}>
                    <div className={styles.formSectionIcon} style={{ background: '#F0FDF9' }}>
                      <FolderOpen size={13} color="#33AE95" />
                    </div>
                    <span className={styles.formSectionTitle}>Basic Information</span>
                  </div>
                  <div className="space-y-4">
                    <Fld label="Project Name" required error={errors.name?.message}>
                      <Input placeholder="e.g. Site Inspection Phase 1" {...register('name')} className={inputCls(!!errors.name)} />
                    </Fld>

                    {/* Organisation selector — super admin only */}
                    {isSuperAdmin && (
                      <Fld label="Organisation" required error={errors.organisationId?.message}>
                        <Controller
                          name="organisationId"
                          control={control}
                          render={({ field }) => (
                            <DropdownSelect
                              options={organisations.map(o => ({ value: o.uuid, label: o.name, meta: o.parentOrgId ? 'Franchise' : 'Organisation' }))}
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

                    <div className="grid gap-4 sm:grid-cols-2">
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
                              error={errors.clientId?.message}
                            />
                          )}
                        />
                        {clients.length === 0 && (
                          <p className="text-xs text-amber-500 mt-1">No clients yet.</p>
                        )}
                      </Fld>
                      <Fld label="Manager" required error={errors.managerId?.message}>
                        <Controller
                          name="managerId"
                          control={control}
                          render={({ field }) => (
                            <DropdownSelect
                              options={managerOptions}
                              value={field.value || null}
                              onChange={val => field.onChange(val ?? '')}
                              placeholder={managerUsers.length === 0 ? 'No managers in org' : 'Select manager…'}
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
                              options={qaOptions}
                              value={field.value || null}
                              onChange={val => field.onChange(val ?? '')}
                              placeholder={qaUsers.length === 0 ? 'No QA users in org' : 'Select QA…'}
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
                              options={inspectorOptions}
                              value={field.value || null}
                              onChange={val => field.onChange(val ?? '')}
                              placeholder={inspectorUsers.length === 0 ? 'No inspectors in org' : 'Select inspector…'}
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
                              options={contractorOptions}
                              value={field.value || null}
                              onChange={val => field.onChange(val ?? '')}
                              placeholder={contractorUsers.length === 0 ? 'No contractors in org' : 'Select contractor…'}
                              searchable
                              searchPlaceholder="Search contractors…"
                            />
                          )}
                        />
                      </Fld>
                    </div>

                    <Fld label="Status">
                      <div className="flex flex-wrap gap-2 mt-1">
                        {PROJECT_STATUSES.map(s => {
                          const meta = STATUS_META[s];
                          const active = selectedStatus === s;
                          return (
                            <button key={s} type="button" onClick={() => setValue('projectStatus', s)} style={{
                              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              border: `1px solid ${active ? meta.color : '#E5E7EB'}`,
                              background: active ? meta.bg : 'white',
                              color: active ? meta.color : '#6B7280',
                              transition: 'all 0.15s',
                            }}>
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </Fld>

                    <Fld label="Description" hint="Optional">
                      <textarea rows={2} placeholder="Brief description…" {...register('description')}
                        className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none transition-all" />
                    </Fld>
                  </div>
                </div>

                {/* Property Details */}
                <div className={styles.formSection}>
                  <div className={styles.formSectionHead}>
                    <div className={styles.formSectionIcon} style={{ background: '#F0FDF9' }}>
                      <ClipboardList size={13} color="#33AE95" />
                    </div>
                    <span className={styles.formSectionTitle}>Property Details</span>
                  </div>
                  <div className="space-y-4">
                    <Fld label="Property Type" required error={errors.propertyTypeId?.message}>
                      <Controller
                        name="propertyTypeId"
                        control={control}
                        render={({ field }) => (
                          <DropdownSelect
                            options={propertyTypeOptions}
                            value={field.value || null}
                            onChange={(val) => {
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

                    {/* Unified spec + custom fields block */}
                    {selectedPropertyTypeId && (
                      <div className={styles.specsBlock}>
                        {/* Gradient header */}
                        <div className={styles.specsHeader}>
                          <div className={styles.specsHeaderIcon}>
                            <ClipboardList size={14} />
                          </div>
                          <div className={styles.specsHeaderText}>
                            <p className={styles.specsHeaderTitle}>{selectedPropertyType?.name} Details</p>
                            <p className={styles.specsHeaderSub}>
                              {specFields.length + customFields.length} question{specFields.length + customFields.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        <div className={styles.specsBody}>
                          {/* Standard template fields */}
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
                                        className={`h-10 w-full rounded-md border px-3 flex items-center justify-between text-sm transition-all outline-none data-[state=open]:border-[#33AE95] data-[state=open]:ring-1 data-[state=open]:ring-[#33AE95]/20 ${inputCls(false)}`}
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
                                          className={specValues[f.label] === o ? 'bg-[#F0FDF9] text-[#33AE95] font-medium' : ''}
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

                          {/* Separator before custom fields */}
                          {customFields.length > 0 && (
                            <div style={{ borderTop: '1px dashed #D1FAE5', margin: '2px 0' }} />
                          )}

                          {/* Custom fields */}
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
                                  <button
                                    type="button"
                                    title="Edit label"
                                    onClick={() => setEditingLabelIdx(editingLabelIdx === idx ? null : idx)}
                                    className={styles.customFieldActionBtn}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Remove"
                                    onClick={() => {
                                      setCustomFields(prev => prev.filter((_, i) => i !== idx));
                                      if (editingLabelIdx === idx) setEditingLabelIdx(null);
                                    }}
                                    className={`${styles.customFieldActionBtn} ${styles.danger}`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
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

                          {/* Add Custom Detail button */}
                          <button
                            type="button"
                            className={styles.addCustomBtn}
                            onClick={() => {
                              const newIdx = customFields.length;
                              setCustomFields(prev => [...prev, { label: '', value: '' }]);
                              setEditingLabelIdx(newIdx);
                            }}
                          >
                            <PlusCircle size={14} />
                            Add Custom Detail
                          </button>
                        </div>
                      </div>
                    )}
                  </div>{/* closes space-y-4 */}
                </div>{/* closes formSection (Property Details) */}

                {/* Address */}
                <div className={styles.formSection}>
                  <div className={styles.formSectionHead}>
                    <div className={styles.formSectionIcon} style={{ background: '#FFF7ED' }}>
                      <MapPin size={13} color="#F97316" />
                    </div>
                    <span className={styles.formSectionTitle}>Address</span>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Fld label="Address Line 1"><Input placeholder="Flat / Building no." {...register('addressLine1')} className={inputCls(false)} /></Fld>
                      <Fld label="Address Line 2"><Input placeholder="Area / Colony" {...register('addressLine2')} className={inputCls(false)} /></Fld>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Fld label="Street"><Input placeholder="Street name" {...register('street')} className={inputCls(false)} /></Fld>
                      <Fld label="City / District"><Input placeholder="Mumbai" {...register('city')} className={inputCls(false)} /></Fld>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Fld label="State"><Input placeholder="Maharashtra" {...register('state')} className={inputCls(false)} /></Fld>
                      <Fld label="Country"><Input placeholder="India" {...register('country')} className={inputCls(false)} /></Fld>
                      <Fld label="Pincode"><Input placeholder="400001" {...register('pincode')} className={inputCls(false)} /></Fld>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Fld label="Latitude">
                        <div className="relative">
                          <Navigation style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                          <Input type="number" step="any" placeholder="19.0760" {...register('latitude')} className={inputCls(false) + ' pl-9'} />
                        </div>
                      </Fld>
                      <Fld label="Longitude">
                        <div className="relative">
                          <Navigation style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none rotate-90" />
                          <Input type="number" step="any" placeholder="72.8777" {...register('longitude')} className={inputCls(false) + ' pl-9'} />
                        </div>
                      </Fld>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className={styles.formSection}>
                  <div className={styles.formSectionHead}>
                    <div className={styles.formSectionIcon} style={{ background: '#F5F3FF' }}>
                      <Calendar size={13} color="#7C3AED" />
                    </div>
                    <span className={styles.formSectionTitle}>Timeline</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Planned Start Date"><Input type="date" {...register('startDatePlanned')} className={inputCls(false)} /></Fld>
                    <Fld label="Actual Start Date"><Input type="date" {...register('startDateActual')} className={inputCls(false)} /></Fld>
                    <Fld label="Estimated End Date"><Input type="date" {...register('estimatedCompletionDate')} className={inputCls(false)} /></Fld>
                    <Fld label="Actual End Date"><Input type="date" {...register('actualCompletionDate')} className={inputCls(false)} /></Fld>
                  </div>
                </div>

                {/* Financials */}
                <div className={styles.formSection}>
                  <div className={styles.formSectionHead}>
                    <div className={styles.formSectionIcon} style={{ background: '#F0FDF4' }}>
                      <IndianRupee size={13} color="#16A34A" />
                    </div>
                    <span className={styles.formSectionTitle}>Financials</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Total Budget">
                      <div className="relative">
                        <IndianRupee style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        <Input type="number" step="any" placeholder="0.00" {...register('totalBudget')} className={inputCls(false) + ' pl-9'} />
                      </div>
                    </Fld>
                    <Fld label="Contract Value">
                      <div className="relative">
                        <Banknote style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        <Input type="number" step="any" placeholder="0.00" {...register('contractValue')} className={inputCls(false) + ' pl-9'} />
                      </div>
                    </Fld>
                  </div>
                </div>

              </div>

              <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl flex gap-3">
                <Button type="button" variant="ghost" onClick={closeForm} disabled={submitting}
                  className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
                <Button type="submit" disabled={submitting}
                  className="flex-1 sm:flex-none sm:min-w-40 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg">
                  {submitting
                    ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{editTarget ? 'Saving…' : 'Creating…'}</span>
                    : editTarget ? 'Save Changes' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>}

      {/* ── View Detail Modal ───────────────────────────────────────────────── */}
      <Dialog open={!!viewTarget} onOpenChange={open => { if (!open) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0">
          {viewTarget && (() => {
            const hasAddress = [viewTarget.addressLine1, viewTarget.addressLine2, viewTarget.street, viewTarget.city, viewTarget.state, viewTarget.country, viewTarget.pincode].some(Boolean);
            const hasTimeline = [viewTarget.startDatePlanned, viewTarget.startDateActual, viewTarget.estimatedCompletionDate, viewTarget.actualCompletionDate].some(Boolean);
            const hasFinancials = viewTarget.totalBudget != null || viewTarget.contractValue != null;
            const hasSpecs = viewTarget.projectSpecs && Object.keys(viewTarget.projectSpecs).length > 0;
            return (
              <>
                {/* Hero header */}
                <div className={styles.viewHero}>
                  <div className={styles.viewHeroBg} />
                  <div className={styles.viewHeroContent}>
                    <div className={styles.viewHeroIcon}>
                      <FolderOpen size={22} color="white" />
                    </div>
                    <div className={styles.viewHeroMeta}>
                      <DialogTitle className={styles.viewHeroName}>{viewTarget.name}</DialogTitle>
                      <div className={styles.viewHeroRow}>
                        <StatusBadge status={viewTarget.projectStatus} />
                        {viewTarget.propertyTypeName && (
                          <span className={styles.viewHeroPropType}>
                            <Building2 size={10} /> {viewTarget.propertyTypeName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.viewSections}>

                  {/* People */}
                  <div className={styles.viewSection}>
                    <div className={styles.viewSectionHead}>
                      <div className={styles.viewSectionIcon} style={{ background: '#EFF6FF' }}>
                        <Users size={13} color="#3B82F6" />
                      </div>
                      <span className={styles.viewSectionTitle}>People</span>
                    </div>
                    <div className={styles.viewGrid}>
                      <div className={styles.viewField}>
                        <span className={styles.viewFieldLabel}>Client</span>
                        <span className={styles.viewFieldValue}>{viewTarget.clientName ?? '—'}</span>
                      </div>
                      <div className={styles.viewField}>
                        <span className={styles.viewFieldLabel}>Company</span>
                        <span className={styles.viewFieldValue}>{viewTarget.clientCompany ?? '—'}</span>
                      </div>
                      <div className={styles.viewField}>
                        <span className={styles.viewFieldLabel}>Manager</span>
                        <span className={viewTarget.managerName ? styles.viewFieldValue : styles.viewFieldValueMuted}>
                          {viewTarget.managerName ?? 'Unassigned'}
                        </span>
                      </div>
                      <div className={styles.viewField}>
                        <span className={styles.viewFieldLabel}>Organisation</span>
                        <span className={styles.viewFieldValue}>{viewTarget.franchiseName ?? '—'}</span>
                      </div>
                      {viewTarget.description && (
                        <div className={`${styles.viewField} ${styles.viewFieldFull}`}>
                          <span className={styles.viewFieldLabel}>Description</span>
                          <span className={styles.viewFieldValue}>{viewTarget.description}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Property Specs */}
                  {hasSpecs && (
                    <div className={styles.viewSection}>
                      <div className={styles.viewSectionHead}>
                        <div className={styles.viewSectionIcon} style={{ background: '#F0FDF9' }}>
                          <ClipboardList size={13} color="#33AE95" />
                        </div>
                        <span className={styles.viewSectionTitle}>Property Details</span>
                      </div>
                      <div className={styles.viewSpecsBlock}>
                        <div className={styles.viewSpecsHead}>{viewTarget.propertyTypeName ?? 'Specs'}</div>
                        <div className={styles.viewSpecsBody}>
                          {Object.entries(viewTarget.projectSpecs as Record<string, string>).map(([k, v]) => (
                            <div key={k} className={styles.viewSpecRow}>
                              <span className={styles.viewSpecKey}>{k}</span>
                              <span className={styles.viewSpecVal}>{v || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Address */}
                  {hasAddress && (
                    <div className={styles.viewSection}>
                      <div className={styles.viewSectionHead}>
                        <div className={styles.viewSectionIcon} style={{ background: '#FFF7ED' }}>
                          <MapPin size={13} color="#F97316" />
                        </div>
                        <span className={styles.viewSectionTitle}>Address</span>
                      </div>
                      <div className={styles.viewGrid}>
                        {viewTarget.addressLine1 && (
                          <div className={`${styles.viewField} ${styles.viewFieldFull}`}>
                            <span className={styles.viewFieldLabel}>Line 1</span>
                            <span className={styles.viewFieldValue}>{viewTarget.addressLine1}</span>
                          </div>
                        )}
                        {viewTarget.addressLine2 && (
                          <div className={`${styles.viewField} ${styles.viewFieldFull}`}>
                            <span className={styles.viewFieldLabel}>Line 2</span>
                            <span className={styles.viewFieldValue}>{viewTarget.addressLine2}</span>
                          </div>
                        )}
                        {viewTarget.city && (
                          <div className={styles.viewField}>
                            <span className={styles.viewFieldLabel}>City</span>
                            <span className={styles.viewFieldValue}>{viewTarget.city}</span>
                          </div>
                        )}
                        {viewTarget.state && (
                          <div className={styles.viewField}>
                            <span className={styles.viewFieldLabel}>State</span>
                            <span className={styles.viewFieldValue}>{viewTarget.state}</span>
                          </div>
                        )}
                        {viewTarget.country && (
                          <div className={styles.viewField}>
                            <span className={styles.viewFieldLabel}>Country</span>
                            <span className={styles.viewFieldValue}>{viewTarget.country}</span>
                          </div>
                        )}
                        {viewTarget.pincode && (
                          <div className={styles.viewField}>
                            <span className={styles.viewFieldLabel}>Pincode</span>
                            <span className={styles.viewFieldValue}>{viewTarget.pincode}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {hasTimeline && (
                    <div className={styles.viewSection}>
                      <div className={styles.viewSectionHead}>
                        <div className={styles.viewSectionIcon} style={{ background: '#F5F3FF' }}>
                          <Calendar size={13} color="#7C3AED" />
                        </div>
                        <span className={styles.viewSectionTitle}>Timeline</span>
                      </div>
                      <div className={styles.viewGrid}>
                        <div className={styles.viewField}>
                          <span className={styles.viewFieldLabel}>Planned Start</span>
                          <span className={styles.viewFieldValue}>{fmt(viewTarget.startDatePlanned)}</span>
                        </div>
                        <div className={styles.viewField}>
                          <span className={styles.viewFieldLabel}>Actual Start</span>
                          <span className={styles.viewFieldValue}>{fmt(viewTarget.startDateActual)}</span>
                        </div>
                        <div className={styles.viewField}>
                          <span className={styles.viewFieldLabel}>Est. Completion</span>
                          <span className={styles.viewFieldValue}>{fmt(viewTarget.estimatedCompletionDate)}</span>
                        </div>
                        <div className={styles.viewField}>
                          <span className={styles.viewFieldLabel}>Actual Completion</span>
                          <span className={styles.viewFieldValue}>{fmt(viewTarget.actualCompletionDate)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Financials */}
                  {hasFinancials && (
                    <div className={styles.viewSection}>
                      <div className={styles.viewSectionHead}>
                        <div className={styles.viewSectionIcon} style={{ background: '#F0FDF4' }}>
                          <IndianRupee size={13} color="#16A34A" />
                        </div>
                        <span className={styles.viewSectionTitle}>Financials</span>
                      </div>
                      <div className={styles.viewGrid}>
                        {viewTarget.totalBudget != null && (
                          <div className={`${styles.viewFinCard} ${styles.viewFinCardBudget}`}>
                            <span className={styles.viewFinLabel}>Total Budget</span>
                            <span className={`${styles.viewFinAmount} ${styles.viewFinAmountGreen}`}>{fmtMoney(viewTarget.totalBudget)}</span>
                          </div>
                        )}
                        {viewTarget.contractValue != null && (
                          <div className={`${styles.viewFinCard} ${styles.viewFinCardContract}`}>
                            <span className={styles.viewFinLabel}>Contract Value</span>
                            <span className={`${styles.viewFinAmount} ${styles.viewFinAmountBlue}`}>{fmtMoney(viewTarget.contractValue)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className={styles.viewSection} style={{ borderBottom: 'none' }}>
                    <div className={styles.viewFieldLabel} style={{ marginBottom: 4 }}>Created</div>
                    <div className={styles.viewFieldValue}>{fmt(viewTarget.createdAt)}</div>
                  </div>

                </div>

                <DialogFooter className="px-7 py-4 border-t border-[#E5E7EB] flex gap-3">
                  <Button variant="ghost" onClick={() => setViewTarget(null)}
                    className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Close</Button>
                  <Button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                    className="bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold">
                    <Pencil size={14} className="mr-2" /> Edit
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Delete Project</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-12">
              Delete <strong className="text-[#263B4F]">{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-7 py-5 flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting
                ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting…</span>
                : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Projects;
