import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  FolderOpen, Plus, RefreshCw, Eye, Pencil, Trash2,
  User, Calendar, IndianRupee, MapPin, Loader2,
  ChevronLeft, ChevronRight, AlertTriangle, Users,
} from 'lucide-react';

import { projectService } from '@/services/projectService';
import { customerService } from '@/services/customerService';
import { userService } from '@/services/userService';
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
import styles from './Projects.module.css';

const PAGE_SIZE = 10;

const PROJECT_STATUSES = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
type ProjectStatus = typeof PROJECT_STATUSES[number];

const STATUS_META: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  PLANNING:   { label: 'Planning',     color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  IN_PROGRESS:{ label: 'In Progress',  color: '#33AE95', bg: 'rgba(51,174,149,0.1)' },
  ON_HOLD:    { label: 'On Hold',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  COMPLETED:  { label: 'Completed',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  CANCELLED:  { label: 'Cancelled',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  clientId: z.string().min(1, 'Client is required'),
  managerId: z.string().optional(),
  projectStatus: z.enum(PROJECT_STATUSES),
  description: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  startDatePlanned: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  totalBudget: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '', clientId: '', managerId: '', projectStatus: 'PLANNING',
  description: '', city: '', state: '', startDatePlanned: '', estimatedCompletionDate: '', totalBudget: '',
};

const Projects = () => {
  const { user } = useAuthStore();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [clients, setClients] = useState<CustomerResponse[]>([]);
  const [managers, setManagers] = useState<UserResponse[]>([]);
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

  const { register, reset, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const selectedStatus = watch('projectStatus');

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

  const fetchClients = async () => {
    try {
      const data = await customerService.listClients(0, 200);
      setClients(data.content ?? []);
    } catch { setClients([]); }
  };

  const fetchManagers = async () => {
    try {
      const data = await userService.listUsers(0, 200);
      setManagers(data.users ?? []);
    } catch { setManagers([]); }
  };

  useEffect(() => { fetchProjects(currentPage); }, [currentPage, user?.id]);
  useEffect(() => { fetchClients(); fetchManagers(); }, [user?.id]);

  // ─── Open forms ───────────────────────────────────────────────────────────

  const openCreate = () => { setEditTarget(null); reset(EMPTY); setFormOpen(true); };

  const openEdit = (p: ProjectResponse) => {
    setEditTarget(p);
    reset({
      name: p.name ?? '',
      clientId: p.clientId ?? '',
      managerId: p.managerId ?? '',
      projectStatus: (p.projectStatus as ProjectStatus) ?? 'PLANNING',
      description: p.description ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      startDatePlanned: p.startDatePlanned ? p.startDatePlanned.slice(0, 10) : '',
      estimatedCompletionDate: p.estimatedCompletionDate ? p.estimatedCompletionDate.slice(0, 10) : '',
      totalBudget: p.totalBudget != null ? String(p.totalBudget) : '',
    });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditTarget(null); reset(EMPTY); };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    const payload = {
      name: data.name.trim(),
      clientId: data.clientId,
      managerId: data.managerId || undefined,
      projectStatus: data.projectStatus,
      description: data.description?.trim() || undefined,
      city: data.city?.trim() || undefined,
      state: data.state?.trim() || undefined,
      startDatePlanned: data.startDatePlanned || undefined,
      estimatedCompletionDate: data.estimatedCompletionDate || undefined,
      totalBudget: data.totalBudget ? parseFloat(data.totalBudget) : undefined,
    };
    try {
      if (editTarget) {
        const updated = await projectService.updateProject(editTarget.id, payload);
        setProjects((prev) => prev.map((p) => p.id === editTarget.id ? updated : p));
        toast.success('Project updated!');
      } else {
        const created = await projectService.createProject(payload);
        setProjects((prev) => [created, ...prev]);
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
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success('Project deleted');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const StatusBadge = ({ status }: { status?: string }) => {
    const meta = STATUS_META[status as ProjectStatus] ?? { label: status ?? 'Unknown', color: '#6B7280', bg: '#F3F4F6' };
    return (
      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}30` }}>
        {meta.label}
      </span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.subtitle}>{totalItems} project{totalItems !== 1 ? 's' : ''} total</p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <Plus style={{ width: 15, height: 15 }} />
          New Project
        </button>
      </div>

      {/* Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <FolderOpen style={{ width: 16, height: 16, color: '#33AE95' }} />
            All Projects
          </div>
          <button className={styles.refreshBtn} onClick={() => fetchProjects(currentPage)} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.spinner} />
              <p>Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><FolderOpen style={{ width: 28, height: 28 }} /></div>
              <p className={styles.emptyTitle}>No projects yet</p>
              <p className={styles.emptySubtitle}>Click "New Project" to create your first project.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Manager</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className={styles.row}>
                      <td>
                        <div className={styles.projectCell}>
                          <div className={styles.projectIcon}>
                            <FolderOpen style={{ width: 14, height: 14 }} />
                          </div>
                          <div>
                            <p className={styles.projectName}>{p.name}</p>
                            {p.city && <p className={styles.projectMeta}><MapPin style={{ width: 10, height: 10, display: 'inline', marginRight: 2 }} />{p.city}{p.state ? `, ${p.state}` : ''}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={styles.muted}>
                        {p.clientName
                          ? <span className={styles.inlineRow}><User style={{ width: 12, height: 12 }} />{p.clientName}</span>
                          : '—'}
                      </td>
                      <td className={styles.muted}>
                        {p.managerName
                          ? <span className={styles.inlineRow}><Users style={{ width: 12, height: 12 }} />{p.managerName}</span>
                          : <span style={{ color: '#D1D5DB' }}>Unassigned</span>}
                      </td>
                      <td><StatusBadge status={p.projectStatus} /></td>
                      <td className={styles.muted}>
                        {p.startDatePlanned
                          ? <span className={styles.inlineRow}><Calendar style={{ width: 12, height: 12 }} />{new Date(p.startDatePlanned).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          : '—'}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.actionBtn} onClick={() => setViewTarget(p)} title="View"><Eye size={14} /></button>
                          <button className={styles.actionBtn} onClick={() => openEdit(p)} title="Edit"><Pencil size={14} /></button>
                          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => setDeleteTarget(p)} title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationInfo}>
                    Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalItems)} of {totalItems}
                  </span>
                  <div className={styles.paginationControls}>
                    <button className={styles.pageBtn} disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft size={14} /></button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button key={i} className={`${styles.pageBtn} ${i === currentPage ? styles.pageBtnActive : ''}`} onClick={() => setCurrentPage(i)}>{i + 1}</button>
                    ))}
                    <button className={styles.pageBtn} disabled={currentPage === totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
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

          <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors.'))}>
            <div className="px-7 py-6 space-y-5">

              {/* Basic Info */}
              <Fld label="Project Name" required error={errors.name?.message}>
                <Input placeholder="e.g. Site Inspection Phase 1" {...register('name')} className={inputCls(!!errors.name)} />
              </Fld>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Client */}
                <Fld label="Client" required error={errors.clientId?.message}>
                  <select {...register('clientId')} className={inputCls(!!errors.clientId) + ' h-10 appearance-none'}>
                    <option value="">— Select Client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName || c.firstName}{c.companyName ? ` (${c.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1">No clients yet. Add clients first.</p>
                  )}
                </Fld>

                {/* Manager */}
                <Fld label="Manager" hint="Optional">
                  <select {...register('managerId')} className={inputCls(false) + ' h-10 appearance-none'}>
                    <option value="">— Unassigned —</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} {m.email ? `(${m.email})` : ''}
                      </option>
                    ))}
                  </select>
                </Fld>
              </div>

              {/* Status */}
              <Fld label="Status">
                <div className="flex flex-wrap gap-2 mt-1">
                  {PROJECT_STATUSES.map((s) => {
                    const meta = STATUS_META[s];
                    const active = selectedStatus === s;
                    return (
                      <button key={s} type="button" onClick={() => setValue('projectStatus', s)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${active ? meta.color : '#E5E7EB'}`,
                          background: active ? meta.bg : 'white',
                          color: active ? meta.color : '#6B7280',
                          transition: 'all 0.15s', cursor: 'pointer',
                        }}>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </Fld>

              {/* Description */}
              <Fld label="Description" hint="Optional">
                <textarea rows={2} placeholder="Brief description of the project..." {...register('description')}
                  className="w-full rounded-md bg-white border border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#33AE95] focus:ring-1 focus:ring-[#33AE95]/20 text-sm px-3 py-2 resize-none outline-none" />
              </Fld>

              {/* Location */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="City" hint="Optional">
                  <Input placeholder="Mumbai" {...register('city')} className={inputCls(false)} />
                </Fld>
                <Fld label="State" hint="Optional">
                  <Input placeholder="Maharashtra" {...register('state')} className={inputCls(false)} />
                </Fld>
              </div>

              {/* Timeline */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Fld label="Start Date" hint="Planned">
                  <Input type="date" {...register('startDatePlanned')} className={inputCls(false)} />
                </Fld>
                <Fld label="End Date" hint="Estimated">
                  <Input type="date" {...register('estimatedCompletionDate')} className={inputCls(false)} />
                </Fld>
              </div>

              {/* Budget */}
              <Fld label="Total Budget" hint="Optional (₹)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
                    <IndianRupee size={14} />
                  </span>
                  <Input placeholder="0.00" {...register('totalBudget')} className={inputCls(false) + ' pl-9'} />
                </div>
              </Fld>

            </div>

            <DialogFooter className="px-7 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl flex gap-3">
              <Button type="button" variant="ghost" onClick={closeForm} disabled={submitting}
                className="text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]">Cancel</Button>
              <Button type="submit" disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-40 bg-[#33AE95] hover:bg-[#2a9a84] text-white font-semibold shadow-lg">
                {submitting
                  ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{editTarget ? 'Saving...' : 'Creating...'}</span>
                  : editTarget ? 'Save Changes' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-xl rounded-2xl p-0">
          <DialogHeader className="px-7 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-[#33AE95]/15 border border-[#33AE95]/30 flex items-center justify-center">
                <FolderOpen size={18} className="text-[#33AE95]" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#263B4F]">Project Details</DialogTitle>
            </div>
            {viewTarget && <StatusBadge status={viewTarget.projectStatus} />}
          </DialogHeader>
          {viewTarget && (
            <div className="px-7 py-5 space-y-0">
              <ViewRow label="Name" value={viewTarget.name} />
              <ViewRow label="Client" value={viewTarget.clientName ?? '—'} />
              <ViewRow label="Company" value={viewTarget.clientCompany ?? '—'} />
              <ViewRow label="Manager" value={viewTarget.managerName ?? 'Unassigned'} />
              <ViewRow label="Location" value={[viewTarget.city, viewTarget.state].filter(Boolean).join(', ') || '—'} />
              <ViewRow label="Start Date" value={viewTarget.startDatePlanned ? new Date(viewTarget.startDatePlanned).toLocaleDateString('en-IN') : '—'} />
              <ViewRow label="End Date (Est.)" value={viewTarget.estimatedCompletionDate ? new Date(viewTarget.estimatedCompletionDate).toLocaleDateString('en-IN') : '—'} />
              <ViewRow label="Budget" value={viewTarget.totalBudget != null ? `₹ ${Number(viewTarget.totalBudget).toLocaleString('en-IN')}` : '—'} />
              {viewTarget.description && <ViewRow label="Description" value={viewTarget.description} />}
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

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
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
              {deleting ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
