import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle,
  ChevronRight, ChevronDown, Layers, Camera, PlusCircle, Send, ClipboardCheck,
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
function parsePath(sectionName: string): string[] {
  return sectionName.split(' › ').map(s => s.trim()).filter(Boolean);
}

type NavTree = Record<string, Record<string, Record<string, LocalResult[]>>>;

function buildTree(results: LocalResult[]): NavTree {
  return results.reduce<NavTree>((acc, r) => {
    const parts = parsePath(r.sectionName || 'Other');
    const s = parts[0] || 'Other';
    const sub = parts[1] || '';
    const panel = parts[2] || '';
    if (!acc[s]) acc[s] = {};
    if (!acc[s][sub]) acc[s][sub] = {};
    if (!acc[s][sub][panel]) acc[s][sub][panel] = [];
    acc[s][sub][panel].push(r);
    return acc;
  }, {});
}

function getAllPanelKeys(tree: NavTree): string[] {
  const keys: string[] = [];
  for (const section of Object.keys(tree)) {
    for (const sub of Object.keys(tree[section])) {
      for (const panel of Object.keys(tree[section][sub])) {
        keys.push([section, sub, panel].filter(Boolean).join(' › '));
      }
    }
  }
  return keys;
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
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [openNavSections, setOpenNavSections] = useState<Set<string>>(new Set());

  // Section-complete prompt
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);

  // Add More per section (in sidebar footer)
  const [addMoreOpen, setAddMoreOpen] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

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

      // Set initial active panel
      const tree = buildTree(loaded);
      const allPanels = getAllPanelKeys(tree);
      if (allPanels.length > 0) {
        setActivePanel(prev => prev ?? allPanels[0]);
        const firstSection = Object.keys(tree)[0];
        if (firstSection) setOpenNavSections(prev => new Set([...prev, firstSection]));
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

  // Focus add-more input
  useEffect(() => {
    if (addMoreOpen) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [addMoreOpen]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const tree = useMemo(() => buildTree(results), [results]);
  const allPanelKeys = useMemo(() => getAllPanelKeys(tree), [tree]);

  const activePanelResults = useMemo(() => {
    if (!activePanel) return [];
    return results.filter(r => (r.sectionName || 'Other') === activePanel);
  }, [activePanel, results]);

  const answered = results.filter(r => !!r.responseValue).length;
  const pct = results.length > 0 ? Math.round((answered / results.length) * 100) : 0;

  const isPanelComplete = activePanelResults.length > 0 && activePanelResults.every(r => !!r.responseValue);
  const nextPanelKey = activePanel ? allPanelKeys[allPanelKeys.indexOf(activePanel) + 1] ?? null : null;

  const panelAnsweredCount = activePanelResults.filter(r => !!r.responseValue).length;
  const panelPct = activePanelResults.length > 0 ? Math.round((panelAnsweredCount / activePanelResults.length) * 100) : 0;

  // Show section-complete prompt when panel finishes
  useEffect(() => {
    if (isPanelComplete && nextPanelKey) setShowCompletePrompt(true);
    else setShowCompletePrompt(false);
  }, [isPanelComplete, nextPanelKey]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToPanel = (key: string) => {
    setActivePanel(key);
    setShowCompletePrompt(false);
    setAddMoreOpen(false);
    setAddLabel('');
    const parts = parsePath(key);
    if (parts[0]) setOpenNavSections(prev => new Set([...prev, parts[0]]));
  };

  const goToNextPanel = () => { if (nextPanelKey) goToPanel(nextPanelKey); };

  const toggleNavSection = (section: string) => {
    setOpenNavSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
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
  const handleAddMore = async () => {
    if (!addLabel.trim() || !inspectionId || !activePanel) return;
    setAdding(true);
    try {
      const newResult = await checklistService.addCustomResult(inspectionId, {
        itemLabel: addLabel.trim(),
        sectionName: activePanel,
        logicType: 'DAMAGE',
      });
      setResults(prev => [...prev, toLocal(newResult)]);
      setAddLabel('');
      setAddMoreOpen(false);
      toast.success('Custom item added');
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
  const breadcrumbParts = activePanel ? parsePath(activePanel) : [];

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
            {Object.entries(tree).map(([section, subs]) => {
              const sectionResults = Object.values(subs).flatMap(p => Object.values(p).flat());
              const sectionAnswered = sectionResults.filter(r => !!r.responseValue).length;
              const sectionDone = sectionAnswered === sectionResults.length && sectionResults.length > 0;
              const isNavOpen = openNavSections.has(section);

              return (
                <div key={section} className="ie-nav-section">
                  <div className="ie-nav-section-head" onClick={() => toggleNavSection(section)}>
                    <div className={`ie-nav-dot ${sectionDone ? 'ie-nav-dot-done' : ''}`} />
                    <span className="ie-nav-section-name">{section}</span>
                    <span className="ie-nav-count">{sectionAnswered}/{sectionResults.length}</span>
                    <ChevronDown
                      size={12}
                      className={`ie-nav-chevron ${isNavOpen ? 'ie-nav-chevron-open' : ''}`}
                    />
                  </div>

                  {isNavOpen && Object.entries(subs).map(([sub, panels]) => (
                    <div key={sub} className="ie-nav-sub">
                      {sub && <div className="ie-nav-sub-label">{sub}</div>}
                      {Object.entries(panels).map(([panel, panelResults]) => {
                        const panelKey = [section, sub, panel].filter(Boolean).join(' › ');
                        const panelAnswered = panelResults.filter(r => !!r.responseValue).length;
                        const panelDone = panelAnswered === panelResults.length && panelResults.length > 0;
                        const isActive = activePanel === panelKey;

                        return (
                          <div
                            key={panelKey}
                            className={`ie-nav-panel ${isActive ? 'ie-nav-panel-active' : ''}`}
                            onClick={() => goToPanel(panelKey)}
                          >
                            {panelDone
                              ? <CheckCircle2 size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
                              : <span className="ie-nav-panel-dot" />
                            }
                            <span className="ie-nav-panel-name">{panel || sub || section}</span>
                            <span className="ie-nav-panel-count">{panelAnswered}/{panelResults.length}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Sidebar footer — Add Custom Item */}
          {!isCompleted && (
            <div className="ie-nav-footer">
              {addMoreOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  <input
                    ref={addInputRef}
                    type="text"
                    className="ie-add-input"
                    placeholder="Describe the item…"
                    value={addLabel}
                    onChange={e => setAddLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMore()}
                  />
                  <div className="ie-add-actions">
                    <button
                      className="ie-add-cancel"
                      onClick={() => { setAddMoreOpen(false); setAddLabel(''); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="ie-add-confirm"
                      disabled={!addLabel.trim() || adding}
                      onClick={handleAddMore}
                    >
                      {adding ? <RefreshCw size={12} className="ie-spinner-sm" /> : <PlusCircle size={12} />}
                      {adding ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="ie-nav-add-btn"
                  disabled={!activePanel}
                  onClick={() => setAddMoreOpen(true)}
                >
                  <PlusCircle size={14} /> Add Custom Item
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Workspace (right panel) ───────────────────────────────────── */}
        <div className="ie-workspace">

          {/* Breadcrumb bar */}
          <div className="ie-bc-bar">
            {breadcrumbParts.length > 0 ? (
              breadcrumbParts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight size={12} className="ie-breadcrumb-sep" />}
                  <span className={i === breadcrumbParts.length - 1 ? 'ie-breadcrumb-active' : 'ie-breadcrumb-item'}>
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

            {/* Empty / retry state */}
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

            {/* Active panel card */}
            {activePanelResults.length > 0 && (
              <div className="ie-panel-card">
                {/* Card header */}
                <div className="ie-panel-card-head">
                  <div className="ie-panel-card-icon"><Layers size={13} /></div>
                  <span className="ie-panel-card-title">
                    {breadcrumbParts[breadcrumbParts.length - 1] ?? 'Items'}
                  </span>
                  <div className="ie-panel-progress-wrap">
                    <span className="ie-panel-progress-text">{panelAnsweredCount}/{activePanelResults.length}</span>
                    <div className="ie-panel-progress-bar">
                      <div
                        className={`ie-panel-progress-fill ${panelPct === 100 ? 'ie-panel-progress-fill-done' : ''}`}
                        style={{ width: `${panelPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Result rows */}
                {activePanelResults.map((result) => {
                  const isDamaged = result.responseValue === 'DEFECTIVE';
                  const isCorrect = result.responseValue === 'ACCEPTABLE';

                  return (
                    <div
                      key={result.id}
                      className={`ie-result-row ${isDamaged ? 'ie-row-damaged' : isCorrect ? 'ie-row-correct' : ''}`}
                    >
                      <div className="ie-result-body">
                        <div className="ie-result-label-row">
                          <p className="ie-item-label">{result.itemLabel}</p>
                          <div className="ie-item-chips">
                            {result.isCustom && <span className="ie-chip ie-chip-custom">Custom</span>}
                            {result.logicType && <span className="ie-chip ie-chip-logic">{result.logicType}</span>}
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
                              <CheckCircle2 size={13} /> Correct
                            </button>
                            <button
                              type="button"
                              className={`ie-dmg-btn ie-dmg-damaged ${isDamaged ? 'ie-dmg-active-red' : ''}`}
                              onClick={() => setStatus(result.id, 'DEFECTIVE')}
                            >
                              <AlertTriangle size={13} /> Damaged
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section-complete prompt */}
            {isPanelComplete && showCompletePrompt && nextPanelKey && (
              <div className="ie-complete-prompt">
                <div className="ie-complete-icon">
                  <CheckCircle2 size={26} />
                </div>
                <div className="ie-complete-text">
                  <h3 className="ie-complete-title">Section Complete!</h3>
                  <p className="ie-complete-sub">
                    Ready to move to <strong>{parsePath(nextPanelKey).slice(-1)[0]}</strong>?
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
          <div className="ie-wfooter">
            <span className="ie-wfooter-meta">{answered}/{results.length} answered · {pct}%</span>
            <div className="ie-wfooter-spacer" />
            {nextPanelKey && (
              <button className="ie-fBtn" onClick={goToNextPanel}>
                Next: {parsePath(nextPanelKey).slice(-1)[0]}
                <ChevronRight size={13} />
              </button>
            )}
            {!isCompleted && (
              <button
                className="ie-fBtn ie-fBtn-primary"
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
  );
}
