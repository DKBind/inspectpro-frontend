import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle,
  ChevronRight, ChevronDown, Layers, Plus, Send, ClipboardCheck,
  Copy, Trash2, Folder, FolderOpen, ArrowUp, ArrowDown,
  Edit2, Search, X, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type {
  InspectionWithResultsResponse,
  InspectionResultResponse,
} from '@/services/models/checklist';
import { useAuthStore } from '@/store/useAuthStore';

// ─── Child Components ────────────────────────────────────────────────────────
import InspectionImageUpload from './components/InspectionImageUpload';

// ─── TemplateBuilder CSS (shared styles) ─────────────────────────────────────
import tbCss from '../Templates/TemplateBuilder.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface LocalResult extends InspectionResultResponse {
  reportName?: string;
  _dirty: boolean;
  _saving: boolean;
}

function toLocal(r: InspectionResultResponse): LocalResult {
  return { ...r, _dirty: false, _saving: false };
}

// ─── N-Tier Nodal Tree ────────────────────────────────────────────────────────
export interface NavNode {
  name: string;
  fullPath: string;
  children: Record<string, NavNode>;
  results: LocalResult[];
  isLeaf: boolean;
}

function parsePath(sectionName: string): string[] {
  return sectionName.split(' › ').map(s => s.trim()).filter(Boolean);
}

function buildTree(results: LocalResult[], emptyFolders: string[] = []): Record<string, NavNode> {
  const root: Record<string, NavNode> = {};
  results.forEach(r => {
    const parts = parsePath(r.sectionName || 'Other');
    let currentMap = root;
    let currentPath = '';
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath} › ${part}` : part;
      if (!currentMap[part]) {
        currentMap[part] = { name: part, fullPath: currentPath, children: {}, results: [], isLeaf: false };
      }
      if (i === parts.length - 1) {
        currentMap[part].isLeaf = true;
        currentMap[part].results.push(r);
      }
      currentMap = currentMap[part].children;
    });
  });

  emptyFolders.forEach(folderPath => {
    const parts = parsePath(folderPath);
    let currentMap = root;
    let currentPath = '';
    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath} › ${part}` : part;
      if (!currentMap[part]) {
        currentMap[part] = { name: part, fullPath: currentPath, children: {}, results: [], isLeaf: false };
      }
      if (i === parts.length - 1) {
        currentMap[part].isLeaf = false;
      }
      currentMap = currentMap[part].children;
    });
  });

  return root;
}

function getNodeAtPath(tree: Record<string, NavNode>, path: string[]): NavNode | null {
  if (path.length === 0) return null;
  let currentMap = tree;
  let node: NavNode | null = null;
  for (const part of path) {
    node = currentMap[part];
    if (!node) return null;
    currentMap = node.children;
  }
  return node;
}

function getAllLeafPaths(tree: Record<string, NavNode>): string[][] {
  const leaves: string[][] = [];
  function traverse(nodes: Record<string, NavNode>, currentPath: string[]) {
    for (const [key, node] of Object.entries(nodes)) {
      const path = [...currentPath, key];
      if (node.isLeaf) leaves.push(path);
      traverse(node.children, path);
    }
  }
  traverse(tree, []);
  return leaves;
}

