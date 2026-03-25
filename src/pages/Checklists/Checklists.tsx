import React, { useEffect, useState } from 'react';
import {
  ClipboardList, Plus, Pencil, Trash2, RefreshCw,
  Globe, Building2, FolderOpen, Lock, Unlock,
  ChevronDown, X, Check, BookOpen, AlertTriangle,
  Layers, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type { TemplateResponse, TemplateScope } from '@/services/models/checklist';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import styles from './Checklists.module.css';

// ─── HIP response types ────────────────────────────────────────────────────────
const RESPONSE_TYPES = ['HIP', 'PASS_FAIL', 'TEXT', 'PHOTO', 'DROPDOWN'] as const;
type ResponseType = typeof RESPONSE_TYPES[number];

// ─── Draft types for the builder ──────────────────────────────────────────────
interface ItemDraft {
  label: string;
  responseType: ResponseType;
  options: string[];
  commonComments: string[];
  commentInput: string;  // temp state for the add-comment input
}

interface SectionDraft {
  sectionName: string;
  items: ItemDraft[];
}

const emptyItem = (): ItemDraft => ({
  label: '', responseType: 'HIP', options: [], commonComments: [], commentInput: '',
});
const emptySection = (): SectionDraft => ({
  sectionName: '', items: [emptyItem()],
});

// ─── Scope helpers ─────────────────────────────────────────────────────────────
const scopeLabel: Record<TemplateScope, string> = {
  GLOBAL:       'Global',
  ORGANISATION: 'Organisation',
  PROJECT:      'Project',
  SCRATCH:      'Scratch',
};
const scopeIcon: Record<TemplateScope, React.ReactNode> = {
  GLOBAL:       <Globe size={14} />,
  ORGANISATION: <Building2 size={14} />,
  PROJECT:      <FolderOpen size={14} />,
  SCRATCH:      <Plus size={14} />,
};

// ─── TemplateFormModal ─────────────────────────────────────────────────────────
interface FormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  template?: TemplateResponse | null;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TemplateFormModal: React.FC<FormModalProps> = ({
  open, mode, template, isSuperAdmin, onClose, onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'GLOBAL' | 'ORGANISATION'>('ORGANISATION');
  const [isLocked, setIsLocked] = useState(false);
  const [sections, setSections] = useState<SectionDraft[]>([emptySection()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title ?? '');
    setDescription(template?.description ?? '');
    setScope(
      (template?.scope === 'GLOBAL' ? 'GLOBAL' : 'ORGANISATION') as 'GLOBAL' | 'ORGANISATION'
    );
    setIsLocked(template?.isLocked ?? false);
    setSections(
      template?.sections?.length
        ? template.sections.map((s) => ({
            sectionName: s.sectionName,
            items: s.items?.length
              ? s.items.map((it) => ({
                  label: it.label,
                  responseType: (it.responseType as ResponseType) ?? 'HIP',
                  options: it.options ?? [],
                  commonComments: it.commonComments ?? [],
                  commentInput: '',
                }))
              : [emptyItem()],
          }))
        : [emptySection()]
    );
  }, [open, template]);

  // ── Section helpers ──────────────────────────────────────────────────────────
  const addSection = () => setSections((p) => [...p, emptySection()]);
  const removeSection = (si: number) => setSections((p) => p.filter((_, i) => i !== si));
  const updateSectionName = (si: number, name: string) =>
    setSections((p) => p.map((s, i) => i === si ? { ...s, sectionName: name } : s));

  // ── Item helpers ─────────────────────────────────────────────────────────────
  const addItem = (si: number) =>
    setSections((p) => p.map((s, i) => i === si ? { ...s, items: [...s.items, emptyItem()] } : s));
  const removeItem = (si: number, ii: number) =>
    setSections((p) => p.map((s, i) =>
      i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s));
  const updateItem = (si: number, ii: number, patch: Partial<ItemDraft>) =>
    setSections((p) => p.map((s, i) =>
      i === si ? {
        ...s, items: s.items.map((it, j) => j === ii ? { ...it, ...patch } : it),
      } : s));

  const addComment = (si: number, ii: number) => {
    const text = sections[si].items[ii].commentInput.trim();
    if (!text) return;
    updateItem(si, ii, {
      commonComments: [...sections[si].items[ii].commonComments, text],
      commentInput: '',
    });
  };
  const removeComment = (si: number, ii: number, ci: number) =>
    updateItem(si, ii, {
      commonComments: sections[si].items[ii].commonComments.filter((_, k) => k !== ci),
    });

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Template name is required'); return; }
    const validSections = sections.filter((s) => s.sectionName.trim());
    if (validSections.length === 0) { toast.error('Add at least one section with a name'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        scope,
        isLocked,
        sections: validSections.map((s) => ({
          sectionName: s.sectionName.trim(),
          items: s.items
            .filter((it) => it.label.trim())
            .map((it) => ({
              label: it.label.trim(),
              responseType: it.responseType,
              options: it.options.length ? it.options : undefined,
              commonComments: it.commonComments.length ? it.commonComments : undefined,
            })),
        })),
      };

      if (mode === 'create') {
        await checklistService.createTemplate(payload);
        toast.success('Template created');
      } else {
        await checklistService.updateTemplate(template!.id!, payload);
        toast.success('Template updated');
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create Template' : 'Edit Template'}</DialogTitle>
          <DialogDescription>Build the HIP checklist hierarchy: Sections → Items → Common Comments</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Scope Selector (Super Admin only) */}
          {isSuperAdmin && mode === 'create' && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.55px', marginBottom: 8 }}>
                Template Scope
              </p>
              <div className={styles.scopeSelector}>
                {(['GLOBAL', 'ORGANISATION'] as const).map((s) => (
                  <button
                    key={s} type="button"
                    className={`${styles.scopeOption} ${scope === s ? styles.scopeOptionActive : ''}`}
                    onClick={() => setScope(s)}
                  >
                    {s === 'GLOBAL' ? '🌐 Global' : '🏢 Organisation'}
                  </button>
                ))}
              </div>
              {scope === 'GLOBAL' && (
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
                  Global templates are visible to all organisations.
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Template Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fire Safety Inspection"
              style={{ width: '100%', height: 40, borderRadius: 9, border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 13, color: '#263B4F', outline: 'none' }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Description
            </label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              style={{ width: '100%', borderRadius: 9, border: '1px solid #E5E7EB', padding: '8px 12px', fontSize: 13, color: '#263B4F', outline: 'none', resize: 'none' }}
            />
          </div>

          {/* Lock toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setIsLocked((p) => !p)}
              style={{
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: isLocked ? '#f59e0b' : '#D1D5DB', transition: 'background 0.2s', position: 'relative',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: isLocked ? 20 : 3,
                width: 16, height: 16, borderRadius: 8, background: 'white', transition: 'left 0.2s',
              }} />
            </button>
            <span style={{ fontSize: 12.5, color: '#374151', fontWeight: 600 }}>
              {isLocked ? '🔒 Locked — inspectors can use but not edit questions' : '🔓 Unlocked — questions can be edited'}
            </span>
          </div>

          {/* Sections Builder */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.55px', marginBottom: 10 }}>
              Checklist Sections
            </p>

            {sections.map((sec, si) => (
              <div key={si} className={styles.builderSection}>
                <div className={styles.builderSectionHead}>
                  <Layers size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                  <input
                    className={styles.sectionNameInput}
                    value={sec.sectionName}
                    onChange={(e) => updateSectionName(si, e.target.value)}
                    placeholder={`Section ${si + 1} name, e.g. "Roofing"`}
                  />
                  <button
                    type="button" onClick={() => removeSection(si)}
                    style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className={styles.builderSectionBody}>
                  {sec.items.map((item, ii) => (
                    <div key={ii} className={styles.itemRow}>
                      <div className={styles.itemBody}>
                        <input
                          className={styles.itemLabelInput}
                          value={item.label}
                          onChange={(e) => updateItem(si, ii, { label: e.target.value })}
                          placeholder={`Item ${ii + 1}, e.g. "Shingle Condition"`}
                        />

                        {/* Response Type */}
                        <div className={styles.responseTypeRow}>
                          <span className={styles.responseTypeLabel}>Type:</span>
                          {RESPONSE_TYPES.map((rt) => (
                            <button
                              key={rt} type="button"
                              className={`${styles.responseTypeBtn} ${item.responseType === rt ? styles.responseTypeBtnActive : ''}`}
                              onClick={() => updateItem(si, ii, { responseType: rt })}
                            >
                              {rt}
                            </button>
                          ))}
                        </div>

                        {/* Common Comments */}
                        <div className={styles.commentsRow}>
                          <span className={styles.commentsLabel}>Common Comments:</span>
                          <div className={styles.commentChips}>
                            {item.commonComments.map((c, ci) => (
                              <span key={ci} className={styles.commentChip}>
                                <MessageSquare size={10} />
                                {c}
                                <button
                                  type="button" className={styles.commentChipRemove}
                                  onClick={() => removeComment(si, ii, ci)}
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                            <input
                              className={styles.addCommentInput}
                              value={item.commentInput}
                              placeholder="+ Add comment…"
                              onChange={(e) => updateItem(si, ii, { commentInput: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); addComment(si, ii); }
                              }}
                              onBlur={() => addComment(si, ii)}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button" onClick={() => removeItem(si, ii)}
                        style={{ marginTop: 2, width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  <button type="button" className={styles.addItemBtn} onClick={() => addItem(si)}>
                    <Plus size={13} /> Add Item
                  </button>
                </div>
              </div>
            ))}

            <button type="button" className={styles.addSectionBtn} onClick={addSection}>
              <Plus size={15} /> Add Section
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;
type TabKey = 'all' | 'global' | 'org';

export default function Checklists() {
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<TemplateResponse | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await checklistService.listGlobalTemplates();
      setTemplates(data.filter((t) => t.scope !== 'SCRATCH'));
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Filter by tab ────────────────────────────────────────────────────────────
  const filtered = templates.filter((t) => {
    if (tab === 'global') return t.scope === 'GLOBAL';
    if (tab === 'org')    return t.scope === 'ORGANISATION';
    return t.scope !== 'PROJECT'; // 'all' hides project snapshots
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (t: TemplateResponse) => { setEditTarget(t); setFormOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await checklistService.deleteTemplate(deleteTarget.id!);
      toast.success('Template deleted');
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── Scope badge ──────────────────────────────────────────────────────────────
  const ScopeBadge = ({ scope }: { scope: TemplateScope }) => {
    const cls = scope === 'GLOBAL' ? styles.scopeGlobal
               : scope === 'ORGANISATION' ? styles.scopeOrg
               : styles.scopeProject;
    return (
      <span className={`${styles.scopeBadge} ${cls}`}>
        {scopeIcon[scope]}{scopeLabel[scope]}
      </span>
    );
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Template Library</h1>
          <p className={styles.subtitle}>Manage inspection checklists using the HIP hierarchy</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={load} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className={styles.createBtn} onClick={openCreate}>
            <Plus size={15} /> New Template
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {([
          { key: 'all',    label: 'All Templates' },
          { key: 'global', label: '🌐 Global' },
          { key: 'org',    label: '🏢 Organisation' },
        ] as { key: TabKey; label: string }[]).map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => { setTab(t.key); setCurrentPage(1); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            Templates
            <span className={styles.panelCount}>{filtered.length}</span>
          </span>
        </div>

        {loading ? (
          <div className={styles.empty}>
            <RefreshCw className={styles.spinner} size={26} />
            <p style={{ color: '#9CA3AF', fontSize: 13 }}>Loading templates…</p>
          </div>
        ) : paged.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><ClipboardList size={26} /></div>
            <p className={styles.emptyTitle}>No templates yet</p>
            <p className={styles.emptyText}>Click "New Template" to create your first checklist</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '34%' }}>Template</th>
                <th>Scope</th>
                <th>Lock</th>
                <th>Sections</th>
                <th>Organisation</th>
                <th>Created</th>
                <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => (
                <tr key={t.id} className={styles.tableRow}>
                  <td>
                    <div className={styles.tplCell}>
                      <div className={`${styles.tplIcon} ${
                        t.scope === 'GLOBAL' ? styles.tplIconGlobal
                        : t.scope === 'PROJECT' ? styles.tplIconProject
                        : styles.tplIconOrg
                      }`}>
                        {t.scope === 'GLOBAL' ? <Globe size={15} />
                         : t.scope === 'PROJECT' ? <FolderOpen size={15} />
                         : <BookOpen size={15} />}
                      </div>
                      <div>
                        <p className={styles.tplName}>{t.title}</p>
                        {t.description && (
                          <p className={styles.tplMeta} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><ScopeBadge scope={t.scope} /></td>
                  <td>
                    {t.isLocked
                      ? <span className={styles.lockBadge}><Lock size={11} /> Locked</span>
                      : <span className={styles.unlocked}><Unlock size={11} /> Open</span>}
                  </td>
                  <td>
                    <span className={styles.sectionCount}>
                      <Layers size={12} />{t.sectionCount ?? t.sections?.length ?? 0}
                    </span>
                  </td>
                  <td style={{ color: '#6B7280', fontSize: 12.5 }}>
                    {t.organisationName ?? <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                  <td style={{ color: '#9CA3AF', fontSize: 12 }}>
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div className={styles.actions} style={{ justifyContent: 'center' }}>
                      <button className={styles.actionBtn} title="View" onClick={() => setViewTarget(t)}>
                        <ChevronDown size={14} />
                      </button>
                      <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(t)}>
                        <Pencil size={14} />
                      </button>
                      <button className={`${styles.actionBtn} ${styles.danger}`} title="Delete" onClick={() => setDeleteTarget(t)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className={styles.paginationArea}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              onPageSizeChange={() => {}}
            />
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <TemplateFormModal
        open={formOpen}
        mode={editTarget ? 'edit' : 'create'}
        template={editTarget}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setFormOpen(false)}
        onSuccess={load}
      />

      {/* View Modal */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTarget?.title}</DialogTitle>
            <DialogDescription>{viewTarget?.description || 'No description'}</DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3 py-2">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ScopeBadge scope={viewTarget.scope} />
                {viewTarget.isLocked
                  ? <span className={styles.lockBadge}><Lock size={11} /> Locked</span>
                  : <span className={styles.unlocked}><Unlock size={11} /> Open</span>}
                {viewTarget.organisationName && (
                  <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={12} />{viewTarget.organisationName}
                  </span>
                )}
              </div>

              {viewTarget.sections?.map((sec, si) => (
                <div key={si} style={{ border: '1px solid #F0F0F0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 14px', background: '#F9FAFB', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Layers size={13} style={{ color: '#9CA3AF' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{sec.sectionName}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>{sec.items?.length ?? 0} items</span>
                  </div>
                  <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sec.items?.map((item, ii) => (
                      <div key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(51,174,149,0.1)', color: '#33AE95', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <Check size={10} />
                        </span>
                        <div>
                          <p style={{ fontSize: 13, color: '#374151', margin: '0 0 2px' }}>{item.label}</p>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, background: '#F3F4F6', color: '#6B7280', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                              {item.responseType}
                            </span>
                            {item.commonComments?.map((c, ci) => (
                              <span key={ci} style={{ fontSize: 10.5, background: '#EEF2FF', color: '#4338ca', padding: '1px 7px', borderRadius: 10 }}>
                                "{c}"
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
            <Button onClick={() => { openEdit(viewTarget!); setViewTarget(null); }}>
              <Pencil size={13} style={{ marginRight: 5 }} />Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <div className={styles.deleteBody}>
            <div className={styles.deleteIcon}><AlertTriangle size={20} /></div>
            <div>
              <p className={styles.deleteTitle}>Are you sure?</p>
              <p className={styles.deleteText}>
                "<strong>{deleteTarget?.title}</strong>" will be permanently deleted and cannot be recovered.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
