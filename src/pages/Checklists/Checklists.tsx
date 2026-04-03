import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Plus, Trash2, RefreshCw,
  Globe, Building2, FolderOpen, Lock, Unlock,
  Check, BookOpen, AlertTriangle,
  Layers, Eye, Copy, Download, Search,
  Home, Warehouse, Zap, Droplets, X, Pencil,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type { TemplateResponse, TemplateScope } from '@/services/models/checklist';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog, DialogContent,
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
type TabKey = 'global' | 'organisation' | 'franchise';

export default function Checklists() {
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const isSuperAdmin = authUser?.isSuperAdmin === true || authUser?.role === 'super_admin';
  const isFranchiseAdmin = !isSuperAdmin && (authUser?.role?.toLowerCase().includes('franchise') === true);
  const isOrgAdmin = !isSuperAdmin && !isFranchiseAdmin;

  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>('global');
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<TemplateResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<TemplateResponse | null>(null);

  const [cloning, setCloning] = useState<Set<string>>(new Set());

  // Quick preview popup
  const [hoverPreview, setHoverPreview] = useState<{ tpl: TemplateResponse; x: number; y: number } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await checklistService.listGlobalTemplates();
      setTemplates(data.filter((t) => t.scope !== 'SCRATCH' && t.scope !== 'PROJECT'));
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Role-based tab visibility ──────────────────────────────────────────────
  type TabDef = { key: TabKey; label: string };
  const allTabs: TabDef[] = [
    { key: 'global', label: '🌐 Global' },
    { key: 'organisation', label: '🏢 Organisation' },
    { key: 'franchise', label: '🏪 Franchise' },
  ];

  // Org Admin: Global + Organisation. Franchise Admin / Super Admin: all 3
  const visibleTabs = isOrgAdmin
    ? allTabs.filter(t => t.key !== 'franchise')
    : allTabs;

  // Parent-org tab = Franchise Admin viewing the "Organisation" tab (read-only)
  const isParentOrgTab = isFranchiseAdmin && tab === 'organisation';

  // ── Filters ──────────────────────────────────────────────────────────────────
  const byTab = templates.filter((t) => {
    if (tab === 'global') return t.scope === 'GLOBAL';
    // Organisation tab: ORGANISATION scope templates where the org has NO parent (pure org)
    if (tab === 'organisation') return t.scope === 'ORGANISATION' && !t.parentOrgId;
    // Franchise tab: ORGANISATION scope templates where the org IS a franchise (has a parent)
    if (tab === 'franchise') return t.scope === 'ORGANISATION' && !!t.parentOrgId;
    return false;
  });
  const filtered = search.trim()
    ? byTab.filter((t) => {
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.organisationName ?? '').toLowerCase().includes(q);
    })
    : byTab;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const canCreate = !isParentOrgTab;
  const canEdit = (t: TemplateResponse) => !isParentOrgTab && !t.isLocked;
  const canDelete = (_t: TemplateResponse) => !isParentOrgTab && (isSuperAdmin || !isOrgAdmin);

  // ── Actions ──────────────────────────────────────────────────────────────────
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

  const handleClone = async (t: TemplateResponse, targetScope?: TemplateScope) => {
    const tid = t.id as string;
    setCloning((prev) => new Set([...prev, tid]));
    try {
      const full = await checklistService.getTemplate(tid);
      const clonedScope = targetScope ?? (full.scope === 'PROJECT' ? 'ORGANISATION' : full.scope);
      const cloned = await checklistService.createTemplate({
        title: `Copy of ${full.title}`,
        description: full.description,
        scope: clonedScope,
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
        {visibleTabs.map((t) => (
          <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => { setTab(t.key); setCurrentPage(1); setSearch(''); }}>
            {t.label}
          </button>
        ))}
        {canCreate && (
          <button className={styles.createBtn}
            onClick={() => navigate(`/templates/new/builder?scope=${isSuperAdmin ? 'GLOBAL' : 'ORGANISATION'}`)}>
            <Plus size={15} /> New Template
          </button>
        )}
      </div>

      {/* Read-only notice for Franchise Admin on Parent Org tab */}
      {isParentOrgTab && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '10px 14px', borderRadius: 10, marginBottom: 14,
          background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
          fontSize: 12.5, color: '#92400E',
        }}>
          <ShieldAlert size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Parent Organisation Templates (Read-Only).</strong>{' '}
            You can view and <strong>Clone</strong> these into your Franchise tab, but cannot edit or delete them.
          </span>
        </div>
      )}

      {/* Panel */}
      <div className={styles.panel}>
        {/* Panel header with count + search */}
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            Templates
            {/* <span className={styles.panelCount}>{filtered.length}</span> */}
          </span>
          {/* <div className={styles.searchBar}>
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
          </div> */}


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
                            {isParentOrgTab && (
                              <span style={{
                                fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                                background: 'rgba(245,158,11,0.1)', color: '#b45309',
                                border: '1px solid rgba(245,158,11,0.2)', textTransform: 'uppercase',
                                letterSpacing: '0.04em', flexShrink: 0,
                              }}>Read-only</span>
                            )}
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
                        {/* View — navigate to builder in read-only mode */}
                        <button
                          className={styles.actionBtn}
                          title="View template"
                          onClick={() => navigate(`/templates/${t.id}/builder?view=true`)}
                        >
                          <Eye size={14} />
                        </button>
                        {/* Open Builder (hidden if read-only tab or locked) */}
                        {!isParentOrgTab && (
                          <button
                            className={`${styles.actionBtn} ${t.isLocked ? styles.actionBtnLocked : ''}`}
                            title={t.isLocked ? 'Template is locked' : 'Open Builder'}
                            onClick={() => canEdit(t) && navigate(`/templates/${t.id}/builder`)}
                            disabled={t.isLocked}
                          >
                            {t.isLocked ? <Lock size={14} /> : <Pencil size={14} />}
                          </button>
                        )}
                        {/* Clone — labelled "Clone" on parent-org tab */}
                        <button
                          className={styles.actionBtn}
                          title={isParentOrgTab ? 'Clone to My Franchise' : 'Duplicate template'}
                          onClick={() => handleClone(t, isParentOrgTab ? 'ORGANISATION' : undefined)}
                          disabled={isCloning}
                        >
                          {isCloning ? <RefreshCw size={14} className={styles.spinner} style={{ width: 14, height: 14, marginBottom: 0 }} /> : <Copy size={14} />}
                        </button>
                        {/* Export */}
                        <button className={styles.actionBtn} title="Export as JSON" onClick={() => handleExport(t)}>
                          <Download size={14} />
                        </button>
                        {/* Delete (hidden on read-only tab) */}
                        {canDelete(t) && (
                          <button className={`${styles.actionBtn} ${styles.danger}`} title="Delete" onClick={() => setDeleteTarget(t)}>
                            <Trash2 size={14} />
                          </button>
                        )}
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
              {(viewTarget.nodes?.length ?? 0) > 0 ? (
                viewTarget.nodes!.map((node, ni) => (
                  <div key={ni} className={styles.viewPanelSection}>
                    <div className={styles.viewPanelSectionHead}>
                      <FolderOpen size={13} style={{ color: '#9CA3AF' }} />
                      <span className={styles.viewPanelSectionName}>{node.name}</span>
                      <span className={styles.viewPanelSectionCount}>
                        {node.type === 'FOLDER' ? `${node.children?.length ?? 0} children` : node.panelType ?? ''}
                      </span>
                    </div>
                    {node.children && node.children.length > 0 && (
                      <div className={styles.viewPanelSectionBody}>
                        {node.children.map((child, ci) => (
                          <div key={ci} className={styles.viewPanelItem}>
                            <span className={styles.viewPanelItemDot}>
                              {child.type === 'FOLDER' ? <Layers size={10} /> : <Check size={10} />}
                            </span>
                            <div>
                              <p className={styles.viewPanelItemLabel}>{child.name}</p>
                              {child.panelType && <span className={styles.viewPanelItemType}>{child.panelType}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.viewPanelEmpty} style={{ flexDirection: 'column', gap: 10 }}>
                  <Layers size={28} style={{ color: '#D1D5DB' }} />
                  <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>No content yet</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Open the builder to add folders and items.</p>
                </div>
              )}
            </div>
            <div className={styles.viewPanelFooter}>
              <button className={styles.viewPanelCancelBtn} onClick={() => setViewTarget(null)}>Close</button>
              {isParentOrgTab ? (
                <button
                  className={styles.viewPanelOpenBtn}
                  onClick={() => { handleClone(viewTarget, 'ORGANISATION'); setViewTarget(null); }}
                >
                  <Copy size={13} /> Clone to My Franchise
                </button>
              ) : (
                <button
                  className={styles.viewPanelOpenBtn}
                  onClick={() => { navigate(`/templates/${viewTarget!.id}/builder`); setViewTarget(null); }}
                >
                  <Pencil size={13} /> Open Builder
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md" style={{ padding: 0, overflow: 'hidden', borderRadius: 14 }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#263B4F' }}>Delete Template</p>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: 'rgba(220,38,38,0.08)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#dc2626',
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#263B4F' }}>Are you sure?</p>
              <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                <strong style={{ color: '#263B4F' }}>&#8220;{deleteTarget?.title}&#8221;</strong> will be permanently deleted and cannot be recovered.
              </p>
            </div>
          </div>
          <div style={{
            padding: '14px 24px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          }}>
            <button
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', color: '#263B4F', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: '#DC2626', color: 'white', fontSize: 13, fontWeight: 600,
                cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.65 : 1,
                boxShadow: '0 2px 8px rgba(220,38,38,0.25)',
              }}
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={13} />{deleting ? 'Deleting…' : 'Delete Template'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
