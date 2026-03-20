import { useEffect, useRef, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Play,
  Download,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  X,
  CheckSquare,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import { projectService } from '@/services/projectService';
import type { TemplateResponse, InspectionResponse, FieldInfo } from '@/services/models/checklist';
import type { ProjectResponse } from '@/services/models/project';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import styles from '@/pages/Organisation/Organisation.module.css';

// ─── Field row used in template builder ─────────────────────────────────────

interface FieldDraft {
  fieldTitle: string;
  fieldDescription: string;
  fieldType: 'INPUT' | 'CHECKBOX';
}

// ─── TemplateFormModal ───────────────────────────────────────────────────────

interface TemplateFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  isGlobal: boolean;
  projectId?: string;
  template?: TemplateResponse | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TemplateFormModal = ({
  open,
  mode,
  isGlobal,
  projectId,
  template,
  onClose,
  onSuccess,
}: TemplateFormModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(template?.title ?? '');
      setDescription(template?.description ?? '');
      setFields(
        template?.fields?.map((f) => ({
          fieldTitle: f.fieldTitle,
          fieldDescription: f.fieldDescription ?? '',
          fieldType: (f.fieldType as 'INPUT' | 'CHECKBOX') ?? 'INPUT',
        })) ?? []
      );
    }
  }, [open, template]);

  const addField = () =>
    setFields((prev) => [...prev, { fieldTitle: '', fieldDescription: '', fieldType: 'INPUT' }]);

  const removeField = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));

  const updateField = (i: number, key: keyof FieldDraft, value: string) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)));

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Template name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        isGlobal,
        projectId: isGlobal ? undefined : projectId,
        fields: fields.filter((f) => f.fieldTitle.trim()),
      };
      if (mode === 'create') {
        await checklistService.createTemplate(payload);
        toast.success('Template created');
      } else {
        await checklistService.updateTemplate(template!.id, payload);
        toast.success('Template updated');
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Template' : 'Edit Template'}
          </DialogTitle>
          <DialogDescription>
            {isGlobal ? 'Common library template' : 'Project-specific template'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#263B4F] mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fire Safety Inspection"
              className="w-full h-10 rounded-lg border border-[#DDE3EC] bg-white px-3 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#3B62C2]/30 focus:border-[#3B62C2]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#263B4F] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this template"
              rows={2}
              className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#3B62C2]/30 focus:border-[#3B62C2] resize-none"
            />
          </div>

          {/* Dynamic Fields Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[#263B4F]">
                Checklist Fields
              </label>
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B62C2] hover:text-[#2a4fa0] transition-colors"
              >
                <Plus size={13} /> Add Field
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#DDE3EC] bg-[#F8FAFC] py-6 text-center text-sm text-[#9CA3AF]">
                No fields yet — click "Add Field" to begin
              </div>
            ) : (
              <div className="rounded-lg border border-[#DDE3EC] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#DDE3EC]">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-[#64748B] w-[35%]">Field Title</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-[#64748B] w-[35%]">Description</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-[#64748B] w-[20%]">Type</th>
                      <th className="px-3 py-2 w-[10%]" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f, i) => (
                      <tr key={i} className="border-b border-[#DDE3EC] last:border-0">
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={f.fieldTitle}
                            onChange={(e) => updateField(i, 'fieldTitle', e.target.value)}
                            placeholder="e.g. Check fire exit"
                            className="w-full h-8 rounded-md border border-[#DDE3EC] px-2 text-xs text-[#263B4F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#3B62C2]/40"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={f.fieldDescription}
                            onChange={(e) => updateField(i, 'fieldDescription', e.target.value)}
                            placeholder="Optional"
                            className="w-full h-8 rounded-md border border-[#DDE3EC] px-2 text-xs text-[#263B4F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#3B62C2]/40"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <select
                              value={f.fieldType}
                              onChange={(e) => updateField(i, 'fieldType', e.target.value as 'INPUT' | 'CHECKBOX')}
                              className="w-full h-8 rounded-md border border-[#DDE3EC] pl-2 pr-6 text-xs text-[#263B4F] appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-[#3B62C2]/40"
                            >
                              <option value="INPUT">Input</option>
                              <option value="CHECKBOX">Checkbox</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-1.5 top-2.5 text-[#64748B] pointer-events-none" />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeField(i)}
                            className="text-[#DF453A] hover:text-[#c73c32] transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-3 mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#3B62C2] hover:bg-[#2a4fa0] text-white font-semibold min-w-28"
          >
            {saving
              ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</span>
              : mode === 'create' ? 'Create Template' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── ImportModal ─────────────────────────────────────────────────────────────

interface ImportModalProps {
  open: boolean;
  projectId: string;
  globalTemplates: TemplateResponse[];
  onClose: () => void;
  onSuccess: () => void;
}

const ImportModal = ({ open, projectId, globalTemplates, onClose, onSuccess }: ImportModalProps) => {
  const [importingId, setImportingId] = useState<string | null>(null);

  const handleImport = async (templateId: string) => {
    setImportingId(templateId);
    try {
      await checklistService.importTemplate(templateId, projectId);
      toast.success('Template imported to project');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to import template');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Common Library</DialogTitle>
          <DialogDescription>Select a global template to import into this project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
          {globalTemplates.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">No global templates available.</p>
          ) : (
            globalTemplates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-[#DDE3EC] bg-[#F8FAFC] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#263B4F]">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-[#64748B] mt-0.5">{t.description}</p>
                  )}
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{t.fieldCount} field{t.fieldCount !== 1 ? 's' : ''}</p>
                </div>
                <Button
                  onClick={() => handleImport(t.id)}
                  disabled={importingId === t.id}
                  className="bg-[#3B62C2] hover:bg-[#2a4fa0] text-white text-xs font-semibold h-8 px-3"
                >
                  {importingId === t.id
                    ? <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Import'}
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── InspectionFormModal ──────────────────────────────────────────────────────

interface InspectionModalProps {
  open: boolean;
  template: TemplateResponse | null;
  preProjectId?: string;
  projects: ProjectResponse[];
  onClose: () => void;
  onSuccess: () => void;
}

interface AnswerDraft {
  fieldTitle: string;
  fieldType: string;
  answer: string;
  photoUrl: string | null;
  localPreview: string | null;
}

const InspectionFormModal = ({
  open,
  template,
  preProjectId,
  projects,
  onClose,
  onSuccess,
}: InspectionModalProps) => {
  const [projectId, setProjectId] = useState(preProjectId ?? '');
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<AnswerDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open && template) {
      setProjectId(preProjectId ?? '');
      setNotes('');
      setAnswers(
        (template.fields ?? []).map((f) => ({
          fieldTitle: f.fieldTitle,
          fieldType: f.fieldType,
          answer: f.fieldType === 'CHECKBOX' ? 'false' : '',
          photoUrl: null,
          localPreview: null,
        }))
      );
    }
  }, [open, template, preProjectId]);

  const handleFileChange = (i: number, file: File | null) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setAnswers((prev) =>
      prev.map((a, idx) =>
        idx === i
          ? {
              ...a,
              // TODO: Upload file to S3 and store the returned URL in photoUrl
              photoUrl: file.name,
              localPreview: preview,
            }
          : a
      )
    );
  };

  const removePhoto = (i: number) => {
    if (fileRefs.current[i]) fileRefs.current[i]!.value = '';
    setAnswers((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, photoUrl: null, localPreview: null } : a))
    );
  };

  const handleSubmit = async () => {
    if (!projectId) {
      toast.error('Please select a project');
      return;
    }
    if (!template) return;
    setSubmitting(true);
    try {
      const payload = {
        projectId,
        templateId: template.id,
        notes,
        answers: answers.map(({ fieldTitle, fieldType, answer, photoUrl }) => ({
          fieldTitle,
          fieldType,
          answer,
          photoUrl,
        })),
      };

      // Create draft then immediately submit
      const draft = await checklistService.startInspection(payload);
      await checklistService.submitInspection(draft.id, payload);

      toast.success('Inspection submitted successfully');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit inspection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start Inspection</DialogTitle>
          <DialogDescription>
            Template: <span className="font-semibold text-[#263B4F]">{template?.title}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Project selector (only if not pre-selected) */}
          {!preProjectId && (
            <div>
              <label className="block text-sm font-medium text-[#263B4F] mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#DDE3EC] bg-white pl-3 pr-8 text-sm text-[#263B4F] appearance-none focus:outline-none focus:ring-2 focus:ring-[#3B62C2]/30 focus:border-[#3B62C2]"
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-[#64748B] pointer-events-none" />
              </div>
            </div>
          )}

          {/* Dynamic fields */}
          {answers.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-4">This template has no fields.</p>
          ) : (
            <div className="space-y-4">
              {answers.map((answer, i) => {
                const field = template?.fields?.[i];
                return (
                  <div key={i} className="rounded-lg border border-[#DDE3EC] bg-[#F8FAFC] p-4">
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-[#263B4F]">{answer.fieldTitle}</p>
                      {field?.fieldDescription && (
                        <p className="text-xs text-[#64748B] mt-0.5">{field.fieldDescription}</p>
                      )}
                    </div>

                    {/* Input or Checkbox */}
                    {answer.fieldType === 'CHECKBOX' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={answer.answer === 'true'}
                          onChange={(e) =>
                            setAnswers((prev) =>
                              prev.map((a, idx) =>
                                idx === i ? { ...a, answer: String(e.target.checked) } : a
                              )
                            )
                          }
                          className="h-4 w-4 rounded border-[#DDE3EC] text-[#3B62C2] focus:ring-[#3B62C2]/30"
                        />
                        <span className="text-sm text-[#263B4F]">
                          {answer.answer === 'true' ? 'Yes / Checked' : 'No / Unchecked'}
                        </span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={answer.answer}
                        onChange={(e) =>
                          setAnswers((prev) =>
                            prev.map((a, idx) =>
                              idx === i ? { ...a, answer: e.target.value } : a
                            )
                          )
                        }
                        placeholder="Enter your answer…"
                        className="w-full h-9 rounded-lg border border-[#DDE3EC] bg-white px-3 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#3B62C2]/30 focus:border-[#3B62C2]"
                      />
                    )}

                    {/* Photo upload */}
                    <div className="mt-3">
                      {answer.localPreview ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={answer.localPreview}
                            alt="preview"
                            className="h-16 w-16 object-cover rounded-lg border border-[#DDE3EC]"
                          />
                          <div>
                            <p className="text-xs text-[#64748B] truncate max-w-[160px]">{answer.photoUrl}</p>
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="text-xs text-[#DF453A] hover:underline mt-0.5"
                            >
                              Remove photo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] cursor-pointer hover:text-[#3B62C2] transition-colors">
                          <Plus size={12} /> Attach photo
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            ref={(el) => { fileRefs.current[i] = el; }}
                            onChange={(e) => handleFileChange(i, e.target.files?.[0] ?? null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#263B4F] mb-1">Inspector Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional remarks…"
              rows={3}
              className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm text-[#263B4F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#3B62C2]/30 focus:border-[#3B62C2] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-3 mt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#3B62C2] hover:bg-[#2a4fa0] text-white font-semibold min-w-32"
          >
            {submitting
              ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</span>
              : 'Submit Inspection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Template Table Row ───────────────────────────────────────────────────────

const TemplateRow = ({
  t,
  onEdit,
  onDelete,
  onStart,
}: {
  t: TemplateResponse;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
}) => (
  <tr className={styles.tableRow}>
    <td>
      <div className={styles.orgCell}>
        <div className={styles.orgIcon}>
          <ClipboardList style={{ width: 14, height: 14 }} />
        </div>
        <div>
          <span className={styles.orgName}>{t.title}</span>
          {t.description && (
            <p className={styles.orgMeta}>{t.description}</p>
          )}
        </div>
      </div>
    </td>
    <td className={styles.mutedCell}>
      {t.fieldCount} field{t.fieldCount !== 1 ? 's' : ''}
    </td>
    <td className={styles.mutedCell}>
      {t.organisationName ?? <span style={{ opacity: 0.4 }}>—</span>}
    </td>
    <td>
      <div className={styles.actionBtns}>
        <button
          className={`${styles.actionBtn}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12, fontWeight: 600, color: '#3B62C2', background: 'rgba(59,98,194,0.08)', border: '1px solid rgba(59,98,194,0.2)', borderRadius: 6 }}
          onClick={onStart}
          title="Start Inspection"
        >
          <Play size={12} /> Start
        </button>
        <button className={styles.actionBtn} onClick={onEdit} title="Edit"><Pencil size={14} /></button>
        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={onDelete} title="Delete"><Trash2 size={14} /></button>
      </div>
    </td>
  </tr>
);

// ─── Main Checklists Page ─────────────────────────────────────────────────────

const Checklists = () => {
  const [activeTab, setActiveTab] = useState<'common' | 'project'>('common');

  // Common templates
  const [globalTemplates, setGlobalTemplates] = useState<TemplateResponse[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  // Project templates
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectTemplates, setProjectTemplates] = useState<TemplateResponse[]>([]);
  const [loadingProject, setLoadingProject] = useState(false);

  // Template modal
  const [templateModal, setTemplateModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    isGlobal: boolean;
    projectId?: string;
    template?: TemplateResponse | null;
  }>({ open: false, mode: 'create', isGlobal: true });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import modal
  const [importOpen, setImportOpen] = useState(false);

  // Inspection modal
  const [inspectionModal, setInspectionModal] = useState<{
    open: boolean;
    template: TemplateResponse | null;
    preProjectId?: string;
  }>({ open: false, template: null });

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchGlobalTemplates = async () => {
    setLoadingGlobal(true);
    try {
      setGlobalTemplates(await checklistService.listGlobalTemplates());
    } catch {
      setGlobalTemplates([]);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const page = await projectService.listProjects(0, 100);
      setProjects(page.content);
    } catch {
      setProjects([]);
    }
  };

  const fetchProjectTemplates = async (pid: string) => {
    setLoadingProject(true);
    try {
      setProjectTemplates(await checklistService.listProjectTemplates(pid));
    } catch {
      setProjectTemplates([]);
    } finally {
      setLoadingProject(false);
    }
  };

  useEffect(() => {
    fetchGlobalTemplates();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) fetchProjectTemplates(selectedProjectId);
    else setProjectTemplates([]);
  }, [selectedProjectId]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await checklistService.deleteTemplate(deleteTarget.id);
      toast.success('Template deleted');
      setDeleteTarget(null);
      if (activeTab === 'common') fetchGlobalTemplates();
      else if (selectedProjectId) fetchProjectTemplates(selectedProjectId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = (isGlobal: boolean, pid?: string) =>
    setTemplateModal({ open: true, mode: 'create', isGlobal, projectId: pid, template: null });

  const openEdit = (t: TemplateResponse) =>
    setTemplateModal({
      open: true,
      mode: 'edit',
      isGlobal: t.isGlobal,
      projectId: t.projectId,
      template: t,
    });

  const openInspection = (t: TemplateResponse, pid?: string) =>
    setInspectionModal({ open: true, template: t, preProjectId: pid });

  const onTemplateSuccess = () => {
    if (activeTab === 'common') fetchGlobalTemplates();
    else if (selectedProjectId) fetchProjectTemplates(selectedProjectId);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Inspection Checklists</h1>
        </div>
        <button
          className={styles.createBtn}
          onClick={() =>
            activeTab === 'common'
              ? openCreate(true)
              : openCreate(false, selectedProjectId || undefined)
          }
        >
          <Plus style={{ display: 'inline', width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
          Create Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#DDE3EC]">
        {(['common', 'project'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-[#3B62C2] text-[#3B62C2]'
                : 'border-transparent text-[#64748B] hover:text-[#263B4F]'
            }`}
          >
            {tab === 'common' ? (
              <span className="flex items-center gap-2"><FileText size={14} /> Common Templates</span>
            ) : (
              <span className="flex items-center gap-2"><ClipboardList size={14} /> Project Templates</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Common Templates ── */}
      {activeTab === 'common' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <FileText style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }} />
              Common Template Library
            </h3>
            <button className={styles.refreshBtn} onClick={fetchGlobalTemplates} title="Refresh">
              <RefreshCw style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div className={styles.panelBody}>
            {loadingGlobal ? (
              <div className={styles.emptyState}>
                <div className={styles.spinner} />
                <p style={{ marginTop: 12 }}>Loading…</p>
              </div>
            ) : globalTemplates.length === 0 ? (
              <div className={styles.emptyState}>
                <ClipboardList style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                <p>No common templates yet.</p>
                <p className={styles.emptySubtext}>Click "Create Template" to add one.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Fields</th>
                    <th>Organisation</th>
                    <th style={{ width: 160, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {globalTemplates.map((t) => (
                    <TemplateRow
                      key={t.id}
                      t={t}
                      onEdit={() => openEdit(t)}
                      onDelete={() => setDeleteTarget({ id: t.id, title: t.title })}
                      onStart={() => openInspection(t)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Project Templates ── */}
      {activeTab === 'project' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <ClipboardList style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }} />
              Project Templates
            </h3>
            <div className="flex items-center gap-2">
              {selectedProjectId && (
                <>
                  <button
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B62C2] border border-[#3B62C2]/30 bg-[#3B62C2]/08 rounded-lg px-3 h-8 hover:bg-[#3B62C2]/10 transition-colors"
                    onClick={() => setImportOpen(true)}
                  >
                    <Download size={12} /> Import from Common
                  </button>
                  <button
                    className={styles.refreshBtn}
                    onClick={() => fetchProjectTemplates(selectedProjectId)}
                    title="Refresh"
                  >
                    <RefreshCw style={{ width: 14, height: 14 }} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={styles.panelBody}>
            {/* Project selector */}
            <div className="px-6 py-4 border-b border-[#DDE3EC]">
              <label className="block text-sm font-medium text-[#263B4F] mb-1.5">Select Project</label>
              <div className="relative max-w-sm">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#DDE3EC] bg-white pl-3 pr-8 text-sm text-[#263B4F] appearance-none focus:outline-none focus:ring-2 focus:ring-[#3B62C2]/30 focus:border-[#3B62C2]"
                >
                  <option value="">— Choose a project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-[#64748B] pointer-events-none" />
              </div>
            </div>

            {!selectedProjectId ? (
              <div className={styles.emptyState}>
                <CheckSquare style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                <p>Select a project to view its templates.</p>
              </div>
            ) : loadingProject ? (
              <div className={styles.emptyState}>
                <div className={styles.spinner} />
                <p style={{ marginTop: 12 }}>Loading…</p>
              </div>
            ) : projectTemplates.length === 0 ? (
              <div className={styles.emptyState}>
                <ClipboardList style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                <p>No templates for this project.</p>
                <p className={styles.emptySubtext}>
                  Create a new one or import from the common library.
                </p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Fields</th>
                    <th>Organisation</th>
                    <th style={{ width: 160, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTemplates.map((t) => (
                    <TemplateRow
                      key={t.id}
                      t={t}
                      onEdit={() => openEdit(t)}
                      onDelete={() => setDeleteTarget({ id: t.id, title: t.title })}
                      onStart={() => openInspection(t, selectedProjectId)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <TemplateFormModal
        open={templateModal.open}
        mode={templateModal.mode}
        isGlobal={templateModal.isGlobal}
        projectId={templateModal.projectId}
        template={templateModal.template}
        onClose={() => setTemplateModal((s) => ({ ...s, open: false }))}
        onSuccess={onTemplateSuccess}
      />

      <InspectionFormModal
        open={inspectionModal.open}
        template={inspectionModal.template}
        preProjectId={inspectionModal.preProjectId}
        projects={projects}
        onClose={() => setInspectionModal((s) => ({ ...s, open: false }))}
        onSuccess={() => {}}
      />

      <ImportModal
        open={importOpen}
        projectId={selectedProjectId}
        globalTemplates={globalTemplates}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          if (selectedProjectId) fetchProjectTemplates(selectedProjectId);
        }}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-[#DF453A]/10 border border-[#DF453A]/25 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-[#DF453A]" />
              </div>
              <DialogTitle>Delete Template</DialogTitle>
            </div>
            <DialogDescription className="pl-[52px]">
              Delete <span className="font-medium text-[#263B4F]">{deleteTarget?.title}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#DF453A] hover:bg-[#c73c32] text-white font-semibold min-w-28"
            >
              {deleting
                ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</span>
                : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Checklists;
