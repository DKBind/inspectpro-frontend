import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Plus, Trash2, RefreshCw,
  Globe, Building2, FolderOpen, Lock, Unlock,
  Check, BookOpen, AlertTriangle,
  Layers, Eye, Copy, Download, Search,
  Home, Warehouse, Zap, Droplets, X, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type { TemplateResponse, TemplateScope } from '@/services/models/checklist';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/shared-ui/Dialog/dialog';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import styles from './Checklists.module.css';

// ─── Scope helpers ─────────────────────────────────────────────────────────────
const scopeLabel: Record<TemplateScope, string> = {
  GLOBAL: 'Global', ORGANISATION: 'Organisation', PROJECT: 'Project', SCRATCH: 'Scratch',
};
const scopeIcon: Record<TemplateScope, React.ReactNode> = {
  GLOBAL: <Globe size={14} />, ORGANISATION: <Building2 size={14} />,
  PROJECT: <FolderOpen size={14} />, SCRATCH: <Plus size={14} />,
};

// ─── Category icon ─────────────────────────────────────────────────────────────
function getCategoryIcon(title: string, scope: TemplateScope): { icon: React.ReactNode; color: string; bg: string } {
  const t = title.toLowerCase();
  if (/residential|house|home|dwelling|property/.test(t)) return { icon: <Home size={15} />, color: '#2563eb', bg: 'rgba(37,99,235,0.1)' };
  if (/commercial|warehouse|industrial|factory|retail/.test(t)) return { icon: <Warehouse size={15} />, color: '#d97706', bg: 'rgba(217,119,6,0.1)' };
  if (/electrical|wiring|power|circuit/.test(t)) return { icon: <Zap size={15} />, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
  if (/plumbing|pipe|water|drainage/.test(t)) return { icon: <Droplets size={15} />, color: '#0891b2', bg: 'rgba(8,145,178,0.1)' };
  if (/building|office|apartment|unit/.test(t)) return { icon: <Building2 size={15} />, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' };
  if (scope === 'GLOBAL') return { icon: <Globe size={15} />, color: '#2563eb', bg: 'rgba(37,99,235,0.1)' };
  return { icon: <BookOpen size={15} />, color: '#33AE95', bg: 'rgba(51,174,149,0.1)' };
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;
type TabKey = 'all' | 'global' | 'org';

export default function Checklists() {
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';

  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<TemplateResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<TemplateResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [cloning, setCloning] = useState<Set<string>>(new Set());

  // Quick preview popup
  const [hoverPreview, setHoverPreview] = useState<{ tpl: TemplateResponse; x: number; y: number } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Filters ──────────────────────────────────────────────────────────────────
  const byTab = templates.filter((t) => {
    if (tab === 'global') return t.scope === 'GLOBAL';
    if (tab === 'org') return t.scope === 'ORGANISATION';
    return t.scope !== 'PROJECT';
  });
  const filtered = search.trim()
    ? byTab.filter((t) => {
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.organisationName ?? '').toLowerCase().includes(q);
    })
    : byTab;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleView = async (t: TemplateResponse) => {
    setViewTarget(t);
    setViewLoading(true);
    try {
      const full = await checklistService.getTemplate(t.id as string);
      setViewTarget(full);
    } catch {
      // keep showing partial data on error
    } finally {
      setViewLoading(false);
    }
  };

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

  const handleClone = async (t: TemplateResponse) => {
    const tid = t.id as string;
    setCloning((prev) => new Set([...prev, tid]));
    try {
      const full = await checklistService.getTemplate(tid);
      const cloned = await checklistService.createTemplate({
        title: `Copy of ${full.title}`,
        description: full.description,
        scope: full.scope === 'PROJECT' ? 'ORGANISATION' : full.scope,
        sections: full.sections as any[],
      });
      toast.success(`"${cloned.title}" created — opening builder…`);
      navigate(`/templates/${cloned.id}/builder`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Clone failed');
    } finally {
      setCloning((prev) => { const n = new Set(prev); n.delete(tid); return n; });
    }
  };

  const handleExport = async (t: TemplateResponse) => {
    try {
      const full = await checklistService.getTemplate(t.id as string);
      const blob = new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${full.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')}_template.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template exported');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Export failed');
    }
  };

  // ── Preview popup handlers ────────────────────────────────────────────────────
  const showPreview = (e: React.MouseEvent, tpl: TemplateResponse) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverPreview({ tpl, x: rect.right + 10, y: rect.top - 4 });
  };
  const hidePreview = () => {
    previewTimer.current = setTimeout(() => setHoverPreview(null), 180);
  };
  const keepPreview = () => { if (previewTimer.current) clearTimeout(previewTimer.current); };

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
      {/* Tabs + New Template */}
      <div className={styles.tabs}>
        {([
          { key: 'all', label: 'All Templates' },
          { key: 'global', label: '🌐 Global' },
          { key: 'org', label: '🏢 Organisation' },
        ] as { key: TabKey; label: string }[]).map((t) => (
          <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => { setTab(t.key); setCurrentPage(1); }}>
            {t.label}
          </button>
        ))}
        <button className={styles.createBtn}
          onClick={() => navigate(`/templates/new/builder?scope=${isSuperAdmin ? 'GLOBAL' : 'ORGANISATION'}`)}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {/* Panel */}
      <div className={styles.panel}>
        {/* Panel header with count + search */}
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            Templates
            <span className={styles.panelCount}>{filtered.length}</span>
          </span>
          <div className={styles.searchBar}>
            <Search size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by name or organisation…"
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}><X size={12} /></button>
            )}
          </div>
          <button className={styles.refreshBtn} onClick={load} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className={styles.empty}>
            <RefreshCw className={styles.spinner} size={26} />
            <p style={{ color: '#9CA3AF', fontSize: 13 }}>Loading templates…</p>
          </div>
        ) : paged.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><ClipboardList size={26} /></div>
            <p className={styles.emptyTitle}>{search ? 'No templates match your search' : 'No templates yet'}</p>
            <p className={styles.emptyText}>{search ? 'Try a different search term' : 'Click "New Template" to create your first checklist'}</p>
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
                <th>Last Updated</th>
                <th style={{ width: 140, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => {
                const cat = getCategoryIcon(t.title, t.scope);
                const isCloning = cloning.has(t.id as string);
                return (
                  <tr key={t.id} className={styles.tableRow}>
                    {/* Template cell */}
                    <td>
                      <div className={styles.tplCell}>
                        <div className={styles.tplIcon} style={{ background: cat.bg, color: cat.color }}>
                          {cat.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <p className={styles.tplName}>{t.title}</p>
                            <button
                              className={styles.previewBtn}
                              onMouseEnter={(e) => showPreview(e, t)}
                              onMouseLeave={hidePreview}
                              title="Quick preview"
                            >
                              <Eye size={11} />
                            </button>
                          </div>
                          {t.description && (
                            <p className={styles.tplMeta} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td><ScopeBadge scope={t.scope} /></td>

                    {/* Lock */}
                    <td>
                      {t.isLocked
                        ? <span className={styles.lockBadge}><Lock size={11} /> Locked</span>
                        : <span className={styles.unlocked}><Unlock size={11} /> Open</span>}
                    </td>

                    {/* Sections */}
                    <td>
                      <span className={styles.sectionCount}>
                        <Layers size={12} />{t.sectionCount ?? t.sections?.length ?? 0}
                      </span>
                    </td>

                    {/* Version (frontend placeholder) */}
                    {/* <td>
                      <span className={styles.versionBadge}>v1.{t.sectionCount ?? 0}</span>
                    </td> */}

                    {/* Organisation */}
                    <td style={{ color: '#6B7280', fontSize: 12.5 }}>
                      {t.organisationName ?? <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Last Updated */}
                    <td style={{ color: '#9CA3AF', fontSize: 12 }}>
                      {formatDate((t as any).updatedAt ?? t.createdAt)}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className={styles.actions} style={{ justifyContent: 'center' }}>
                        {/* View */}
                        <button className={styles.actionBtn} title="View details" onClick={() => handleView(t)}>
                          <Eye size={14} />
                        </button>
                        {/* Open Builder (greyed if locked) */}
                        <button
                          className={`${styles.actionBtn} ${t.isLocked ? styles.actionBtnLocked : ''}`}
                          title={t.isLocked ? 'Template is locked' : 'Open Builder'}
                          onClick={() => !t.isLocked && navigate(`/templates/${t.id}/builder`)}
                          disabled={t.isLocked}
                        >
                          {t.isLocked ? <Lock size={14} /> : <Pencil size={14} />}
                        </button>
                        {/* Clone */}
                        <button className={styles.actionBtn} title="Duplicate template" onClick={() => handleClone(t)} disabled={isCloning}>
                          {isCloning ? <RefreshCw size={14} className={styles.spinner} style={{ width: 14, height: 14, marginBottom: 0 }} /> : <Copy size={14} />}
                        </button>
                        {/* Export */}
                        <button className={styles.actionBtn} title="Export as JSON" onClick={() => handleExport(t)}>
                          <Download size={14} />
                        </button>
                        {/* Delete */}
                        <button className={`${styles.actionBtn} ${styles.danger}`} title="Delete" onClick={() => setDeleteTarget(t)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
              onPageSizeChange={() => { }}
            />
          </div>
        )}
      </div>

      {/* Quick Preview Popup */}
      {hoverPreview && (
        <div
          className={styles.previewPopup}
          style={{ left: Math.min(hoverPreview.x, window.innerWidth - 280), top: hoverPreview.y }}
          onMouseEnter={keepPreview}
          onMouseLeave={hidePreview}
        >
          <div className={styles.previewPopupTitle}>{hoverPreview.tpl.title}</div>
          {hoverPreview.tpl.sections?.length ? (
            hoverPreview.tpl.sections.slice(0, 6).map((sec, i) => (
              <div key={i} className={styles.previewPopupSection}>
                <Layers size={11} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: 1 }} />
                <span>{sec.sectionName}</span>
                <span className={styles.previewPopupCount}>{sec.items?.length ?? 0}</span>
              </div>
            ))
          ) : (
            <p className={styles.previewPopupEmpty}>No sections yet</p>
          )}
          {(hoverPreview.tpl.sections?.length ?? 0) > 6 && (
            <p className={styles.previewPopupMore}>+{(hoverPreview.tpl.sections?.length ?? 0) - 6} more sections</p>
          )}
        </div>
      )}

      {/* View Panel (slide-over) */}
      {viewTarget && (
        <>
          <div className={styles.viewBackdrop} onClick={() => setViewTarget(null)} />
          <div className={styles.viewPanel}>
            <div className={styles.viewPanelHeader}>
              <div className={styles.viewPanelHeaderLeft}>
                <div className={styles.viewPanelIcon}>
                  {(() => { const cat = getCategoryIcon(viewTarget.title, viewTarget.scope); return <span style={{ color: cat.color }}>{cat.icon}</span>; })()}
                </div>
                <div>
                  <h2 className={styles.viewPanelTitle}>{viewTarget.title}</h2>
                  {viewTarget.description && <p className={styles.viewPanelDesc}>{viewTarget.description}</p>}
                </div>
              </div>
              <button className={styles.viewPanelClose} onClick={() => setViewTarget(null)} title="Close">
                <X size={16} />
              </button>
            </div>
            <div className={styles.viewPanelMeta}>
              <ScopeBadge scope={viewTarget.scope} />
              {viewTarget.isLocked
                ? <span className={styles.lockBadge}><Lock size={11} /> Locked</span>
                : <span className={styles.unlocked}><Unlock size={11} /> Open</span>}
              {viewTarget.organisationName && (
                <span className={styles.viewPanelOrg}>
                  <Building2 size={12} />{viewTarget.organisationName}
                </span>
              )}
            </div>
            <div className={styles.viewPanelBody}>
              {viewLoading ? (
                <div className={styles.viewPanelEmpty}>
                  <RefreshCw size={20} className={styles.spinner} style={{ marginBottom: 8 }} />
                  Loading sections…
                </div>
              ) : (viewTarget.sections?.length ?? 0) === 0 ? (
                <div className={styles.viewPanelEmpty}>No sections in this template</div>
              ) : viewTarget.sections?.map((sec, si) => (
                <div key={si} className={styles.viewPanelSection}>
                  <div className={styles.viewPanelSectionHead}>
                    <Layers size={13} style={{ color: '#9CA3AF' }} />
                    <span className={styles.viewPanelSectionName}>{sec.sectionName}</span>
                    <span className={styles.viewPanelSectionCount}>{sec.items?.length ?? 0} items</span>
                  </div>
                  <div className={styles.viewPanelSectionBody}>
                    {sec.items?.map((item, ii) => (
                      <div key={ii} className={styles.viewPanelItem}>
                        <span className={styles.viewPanelItemDot}><Check size={10} /></span>
                        <div>
                          <p className={styles.viewPanelItemLabel}>{item.label}</p>
                          <span className={styles.viewPanelItemType}>{item.responseType}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.viewPanelFooter}>
              <button className={styles.viewPanelCancelBtn} onClick={() => setViewTarget(null)}>Close</button>
              {!viewTarget.isLocked && (
                <button
                  className={styles.viewPanelOpenBtn}
                  onClick={() => { navigate(`/templates/${viewTarget!.id}/builder`); setViewTarget(null); }}
                >
                  <Pencil size={13} />Open Builder
                </button>
              )}
            </div>
          </div>
        </>
      )}

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
          <div className={styles.deleteFooter}>
            <button className={styles.deleteCancelBtn} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
            <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleting}>
              <Trash2 size={13} />{deleting ? 'Deleting…' : 'Delete Template'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
