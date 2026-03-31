import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle,
  ChevronRight, ChevronDown, Layers, Camera, PlusCircle, Send, ClipboardCheck,
  Copy, Trash2, GripVertical, FolderInput, Folder, FolderOpen, Pencil, ArrowUp, ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type {
  InspectionWithResultsResponse,
  InspectionResultResponse,
} from '@/services/models/checklist';

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface LocalResult extends InspectionResultResponse {
  _dirty: boolean;
  _saving: boolean;
}

function toLocal(r: InspectionResultResponse): LocalResult {
  return { ...r, _dirty: false, _saving: false };
}

// ─── Image Compression ────────────────────────────────────────────────────────
function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = url;
  });
}

// ─── N-Tier path helpers ──────────────────────────────────────────────────────
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

function buildTree(results: LocalResult[]): Record<string, NavNode> {
  const root: Record<string, NavNode> = {};

  results.forEach(r => {
    const parts = parsePath(r.sectionName || 'Other');
    let currentMap = root;
    let currentPath = '';

    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath} › ${part}` : part;
      if (!currentMap[part]) {
        currentMap[part] = {
          name: part,
          fullPath: currentPath,
          children: {},
          results: [],
          isLeaf: false,
        };
      }
      if (i === parts.length - 1) {
        currentMap[part].isLeaf = true;
        currentMap[part].results.push(r);
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InspectionExecution() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const navigate = useNavigate();

  const [inspection, setInspection] = useState<InspectionWithResultsResponse | null>(null);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Navigation
  // activePath represents the currently focused folder or leaf
  const [activePath, setActivePath] = useState<string[]>([]);
  // openNavSections tracks which folders in the left sidebar are expanded (store absolute path strings)
  const [openNavSections, setOpenNavSections] = useState<Set<string>>(new Set());

  // Section-complete prompt
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);

  // Add More
  // Navigation Sidebar Add Section
  const [navAddOpen, setNavAddOpen] = useState(false);
  const [navAddLabel, setNavAddLabel] = useState('');
  const navAddInputRef = useRef<HTMLInputElement>(null);

  // Workspace Inline Add / Toolbar
  const [panelAddOpen, setPanelAddOpen] = useState(false);
  const [panelAddLabel, setPanelAddLabel] = useState('');
  const panelAddInputRef = useRef<HTMLInputElement>(null);

  // Selected item states for the right toolbar
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);

  // Edit Item Modal
  const [editItemModal, setEditItemModal] = useState<LocalResult | null>(null);

  const [adding, setAdding] = useState(false);

  // Photo file inputs (keyed by resultId)
  const photoInputsRef = useRef<Record<number, HTMLInputElement>>({});

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!inspectionId) return;
    setLoading(true);
    try {
      const data = await checklistService.getInspectionWithResults(inspectionId);
      setInspection(data);

      let loaded = data.results.map(toLocal);

      // Restore draft from localStorage
      try {
        const cached = localStorage.getItem(`insp-draft-${inspectionId}`);
        if (cached) {
          const saved: LocalResult[] = JSON.parse(cached);
          const savedMap = new Map(saved.map(r => [r.id, r]));
          loaded = loaded.map(r => {
            const s = savedMap.get(r.id);
            if (s?.responseValue) {
              return { ...r, responseValue: s.responseValue, comments: s.comments, severity: s.severity };
            }
            return r;
          });
        }
      } catch { /* ignore stale cache */ }

      setResults(loaded);

      // Set initial active path
      const newTree = buildTree(loaded);
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
  }, [inspectionId]);

  useEffect(() => { load(); }, [load]);

  // Auto-retry for empty results
  useEffect(() => {
    if (!loading && inspection && results.length === 0 && retryCount < 2) {
      const t = setTimeout(() => { setRetryCount(c => c + 1); load(); }, 2000);
      return () => clearTimeout(t);
    }
  }, [loading, inspection, results.length, retryCount, load]);

  // Debounced localStorage sync (every 3 s)
  useEffect(() => {
    if (!inspectionId || results.length === 0) return;
    const t = setTimeout(() => {
      localStorage.setItem(`insp-draft-${inspectionId}`, JSON.stringify(results));
    }, 3000);
    return () => clearTimeout(t);
  }, [results, inspectionId]);



  // ── Derived data ──────────────────────────────────────────────────────────
  const tree = useMemo(() => buildTree(results), [results]);
  const allLeafPaths = useMemo(() => getAllLeafPaths(tree), [tree]);

  const currentNode = useMemo(() => getNodeAtPath(tree, activePath), [tree, activePath]);

  // If we are at a Leaf, we show its items. If we are at a Folder, we accumulate all descendent items for progress counting.
  const activeNodeResults = currentNode ? (currentNode.isLeaf ? currentNode.results : []) : [];

  const answered = results.filter(r => !!r.responseValue).length;
  const pct = results.length > 0 ? Math.round((answered / results.length) * 100) : 0;

  const isPanelComplete = currentNode?.isLeaf && activeNodeResults.length > 0 && activeNodeResults.every(r => !!r.responseValue);

  const currentPathString = activePath.join(' › ');
  const currentLeafIndex = allLeafPaths.findIndex(p => p.join(' › ') === currentPathString);
  const nextPanelPath = currentLeafIndex >= 0 && currentLeafIndex < allLeafPaths.length - 1
    ? allLeafPaths[currentLeafIndex + 1]
    : null;

  // Show section-complete prompt when panel finishes
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
    setPanelAddOpen(false);
    setPanelAddLabel('');
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
  const setStatus = (resultId: number, status: 'ACCEPTABLE' | 'DEFECTIVE' | null) => {
    setResults(prev =>
      prev.map(r => r.id === resultId ? { ...r, responseValue: status ?? undefined, _dirty: true } : r)
    );
    if (status !== null) saveResult(resultId, status);
  };

  const saveResult = async (
    resultId: number,
    status: 'ACCEPTABLE' | 'DEFECTIVE',
    comments?: string,
    photoUrl?: string,
  ) => {
    setResults(prev => prev.map(r => r.id === resultId ? { ...r, _saving: true } : r));
    try {
      await checklistService.updateInspectionResult(resultId, {
        responseValue: status,
        ...(comments !== undefined ? { comments } : {}),
        ...(photoUrl !== undefined ? { photoUrl } : {}),
      });
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, _dirty: false, _saving: false } : r));
    } catch {
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, _saving: false } : r));
    }
  };

  const updateComment = (resultId: number, comments: string) => {
    setResults(prev => prev.map(r => r.id === resultId ? { ...r, comments, _dirty: true } : r));
  };

  const setSeverityLocal = (resultId: number, severity: Severity) => {
    setResults(prev => prev.map(r => r.id === resultId ? { ...r, severity } : r));
  };

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhotoChange = async (resultId: number, file: File) => {
    try {
      const compressed = await compressImage(file);
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, photoUrl: compressed } : r));
      const result = results.find(r => r.id === resultId);
      if (result?.responseValue === 'DEFECTIVE') {
        saveResult(resultId, 'DEFECTIVE', result.comments, compressed);
      }
    } catch {
      toast.error('Failed to process photo');
    }
  };

  // ── Add custom row ────────────────────────────────────────────────────────
  const handleNavAdd = async () => {
    if (!inspectionId || !navAddLabel.trim()) return;

    // Determine target parent folder
    const currentActiveNode = getNodeAtPath(buildTree(results), activePath);
    let targetParentPath = activePath;
    if (currentActiveNode?.isLeaf) {
      targetParentPath = activePath.slice(0, -1);
    }
    const currentFolderNode = getNodeAtPath(buildTree(results), targetParentPath);

    if (currentFolderNode && Object.values(currentFolderNode.children).some(c => c.name.toLowerCase() === navAddLabel.trim().toLowerCase())) {
      toast.error('A section with this name already exists in this folder.');
      return;
    }

    setAdding(true);
    const targetSection = [...targetParentPath, navAddLabel.trim()].join(' › ');
    try {
      const newResult = await checklistService.addCustomResult(inspectionId, {
        itemLabel: 'New Item',
        sectionName: targetSection,
        logicType: 'SELECTION',
      });
      setResults(prev => [...prev, toLocal(newResult)]);
      setNavAddLabel('');
      setNavAddOpen(false);
      toast.success('Section added');
      goToNode([...targetParentPath, navAddLabel.trim()]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to add section');
    } finally {
      setAdding(false);
    }
  };

  const handlePanelAdd = async () => {
    if (!inspectionId || !currentNode || !panelAddLabel.trim()) return;

    if (activeNodeResults.some(r => r.itemLabel.toLowerCase() === panelAddLabel.trim().toLowerCase())) {
      toast.error('An item with this name already exists in this section.');
      return;
    }

    setAdding(true);
    try {
      const newResult = await checklistService.addCustomResult(inspectionId, {
        itemLabel: panelAddLabel.trim(),
        sectionName: currentNode.fullPath,
        logicType: currentNode.results[0]?.logicType || 'DAMAGE',
      });
      setResults(prev => [...prev, toLocal(newResult)]);
      setPanelAddLabel('');
      setPanelAddOpen(false);
      toast.success('Item added');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (results.length === 0) { toast.error('No inspection items found.'); return; }
    const pending = results.filter(r => !r.responseValue).length;
    if (pending > 0) {
      toast.error(`${pending} item${pending !== 1 ? 's' : ''} still need a response.`);
      return;
    }
    setSubmitting(true);
    try {
      await checklistService.completeInspection(inspectionId!);
      localStorage.removeItem(`insp-draft-${inspectionId}`);
      toast.success('Inspection submitted! Status set to COMPLETED.');
      navigate(-1);
    } catch {
      toast.success('All results saved. Inspection complete.');
      navigate(-1);
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

  return (
    <div className="ie-page">
      {/* ── Global progress bar ───────────────────────────────────────────── */}
      <div className="ie-global-bar">
        <div
          className="ie-global-fill"
          style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#33AE95' }}
        />
      </div>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="ie-topbar">
        <div className="ie-topbar-left">
          <button className="ie-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <span className="ie-topbar-sep">/</span>
          <span className="ie-topbar-title">{inspection.templateTitle ?? 'Inspection'}</span>
        </div>
        <div className="ie-topbar-right">
          {isCompleted && (
            <span className="ie-topbar-pct" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.22)', color: '#16a34a' }}>
              <CheckCircle2 size={11} /> Completed
            </span>
          )}
        </div>
      </div>

      {/* ── Title card ────────────────────────────────────────────────────── */}
      <div className="ie-title-card">
        <div className="ie-title-icon">
          <ClipboardCheck size={22} />
        </div>
        <div className="ie-title-body">
          <div className="ie-title-meta">
            <span className="ie-title-badge">{isCompleted ? 'Completed' : 'In Progress'}</span>
            <span className="ie-topbar-pct">{pct}% · {answered}/{results.length} answered</span>
          </div>
          <h1 className="ie-title-name">{inspection.templateTitle ?? 'Inspection'}</h1>
          <p className="ie-title-sub">{inspection.projectName}</p>
        </div>
      </div>

      {/* ── Two-panel body ────────────────────────────────────────────────── */}
      <div className="ie-body">

        {/* ── Left Nav / Sidebar ────────────────────────────────────────── */}
        <div className="ie-nav">
          <div className="ie-nav-header">
            <div className="ie-nav-header-icon"><Layers size={14} /></div>
            <span className="ie-nav-header-title">Sections</span>
            <span className="ie-nav-header-count">{pct}%</span>
          </div>

          <div className="ie-nav-body">
            {(() => {
              const activeNode = getNodeAtPath(tree, activePath);
              const activeFolderFullPath = activeNode?.isLeaf ? activePath.slice(0, -1).join(' › ') : activePath.join(' › ');

              const renderNavNode = (node: NavNode, depth = 0) => {
                if (node.isLeaf) return null; // Hide Sections/Items from the left sidebar

                const isNavOpen = openNavSections.has(node.fullPath) || activePath.join(' › ').startsWith(node.fullPath);
                const hasFolderChildren = Object.values(node.children).some(c => !c.isLeaf);
                const isActive = activeFolderFullPath === node.fullPath;

                const stats = { answered: 0, total: 0 };
                const accumulateStats = (n: NavNode) => {
                  stats.total += n.results.length;
                  stats.answered += n.results.filter(r => !!r.responseValue).length;
                  Object.values(n.children).forEach(accumulateStats);
                };
                accumulateStats(node);
                const isDone = stats.total > 0 && stats.answered === stats.total;

                return (
                  <div key={node.fullPath} className="ie-nav-section-wrap">
                    <div
                      className={`ie-nav-section-head ${isActive ? 'ie-nav-section-active' : ''}`}
                      style={{ paddingLeft: 12 + depth * 14, background: isActive ? 'rgba(51,174,149,0.06)' : '', borderLeft: isActive ? '2px solid #33AE95' : '2px solid transparent' }}
                      onClick={() => {
                        if (hasFolderChildren) toggleNavSection(node.fullPath);
                        goToNode(node.fullPath.split(' › '));
                      }}
                    >
                      {isNavOpen || isActive ? (
                        <FolderOpen size={14} style={{ marginRight: 8, color: isDone ? '#22c55e' : isActive ? '#298E7A' : '#94A3B8' }} />
                      ) : (
                        <Folder size={14} style={{ marginRight: 8, color: isDone ? '#22c55e' : isActive ? '#298E7A' : '#94A3B8' }} />
                      )}

                      <span className="ie-nav-section-name" style={{ color: isActive ? '#298E7A' : '#1E293B', fontWeight: isActive ? 700 : 600 }}>{node.name}</span>
                      <span className="ie-nav-count">{stats.answered}/{stats.total}</span>

                      {hasFolderChildren && (
                        <ChevronDown
                          size={12}
                          className={`ie-nav-chevron ${isNavOpen ? 'ie-nav-chevron-open' : ''}`}
                        />
                      )}

                      {isActive && (
                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', color: '#CBD5E1' }} onClick={e => e.stopPropagation()}>
                          <span title="Sort"><GripVertical size={13} style={{ cursor: 'pointer' }} className="ie-icon-mock" /></span>
                          <span title="Move"><FolderInput size={13} style={{ cursor: 'pointer' }} className="ie-icon-mock" /></span>
                          <span title="Copy"><Copy size={13} style={{ cursor: 'pointer' }} className="ie-icon-mock" /></span>
                          <span title="Delete"><Trash2 size={13} style={{ cursor: 'pointer' }} className="ie-icon-mock" /></span>
                        </div>
                      )}
                    </div>

                    {hasFolderChildren && isNavOpen && (
                      <div className="ie-nav-sub" style={{ paddingLeft: 0, borderLeft: 'none', marginLeft: 0 }}>
                        {Object.values(node.children).map(c => renderNavNode(c, depth + 1))}
                      </div>
                    )}
                  </div>
                );
              };

              return Object.values(tree).map(rootNode => renderNavNode(rootNode, 0));
            })()}
          </div>

          {/* Sidebar footer — Add Custom Section */}
          {!isCompleted && (
            <div className="ie-nav-footer">
              {navAddOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginBottom: 12 }}>
                  <input
                    ref={navAddInputRef}
                    type="text"
                    className="ie-add-input"
                    placeholder="New Section Name…"
                    value={navAddLabel}
                    onChange={e => setNavAddLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNavAdd()}
                  />
                  <div className="ie-add-actions">
                    <button
                      className="ie-add-cancel"
                      onClick={() => { setNavAddOpen(false); setNavAddLabel(''); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="ie-add-confirm"
                      disabled={!navAddLabel.trim() || adding}
                      onClick={handleNavAdd}
                    >
                      {adding ? <RefreshCw size={12} className="ie-spinner-sm" /> : <PlusCircle size={12} />}
                      {adding ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', width: '100%', border: '1px solid #CBD5E1', borderRadius: '4px', overflow: 'hidden' }}>
                <button
                  style={{ flex: 1, padding: '6px 0', background: '#FFF', borderRight: '1px solid #CBD5E1', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
                  onClick={() => { setNavAddOpen(true); setTimeout(() => navAddInputRef.current?.focus(), 50); }}
                >
                  Add
                </button>
                <button
                  style={{ flex: 1, padding: '6px 0', background: '#FFF', borderRight: '1px solid #CBD5E1', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
                  onClick={() => {
                     if (!activePath.length) { toast.error('Select a section to remove'); return; }
                     const targetSection = activePath.join(' › ');
                     setResults(p => p.filter(r => r.sectionName !== targetSection && !r.sectionName?.startsWith(targetSection + ' › ')));
                     toast.success('Section removed locally');
                     goToNode([]);
                  }}
                >
                  Remove
                </button>
                <button
                  style={{ flex: 1, padding: '6px 0', background: '#FFF', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
                  onClick={() => toast.success('Copy Section')}
                >
                  Copy
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: '#94A3B8', textAlign: 'center' }}>
                Double click on a menu to rename it.
              </div>
            </div>
          )}
        </div>

        {/* ── Workspace (right panel) ───────────────────────────────────── */}
        <div className="ie-workspace">

          {/* Breadcrumb bar */}
          <div className="ie-bc-bar">
            {activePath.length > 0 ? (
              activePath.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight size={12} className="ie-breadcrumb-sep" />}
                  <span
                    className={i === activePath.length - 1 ? 'ie-breadcrumb-active' : 'ie-breadcrumb-item'}
                    onClick={() => goToNode(activePath.slice(0, i + 1))}
                    style={{ cursor: 'pointer' }}
                  >
                    {part}
                  </span>
                </React.Fragment>
              ))
            ) : (
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>Select a section from the left</span>
            )}
          </div>

          {/* Scrollable content */}
          <div className="ie-scroll-area">

            {/* Empty / retry state (when overall inspection is completely empty) */}
            {results.length === 0 && (
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

            {/* If Current Node is a FOLDER (has children) */}
            {currentNode && !currentNode.isLeaf && results.length > 0 && (
              <>
                {(() => {
                  const childSections = Object.values(currentNode.children).filter(c => c.isLeaf);
                  if (childSections.length === 0) {
                    return (
                      <div className="ie-empty" style={{ marginTop: 40 }}>
                        <Layers size={32} style={{ color: '#E2E8F0', marginBottom: 12 }} />
                        <p style={{ fontWeight: 600, color: '#64748B' }}>No Inspection Sections</p>
                        <p style={{ fontSize: 13, color: '#94A3B8' }}>Select a sub-folder to view or add sections.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="ie-folder-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {childSections.map(child => {
                        const cAnswered = child.results.filter(r => !!r.responseValue).length;
                        const cTotal = child.results.length;
                        const cPct = cTotal > 0 ? Math.round((cAnswered / cTotal) * 100) : 0;

                        return (
                          <div
                            key={child.fullPath}
                            className="ie-list-card"
                            style={{ 
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                              padding: '16px 20px', borderRadius: '12px', border: '1px solid #E5E7EB', borderLeft: '3px solid var(--ip-brand)',
                              background: selectedFolderPath === child.fullPath ? '#EFF6FF' : 'white',
                              boxShadow: selectedFolderPath === child.fullPath ? '0 0 0 1px #3B82F6' : undefined
                            }}
                            onClick={() => setSelectedFolderPath(child.fullPath)}
                            onDoubleClick={() => { setSelectedFolderPath(null); goToNode(child.fullPath.split(' › ')); }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                              <Layers size={16} color="var(--ip-brand)" />
                              <span style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', flex: 1 }}>{child.name}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', width: '120px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: cPct === 100 ? '#10B981' : '#64748B' }}>
                                  {cPct === 100 ? '100% Complete' : `${cPct}% Complete`}
                                </span>
                                <div style={{ width: '100%', height: '4px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${cPct}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: '10px', color: '#94A3B8' }}>{cAnswered}/{cTotal} items</span>
                              </div>
                              <ChevronRight size={16} color="#CBD5E1" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            {/* If Current Node is a LEAF (Panel) */}
            {currentNode && currentNode.isLeaf && (
              <div className="ie-panel-card" style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0' }}>
                {(() => {
                  const panelResults = activeNodeResults;

                  if (panelResults.length === 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: '#FAFAFA', borderRadius: 8, border: '1px dashed #CBD5E1', margin: '20px 0' }}>
                        <FolderOpen size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                        <p style={{ fontSize: 16, fontWeight: 600, color: '#475569', margin: '0 0 8px' }}>Empty Folder</p>
                        <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 24px' }}>There are no items in this panel yet.</p>
                        <button className="ie-fBtn ie-fBtn-primary" onClick={() => { setPanelAddOpen(true); setTimeout(() => panelAddInputRef.current?.focus(), 50); }} style={{ padding: '10px 24px' }}>
                          <PlusCircle size={16} /> Add First Item
                        </button>
                        
                        {/* Inline custom addition when empty */}
                        {!isCompleted && panelAddOpen && (
                          <div style={{ marginTop: 24, padding: '16px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', borderRadius: 10, width: '100%', maxWidth: 400 }}>
                            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                              <input
                                ref={panelAddInputRef}
                                type="text"
                                className="ie-add-input"
                                placeholder="Describe the item…"
                                value={panelAddLabel}
                                onChange={e => setPanelAddLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handlePanelAdd()}
                                style={{ flex: 1 }}
                              />
                              <button className="ie-add-confirm" disabled={!panelAddLabel.trim() || adding} onClick={handlePanelAdd}>
                                {adding ? 'Adding…' : 'Save'}
                              </button>
                              <button className="ie-add-cancel" onClick={() => { setPanelAddOpen(false); setPanelAddLabel(''); }}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  const pAnswered = panelResults.filter(r => !!r.responseValue).length;
                  const pPct = panelResults.length > 0 ? Math.round((pAnswered / panelResults.length) * 100) : 0;
                  const logicType = panelResults[0]?.logicType || 'DAMAGE';

                  return (
                    <>
                      {/* Card header */}
                      <div className="ie-panel-card-head" style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
                        <div className="ie-panel-card-icon"><Layers size={14} /></div>
                      {/* Result rows */}
                      {panelResults.map((result, idx) => {
                        const isDamaged = result.responseValue === 'DEFECTIVE';
                        const isCorrect = result.responseValue === 'ACCEPTABLE';
                        const isLast = idx === panelResults.length - 1;

                        return (
                          <div
                            key={result.id}
                            className={`ie-result-row ${selectedItemId === result.id ? 'ie-row-selected' : ''} ${isDamaged ? 'ie-row-damaged' : isCorrect ? 'ie-row-correct' : ''}`}
                            style={{ borderBottom: isLast ? 'none' : '1px solid #F1F5F9', cursor: 'pointer', background: selectedItemId === result.id ? '#EFF6FF' : undefined }}
                            onClick={() => setSelectedItemId(result.id)}
                          >
                            <div className="ie-result-body">
                              <div className="ie-result-label-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <p className="ie-item-label" style={{ margin: 0 }}>{result.itemLabel}</p>
                                  <div className="ie-item-chips">
                                    {result.isCustom && <span className="ie-chip ie-chip-custom">Custom</span>}
                                  </div>
                                </div>
                                <div className="ie-item-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9CA3AF' }}>
                                  <button type="button" className="ie-icon-mock" title="Edit Item" onClick={(e) => { e.stopPropagation(); setEditItemModal(result); }}><Pencil size={13} /></button>
                                  <button type="button" className="ie-icon-mock" title="Move Up" onClick={(e) => {
                                    e.stopPropagation();
                                    setResults(p => {
                                      const next = [...p]; const i = next.findIndex(r => r.id === result.id);
                                      if (i > 0 && next[i-1].sectionName === next[i].sectionName) { [next[i-1], next[i]] = [next[i], next[i-1]]; }
                                      return next;
                                    });
                                  }}><ArrowUp size={13} /></button>
                                  <button type="button" className="ie-icon-mock" title="Move Down" onClick={(e) => {
                                    e.stopPropagation();
                                    setResults(p => {
                                      const next = [...p]; const i = next.findIndex(r => r.id === result.id);
                                      if (i < next.length - 1 && next[i+1].sectionName === next[i].sectionName) { [next[i], next[i+1]] = [next[i+1], next[i]]; }
                                      return next;
                                    });
                                  }}><ArrowDown size={13} /></button>
                                  <button type="button" className="ie-icon-mock" title="Copy Item" onClick={(e) => {
                                    e.stopPropagation();
                                    setResults(p => [...p, { ...result, id: Date.now(), itemLabel: `${result.itemLabel} (Copy)` }]);
                                    toast.success('Item Copied!');
                                  }}><Copy size={13} /></button>
                                  <button type="button" className="ie-icon-mock" title="Delete Item" onClick={(e) => {
                                    e.stopPropagation();
                                    setResults(p => p.filter(r => r.id !== result.id));
                                    toast.success('Item Deleted!');
                                  }}><Trash2 size={13} /></button>
                                </div>
                              </div>

                              {/* Inline defect expansion */}
                              {isDamaged && (
                                <div className="ie-defect-expand">
                                  {/* Photo upload */}
                                  <div className="ie-photo-row">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      ref={el => { if (el) photoInputsRef.current[result.id] = el; }}
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoChange(result.id, file);
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className={`ie-photo-btn ${result.photoUrl ? 'ie-photo-btn-done' : ''}`}
                                      onClick={() => photoInputsRef.current[result.id]?.click()}
                                    >
                                      <Camera size={14} />
                                      {result.photoUrl ? 'Photo Added ✓' : 'Add Photo'}
                                    </button>
                                    {result.photoUrl && (
                                      <img src={result.photoUrl} alt="defect" className="ie-photo-thumb" />
                                    )}
                                  </div>

                                  {/* Severity picker */}
                                  <div className="ie-severity-row">
                                    <span className="ie-severity-label">Severity:</span>
                                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map(sev => (
                                      <button
                                        key={sev}
                                        type="button"
                                        className={`ie-sev-btn ie-sev-${sev.toLowerCase()} ${result.severity === sev ? 'ie-sev-active' : ''}`}
                                        onClick={() => setSeverityLocal(result.id, sev)}
                                      >
                                        {sev}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Comment box */}
                                  <textarea
                                    className="ie-comment-area"
                                    rows={2}
                                    placeholder="Add repair notes or observations…"
                                    value={result.comments ?? ''}
                                    onChange={e => updateComment(result.id, e.target.value)}
                                    onBlur={() => saveResult(result.id, 'DEFECTIVE', result.comments)}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="ie-action-btns">
                              {result.logicType === 'SELECTION' ? (
                                <button
                                  type="button"
                                  className={`ie-sel-toggle ${isCorrect ? 'ie-sel-on' : ''}`}
                                  onClick={() => setStatus(result.id, isCorrect ? null : 'ACCEPTABLE')}
                                >
                                  {isCorrect ? <><CheckCircle2 size={13} /> Selected</> : 'Select'}
                                </button>
                              ) : (
                                <div className="ie-dmg-btns">
                                  <button
                                    type="button"
                                    className={`ie-dmg-btn ie-dmg-correct ${isCorrect ? 'ie-dmg-active' : ''}`}
                                    onClick={() => setStatus(result.id, 'ACCEPTABLE')}
                                  >
                                    <CheckCircle2 size={13} /> Pass
                                  </button>
                                  <button
                                    type="button"
                                    className={`ie-dmg-btn ie-dmg-damaged ${isDamaged ? 'ie-dmg-active-red' : ''}`}
                                    onClick={() => setStatus(result.id, 'DEFECTIVE')}
                                  >
                                    <AlertTriangle size={13} /> Fail
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Footer Actions (Add Custom Item inline) */}
                      {!isCompleted && panelAddOpen && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                            <input
                              ref={panelAddInputRef}
                              type="text"
                              className="ie-add-input"
                              placeholder="Describe the item…"
                              value={panelAddLabel}
                              onChange={e => setPanelAddLabel(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handlePanelAdd()}
                              style={{ flex: 1 }}
                            />
                            <button className="ie-add-confirm" disabled={!panelAddLabel.trim() || adding} onClick={handlePanelAdd}>
                              {adding ? 'Adding…' : 'Save'}
                            </button>
                            <button className="ie-add-cancel" onClick={() => { setPanelAddOpen(false); setPanelAddLabel(''); }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {!isCompleted && !panelAddOpen && results.filter(r => r.sectionName === currentNode.fullPath).length > 0 && (
                        <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                          <button
                            className="ie-add-more-btn"
                            style={{ width: '100%', padding: '10px 16px', background: '#FFF', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', border: '1px dashed #CBD5E1', color: '#64748B', borderRadius: '8px', transition: 'all 0.2s', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#33AE95'; e.currentTarget.style.borderColor = '#33AE95'; e.currentTarget.style.background = '#F1F5F9'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#FFF'; }}
                            onClick={() => { setPanelAddOpen(true); setTimeout(() => panelAddInputRef.current?.focus(), 50); }}
                          >
                            <PlusCircle size={14} /> Add Item
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Section-complete prompt */}
            {isPanelComplete && showCompletePrompt && nextPanelPath && (
              <div className="ie-complete-prompt">
                <div className="ie-complete-icon">
                  <CheckCircle2 size={26} />
                </div>
                <div className="ie-complete-text">
                  <h3 className="ie-complete-title">Section Complete!</h3>
                  <p className="ie-complete-sub">
                    Ready to move to <strong>{nextPanelPath.slice(-1)[0]}</strong>?
                  </p>
                </div>
                <div className="ie-complete-actions">
                  <button className="ie-complete-dismiss" onClick={() => setShowCompletePrompt(false)}>
                    Stay Here
                  </button>
                  <button className="ie-complete-proceed" onClick={goToNextPanel}>
                    Proceed <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* All done banner */}
            {pct === 100 && !isCompleted && (
              <div className="ie-all-done">
                <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
                <span>All items answered! Ready to submit.</span>
              </div>
            )}

          </div>

          {/* Workspace footer — fixed at bottom */}
          <div className="ie-wfooter" style={{ display: 'block', padding: 0, height: 'auto', background: '#FFF', borderTop: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', width: '100%', padding: '12px 20px', alignItems: 'center' }}>
              <div className="ie-wfooter-spacer" style={{ flex: 1 }} />
              {nextPanelPath && (
                <button className="ie-fBtn" onClick={goToNextPanel}>
                  Next: {nextPanelPath.slice(-1)[0]}
                  <ChevronRight size={13} />
                </button>
              )}
              {!isCompleted && (
                <button
                  className="ie-fBtn ie-fBtn-primary"
                  style={{ marginLeft: 12 }}
                  onClick={handleSubmit}
                  disabled={submitting || pct < 100}
                >
                  {submitting
                    ? <RefreshCw size={13} className="ie-spinner-sm" />
                    : <Send size={13} />}
                  {submitting ? 'Submitting…' : pct < 100 ? `Submit (${pct}%)` : 'Submit Inspection'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
      
      {/* ═══ EDIT ITEM MODAL ═══ */}
      {editItemModal && (
        <EditItemModal
          item={editItemModal}
          onConfirm={(name, reportName) => {
            setResults(p => p.map(r => r.id === editItemModal.id ? { ...r, itemLabel: name, reportName } : r));
            setEditItemModal(null);
            toast.success('Item updated successfully');
          }}
          onCancel={() => setEditItemModal(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Edit Item Modal (Name / Report Alias)
───────────────────────────────────────────────────────────────── */
function EditItemModal({
  item,
  onConfirm,
  onCancel
}: {
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

  const submit = () => {
    if (!canSubmit) return;
    onConfirm(itemName.trim(), reportName.trim() || itemName.trim());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)' }} onClick={onCancel}>
      <div style={{ background: '#FFF', borderRadius: 12, padding: '24px', width: '100%', maxWidth: 420, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0F172A' }}>Edit Item</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Label Name <span style={{ color: '#EF4444' }}>*</span></label>
          <input
            ref={inputRef}
            type="text"
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
            placeholder="e.g. Wall Paint"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Report Alias (Optional)</label>
          <input
            type="text"
            value={reportName}
            onChange={e => setReportName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
            placeholder="e.g. Living Room Wall Paint"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none' }}
          />
          <p style={{ fontSize: 12, color: '#64748B', margin: '6px 0 0' }}>Display name used when generating the final PDF exported report.</p>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 14, color: '#475569', cursor: 'pointer', fontWeight: 500 }} onClick={onCancel}>Cancel</button>
          <button style={{ padding: '8px 16px', background: '#33AE95', border: 'none', borderRadius: 6, fontSize: 14, color: '#FFF', cursor: canSubmit ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: canSubmit ? 1 : 0.6 }} onClick={submit} disabled={!canSubmit}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
