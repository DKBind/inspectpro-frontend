import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FolderOpen, Users, Building2, MapPin,
  Calendar, IndianRupee, ClipboardList, Loader2, AlertTriangle, Pencil,
  CheckCircle2, Layers, Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectService } from '@/services/projectService';
import { checklistService } from '@/services/checklistService';
import type { ProjectResponse } from '@/services/models/project';
import type { TemplateResponse } from '@/services/models/checklist';
import { ROUTES } from '@/components/Constant/Route';
import styles from './ProjectDetail.module.css';

const PROJECT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PLANNING:    { label: 'Planning',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  IN_PROGRESS: { label: 'In Progress', color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  ON_HOLD:     { label: 'On Hold',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  COMPLETED:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  CANCELLED:   { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

const fmt = (date?: string) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtMoney = (v?: number) =>
  v != null ? `₹ ${Number(v).toLocaleString('en-IN')}` : '—';

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className={styles.section}>
    <div className={styles.sectionHead}>
      <span className={styles.sectionIcon}>{icon}</span>
      <span className={styles.sectionTitle}>{title}</span>
    </div>
    <div className={styles.sectionBody}>{children}</div>
  </div>
);

const Field = ({ label, value, full }: { label: string; value?: React.ReactNode; full?: boolean }) => (
  <div className={`${styles.field} ${full ? styles.fieldFull : ''}`}>
    <span className={styles.fieldLabel}>{label}</span>
    <span className={styles.fieldValue}>{value || '—'}</span>
  </div>
);

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Template state (view-only in this page) ───────────────────────────────
  const [projectTemplate, setProjectTemplate] = useState<TemplateResponse | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [creatingInspection, setCreatingInspection] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    projectService.getProject(id)
      .then(setProject)
      .catch(e => setError(e.message || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setTemplatesLoading(true);
    checklistService.listProjectTemplates(id)
      .then(projTpls => {
        if (projTpls.length > 0) {
          // Prefer PROJECT-scoped clone over master template
          const projectScoped = projTpls.find(t => t.scope === 'PROJECT');
          setProjectTemplate(projectScoped ?? projTpls[0]);
        }
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, [id]);

  const handleCreateInspection = async () => {
    if (!projectTemplate?.id || !id) return;
    setCreatingInspection(true);
    try {
      await checklistService.snapshotTemplate(projectTemplate.id!, id);
      toast.success('Inspection created! Go to Inspections to start.');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to create inspection');
    } finally {
      setCreatingInspection(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <Loader2 size={32} className={styles.spinner} />
        <p>Loading project…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={styles.center}>
        <AlertTriangle size={32} color="#EF4444" />
        <p style={{ color: '#EF4444', marginTop: 8 }}>{error ?? 'Project not found'}</p>
        <button className={styles.backBtn} onClick={() => navigate(ROUTES.PROJECTS)} style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
      </div>
    );
  }

  const statusMeta = PROJECT_STATUS_META[project.projectStatus ?? ''] ??
    { label: project.projectStatus ?? 'Unknown', color: '#64748B', bg: '#F1F5F9' };

  const managerAssignment  = project.assignments?.find(a => a.roleName?.toLowerCase() === 'manager');
  const qaAssignment       = project.assignments?.find(a => a.roleName?.toLowerCase() === 'qa');
  const inspectorAssignment  = project.assignments?.find(a => a.roleName?.toLowerCase() === 'inspector');
  const contractorAssignment = project.assignments?.find(a => a.roleName?.toLowerCase() === 'contractor');

  const hasAddress   = [project.addressLine1, project.addressLine2, project.street, project.city, project.state, project.country, project.pincode].some(Boolean);
  const hasTimeline  = [project.startDatePlanned, project.startDateActual, project.estimatedCompletionDate, project.actualCompletionDate].some(Boolean);
  const hasFinancials = project.totalBudget != null || project.contractValue != null;
  const hasSpecs = project.projectSpecs && Object.keys(project.projectSpecs).length > 0;

  const allAssignments = [
    ...(project.managerName ? [{ role: 'Manager', name: project.managerName }] : []),
    ...(managerAssignment && !project.managerName ? [{ role: 'Manager', name: managerAssignment.userName ?? '' }] : []),
    ...(qaAssignment         ? [{ role: 'QA',         name: qaAssignment.userName ?? '' }] : []),
    ...(inspectorAssignment  ? [{ role: 'Inspector',  name: inspectorAssignment.userName ?? '' }] : []),
    ...(contractorAssignment ? [{ role: 'Contractor', name: contractorAssignment.userName ?? '' }] : []),
  ];

  return (
    <div className={styles.page}>

      {/* Top bar */}
      <div className={styles.topBar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className={styles.backBtn} onClick={() => navigate(ROUTES.PROJECTS)}>
          <ArrowLeft size={15} /> Back to Projects
        </button>
        <button
          className={styles.backBtn}
          onClick={() => navigate(`/projects/edit/${project.id}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', borderColor: '#33AE95', color: '#33AE95', fontWeight: 600 }}
        >
          <Pencil size={13} /> Edit Project
        </button>
      </div>

      {/* Hero */}
      <div className={styles.hero} style={{ borderTopColor: statusMeta.color }}>
        <div className={styles.heroIconWrap} style={{ background: statusMeta.bg }}>
          <FolderOpen size={26} color={statusMeta.color} />
        </div>
        <div className={styles.heroInfo}>
          <h1 className={styles.heroTitle}>{project.name}</h1>
          <div className={styles.heroMeta}>
            <span className={styles.statusBadge}>
              <span className={styles.statusDot} style={{ background: statusMeta.color }} />
              {statusMeta.label}
            </span>
            {project.propertyTypeName && (
              <span className={styles.heroPropType}>
                <Building2 size={11} /> {project.propertyTypeName}
              </span>
            )}
            {project.organisationName && (
              <span className={styles.heroPropType}>
                <Building2 size={11} /> {project.organisationName}
              </span>
            )}
          </div>
          {project.description && (
            <p className={styles.heroDesc}>{project.description}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>

        <Section icon={<Users size={14} color="#3B82F6" />} title="Team & Client">
          <div className={styles.grid}>
            <Field label="Client"  value={project.clientName} />
            <Field label="Company" value={project.clientCompany} />
            {allAssignments.map(({ role, name }, i) => (
              <Field
                key={role}
                label={role}
                value={name || '—'}
                full={i === allAssignments.length - 1 && allAssignments.length % 2 !== 0}
              />
            ))}
          </div>
        </Section>

        {hasSpecs && (() => {
          const entries = Object.entries(project.projectSpecs as Record<string, string>);
          return (
            <Section icon={<ClipboardList size={14} color="#3B82F6" />} title={`${project.propertyTypeName ?? 'Property'} Specifications`}>
              <div className={styles.grid}>
                {entries.map(([k, v], i) => (
                  <Field key={k} label={k} value={v || '—'} full={i === entries.length - 1 && entries.length % 2 !== 0} />
                ))}
              </div>
            </Section>
          );
        })()}

        {hasAddress && (
          <Section icon={<MapPin size={14} color="#F97316" />} title="Address">
            <div className={styles.grid}>
              {project.addressLine1 && <Field label="Line 1" value={project.addressLine1} full />}
              {project.addressLine2 && <Field label="Line 2" value={project.addressLine2} full />}
              {project.city    && <Field label="City"    value={project.city} />}
              {project.state   && <Field label="State"   value={project.state} />}
              {project.country && <Field label="Country" value={project.country} />}
              {project.pincode && <Field label="Pincode" value={project.pincode} />}
            </div>
          </Section>
        )}

        {hasTimeline && (
          <Section icon={<Calendar size={14} color="#7C3AED" />} title="Timeline">
            <div className={styles.grid}>
              <Field label="Planned Start"     value={fmt(project.startDatePlanned)} />
              <Field label="Actual Start"      value={fmt(project.startDateActual)} />
              <Field label="Est. Completion"   value={fmt(project.estimatedCompletionDate)} />
              <Field label="Actual Completion" value={fmt(project.actualCompletionDate)} />
            </div>
          </Section>
        )}

        {hasFinancials && (
          <Section icon={<IndianRupee size={14} color="#16A34A" />} title="Financials">
            <div className={styles.grid}>
              <Field label="Total Budget"   value={fmtMoney(project.totalBudget)} />
              <Field label="Contract Value" value={fmtMoney(project.contractValue)} />
            </div>
          </Section>
        )}

        {/* ── Inspection Template (view-only) ─────────────────────────────── */}
        <Section icon={<ClipboardList size={14} color="#33AE95" />} title="Inspection Template">
          {templatesLoading ? (
            <div className={styles.tplLoading}>
              <Loader2 size={16} className={styles.tplSpinner} /> Loading…
            </div>
          ) : projectTemplate ? (
            /* Template assigned — show info + Create Inspection button */
            <div className={styles.tplAssigned}>
              <div className={styles.tplAssignedIcon}>
                <CheckCircle2 size={22} color="#33AE95" />
              </div>
              <div className={styles.tplAssignedInfo}>
                <p className={styles.tplAssignedTitle}>{projectTemplate.title}</p>
                <p className={styles.tplAssignedMeta}>
                  <Layers size={11} />{projectTemplate.sectionCount} section{projectTemplate.sectionCount !== 1 ? 's' : ''}
                  &nbsp;·&nbsp;PROJECT copy
                  {projectTemplate.organisationName && <>&nbsp;·&nbsp;{projectTemplate.organisationName}</>}
                </p>
              </div>
              <button
                className={styles.tplReassignBtn}
                style={{ background: 'linear-gradient(135deg,#33AE95,#2a9a84)', color: '#fff', borderColor: 'transparent' }}
                onClick={handleCreateInspection}
                disabled={creatingInspection}
              >
                {creatingInspection
                  ? <><Loader2 size={12} className={styles.tplSpinner} /> Creating…</>
                  : <><Rocket size={12} /> Create Inspection</>}
              </button>
            </div>
          ) : (
            /* No template — prompt to edit project */
            <div className={styles.tplPickerWrap}>
              <p className={styles.tplPickerLabel} style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                No template assigned. Go to Edit Project to select and assign a template.
              </p>
            </div>
          )}
        </Section>

      </div>
    </div>
  );
};

export default ProjectDetail;