function nodeMatchesSearch(node: NavNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true;
  return Object.values(node.children).some(c => nodeMatchesSearch(c, q));
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InspectionExecution() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isInspector = !user?.isSuperAdmin && user?.role?.toLowerCase() === 'inspector';

  const [inspection, setInspection] = useState<InspectionWithResultsResponse | null>(null);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Navigation
  const [activePath, setActivePath] = useState<string[]>([]);
  const [openNavSections, setOpenNavSections] = useState<Set<string>>(new Set());
  const [localEmptyFolders, setLocalEmptyFolders] = useState<string[]>(() => {
    if (!inspectionId) return [];
    try {
      const raw = localStorage.getItem(`insp-folders-${inspectionId}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Section-complete prompt
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);

  // Sidebar search
  const [navSearch, setNavSearch] = useState('');

  // Navigation Sidebar Add Folder Modal
  const [navAddOpen, setNavAddOpen] = useState(false);
  const [navAddLabel, setNavAddLabel] = useState('');
  const navAddInputRef = useRef<HTMLInputElement>(null);

  // Inline rename in sidebar
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  // Workspace Inline Add Item 
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  // Edit Item Modal (double-click to open, like TemplateBuilder)
  const [editItemModal, setEditItemModal] = useState<LocalResult | null>(null);

  // Focused panel row in folder view (for toolbar Up/Down/Copy/Delete)
  const [focusedPanelPath, setFocusedPanelPath] = useState<string | null>(null);

  // Add panel to folder — modal state
  const [folderPanelAddOpen, setFolderPanelAddOpen] = useState(false);
  const [folderPanelAddLabel, setFolderPanelAddLabel] = useState('');
  const [folderPanelAddType, setFolderPanelAddType] = useState<'SELECTION' | 'DAMAGE'>('SELECTION');
  const folderPanelAddInputRef = useRef<HTMLInputElement>(null);

  // Move / Copy to section modal
  const [moveCopyModal, setMoveCopyModal] = useState<{
    item: LocalResult;
    mode: 'move' | 'copy';
  } | null>(null);

  const [sectionMoveCopyModal, setSectionMoveCopyModal] = useState<{
    pattern: string;
    mode: 'move' | 'copy';
  } | null>(null);

  const [adding, setAdding] = useState(false);

  // ── Draft localStorage helpers ─────────────────────────────────────────────
  const draftKey = inspectionId ? `insp-draft-${inspectionId}` : null;

  const readDraft = (): Map<string | number, { id: string | number; responseValue?: string; comments?: string; severity?: string }> => {
    if (!draftKey) return new Map();
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return new Map();
      const entries: { id: string | number; responseValue?: string; comments?: string; severity?: string }[] = JSON.parse(raw);
      return new Map(entries.map(e => [e.id, e]));
    } catch { return new Map(); }
  };

  const writeDraft = (current: LocalResult[]) => {
    if (!draftKey) return;
    const dirty = current.filter(r => r._dirty);
    if (dirty.length === 0) { localStorage.removeItem(draftKey); return; }
    localStorage.setItem(draftKey, JSON.stringify(dirty.map(r => ({
      id: r.id, responseValue: r.responseValue, comments: r.comments, severity: r.severity,
    }))));
  };

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!inspectionId) return;
    setLoading(true);
    try {
      const data = await checklistService.getInspectionWithResults(inspectionId);
      setInspection(data);
      const draft = readDraft();
      const loaded: LocalResult[] = data.results.map(r => {
        const ov = draft.get(r.id);
        if (ov) {
          return {
            ...toLocal(r),
            responseValue: (ov.responseValue ?? r.responseValue) as LocalResult['responseValue'],
            comments: ov.comments ?? r.comments,
            severity: (ov.severity as LocalResult['severity']) ?? r.severity,
            _dirty: true,
            _saving: false,
          };
        }
        return toLocal(r);
      });
      setResults(loaded);

      const newTree = buildTree(loaded, localEmptyFolders);
      const rootKeys = Object.keys(newTree);
      if (rootKeys.length > 0) {
        setActivePath(prev => prev.length ? prev : [rootKeys[0]]);
        setOpenNavSections(prev => new Set([...prev, rootKeys[0]]));
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to load inspection');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, localEmptyFolders]);

  useEffect(() => { load(); }, [load]);

  // Persist empty folders to localStorage whenever they change
  useEffect(() => {
    if (!inspectionId) return;
    if (localEmptyFolders.length === 0) {
      localStorage.removeItem(`insp-folders-${inspectionId}`);
    } else {
      localStorage.setItem(`insp-folders-${inspectionId}`, JSON.stringify(localEmptyFolders));
    }
  }, [localEmptyFolders, inspectionId]);

  // Auto-retry for empty results
  useEffect(() => {
    if (!loading && inspection && results.length === 0 && retryCount < 2) {
      const t = setTimeout(() => { setRetryCount(c => c + 1); load(); }, 2000);
      return () => clearTimeout(t);
    }
  }, [loading, inspection, results.length, retryCount, load]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const tree = useMemo(() => buildTree(results, localEmptyFolders), [results, localEmptyFolders]);
  const allLeafPaths = useMemo(() => getAllLeafPaths(tree), [tree]);
  const currentNode = useMemo(() => getNodeAtPath(tree, activePath), [tree, activePath]);
  const activeNodeResults = currentNode ? (currentNode.isLeaf ? currentNode.results : []) : [];
  const answered = results.filter(r => !!r.responseValue).length;
  const pct = results.length > 0 ? Math.round((answered / results.length) * 100) : 0;
  const isPanelComplete = currentNode?.isLeaf && activeNodeResults.length > 0 && activeNodeResults.every(r => !!r.responseValue);
  const currentPathString = activePath.join(' › ');
  const currentLeafIndex = allLeafPaths.findIndex(p => p.join(' › ') === currentPathString);
  const nextPanelPath = currentLeafIndex >= 0 && currentLeafIndex < allLeafPaths.length - 1 ? allLeafPaths[currentLeafIndex + 1] : null;
  const prevPanelPath = currentLeafIndex > 0 ? allLeafPaths[currentLeafIndex - 1] : null;

  useEffect(() => {
    if (isPanelComplete && nextPanelPath) setShowCompletePrompt(true);
    else setShowCompletePrompt(false);
  }, [isPanelComplete, nextPanelPath]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToNode = (path: string[]) => {
    setActivePath(path);
    setShowCompletePrompt(false);
    setNavAddOpen(false);
    setNavAddLabel('');
    if (path.length > 0) setOpenNavSections(prev => new Set([...prev, path[0]]));
  };

  const goToNextPanel = () => { if (nextPanelPath) goToNode(nextPanelPath); };

  const toggleNavSection = (pathStr: string) => {
    setOpenNavSections(prev => {
      const next = new Set(prev);
      next.has(pathStr) ? next.delete(pathStr) : next.add(pathStr);
      return next;
    });
  };

  // ── Status & save ─────────────────────────────────────────────────────────
  const setStatus = (resultId: number | string, status: 'ACCEPTABLE' | 'DEFECTIVE' | null) => {
    saveResult(resultId, status);
  };

  // All changes are stored locally first; flushed to DB on Submit
  const saveResult = (resultId: number | string, status: 'ACCEPTABLE' | 'DEFECTIVE' | null, comments?: string, photoUrl?: string) => {
    setResults(prev => {
      const next = prev.map(r => r.id === resultId
        ? { ...r, responseValue: status ?? undefined, comments: comments ?? r.comments, ...(photoUrl !== undefined ? { photoUrl } : {}), _dirty: true, _saving: false }
        : r
      );
      writeDraft(next);
      return next;
    });
  };

  const updateComment = (resultId: number | string, comments: string) => {
    setResults(prev => {
      const next = prev.map(r => r.id === resultId ? { ...r, comments, _dirty: true } : r);
      writeDraft(next);
      return next;
    });
  };

  const setSeverityLocal = (resultId: number | string, severity: Severity) => {
    setResults(prev => {
      const next = prev.map(r => r.id === resultId ? { ...r, severity, _dirty: true } : r);
      writeDraft(next);
      return next;
    });
  };

  const closeNavAdd = () => { setNavAddOpen(false); setNavAddLabel(''); };

  // ── Add folder (always creates folder with default panel inside) ───────────
  const handleNavAdd = async () => {
    if (!inspectionId || !navAddLabel.trim()) return;

    const currentActiveNode = getNodeAtPath(buildTree(results, localEmptyFolders), activePath);
    let targetParentPath = activePath;
    if (currentActiveNode?.isLeaf) targetParentPath = activePath.slice(0, -1);

    const nameToCreate = navAddLabel.trim();
    const currentFolderNode = getNodeAtPath(buildTree(results, localEmptyFolders), targetParentPath);
    if (currentFolderNode && Object.values(currentFolderNode.children).some(c => c.name.toLowerCase() === nameToCreate.toLowerCase())) {
      toast.error('A folder with this name already exists here.');
      return;
    }

    setAdding(true);
    const folderPath = [...targetParentPath, nameToCreate].join(' › ');
    try {
      setLocalEmptyFolders(prev => Array.from(new Set([...prev, folderPath])));
      closeNavAdd();
      toast.success('Folder created');
      goToNode([...targetParentPath, nameToCreate]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to add folder');
    } finally {
      setAdding(false);
    }
  };

  const closeFolderPanelAdd = () => { setFolderPanelAddOpen(false); setFolderPanelAddLabel(''); };

  const handleFolderPanelAdd = async () => {
    if (!inspectionId || !currentNode || !folderPanelAddLabel.trim()) return;
    const panelName = folderPanelAddLabel.trim();
    // Check duplicate panel name in this folder
    const existingLeaves = Object.values(currentNode.children).filter(c => c.isLeaf);
    if (existingLeaves.some(c => c.name.toLowerCase() === panelName.toLowerCase())) {
      toast.error('A panel with this name already exists here.');
      return;
    }
    setAdding(true);
    const sectionPath = [currentNode.fullPath, panelName].join(' › ');
    try {
      const newResult = await checklistService.addCustomResult(inspectionId, {
        itemLabel: 'New Item',
        sectionName: sectionPath,
        logicType: folderPanelAddType,
      });
      setResults(prev => [...prev, toLocal(newResult)]);
      setLocalEmptyFolders(prev => prev.filter(p => !sectionPath.startsWith(p + ' › ') && p !== currentNode.fullPath));
      closeFolderPanelAdd();
      toast.success('Panel added');
      goToNode([...activePath, panelName]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to add panel');
    } finally {
      setAdding(false);
    }
  };

  // ── Submit — flush localStorage draft to DB, then complete ───────────────
  const handleSubmit = async () => {
    if (results.length === 0) { toast.error('No inspection items found.'); return; }
    const pending = results.filter(r => !r.responseValue).length;
    if (pending > 0) { toast.error(`${pending} item${pending !== 1 ? 's' : ''} still need a response.`); return; }
    setSubmitting(true);
    try {
      const dirty = results.filter(r => r._dirty);
      if (dirty.length > 0) {
        await Promise.all(dirty.map(r =>
          checklistService.updateInspectionResult(r.id, {
            responseValue: r.responseValue ?? '',
            ...(r.comments !== undefined ? { comments: r.comments } : {}),
            ...(r.severity !== undefined ? { severity: r.severity } : {}),
          })
        ));
      }
      await checklistService.completeInspection(inspectionId!);
      if (draftKey) localStorage.removeItem(draftKey);
      if (inspectionId) localStorage.removeItem(`insp-folders-${inspectionId}`);
      toast.success('Inspection submitted! Status set to COMPLETED.');
      navigate(-1);
    } catch {
      toast.error('Failed to save results. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ie-empty">
        <RefreshCw className="ie-spinner" size={26} />
        <p>Loading inspection…</p>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="ie-empty">
        <AlertTriangle size={26} style={{ color: '#D1D5DB', marginBottom: 12 }} />
        <p>Inspection not found.</p>
      </div>
    );
  }

  const isCompleted = inspection.status === 'COMPLETED' || inspection.status === 'SUBMITTED';
  // Non-inspectors (super admin, org, franchise) can view but not perform inspections
  const readOnly = isCompleted || !isInspector;

  // Filtered tree for search
  const filteredTree = navSearch
    ? Object.fromEntries(Object.entries(tree).filter(([, node]) => nodeMatchesSearch(node, navSearch.toLowerCase())))
    : tree;

  return (
    <div className={tbCss.page}>

      {/* ═══ TOP NAV BAR ═══ */}
      <header className={tbCss.header}>
        <button className={tbCss.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <span className={tbCss.headerSep}>/</span>
        <span className={tbCss.headerTitle}>{inspection.projectName ?? 'Inspection'}</span>
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: pct === 100 ? 'rgba(34,197,94,0.1)' : 'rgba(51,174,149,0.08)',
          color: pct === 100 ? '#16a34a' : '#298E7A',
          border: `1px solid ${pct === 100 ? 'rgba(34,197,94,0.25)' : 'rgba(51,174,149,0.22)'}`,
        }}>
          {pct === 100 ? <CheckCircle2 size={11} /> : null}
          {pct}% · {answered}/{results.length}
        </span>
        {isCompleted && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: 'rgba(34,197,94,0.1)', color: '#16a34a',
            border: '1px solid rgba(34,197,94,0.25)',
          }}>
            <CheckCircle2 size={11} /> Completed
          </span>
        )}
        {!isCompleted && !isInspector && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: 'rgba(245,158,11,0.1)', color: '#b45309',
            border: '1px solid rgba(245,158,11,0.25)',
          }}>
            View Only
          </span>
        )}
      </header>

      {/* ═══ TITLE CARD ═══ */}
      <div className={tbCss.titleCard}>
        <div className={tbCss.titleCardIcon}>
          <ClipboardCheck size={22} color="#33AE95" />
        </div>
        <div className={tbCss.titleCardBody}>
          <div className={tbCss.titleCardMeta}>
            <span className={tbCss.titleCardBadge}>{isCompleted ? 'Completed' : 'In Progress'}</span>
            {/* Progress bar */}
            <div style={{ flex: 1, height: 5, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden', margin: '0 12px', maxWidth: 220 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg,#33AE95,#298E7A)', borderRadius: 10, transition: 'width 0.5s' }} />
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginTop: 4 }}>
            {inspection.projectName ?? 'Inspection'}
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            {inspection.templateTitle ?? ''}
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className={tbCss.body}>

        {/* ════ LEFT SIDEBAR ════ */}
        <nav className={tbCss.sidebar}>

          {/* Sidebar header */}
          <div className={tbCss.sidebarHead}>
            <div className={tbCss.sidebarHeadIcon}>
              <FolderOpen size={14} color="#33AE95" />
            </div>
            <span className={tbCss.sidebarHeadTitle}>Sections</span>
          </div>

          {/* Search box */}
          <div className={tbCss.searchWrap}>
            <div className={tbCss.searchBox}>
              <Search size={12} color="#9CA3AF" style={{ flexShrink: 0 }} />
              <input
                value={navSearch}
                onChange={e => setNavSearch(e.target.value)}
                placeholder="Search…"
                className={tbCss.searchInput}
              />
              {navSearch && (
                <button onClick={() => setNavSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', display: 'flex' }}>
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Tree */}
          <div className={tbCss.treeArea}>
            {Object.keys(filteredTree).length === 0 && (
              <p style={{ fontSize: 13, color: '#9CA3AF', padding: '16px', margin: 0, textAlign: 'center' }}>
                {navSearch ? 'No matches found.' : 'No sections yet.\nClick + below to add one.'}
              </p>
            )}
            {(() => {
              const activeFolderFullPath = (() => {
                const activeNode = getNodeAtPath(tree, activePath);
                return activeNode?.isLeaf ? activePath.slice(0, -1).join(' › ') : activePath.join(' › ');
              })();

              const renderNavNode = (node: NavNode, depth = 0): React.ReactNode => {
                if (node.isLeaf) return null;
                const isNavOpen = openNavSections.has(node.fullPath) || activePath.join(' › ').startsWith(node.fullPath);
                const hasFolderChildren = Object.values(node.children).some(c => !c.isLeaf);
                const isActive = activeFolderFullPath === node.fullPath;
                const isRenaming = renamingPath === node.fullPath;
                const basePad = 22 + depth * 14;

                const stats = { answered: 0, total: 0 };
                const accStats = (n: NavNode) => {
                  stats.total += n.results.length;
                  stats.answered += n.results.filter(r => !!r.responseValue).length;
                  Object.values(n.children).forEach(accStats);
                };
                accStats(node);
                const isDone = stats.total > 0 && stats.answered === stats.total;

                return (
                  <div key={node.fullPath}>
                    <div
                      className={`${tbCss.nodeRow} ${isActive ? tbCss.nodeRowActive : ''}`}
                      onClick={() => {
                        if (isRenaming) return;
                        if (hasFolderChildren) toggleNavSection(node.fullPath);
                        goToNode(node.fullPath.split(' › '));
                      }}
                    >
                      {/* Chevron */}
                      {hasFolderChildren ? (
                        <button
                          onClick={e => { e.stopPropagation(); toggleNavSection(node.fullPath); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: `7px 4px 7px ${basePad}px`, color: '#9CA3AF', display: 'flex', flexShrink: 0 }}
                        >
                          {isNavOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      ) : (
                        <span style={{ paddingLeft: basePad + 16, paddingRight: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }} />
                      )}

                      {/* Icon */}
                      <span style={{ flexShrink: 0, marginRight: 7, display: 'flex', alignItems: 'center' }}>
                        {isNavOpen || isActive
                          ? <FolderOpen size={14} color={isDone ? '#33AE95' : isActive ? '#298E7A' : '#6B7280'} />
                          : <Folder size={14} color={isDone ? '#33AE95' : '#6B7280'} />}
                      </span>

                      {/* Label (inline rename) */}
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onBlur={() => {
                            if (renameVal.trim()) {
                              const oldPath = node.fullPath;
                              const newName = renameVal.trim();
                              setResults(prev => prev.map(r => {
                                if (!r.sectionName) return r;
                                if (r.sectionName === oldPath || r.sectionName.startsWith(oldPath + ' › ')) {
                                  return { ...r, sectionName: r.sectionName.replace(oldPath, oldPath.split(' › ').slice(0, -1).concat(newName).join(' › ')) };
                                }
                                return r;
                              }));
                            }
                            setRenamingPath(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setRenamingPath(null);
                            e.stopPropagation();
                          }}
                          onClick={e => e.stopPropagation()}
                          className={tbCss.nodeLabelInput}
                        />
                      ) : (
                        <span className={tbCss.nodeLabel} style={{
                          fontSize: depth === 0 ? 14 : 13,
                          fontWeight: depth === 0 ? 600 : (isActive ? 500 : 400),
                          color: isActive ? '#298E7A' : '#263B4F',
                          paddingBlock: depth === 0 ? 8 : 7,
                        }}>
                          {node.name}
                        </span>
                      )}

                      {/* Node actions (matching TemplateBuilder exactly) */}
                      {!isRenaming && !readOnly && (
                        <div className={tbCss.nodeActions} onClick={e => e.stopPropagation()}>
                          {/* Add child (+ icon — matching TemplateBuilder's "Add Child") */}
                          <button
                            className={tbCss.nodeActionBtn}
                            title="Add folder inside"
                            onClick={() => {
                              goToNode(node.fullPath.split(' › '));
                              setNavAddOpen(true);
                              setTimeout(() => navAddInputRef.current?.focus(), 50);
                            }}
                          >
                            <Plus size={10} />
                          </button>
                          {/* Copy (depth > 0 only — matching TemplateBuilder) */}
                          {depth > 0 && (
                            <button
                              className={tbCss.nodeActionBtn}
                              title="Copy folder"
                              onClick={() => {
                                const prefix = node.fullPath;
                                const copyName = `${node.name} (Copy)`;
                                const parentPath = node.fullPath.split(' › ').slice(0, -1).join(' › ');
                                const copyPath = parentPath ? `${parentPath} › ${copyName}` : copyName;
                                const toCopy = results.filter(r => r.sectionName === prefix || r.sectionName?.startsWith(prefix + ' › '));
                                const copies = toCopy.map(r => ({
                                  ...r,
                                  id: Date.now() + Math.random(),
                                  sectionName: r.sectionName!.replace(prefix, copyPath),
                                  responseValue: undefined,
                                }));
                                setResults(prev => [...prev, ...copies as LocalResult[]]);
                                toast.success(`"${node.name}" copied`);
                              }}
                            >
                              <Copy size={10} />
                            </button>
                          )}
                          {/* Rename */}
                          <button
                            className={tbCss.nodeActionBtn}
                            title="Rename"
                            onClick={() => { setRenamingPath(node.fullPath); setRenameVal(node.name); }}
                          >
                            <Edit2 size={10} />
                          </button>
                          {/* Delete */}
                          <button
                            className={`${tbCss.nodeActionBtn} ${tbCss.nodeActionBtnDanger}`}
                            title="Delete folder"
                            onClick={() => {
                              const prefix = node.fullPath;
                              setResults(prev => prev.filter(r => r.sectionName !== prefix && !r.sectionName?.startsWith(prefix + ' › ')));
                              if (activePath.join(' › ').startsWith(prefix)) goToNode([]);
                              toast.success(`"${node.name}" removed`);
                            }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Children */}
                    {hasFolderChildren && isNavOpen && (
                      <div>
                        {Object.values(node.children).map(c => renderNavNode(c, depth + 1))}
                      </div>
                    )}
                  </div>
                );
              };

              return Object.values(filteredTree).map(rootNode => renderNavNode(rootNode, 0));
            })()}
          </div>

          {/* Sidebar footer — always creates folder */}
          {!readOnly && (
            <div className={tbCss.sidebarFooter}>
              <button
                className={tbCss.sidebarAddBtn}
                onClick={() => {
                  setNavAddOpen(true);
                  setTimeout(() => navAddInputRef.current?.focus(), 50);
                }}
              >
                <Plus size={13} /> Add New
              </button>
            </div>
          )}
        </nav>

        {/* ════ RIGHT WORKSPACE ════ */}
        <main className={tbCss.workspace}>

          {/* Breadcrumb bar */}
          <div className={tbCss.breadcrumbBar}>
            {activePath.length > 0 && (
              <>
                <button
                  className={tbCss.bcBackBtn}
                  onClick={() => goToNode(activePath.slice(0, -1))}
                >
                  <ArrowLeft size={12} />
                  {activePath.length > 1 ? activePath[activePath.length - 2] : 'Menu'}
                </button>
                <span className={tbCss.bcBarDivider} />
              </>
            )}
            <button
              className={`${tbCss.bcBtn} ${activePath.length === 0 ? tbCss.bcActive : tbCss.bcLink}`}
              onClick={() => goToNode([])}
            >
              <FolderOpen size={13} /> Inspection
            </button>
            {activePath.map((part, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={12} color="#D1D5DB" style={{ flexShrink: 0 }} />
                <button
                  className={`${tbCss.bcBtn} ${i === activePath.length - 1 ? tbCss.bcActive : tbCss.bcLink}`}
                  onClick={() => goToNode(activePath.slice(0, i + 1))}
                >
                  {part}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Scrollable content */}
          <div className={tbCss.scrollArea} style={{ paddingBottom: 80 }}>

            {/* Empty / retry state */}
            {results.length === 0 && localEmptyFolders.length === 0 && (
              <div className="ie-empty">
                {retryCount < 2 ? (
                  <><RefreshCw className="ie-spinner" size={22} /><p>Loading inspection items…</p></>
                ) : (
                  <>
                    <AlertTriangle size={28} style={{ color: '#D1D5DB', marginBottom: 12 }} />
                    <p style={{ fontWeight: 600, color: '#374151' }}>No inspection items found</p>
                    <p style={{ fontSize: 12.5, color: '#9CA3AF', maxWidth: 340, textAlign: 'center' }}>
                      Re-assign the template from the Project page.
                    </p>
                    <button className="ie-fBtn ie-fBtn-primary" style={{ marginTop: 12 }} onClick={() => { setRetryCount(0); load(); }}>
                      <RefreshCw size={13} /> Refresh
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Root level — show folder cards */}
            {activePath.length === 0 && (results.length > 0 || localEmptyFolders.length > 0) && (
              <div className={tbCss.fadeUp}>
                <div className={tbCss.cgHeader}>
                  <div>
                    <h2 className={tbCss.cgTitle}>Inspection Checklist</h2>
                    <p className={tbCss.cgSub}>{Object.keys(tree).length} section{Object.keys(tree).length !== 1 ? 's' : ''} · {pct}% complete</p>
                  </div>
                </div>
                <div className={tbCss.cgGrid}>
                  {Object.values(tree).filter(n => !n.isLeaf).map(node => {
                    const s = { answered: 0, total: 0 };
                    const acc = (n: NavNode) => { s.total += n.results.length; s.answered += n.results.filter(r => !!r.responseValue).length; Object.values(n.children).forEach(acc); };
                    acc(node);
                    const isDone = s.total > 0 && s.answered === s.total;
                    return (
                      <button key={node.fullPath} className={tbCss.cgCard} onClick={() => goToNode(node.fullPath.split(' › '))}>
                        <div className={tbCss.cgCardIcon}>
                          <FolderOpen size={22} color={isDone ? '#22c55e' : '#33AE95'} />
                        </div>
                        <div className={tbCss.cgCardName}>{node.name}</div>
                        <div className={tbCss.cgCardMeta}>{s.answered}/{s.total} answered</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Folder node — show child sections as panel rows */}
            {currentNode && !currentNode.isLeaf && (results.length > 0 || localEmptyFolders.length > 0) && (
              <div className={tbCss.fadeUp}>
                <div className={tbCss.cgHeader} style={{ marginBottom: 12 }}>
                  <div>
                    <h2 className={tbCss.cgTitle}>{currentNode.name}</h2>
                    <p className={tbCss.cgSub}>
                      {Object.values(currentNode.children).length} panel{Object.values(currentNode.children).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {(() => {
                  const leafChildren = Object.values(currentNode.children).filter(c => c.isLeaf);
                  const folderChildren = Object.values(currentNode.children).filter(c => !c.isLeaf);

                  return (
                    <>
                      {/* Leaf panels as panel rows — matching TemplateBuilder's FolderChecklistView */}
                      {leafChildren.length > 0 && (
                        <div className={tbCss.panelRowList}>
                          {leafChildren.map(child => {
                            const cAnswered = child.results.filter(r => !!r.responseValue).length;
                            const cTotal = child.results.length;
                            const cPct = cTotal > 0 ? Math.round((cAnswered / cTotal) * 100) : 0;
                            const isDone = cPct === 100;
                            const inProg = cAnswered > 0 && !isDone;
                            const logicType = child.results[0]?.logicType;
                            const isSel = !logicType || logicType === 'SELECTION';
                            const accent = isDone ? '#29A356' : inProg ? '#3B82F6' : isSel ? '#29A356' : '#EF4444';

                            const isFocused = focusedPanelPath === child.fullPath;
                            return (
                              <div
                                key={child.fullPath}
                                className={`${tbCss.panelRowItem} ${isFocused ? tbCss.panelRowItemFocused : ''}`}
                                onClick={() => setFocusedPanelPath(isFocused ? null : child.fullPath)}
                              >
                                <div className={tbCss.panelRowAccent} style={{ background: accent }} />
                                <div className={tbCss.panelRowContent}>
                                  {isDone
                                    ? <CheckCircle2 size={15} style={{ color: accent, flexShrink: 0 }} />
                                    : isSel
                                      ? <CheckCircle2 size={15} style={{ color: accent, flexShrink: 0 }} />
                                      : <AlertTriangle size={15} style={{ color: accent, flexShrink: 0 }} />}
                                  <div className={tbCss.panelRowLabel}>
                                    <span className={tbCss.panelHeadName}>{child.name}</span>
                                    <span className={tbCss.panelAccordionSub}>{cAnswered}/{cTotal} answered</span>
                                  </div>
                                  <span className={isSel ? tbCss.panelBadgeSel : tbCss.panelBadgeDmg}>
                                    {isSel ? 'SELECTION' : 'DAMAGE'}
                                  </span>
                                  <span style={{
                                    fontSize: 11, fontWeight: 700, minWidth: 34, textAlign: 'right',
                                    color: isDone ? '#16a34a' : inProg ? '#2563eb' : '#94A3B8',
                                  }}>{cPct}%</span>
                                  <button
                                    className={tbCss.panelRowOpenBtn}
                                    onClick={e => { e.stopPropagation(); goToNode(child.fullPath.split(' › ')); }}
                                  >
                                    <ChevronRight size={15} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Sub-folder cards */}
                      {folderChildren.length > 0 && (
                        <div className={tbCss.cgGrid} style={{ marginTop: leafChildren.length > 0 ? 16 : 0 }}>
                          {folderChildren.map(child => {
                            const s = { answered: 0, total: 0 };
                            const acc = (n: NavNode) => { s.total += n.results.length; s.answered += n.results.filter(r => !!r.responseValue).length; Object.values(n.children).forEach(acc); };
                            acc(child);
                            const isDone = s.total > 0 && s.answered === s.total;
                            return (
                              <button key={child.fullPath} className={tbCss.cgCard} onClick={() => goToNode(child.fullPath.split(' › '))}>
                                <div className={tbCss.cgCardIcon}>
                                  <FolderOpen size={22} color={isDone ? '#22c55e' : '#33AE95'} />
                                </div>
                                <div className={tbCss.cgCardName}>{child.name}</div>
                                <div className={tbCss.cgCardMeta}>{s.answered}/{s.total} answered</div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {leafChildren.length === 0 && folderChildren.length === 0 && (
                        <div className={tbCss.panelCardsEmpty}>
                          <Layers size={40} color="#D1D5DB" />
                          <p>No panels yet.<br />Use the toolbar below to add a panel.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Leaf node — show inspection items */}
            {currentNode && currentNode.isLeaf && (
              <div className={tbCss.fadeUp}>
                {(() => {
                  let panelResults = activeNodeResults;
                  if (isCompleted) panelResults = panelResults.filter(r => !!r.responseValue);

                  const logicType = panelResults[0]?.logicType || currentNode.results[0]?.logicType || 'SELECTION';
                  const isSel = logicType === 'SELECTION';
                  const accent = isSel ? '#29A356' : '#EF4444';
                  const accentLight = isSel ? 'rgba(41,163,86,0.07)' : 'rgba(239,68,68,0.05)';
                  const accentBorder = isSel ? 'rgba(41,163,86,0.18)' : 'rgba(239,68,68,0.18)';

                  const pAnswered = panelResults.filter(r => !!r.responseValue).length;
                  const pPct = panelResults.length > 0 ? Math.round((pAnswered / panelResults.length) * 100) : 0;

                  if (panelResults.length === 0 && !isCompleted) {
                    return (
                      <div className={`${tbCss.panelCard} ${isSel ? tbCss.panelCardHeadSel : tbCss.panelCardHeadDmg}`}>
                        <div className={tbCss.panelHead} style={{ background: accentLight, borderBottom: `1px solid ${accentBorder}` }}>
                          {isSel
                            ? <CheckCircle2 size={15} style={{ color: accent, flexShrink: 0 }} />
                            : <AlertTriangle size={15} style={{ color: accent, flexShrink: 0 }} />}
                          <span className={tbCss.panelHeadName}>{currentNode.name}</span>
                          <span className={isSel ? tbCss.panelBadgeSel : tbCss.panelBadgeDmg}>{isSel ? 'SELECTION' : 'DAMAGE'}</span>
                        </div>
                        <p className={tbCss.panelEmpty}>No items yet. Click "Add Item" below.</p>
                        <button
                          className={`${tbCss.panelFooterBtn} ${isSel ? tbCss.panelFooterBtnSel : tbCss.panelFooterBtnDmg}`}
                          onClick={() => setAddItemModalOpen(true)}
                        >
                          <Plus size={12} /> Add Item
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className={`${tbCss.panelCard} ${isSel ? tbCss.panelCardHeadSel : tbCss.panelCardHeadDmg}`}>
                      {/* Panel header — matching TemplateBuilder's panelHead */}
                      <div className={tbCss.panelHead} style={{ background: accentLight, borderBottom: `1px solid ${accentBorder}` }}>
                        {isSel
                          ? <CheckCircle2 size={15} style={{ color: accent, flexShrink: 0 }} />
                          : <AlertTriangle size={15} style={{ color: accent, flexShrink: 0 }} />}
                        <span className={tbCss.panelHeadName}>{currentNode.name}</span>
                        {/* Progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{pAnswered}/{panelResults.length}</span>
                          <div style={{ width: 60, height: 4, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pPct}%`, height: '100%', background: accent, borderRadius: 4, transition: 'width 0.4s' }} />
                          </div>
                        </div>
                        <span className={isSel ? tbCss.panelBadgeSel : tbCss.panelBadgeDmg}>{isSel ? 'SELECTION' : 'DAMAGE'}</span>
                      </div>

                      {/* Item rows — matching TemplateBuilder's item row style */}
                      <div>
                        {panelResults.map((result, idx) => {
                          const isDamaged = result.responseValue === 'DEFECTIVE';
                          const isCorrect = result.responseValue === 'ACCEPTABLE';
                          const statusColor = isCorrect ? '#29A356' : isDamaged ? '#EF4444' : 'transparent';

                          return (
                            <div
                              key={result.id}
                              style={{ borderBottom: '1px solid #F3F4F6', borderLeft: `3px solid ${statusColor}` }}
                            >
                              {/* Main item row — matching TemplateBuilder's itemRow */}
                              <div
                                className={tbCss.itemRow}
                                style={{ paddingLeft: 13, cursor: 'pointer' }}
                                onDoubleClick={() => !readOnly && setEditItemModal(result)}
                              >
                                {/* Label */}
                                <span className={tbCss.itemLabel} style={{ fontSize: 13.5, fontWeight: 500, color: '#263B4F' }}>
                                  {idx + 1}. {result.itemLabel}
                                  {result.isCustom && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', background: '#EEF2FF', padding: '1px 6px', borderRadius: 10, marginLeft: 6 }}>Custom</span>
                                  )}
                                </span>

                                {/* Pass/Fail action */}
                                <div style={{ flexShrink: 0 }}>
                                  {readOnly ? (
                                    <span className={`ie-readonly-status ${isCorrect ? 'ie-readonly-pass' : isDamaged ? 'ie-readonly-fail' : ''}`}>
                                      {isCorrect
                                        ? <><CheckCircle2 size={12} /> {result.logicType === 'SELECTION' ? 'Selected' : 'Pass'}</>
                                        : isDamaged
                                          ? <><AlertTriangle size={12} /> Fail</>
                                          : '—'}
                                    </span>
                                  ) : result.logicType === 'SELECTION' ? (
                                    <button
                                      type="button"
                                      className={`ie-sel-toggle ${isCorrect ? 'ie-sel-on' : ''}`}
                                      onClick={e => { e.stopPropagation(); setStatus(result.id, isCorrect ? null : 'ACCEPTABLE'); }}
                                    >
                                      {isCorrect ? <><CheckCircle2 size={13} /> Selected</> : 'Select'}
                                    </button>
                                  ) : (
                                    <div className="ie-dmg-btns">
                                      <button type="button" className={`ie-dmg-btn ie-dmg-correct ${isCorrect ? 'ie-dmg-active' : ''}`}
                                        onClick={e => { e.stopPropagation(); setStatus(result.id, 'ACCEPTABLE'); }}>
                                        <CheckCircle2 size={13} /> Pass
                                      </button>
                                      <button type="button" className={`ie-dmg-btn ie-dmg-damaged ${isDamaged ? 'ie-dmg-active-red' : ''}`}
                                        onClick={e => { e.stopPropagation(); setStatus(result.id, 'DEFECTIVE'); }}>
                                        <AlertTriangle size={13} /> Fail
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Item actions — Sort, Copy local, Move to section, Copy to section, Delete */}
                                {!readOnly && (
                                  <div className={tbCss.itemActionsGroup} onClick={e => e.stopPropagation()}>
                                    {/* Sort up/down */}
                                    <div className={tbCss.itemSortBtns}>
                                      <button className={tbCss.itemSortBtn} title="Move up"
                                        onClick={() => setResults(p => {
                                          const next = [...p]; const i = next.findIndex(r => r.id === result.id);
                                          if (i > 0 && next[i - 1].sectionName === next[i].sectionName) { [next[i - 1], next[i]] = [next[i], next[i - 1]]; }
                                          return next;
                                        })}>
                                        <ArrowUp size={12} />
                                      </button>
                                      <button className={tbCss.itemSortBtn} title="Move down"
                                        onClick={() => setResults(p => {
                                          const next = [...p]; const i = next.findIndex(r => r.id === result.id);
                                          if (i < next.length - 1 && next[i + 1].sectionName === next[i].sectionName) { [next[i], next[i + 1]] = [next[i + 1], next[i]]; }
                                          return next;
                                        })}>
                                        <ArrowDown size={12} />
                                      </button>
                                    </div>
                                    {/* Copy — duplicate in same section */}
                                    <button className={tbCss.itemActionBtn} title="Copy item (same section)"
                                      onClick={() => {
                                        setResults(p => {
                                          const i = p.findIndex(r => r.id === result.id);
                                          const copy: LocalResult = { ...result, id: Date.now() + Math.random(), itemLabel: `${result.itemLabel} (Copy)`, responseValue: undefined, _dirty: false, _saving: false };
                                          const next = [...p];
                                          next.splice(i + 1, 0, copy);
                                          return next;
                                        });
                                        toast.success('Item copied');
                                      }}>
                                      <Copy size={13} />
                                    </button>
                                    {/* Move to another section */}
                                    <button className={tbCss.itemActionBtn} title="Move to another section"
                                      onClick={() => setMoveCopyModal({ item: result, mode: 'move' })}>
                                      <ArrowRight size={13} />
                                    </button>
                                    {/* Copy to another section */}
                                    <button className={tbCss.itemActionBtn} title="Copy to another section"
                                      style={{ color: '#6B7280' }}
                                      onClick={() => setMoveCopyModal({ item: result, mode: 'copy' })}>
                                      <Copy size={11} />
                                      <ArrowRight size={11} />
                                    </button>
                                    {/* Delete */}
                                    <button className={tbCss.itemDeleteBtn} title="Delete item"
                                      onClick={() => { setResults(p => p.filter(r => r.id !== result.id)); toast.success('Item deleted'); }}>
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Item details expansion — DAMAGE only (photos, severity, comments) */}
                              {isDamaged && !readOnly && (
                                <div className="ie-defect-expand">
                                  <div className="ie-photo-row" style={{ marginTop: 12 }}>
                                    <div style={{ marginTop: 10 }}>
                                      <InspectionImageUpload resultId={result.id} initialImages={result.images || []} readOnly={false} />
                                    </div>
                                  </div>
                                  <div className="ie-severity-row">
                                    <span className="ie-severity-label">Severity:</span>
                                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map(sev => (
                                      <button key={sev} type="button"
                                        className={`ie-sev-btn ie-sev-${sev.toLowerCase()} ${result.severity === sev ? 'ie-sev-active' : ''}`}
                                        onClick={() => setSeverityLocal(result.id, sev)}>
                                        {sev}
                                      </button>
                                    ))}
                                  </div>
                                  <textarea className="ie-comment-area" rows={2}
                                    placeholder="Add notes or observations…"
                                    value={result.comments ?? ''}
                                    onChange={e => updateComment(result.id, e.target.value)}
                                  />
                                </div>
                              )}
                              {/* Completed view — DAMAGE only, only if there's something to show */}
                              {isDamaged && isCompleted && (result.images?.length || result.severity || result.comments) ? (
                                <div className="ie-defect-expand" style={{ pointerEvents: 'none' }}>
                                  {result.images?.length ? (
                                    <InspectionImageUpload resultId={result.id} initialImages={result.images} readOnly />
                                  ) : null}
                                  {result.severity && (
                                    <div className="ie-severity-row">
                                      <span className="ie-severity-label">Severity:</span>
                                      <span className={`ie-sev-btn ie-sev-${result.severity.toLowerCase()} ie-sev-active`}>{result.severity}</span>
                                    </div>
                                  )}
                                  {result.comments && (
                                    <textarea className="ie-comment-area" rows={2} value={result.comments} readOnly
                                      style={{ background: '#F8FAFC', cursor: 'default', resize: 'none' }} />
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add item footer — matching TemplateBuilder's panelFooterBtn */}
                      {!readOnly && (
                        <button
                          className={`${tbCss.panelFooterBtn} ${isSel ? tbCss.panelFooterBtnSel : tbCss.panelFooterBtnDmg}`}
                          onClick={() => setAddItemModalOpen(true)}
                        >
                          <Plus size={12} /> Add Item
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Section-complete prompt */}
                {!readOnly && isPanelComplete && showCompletePrompt && nextPanelPath && (
                  <div className="ie-complete-prompt" style={{ marginTop: 16 }}>
                    <div className="ie-complete-icon"><CheckCircle2 size={26} /></div>
                    <div className="ie-complete-text">
                      <h3 className="ie-complete-title">Section Complete!</h3>
                      <p className="ie-complete-sub">Ready to move to <strong>{nextPanelPath.slice(-1)[0]}</strong>?</p>
                    </div>
                    <div className="ie-complete-actions">
                      <button className="ie-complete-dismiss" onClick={() => setShowCompletePrompt(false)}>Stay Here</button>
                      <button className="ie-complete-proceed" onClick={goToNextPanel}>Next <ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}

                {/* All done banner */}
                {pct === 100 && !readOnly && (
                  <div className="ie-all-done" style={{ marginTop: 16 }}>
                    <CheckCircle2 size={20} style={{ color: '#33AE95' }} />
                    <span>All items answered! Ready to submit.</span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ─── Panel Toolbar (folder view only) — matching TemplateBuilder's panelToolbar ─── */}
          {currentNode && !currentNode.isLeaf && !readOnly && (
            <div className={tbCss.panelToolbar} style={{ marginBottom: 55, borderBottom: '1px solid #E5E7EB' }}>
              {/* Left group: actions on focused panel */}
              <div className={tbCss.panelToolbarGroup}>
                {(() => {
                  const leafChildren = Object.values(currentNode.children).filter(c => c.isLeaf);
                  const focusedIdx = focusedPanelPath ? leafChildren.findIndex(c => c.fullPath === focusedPanelPath) : -1;
                  const hasFocus = focusedIdx >= 0;
                  const focused = hasFocus ? leafChildren[focusedIdx] : null;

                  const copyPanel = () => {
                    if (!focused) return;
                    const copyName = focused.name + ' (Copy)';
                    const newPath = [currentNode.fullPath, copyName].join(' › ');
                    const copies = focused.results.map(r => ({ ...r, id: `copy-${Date.now()}-${Math.random()}`, sectionName: newPath }));
                    setResults(prev => [...prev, ...copies]);
                    setFocusedPanelPath(newPath);
                    toast.success('Panel copied');
                  };

                  const deletePanel = () => {
                    if (!focused) return;
                    setResults(prev => prev.filter(r => r.sectionName !== focused.fullPath));
                    setFocusedPanelPath(null);
                    toast.success(`"${focused.name}" deleted`);
                  };

                  return (
                    <>
                      <button className={tbCss.panelToolbarBtn} disabled={!hasFocus} onClick={() => {
                        if (focused) { setRenamingPath(focused.fullPath); setRenameVal(focused.name); }
                      }}>
                        <Edit2 size={13} /> Edit
                      </button>
                      <button className={tbCss.panelToolbarBtn} disabled={!hasFocus} onClick={copyPanel}>
                        <Copy size={13} /> Copy Local
                      </button>
                      <button className={tbCss.panelToolbarBtn} disabled={!hasFocus} onClick={() => {
                        if (focused) setSectionMoveCopyModal({ pattern: focused.fullPath, mode: 'move' });
                      }}>
                        <ArrowRight size={13} /> Move
                      </button>
                      <button className={tbCss.panelToolbarBtn} disabled={!hasFocus} onClick={() => {
                        if (focused) setSectionMoveCopyModal({ pattern: focused.fullPath, mode: 'copy' });
                      }}>
                        <Copy size={13} /> Move & Copy
                      </button>
                      <button className={`${tbCss.panelToolbarBtn} ${tbCss.panelToolbarBtnDanger}`} disabled={!hasFocus} onClick={deletePanel}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Right group: add new panel */}
              <div className={tbCss.panelToolbarGroup}>
                <button
                  className={`${tbCss.panelToolbarBtn} ${tbCss.panelToolbarBtnSel}`}
                  onClick={() => { setFolderPanelAddType('SELECTION'); setFolderPanelAddLabel(''); setFolderPanelAddOpen(true); }}
                >
                  <Plus size={13} /> Selection
                </button>
                <button
                  className={`${tbCss.panelToolbarBtn} ${tbCss.panelToolbarBtnDmg}`}
                  onClick={() => { setFolderPanelAddType('DAMAGE'); setFolderPanelAddLabel(''); setFolderPanelAddOpen(true); }}
                >
                  <Plus size={13} /> Damage
                </button>
              </div>
            </div>
          )}

          {/* Workspace footer — matching TemplateBuilder's wFooter */}
          <div className={tbCss.wFooter}>
            {prevPanelPath && (
              <button className={tbCss.fBtn} onClick={() => goToNode(prevPanelPath)}>
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <div className={tbCss.wFooterSpacer} />
            {nextPanelPath && (
              <button className={tbCss.fBtn} onClick={goToNextPanel}>
                Next: {nextPanelPath.slice(-1)[0]} <ChevronRight size={13} />
              </button>
            )}
            {!readOnly && (
              <button
                className={`${tbCss.fBtn} ${tbCss.fBtnPrimary}`}
                onClick={handleSubmit}
                disabled={submitting || pct < 100}
              >
                {submitting ? <RefreshCw size={13} className="ie-spinner-sm" /> : <Send size={13} />}
                {submitting ? 'Submitting…' : pct < 100 ? `Submit (${pct}%)` : 'Submit Inspection'}
              </button>
            )}
          </div>

        </main>
      </div>

      {/* ═══ ADD FOLDER MODAL ═══ (matching TemplateBuilder's NameModal) */}
      {navAddOpen && (
        <div className={tbCss.modalOverlay} onClick={closeNavAdd}>
          <div className={tbCss.modalBox} onClick={e => e.stopPropagation()}>
            <h3 className={tbCss.modalTitle}>New Folder</h3>

            {/* Folder name */}
            <input
              ref={navAddInputRef}
              type="text"
              className={tbCss.modalInput}
              placeholder="e.g. Exterior, Roof Area…"
              value={navAddLabel}
              onChange={e => setNavAddLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && navAddLabel.trim()) handleNavAdd();
                if (e.key === 'Escape') closeNavAdd();
              }}
              autoFocus
            />

            <div className={tbCss.modalActions}>
              <button className={tbCss.modalCancelBtn} onClick={closeNavAdd}>Cancel</button>
              <button className={tbCss.modalConfirmBtn} disabled={!navAddLabel.trim() || adding} onClick={handleNavAdd}>
                {adding ? <RefreshCw size={12} style={{ animation: 'spin .7s linear infinite' }} /> : <Plus size={12} />}
                {adding ? 'Adding…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD PANEL TO FOLDER MODAL ═══ */}
      {folderPanelAddOpen && (
        <div className={tbCss.modalOverlay} onClick={closeFolderPanelAdd}>
          <div className={tbCss.modalBox} onClick={e => e.stopPropagation()}>
            <h3 className={tbCss.modalTitle}>
              New {folderPanelAddType === 'SELECTION' ? 'Selection' : 'Damage'} Panel
            </h3>
            <input
              ref={folderPanelAddInputRef}
              type="text"
              className={tbCss.modalInput}
              placeholder="e.g. Windows, Cracks…"
              value={folderPanelAddLabel}
              onChange={e => setFolderPanelAddLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && folderPanelAddLabel.trim()) handleFolderPanelAdd();
                if (e.key === 'Escape') closeFolderPanelAdd();
              }}
              autoFocus
            />
            <div className={tbCss.modalActions}>
              <button className={tbCss.modalCancelBtn} onClick={closeFolderPanelAdd}>Cancel</button>
              <button
                className={tbCss.modalConfirmBtn}
                disabled={!folderPanelAddLabel.trim() || adding}
                onClick={handleFolderPanelAdd}
                style={folderPanelAddType === 'DAMAGE' ? { background: 'linear-gradient(135deg,#ef4444,#dc2626)' } : {}}
              >
                {adding ? <RefreshCw size={12} style={{ animation: 'spin .7s linear infinite' }} /> : <Plus size={12} />}
                {adding ? 'Adding…' : 'Create Panel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT ITEM MODAL ═══ (triggered by double-click, matching TemplateBuilder pattern) */}
      {editItemModal && (
        <EditItemModal
          item={editItemModal}
          onConfirm={(name, reportName) => {
            setResults(p => p.map(r => r.id === editItemModal.id ? { ...r, itemLabel: name, reportName } : r));
            setEditItemModal(null);
            toast.success('Item updated');
          }}
          onCancel={() => setEditItemModal(null)}
        />
      )}

      {/* ═══ ADD ITEM MODAL ═══ */}
      {addItemModalOpen && currentNode && (
        <AddItemModal 
          existingNames={activeNodeResults.map(r => r.itemLabel)}
          onCancel={() => setAddItemModalOpen(false)}
          onConfirm={async (itemName) => {
            if (!inspectionId) return;
            setAdding(true);
            try {
              const logicType = currentNode.name.toLowerCase().includes('selection') || Object.values(currentNode.results).some(r => r.logicType === 'SELECTION') ? 'SELECTION' : 'DAMAGE';
              const newResult = await checklistService.addCustomResult(inspectionId, {
                itemLabel: itemName,
                sectionName: currentNode.fullPath,
                logicType
              });
              setResults(prev => [...prev, toLocal(newResult)]);
              toast.success('Item added');
              setAddItemModalOpen(false);
            } catch (e: any) {
              toast.error(e.message || 'Failed to add item');
            } finally {
              setAdding(false);
            }
          }}
        />
      )}

      {/* ═══ MOVE / COPY TO SECTION MODAL ═══ */}
      {moveCopyModal && (
        <MoveSectionModal
          mode={moveCopyModal.mode}
          item={moveCopyModal.item}
          tree={tree}
          onConfirm={(targetPath) => {
            const { item, mode } = moveCopyModal;
            setResults(prev => {
              const copy: LocalResult = {
                ...item,
                id: Date.now() + Math.random(),
                sectionName: targetPath,
                responseValue: undefined,
                _dirty: false,
                _saving: false,
              };
              if (mode === 'move') {
                // Remove from current section, add to target
                return [...prev.filter(r => r.id !== item.id), copy];
              } else {
                // Keep in current, add copy to target
                return [...prev, copy];
              }
            });
            setMoveCopyModal(null);
            toast.success(mode === 'move' ? 'Item moved' : 'Item copied to section');
          }}
          onCancel={() => setMoveCopyModal(null)}
        />
      )}

      {/* ═══ SECTION MOVE / COPY MODAL ═══ */}
      {sectionMoveCopyModal && (
        <MoveFolderSectionModal
          mode={sectionMoveCopyModal.mode}
          pattern={sectionMoveCopyModal.pattern}
          tree={tree}
          onConfirm={(targetFolder) => {
            const { pattern, mode } = sectionMoveCopyModal;
            const panelName = pattern.split(' › ').pop()!;
            const newPath = targetFolder ? `${targetFolder} › ${panelName}` : panelName;
            
            setResults(prev => {
              let next = [...prev];
              const toMove = next.filter(r => r.sectionName === pattern || r.sectionName?.startsWith(pattern + ' › '));
              
              if (mode === 'move') {
                next = next.map(r => {
                  if (r.sectionName === pattern || r.sectionName?.startsWith(pattern + ' › ')) {
                    return { ...r, sectionName: r.sectionName.replace(pattern, newPath), _dirty: true };
                  }
                  return r;
                });
                return next;
              }

              // Copy mode
              const copies = toMove.map(r => ({
                ...r,
                id: Date.now() + Math.random(),
                sectionName: r.sectionName!.replace(pattern, newPath),
                responseValue: undefined,
                _dirty: false,
                _saving: false
              }));
              return [...next, ...copies as LocalResult[]];
            });
            setSectionMoveCopyModal(null);
            toast.success(mode === 'move' ? 'Section moved' : 'Section copied');
          }}
          onCancel={() => setSectionMoveCopyModal(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Edit Item Modal — triggered by double-click (like TemplateBuilder)
───────────────────────────────────────────────────────────────── */
function EditItemModal({ item, onConfirm, onCancel }: {
  item: LocalResult | null;
  onConfirm: (name: string, reportName: string) => void;
  onCancel: () => void;
}) {
  const [itemName, setItemName] = useState('');
  const [reportName, setReportName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setItemName(item.itemLabel || '');
      setReportName(item.reportName || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [item]);

  if (!item) return null;
  const canSubmit = itemName.trim() !== '';
  const submit = () => { if (!canSubmit) return; onConfirm(itemName.trim(), reportName.trim() || itemName.trim()); };

  return (
    <div className={tbCss.modalOverlay} onClick={onCancel}>
      <div className={tbCss.modalBox} onClick={e => e.stopPropagation()}>
        <h3 className={tbCss.modalTitle}>Edit Item</h3>

        <label className={tbCss.modalFieldLabel}>Item Name <span style={{ color: '#EF4444' }}>*</span></label>
        <input ref={inputRef} type="text" value={itemName}
          onChange={e => setItemName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. Wall Paint"
          className={tbCss.modalInput}
        />

        <label className={tbCss.modalFieldLabel} style={{ marginTop: 8 }}>Report Alias <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>(optional)</span></label>
        <input type="text" value={reportName}
          onChange={e => setReportName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="Display name in PDF report"
          className={tbCss.modalInput}
        />

        <div className={tbCss.modalActions}>
          <button className={tbCss.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={tbCss.modalConfirmBtn} onClick={submit} disabled={!canSubmit}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Add Item Modal (No Alias)
───────────────────────────────────────────────────────────────── */
function AddItemModal({ existingNames, onConfirm, onCancel }: {
  existingNames: string[];
  onConfirm: (itemName: string) => void;
  onCancel: () => void;
}) {
  const [itemName, setItemName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const nameExists = existingNames.some(n => n.toLowerCase() === itemName.trim().toLowerCase());
  const canSubmit = itemName.trim() !== '' && !nameExists;
  const submit = () => { if (canSubmit) onConfirm(itemName.trim()); };

  return (
    <div className={tbCss.modalOverlay} onClick={onCancel}>
      <div className={tbCss.modalBox} onClick={e => e.stopPropagation()}>
        <h3 className={tbCss.modalTitle}>Add Item</h3>

        <label className={tbCss.modalFieldLabel}>Item Name <span style={{ color: '#EF4444' }}>*</span></label>
        <input ref={inputRef} type="text" value={itemName}
          onChange={e => setItemName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. Wall Paint"
          className={tbCss.modalInput}
        />
        {nameExists && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>An item with this name already exists in this section.</p>}

        <div className={tbCss.modalActions}>
          <button className={tbCss.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={tbCss.modalConfirmBtn} onClick={submit} disabled={!canSubmit}>Add Item</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Move / Copy to Section Modal
───────────────────────────────────────────────────────────────── */
function collectLeafPaths(tree: Record<string, NavNode>): { name: string; fullPath: string }[] {
  const out: { name: string; fullPath: string }[] = [];
  function traverse(nodes: Record<string, NavNode>) {
    for (const node of Object.values(nodes)) {
      if (node.isLeaf) out.push({ name: node.name, fullPath: node.fullPath });
      traverse(node.children);
    }
  }
  traverse(tree);
  return out;
}

function MoveSectionModal({ mode: initialMode, item, tree, onConfirm, onCancel }: {
  mode: 'move' | 'copy';
  item: LocalResult;
  tree: Record<string, NavNode>;
  onConfirm: (targetPath: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'move' | 'copy'>(initialMode);
  const [selected, setSelected] = useState('');
  const leaves = collectLeafPaths(tree).filter(l => l.fullPath !== item.sectionName);

  return (
    <div className={tbCss.modalOverlay} onClick={onCancel}>
      <div className={tbCss.modalBox} style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <h3 className={tbCss.modalTitle}>
          {mode === 'move' ? 'Move Item to Section' : 'Copy Item to Section'}
        </h3>

        {/* Mode toggle — Move / Copy */}
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
          <button
            type="button"
            className={`${tbCss.panelToolbarBtn} ${mode === 'move' ? tbCss.panelToolbarBtnSel : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setMode('move')}
          >
            <ArrowRight size={12} /> Move
          </button>
          <button
            type="button"
            className={`${tbCss.panelToolbarBtn} ${mode === 'copy' ? tbCss.panelToolbarBtnSel : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setMode('copy')}
          >
            <Copy size={12} /> Copy to
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
          {mode === 'move'
            ? 'Item will be removed from its current section and placed in the selected one.'
            : 'A copy will be added to the selected section; the original stays in place.'}
        </p>

        {/* Section list */}
        {leaves.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
            No other sections available.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, padding: 4 }}>
            {leaves.map(leaf => {
              const parts = leaf.fullPath.split(' › ');
              const isActive = selected === leaf.fullPath;
              return (
                <button
                  key={leaf.fullPath}
                  type="button"
                  onClick={() => setSelected(leaf.fullPath)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    borderRadius: 6, border: `1px solid ${isActive ? 'rgba(51,174,149,0.4)' : 'transparent'}`,
                    background: isActive ? 'rgba(51,174,149,0.08)' : 'none',
                    textAlign: 'left', cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  <Layers size={13} style={{ color: isActive ? '#33AE95' : '#94A3B8', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#298E7A' : '#263B4F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {leaf.name}
                    </div>
                    {parts.length > 1 && (
                      <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {parts.slice(0, -1).join(' › ')}
                      </div>
                    )}
                  </div>
                  {isActive && <CheckCircle2 size={14} style={{ color: '#33AE95', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}

        <div className={tbCss.modalActions}>
          <button className={tbCss.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button
            className={tbCss.modalConfirmBtn}
            disabled={!selected}
            onClick={() => onConfirm(selected)}
          >
            {mode === 'move' ? 'Move Here' : 'Copy Here'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Move Folder / Section Modal
───────────────────────────────────────────────────────────────── */
function MoveFolderSectionModal({ mode, pattern, tree, onConfirm, onCancel }: {
  mode: 'move' | 'copy';
  pattern: string;
  tree: Record<string, NavNode>;
  onConfirm: (targetFolder: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  
  const folders: {name: string, fullPath: string}[] = [{ name: 'Inspection Root (Top Level)', fullPath: '' }];
  function traverse(nodes: Record<string, NavNode>) {
    for (const node of Object.values(nodes)) {
      if (!node.isLeaf) {
        folders.push({ name: node.name, fullPath: node.fullPath });
        traverse(node.children);
      }
    }
  }
  traverse(tree);

  const available = folders.filter(f => f.fullPath !== pattern && !f.fullPath.startsWith(pattern + ' › ') && !pattern.startsWith(f.fullPath + ' › ' + pattern.split(' › ').pop()));

  return (
    <div className={tbCss.modalOverlay} onClick={onCancel}>
      <div className={tbCss.modalBox} style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <h3 className={tbCss.modalTitle}>
          {mode === 'move' ? 'Move Section to Folder' : 'Copy Section to Folder'}
        </h3>
        
        <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 12px' }}>
          Select the destination folder for <strong>{pattern.split(' › ').pop()}</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
          {available.map(f => (
            <button key={f.fullPath} type="button" onClick={() => setSelected(f.fullPath)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                border: `1px solid ${selected === f.fullPath ? 'rgba(51,174,149,0.5)' : '#E2E8F0'}`,
                background: selected === f.fullPath ? 'rgba(51,174,149,0.08)' : '#FAFAFA',
                textAlign: 'left', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s'
              }}>
              <FolderOpen size={16} color={selected === f.fullPath ? '#33AE95' : '#9CA3AF'} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: selected === f.fullPath ? '#298E7A' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                {f.fullPath && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {f.fullPath}
                  </div>
                )}
              </div>
              {selected === f.fullPath && <CheckCircle2 size={16} color="#33AE95" style={{ flexShrink: 0 }} />}
            </button>
          ))}
          {available.length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>No valid folders found.</p>}
        </div>
        
        <div className={tbCss.modalActions} style={{ marginTop: 16 }}>
           <button className={tbCss.modalCancelBtn} onClick={onCancel}>Cancel</button>
           <button className={tbCss.modalConfirmBtn} disabled={selected === null} onClick={() => onConfirm(selected!)}>
             {mode === 'move' ? 'Move Here' : 'Copy Here'}
           </button>
        </div>
      </div>
    </div>
  );
}
