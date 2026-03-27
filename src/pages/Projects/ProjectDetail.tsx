import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FolderOpen, Users, Building2, MapPin,
  Calendar, IndianRupee, ClipboardList, Loader2, AlertTriangle, Pencil,
  Globe, CheckCircle2, Search, ChevronDown, X, Layers, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectService } from '@/services/projectService';
import { checklistService } from '@/services/checklistService';
import type { ProjectResponse } from '@/services/models/project';
import type { TemplateResponse } from '@/services/models/checklist';
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

  // ── Template assignment state ──────────────────────────────────────────────
  const [pickerTemplates, setPickerTemplates] = useState<TemplateResponse[]>([]);
  const [projectTemplate, setProjectTemplate] = useState<TemplateResponse | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [tplSearch, setTplSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState<TemplateResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    Promise.all([
      checklistService.getPickerTemplates(),
      checklistService.listProjectTemplates(id),
    ]).then(([picker, projTpls]) => {
      setPickerTemplates(picker.filter(t => t.id !== null && t.scope !== 'SCRATCH'));
      if (projTpls.length > 0) setProjectTemplate(projTpls[0]);
    }).catch(() => {}).finally(() => setTemplatesLoading(false));
  }, [id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredTpls = tplSearch.trim()
    ? pickerTemplates.filter(t => t.title.toLowerCase().includes(tplSearch.toLowerCase()))
    : pickerTemplates;

  const totalItems = (selectedTpl?.sections ?? []).reduce((acc, s) => acc + (s.items?.length ?? 0), 0);

  const handleAssign = async () => {
    if (!selectedTpl?.id || !id) return;
    setAssigning(true);
    try {
      const snap = await checklistService.snapshotTemplate(selectedTpl.id, id);
      toast.success(`Template assigned — ${snap.totalRows} inspection items created`);
      setShowConfirm(false);
      navigate(`/inspections/${snap.inspectionId}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const openPicker = () => {
    setSelectedTpl(null);
    setTplSearch('');
    setDropdownOpen(false);
    setShowReassign(true);
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
        <button className={styles.backBtn} onClick={() => navigate(-1)} style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Go Back
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

      {/* Back button */}
      <div className={styles.topBar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back to Projects
        </button>
        <button
          className={styles.backBtn}
          onClick={() => navigate(`/projects/edit/${project.id}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', borderColor: '#3B82F6', color: '#2563EB', fontWeight: 600 }}
        >
          <Pencil size={13} /> Edit Project
        </button>
      </div>

      {/* Hero — white card with status-colored top border */}
      <div
        className={styles.hero}
        style={{ borderTopColor: statusMeta.color }}
      >
        <div
          className={styles.heroIconWrap}
          style={{ background: statusMeta.bg }}
        >
          <FolderOpen size={26} color={statusMeta.color} />
        </div>

        <div className={styles.heroInfo}>
          <h1 className={styles.heroTitle}>{project.name}</h1>

          <div className={styles.heroMeta}>
            {/* Blue status badge with a colored dot indicating actual status */}
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

        {/* Team & Client — same bordered-grid format as Timeline */}
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

        {/* Property Specs — same 2-column field grid as Timeline/Address */}
        {hasSpecs && (() => {
          const entries = Object.entries(project.projectSpecs as Record<string, string>);
          return (
            <Section icon={<ClipboardList size={14} color="#3B82F6" />} title={`${project.propertyTypeName ?? 'Property'} Specifications`}>
              <div className={styles.grid}>
                {entries.map(([k, v], i) => (
                  <Field
                    key={k}
                    label={k}
                    value={v || '—'}
                    full={i === entries.length - 1 && entries.length % 2 !== 0}
                  />
                ))}
              </div>
            </Section>
          );
        })()}

        {/* Address */}
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

        {/* Timeline */}
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

        {/* Financials */}
        {hasFinancials && (
          <Section icon={<IndianRupee size={14} color="#16A34A" />} title="Financials">
            <div className={styles.grid}>
              <Field label="Total Budget"   value={fmtMoney(project.totalBudget)} />
              <Field label="Contract Value" value={fmtMoney(project.contractValue)} />
            </div>
          </Section>
        )}

        {/* ── Inspection Template ─────────────────────────────────────────── */}
        <Section icon={<ClipboardList size={14} color="#33AE95" />} title="Inspection Template">
          {templatesLoading ? (
            <div className={styles.tplLoading}>
              <Loader2 size={16} className={styles.tplSpinner} /> Loading templates…
            </div>
          ) : projectTemplate && !showReassign ? (
            /* ── Already assigned ── */
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
              <button className={styles.tplReassignBtn} onClick={openPicker}>
                <RefreshCw size={12} /> Re-assign
              </button>
            </div>
          ) : (
            /* ── Picker ── */
            <div className={styles.tplPickerWrap}>
              {projectTemplate && showReassign && (
                <div className={styles.tplReassignWarning}>
                  <AlertTriangle size={13} color="#D97706" />
                  A template is already assigned. Re-assigning will create a new copy.
                  <button className={styles.tplCancelReassign} onClick={() => setShowReassign(false)}>
                    <X size={12} /> Cancel
                  </button>
                </div>
              )}

              <p className={styles.tplPickerLabel}>Select a master template to assign to this project:</p>

              {/* Searchable dropdown */}
              <div className={styles.tplDropdownWrap} ref={dropdownRef}>
                <div className={styles.tplDropdownTrigger} onClick={() => setDropdownOpen(o => !o)}>
                  <Search size={13} className={styles.tplSearchIcon} />
                  <input
                    className={styles.tplSearchInput}
                    placeholder="Search templates…"
                    value={tplSearch}
                    onChange={e => { setTplSearch(e.target.value); setDropdownOpen(true); setSelectedTpl(null); }}
                    onFocus={() => setDropdownOpen(true)}
                  />
                  <ChevronDown size={13} className={`${styles.tplChevron} ${dropdownOpen ? styles.tplChevronOpen : ''}`} />
                </div>
                {dropdownOpen && (
                  <div className={styles.tplDropdown}>
                    {filteredTpls.length === 0 ? (
                      <div className={styles.tplDropdownEmpty}>No templates found</div>
                    ) : filteredTpls.map(t => (
                      <button key={t.id} className={styles.tplDropdownItem} onClick={() => {
                        setSelectedTpl(t); setTplSearch(t.title); setDropdownOpen(false);
                      }}>
                        <Globe size={12} style={{ flexShrink: 0, color: '#9CA3AF' }} />
                        <span className={styles.tplDropdownName}>{t.title}</span>
                        <span className={styles.tplDropdownScope}>{t.scope}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview card — shown after selection */}
              {selectedTpl && (
                <div className={styles.tplPreview}>
                  <div className={styles.tplPreviewHeader}>
                    <div className={styles.tplPreviewIcon}><Globe size={16} color="#33AE95" /></div>
                    <div>
                      <p className={styles.tplPreviewTitle}>{selectedTpl.title}</p>
                      {selectedTpl.description && (
                        <p className={styles.tplPreviewDesc}>{selectedTpl.description}</p>
                      )}
                    </div>
                  </div>
                  <div className={styles.tplPreviewMeta}>
                    <span className={styles.tplPreviewStat}>
                      <Layers size={12} />{selectedTpl.sectionCount} sections
                    </span>
                    <span className={styles.tplPreviewStat}>
                      <ClipboardList size={12} />{totalItems} items
                    </span>
                    <span className={styles.tplPreviewStat}>
                      <Globe size={12} />{selectedTpl.scope}
                    </span>
                  </div>
                  <button className={styles.tplAssignBtn} onClick={() => setShowConfirm(true)}>
                    Assign to Project
                  </button>
                </div>
              )}
            </div>
          )}
        </Section>

      </div>

      {/* ── Confirmation Modal ─────────────────────────────────────────────── */}
      {showConfirm && selectedTpl && (
        <div className={styles.confirmBackdrop} onClick={() => !assigning && setShowConfirm(false)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmHeader}>
              <div className={styles.confirmIcon}><ClipboardList size={20} color="#33AE95" /></div>
              <div>
                <h3 className={styles.confirmTitle}>Assign Template?</h3>
                <p className={styles.confirmSub}>This action will create a unique project copy</p>
              </div>
            </div>
            <p className={styles.confirmBody}>
              Assigning <strong>"{selectedTpl.title}"</strong> will create a unique copy for{' '}
              <strong>{project.name}</strong>. Any custom items added later will only affect this project.
              The master template will remain unchanged.
            </p>
            <div className={styles.confirmStats}>
              <span><Layers size={12} />{selectedTpl.sectionCount} sections</span>
              <span><ClipboardList size={12} />{totalItems} items</span>
              <span><Globe size={12} />{selectedTpl.scope} template</span>
            </div>
            <div className={styles.confirmFooter}>
              <button
                className={styles.confirmCancelBtn}
                onClick={() => setShowConfirm(false)}
                disabled={assigning}
              >
                Cancel
              </button>
              <button
                className={styles.confirmProceedBtn}
                onClick={handleAssign}
                disabled={assigning}
              >
                {assigning ? <><Loader2 size={13} className={styles.tplSpinner} /> Assigning…</> : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
