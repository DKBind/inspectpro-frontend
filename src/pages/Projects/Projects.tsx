import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  FolderOpen, Plus, RefreshCw, Eye, Pencil, Trash2,
  User, Calendar, IndianRupee, MapPin, Loader2,
  ChevronLeft, ChevronRight, AlertTriangle, Users, Building2,
  Banknote, Navigation, ClipboardList, PlusCircle, X,
} from 'lucide-react';

import { projectService } from '@/services/projectService';
import { customerService } from '@/services/customerService';
import { userService } from '@/services/userService';
import { propertyTypeService, parseSpecFields } from '@/services/propertyTypeService';
import type { PropertyTypeResponse, SpecField } from '@/services/propertyTypeService';
import type { ProjectResponse } from '@/services/models/project';
import type { CustomerResponse } from '@/services/models/customer';
import type { UserResponse } from '@/services/models/user';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import { Input } from '@/components/shared-ui/Input/input';
import { Fld, ViewRow, inputCls } from '@/components/shared-ui/form-helpers';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
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
  managerId: z.string().optional(),
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
  name: '', clientId: '', managerId: '', propertyTypeId: '', projectStatus: 'PLANNING',
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

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [managers, setManagers] = useState<UserResponse[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeResponse[]>([]);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
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
    customerService.listClients(0, 200).then(d => setClients(d.content ?? [])).catch(() => setClients([]));
    userService.listUsers(0, 200).then(d => setManagers(d.users ?? [])).catch(() => setManagers([]));
    propertyTypeService.listPropertyTypes().then(setPropertyTypes).catch(() => setPropertyTypes([]));
  }, [user?.id]);

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

  const managerOptions = managers.map(m => ({
    value: m.id,
    label: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim(),
    meta: m.email || undefined,
  }));

  // ─── Form helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    reset(EMPTY);
    setSpecValues({});
    setCustomFields([]);
    setFormOpen(true);
  };;

  const openEdit = (p: ProjectResponse) => {
    setEditTarget(p);

    // Populate spec values from saved projectSpecs
    if (p.projectSpecs && typeof p.projectSpecs === 'object') {
      const templateKeys = new Set<string>(
        parseSpecFields(p.specTemplate as SpecField[] | string | undefined).map(f => f.label)
      );
      const sv: Record<string, string> = {};
      const cf: Array<{ label: string; value: string }> = [];
      Object.entries(p.projectSpecs as Record<string, string>).forEach(([k, v]) => {
        if (templateKeys.has(k)) sv[k] = v;
        else cf.push({ label: k, value: v });
      });
      setSpecValues(sv);
      setCustomFields(cf);
    } else {
      setSpecValues({});
      setCustomFields([]);
    }

    reset({
      name: p.name ?? '',
      clientId: p.clientId ?? '',
      managerId: p.managerId ?? '',
      propertyTypeId: p.propertyTypeId != null ? String(p.propertyTypeId) : '',
      projectStatus: (p.projectStatus as ProjectStatus) ?? 'PLANNING',
      description: p.description ?? '',
      addressLine1: p.addressLine1 ?? '',
      addressLine2: p.addressLine2 ?? '',
      street: p.street ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      country: p.country ?? '',
      pincode: p.pincode ?? '',
      latitude: p.latitude != null ? String(p.latitude) : '',
      longitude: p.longitude != null ? String(p.longitude) : '',
      startDatePlanned: p.startDatePlanned ? p.startDatePlanned.slice(0, 10) : '',
      startDateActual: p.startDateActual ? p.startDateActual.slice(0, 10) : '',
      estimatedCompletionDate: p.estimatedCompletionDate ? p.estimatedCompletionDate.slice(0, 10) : '',
      actualCompletionDate: p.actualCompletionDate ? p.actualCompletionDate.slice(0, 10) : '',
      totalBudget: p.totalBudget != null ? String(p.totalBudget) : '',
      contractValue: p.contractValue != null ? String(p.contractValue) : '',
    });
    setFormOpen(true);
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

    const payload = {
      name: data.name.trim(),
      clientId: data.clientId,
      managerId: data.managerId || undefined,
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
          <h1 className={styles.title}>Projects</h1>
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
                    {/* Header */}
                    <div className={styles.cardHead}>
                      <div className={styles.cardIconWrap} style={{ background: statusMeta.gradient }}>
                        <FolderOpen style={{ width: 16, height: 16 }} />
                      </div>
                      <div className={styles.cardHeadText}>
                        <h3 className={styles.cardTitle}>{p.name}</h3>
                        {p.clientCompany && (
                          <p className={styles.cardCompany}>
                            <Building2 style={{ width: 11, height: 11 }} />
                            {p.clientCompany}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={p.projectStatus} />
                    </div>

                    {p.description && <p className={styles.cardDesc}>{p.description}</p>}

                    {/* Info rows */}
                    <div className={styles.cardInfo}>
                      {p.clientName && (
                        <div className={styles.infoRow}>
                          <User style={{ width: 13, height: 13, color: '#33AE95', flexShrink: 0 }} />
                          <span>{p.clientName}</span>
                        </div>
                      )}
                      <div className={styles.infoRow}>
                        <Users style={{ width: 13, height: 13, color: '#6B7280', flexShrink: 0 }} />
                        <span style={{ color: p.managerName ? '#263B4F' : '#9CA3AF' }}>
                          {p.managerName ?? 'No manager assigned'}
                        </span>
                      </div>
                      {(p.city || p.state) && (
                        <div className={styles.infoRow}>
                          <MapPin style={{ width: 13, height: 13, color: '#6B7280', flexShrink: 0 }} />
                          <span>{[p.city, p.state].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                      {p.startDatePlanned && (
                        <div className={styles.infoRow}>
                          <Calendar style={{ width: 13, height: 13, color: '#6B7280', flexShrink: 0 }} />
                          <span>{fmt(p.startDatePlanned)}</span>
                        </div>
                      )}
                    </div>

                    {/* Budget strip */}
                    {(p.totalBudget != null || p.contractValue != null) && (
                      <div className={styles.budgetRow}>
                        {p.totalBudget != null && (
                          <div className={styles.budgetItem}>
                            <span className={styles.budgetLabel}>Budget</span>
                            <span className={styles.budgetVal}>
                              <IndianRupee style={{ width: 11, height: 11 }} />
                              {Number(p.totalBudget).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                        {p.contractValue != null && (
                          <div className={styles.budgetItem}>
                            <span className={styles.budgetLabel}>Contract</span>
                            <span className={styles.budgetVal}>
                              <IndianRupee style={{ width: 11, height: 11 }} />
                              {Number(p.contractValue).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className={styles.cardFooter}>
                      <button className={styles.viewBtn} onClick={() => setViewTarget(p)}>
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

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={open => { if (!open) closeForm(); }}>
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
              <div className="px-7 py-6 space-y-6">

                {/* Basic Info */}
                <div className="space-y-4">
                  <p className={styles.sectionLabel}>Basic Information</p>

                  <Fld label="Project Name" required error={errors.name?.message}>
                    <Input placeholder="e.g. Site Inspection Phase 1" {...register('name')} className={inputCls(!!errors.name)} />
                  </Fld>

                  {/* Client */}
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
                      <p className="text-xs text-amber-500 mt-1">No clients yet. Add clients first.</p>
                    )}
                  </Fld>

                  {/* Manager */}
                  <Fld label="Manager" hint="Optional">
                    <Controller
                      name="managerId"
                      control={control}
                      render={({ field }) => (
                        <DropdownSelect
                          options={managerOptions}
                          value={field.value || null}
                          onChange={val => field.onChange(val ?? '')}
                          placeholder="Unassigned"
                          searchable
                          searchPlaceholder="Search managers…"
                        />
                      )}
                    />
                  </Fld>

                  {/* Status */}
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
                      className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none" />
                  </Fld>
                </div>

                {/* Property Details */}
                <div className="space-y-4">
                  <p className={styles.sectionLabel}>
                    <span className="flex items-center gap-2">
                      <ClipboardList size={13} className="text-[#33AE95]" />
                      Property Details
                    </span>
                  </p>

                  {/* Property Type selector */}
                  <Fld label="Property Type" hint="Required">
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
                        />
                      )}
                    />
                  </Fld>

                  {/* Dynamic spec fields from template */}
                  {specFields.length > 0 && (
                    <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                        {selectedPropertyType?.name} Details
                      </p>
                      {specFields.map(f => (
                        <Fld key={f.label} label={f.label}>
                          {f.type === 'dropdown' ? (
                            <select
                              value={specValues[f.label] ?? ''}
                              onChange={e => setSpecValues(prev => ({ ...prev, [f.label]: e.target.value }))}
                              className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#263B4F] focus:border-[#33AE95] focus:outline-none focus:ring-1 focus:ring-[#33AE95]/20"
                            >
                              <option value="">Select…</option>
                              {f.options?.map(o => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          ) : f.type === 'boolean' ? (
                            <select
                              value={specValues[f.label] ?? ''}
                              onChange={e => setSpecValues(prev => ({ ...prev, [f.label]: e.target.value }))}
                              className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#263B4F] focus:border-[#33AE95] focus:outline-none focus:ring-1 focus:ring-[#33AE95]/20"
                            >
                              <option value="">Select…</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          ) : (
                            <input
                              type={f.type === 'number' ? 'number' : 'text'}
                              placeholder={`Enter ${f.label.toLowerCase()}…`}
                              value={specValues[f.label] ?? ''}
                              onChange={e => setSpecValues(prev => ({ ...prev, [f.label]: e.target.value }))}
                              className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:outline-none focus:ring-1 focus:ring-[#33AE95]/20"
                            />
                          )}
                        </Fld>
                      ))}
                    </div>
                  )}

                  {/* Custom fields */}
                  <div className="space-y-2">
                    {customFields.map((cf, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          placeholder="Label…"
                          value={cf.label}
                          onChange={e => setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, label: e.target.value } : f))}
                          className="flex-1 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:outline-none focus:ring-1 focus:ring-[#33AE95]/20"
                        />
                        <input
                          placeholder="Value…"
                          value={cf.value}
                          onChange={e => setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value: e.target.value } : f))}
                          className="flex-1 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:outline-none focus:ring-1 focus:ring-[#33AE95]/20"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomFields(prev => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 rounded-md p-2 text-[#9CA3AF] transition-colors hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomFields(prev => [...prev, { label: '', value: '' }])}
                      className="flex items-center gap-2 text-sm font-semibold text-[#33AE95] transition-colors hover:text-[#2a9a84]"
                    >
                      <PlusCircle size={14} />
                      Add Custom Detail
                    </button>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <p className={styles.sectionLabel}>Address</p>
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
                <div>
                  <p className={styles.sectionLabel}>Timeline</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Planned Start Date"><Input type="date" {...register('startDatePlanned')} className={inputCls(false)} /></Fld>
                    <Fld label="Actual Start Date"><Input type="date" {...register('startDateActual')} className={inputCls(false)} /></Fld>
                    <Fld label="Estimated End Date"><Input type="date" {...register('estimatedCompletionDate')} className={inputCls(false)} /></Fld>
                    <Fld label="Actual End Date"><Input type="date" {...register('actualCompletionDate')} className={inputCls(false)} /></Fld>
                  </div>
                </div>

                {/* Financials */}
                <div>
                  <p className={styles.sectionLabel}>Financials</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fld label="Total Budget" hint="₹">
                      <div className="relative">
                        <IndianRupee style={{ width: 13, height: 13 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        <Input type="number" step="any" placeholder="0.00" {...register('totalBudget')} className={inputCls(false) + ' pl-9'} />
                      </div>
                    </Fld>
                    <Fld label="Contract Value" hint="₹">
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
      </Dialog>

      {/* ── View Detail Modal ───────────────────────────────────────────────── */}
      <Dialog open={!!viewTarget} onOpenChange={open => { if (!open) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/15 border border-[#33AE95]/30 flex items-center justify-center">
                <FolderOpen size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Project Details</DialogTitle>
            </div>
            {viewTarget && <div className="pl-12"><StatusBadge status={viewTarget.projectStatus} /></div>}
          </DialogHeader>

          {viewTarget && (
            <div className="px-7 py-5 space-y-0">
              <ViewRow label="Name" value={viewTarget.name} />
              <ViewRow label="Description" value={viewTarget.description ?? '—'} />
              <ViewRow label="Client" value={viewTarget.clientName ?? '—'} />
              <ViewRow label="Company" value={viewTarget.clientCompany ?? '—'} />
              <ViewRow label="Organisation" value={viewTarget.franchiseName ?? '—'} />
              <ViewRow label="Manager" value={viewTarget.managerName ?? 'Unassigned'} />
              <ViewRow label="Manager Email" value={viewTarget.managerEmail ?? '—'} />
              <ViewRow label="Property Type" value={viewTarget.propertyTypeName ?? '—'} />
              {viewTarget.projectSpecs && Object.keys(viewTarget.projectSpecs).length > 0 && (
                <div className="py-3 border-b border-[#F3F4F6]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Property Specs</p>
                  {Object.entries(viewTarget.projectSpecs as Record<string, string>).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 text-sm">
                      <span className="text-[#6B7280]">{k}</span>
                      <span className="font-medium text-[#263B4F]">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              <ViewRow label="Location" value={[viewTarget.city, viewTarget.state, viewTarget.country].filter(Boolean).join(', ') || '—'} />
              <ViewRow label="Pincode" value={viewTarget.pincode ?? '—'} />
              <ViewRow label="Planned Start" value={fmt(viewTarget.startDatePlanned)} />
              <ViewRow label="Actual Start" value={fmt(viewTarget.startDateActual)} />
              <ViewRow label="Est. End Date" value={fmt(viewTarget.estimatedCompletionDate)} />
              <ViewRow label="Actual End" value={fmt(viewTarget.actualCompletionDate)} />
              <ViewRow label="Budget" value={fmtMoney(viewTarget.totalBudget)} />
              <ViewRow label="Contract Value" value={fmtMoney(viewTarget.contractValue)} />
              <ViewRow label="Created" value={fmt(viewTarget.createdAt)} />
            </div>
          )}

          <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] flex gap-3">
            <Button variant="ghost" onClick={() => setViewTarget(null)}
              className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Close</Button>
            {viewTarget && (
              <Button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                className="bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold">
                <Pencil size={14} className="mr-2" /> Edit
              </Button>
            )}
          </DialogFooter>
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
