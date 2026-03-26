import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronRight, ChevronDown, Search, X,
  Loader2, ArrowLeft, Save, FilePlus2, Edit2, Copy,
  AlertTriangle, Camera, CheckCircle2, XCircle, MoveRight,
  FolderOpen, Folder, FileText, LayoutTemplate,
} from 'lucide-react';
import { checklistService } from '@/services/checklistService';
import type {
  BuilderSection, BuilderSubSection, BuilderTab, BuilderPanel,
  BuilderItem, BuilderPanelType, TemplateResponse,
} from '@/services/models/checklist';
import css from './TemplateBuilder.module.css';

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
const genId = () => crypto.randomUUID();

const emptyItem = (): BuilderItem => ({
  id: genId(), label: 'New Item', responseType: 'TEXT',
  options: [], commonComments: [], required: false, conditionalLogic: null,
});
const emptyPanel = (type: BuilderPanelType, name: string): BuilderPanel => ({
  id: genId(), name, panelType: type, items: [],
});
const emptyTab = (name: string): BuilderTab => ({ id: genId(), name, panels: [] });
const emptySubSection = (name: string): BuilderSubSection => ({ id: genId(), name, tabs: [] });
const emptySection = (name: string): BuilderSection => ({ id: genId(), name, subSections: [] });

function deepCopyItem(i: BuilderItem): BuilderItem {
  return { ...i, id: genId(), options: [...i.options], commonComments: [...i.commonComments] };
}
function deepCopyPanel(p: BuilderPanel): BuilderPanel {
  return { ...p, id: genId(), items: p.items.map(deepCopyItem) };
}
function deepCopyTab(t: BuilderTab): BuilderTab {
  return { ...t, id: genId(), panels: t.panels.map(deepCopyPanel) };
}
function deepCopySub(ss: BuilderSubSection): BuilderSubSection {
  return { ...ss, id: genId(), tabs: ss.tabs.map(deepCopyTab) };
}

function toLegacyBuilder(sections: any[]): BuilderSection[] {
  if (!sections?.length) return [];
  return sections.map((sec: any) => {
    if (sec.subSections) return sec as BuilderSection;
    return {
      id: genId(),
      name: sec.sectionName || sec.name || 'Section',
      subSections: [{
        id: genId(),
        name: sec.sectionName || sec.name || 'Section',
        tabs: [{
          id: genId(), name: 'Main',
          panels: [{
            id: genId(), name: 'General', panelType: 'SELECTION' as BuilderPanelType,
            items: (sec.items || []).map((i: any) => ({
              id: genId(), label: i.label || '', responseType: 'TEXT',
              options: [], commonComments: [], required: false, conditionalLogic: null,
            })),
          }],
        }],
      }],
    };
  });
}

/* ─────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────── */
const ROOT_ID = '__template_root__';
type SelLevel = 'root' | 'section' | 'subsection' | 'inspection' | 'panel' | null;
interface TreeSel {
  level: SelLevel;
  sectionId: string | null;
  subId: string | null;
  tabId: string | null;
  panelId: string | null;
}
const NO_SEL: TreeSel = { level: null, sectionId: null, subId: null, tabId: null, panelId: null };
const ROOT_SEL: TreeSel = { level: 'root', sectionId: null, subId: null, tabId: null, panelId: null };
type ItemState = 'none' | 'selected' | 'correct' | 'damaged';

/* ─────────────────────────────────────────────────────────────────
   TemplateBuilder — Root
───────────────────────────────────────────────────────────────── */
export default function TemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const templateIdRef = useRef<string | undefined>(isNew ? undefined : id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [sel, setSel] = useState<TreeSel>(ROOT_SEL);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([ROOT_ID]));
  const [changes, setChanges] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [treeSearch, setTreeSearch] = useState('');
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [selItemIds, setSelItemIds] = useState<Set<string>>(new Set());
  const [copyMoveModal, setCopyMoveModal] = useState<{ itemId: string; panelId: string } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  /* load */
  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    setLoading(true);
    checklistService.getTemplate(id!).then((tpl: TemplateResponse) => {
      setTitle(tpl.title || '');
      setDescription((tpl as any).description || '');
      templateIdRef.current = tpl.id?.toString();
      const built = toLegacyBuilder(tpl.sections ?? []);
      setSections(built);
      setExpanded(new Set([ROOT_ID, ...(built.length ? [built[0].id] : [])]));
    }).catch(() => toast.error('Failed to load template')).finally(() => setLoading(false));
  }, [id, isNew]);

  const dirty = useCallback((fn: (p: BuilderSection[]) => BuilderSection[]) => {
    setSections(fn); setChanges(c => c + 1);
  }, []);

  const toggle = (nodeId: string) =>
    setExpanded(p => { const n = new Set(p); n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId); return n; });

  /* ── Section CRUD ── */
  const addSection = () => {
    const sec = emptySection(`Section ${sections.length + 1}`);
    dirty(p => [...p, sec]);
    setSel({ level: 'section', sectionId: sec.id, subId: null, tabId: null, panelId: null });
    setExpanded(p => new Set([...p, sec.id]));
  };
  const delSection = (sid: string) => {
    dirty(p => p.filter(s => s.id !== sid));
    if (sel.sectionId === sid) setSel(NO_SEL);
  };
  const renameSection = (sid: string, name: string) =>
    dirty(p => p.map(s => s.id === sid ? { ...s, name } : s));

  /* ── Subsection CRUD ── */
  const addSub = (sid: string) => {
    const sec = sections.find(s => s.id === sid);
    const sub = emptySubSection(`Subsection ${(sec?.subSections.length ?? 0) + 1}`);
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: [...s.subSections, sub] } : s));
    setSel({ level: 'subsection', sectionId: sid, subId: sub.id, tabId: null, panelId: null });
    setExpanded(p => new Set([...p, sid]));
  };
  const delSub = (sid: string, ssid: string) => {
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.filter(ss => ss.id !== ssid) } : s));
    if (sel.subId === ssid) setSel(s => ({ ...s, level: 'section', subId: null, tabId: null, panelId: null }));
  };
  const renameSub = (sid: string, ssid: string, name: string) =>
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, name } : ss) } : s));

  /* ── Inspection CRUD ── */
  const addInspection = (sid: string, ssid: string) => {
    const sub = sections.find(s => s.id === sid)?.subSections.find(ss => ss.id === ssid);
    const tab = emptyTab(`Inspection ${(sub?.tabs.length ?? 0) + 1}`);
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: [...ss.tabs, tab] } : ss) } : s));
    setSel({ level: 'inspection', sectionId: sid, subId: ssid, tabId: tab.id, panelId: null });
    setExpanded(p => new Set([...p, sid, ssid]));
  };
  const delInspection = (sid: string, ssid: string, tabId: string) => {
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.filter(t => t.id !== tabId) } : ss) } : s));
    if (sel.tabId === tabId) setSel(s => ({ ...s, level: 'subsection', tabId: null, panelId: null }));
  };
  const renameInspection = (sid: string, ssid: string, tabId: string, name: string) =>
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, name } : t) } : ss) } : s));

  /* ── Panel CRUD ── */
  const addPanel = (type: BuilderPanelType) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    const tab = sections.find(s => s.id === sid)?.subSections.find(ss => ss.id === ssid)?.tabs.find(t => t.id === tabId);
    const panel = emptyPanel(type, `${type === 'SELECTION' ? 'Selection' : 'Damaged'} Section ${(tab?.panels.length ?? 0) + 1}`);
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: [...t.panels, panel] } : t) } : ss) } : s));
    setSel({ level: 'panel', sectionId: sid, subId: ssid, tabId, panelId: panel.id });
    setExpanded(p => new Set([...p, sid, ssid, tabId]));
  };
  const delPanel = (panelId: string) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: t.panels.filter(p2 => p2.id !== panelId) } : t) } : ss) } : s));
    if (sel.panelId === panelId) setSel(s => ({ ...s, level: 'inspection', panelId: null }));
  };
  const renamePanel = (panelId: string, name: string) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: t.panels.map(p2 => p2.id === panelId ? { ...p2, name } : p2) } : t) } : ss) } : s));
  };

  /* ── Item CRUD ── */
  const addItem = (panelId: string) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    const item = emptyItem();
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: t.panels.map(p2 => p2.id === panelId ? { ...p2, items: [...p2.items, item] } : p2) } : t) } : ss) } : s));
  };
  const addItemToFirstPanel = () => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    if (sel.panelId) { addItem(sel.panelId); return; }
    const tab = sections.find(s => s.id === sel.sectionId)?.subSections.find(ss => ss.id === sel.subId)?.tabs.find(t => t.id === sel.tabId);
    if (!tab?.panels.length) { toast.info('Add an Inspection Section first.'); return; }
    addItem(tab.panels[0].id);
  };
  const delItem = (panelId: string, itemId: string) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: t.panels.map(p2 => p2.id === panelId ? { ...p2, items: p2.items.filter(i => i.id !== itemId) } : p2) } : t) } : ss) } : s));
    setSelItemIds(p => { const n = new Set(p); n.delete(itemId); return n; });
  };
  const renameItem = (panelId: string, itemId: string, label: string) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: t.panels.map(p2 => p2.id === panelId ? { ...p2, items: p2.items.map(i => i.id === itemId ? { ...i, label } : i) } : p2) } : t) } : ss) } : s));
  };
  const delSelectedItems = () => {
    if (!selItemIds.size || !sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    const ids = selItemIds;
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: t.panels.map(p2 => ({ ...p2, items: p2.items.filter(i => !ids.has(i.id)) })) } : t) } : ss) } : s));
    setSelItemIds(new Set());
  };
  const copyItem = (panelId: string, itemId: string) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    const item = sections.find(s => s.id === sid)?.subSections.find(ss => ss.id === ssid)?.tabs.find(t => t.id === tabId)?.panels.find(p => p.id === panelId)?.items.find(i => i.id === itemId);
    if (!item) return;
    const copy = { ...deepCopyItem(item), label: item.label + ' (Copy)' };
    dirty(p => p.map(s => s.id === sid ? { ...s, subSections: s.subSections.map(ss => ss.id === ssid ? { ...ss, tabs: ss.tabs.map(t => t.id === tabId ? { ...t, panels: t.panels.map(p2 => p2.id === panelId ? { ...p2, items: [...p2.items, copy] } : p2) } : t) } : ss) } : s));
    toast.success('Item copied');
  };
  const moveItem = (srcPanelId: string, itemId: string, dstPanelId: string) => {
    if (!sel.sectionId || !sel.subId || !sel.tabId || srcPanelId === dstPanelId) return;
    const { sectionId: sid, subId: ssid, tabId } = sel;
    const item = sections.find(s => s.id === sid)?.subSections.find(ss => ss.id === ssid)?.tabs.find(t => t.id === tabId)?.panels.find(p => p.id === srcPanelId)?.items.find(i => i.id === itemId);
    if (!item) return;
    const copy = { ...deepCopyItem(item), id: item.id };
    dirty(p => p.map(s => s.id === sid ? {
      ...s, subSections: s.subSections.map(ss => ss.id === ssid ? {
        ...ss, tabs: ss.tabs.map(t => t.id === tabId ? {
          ...t, panels: t.panels.map(p2 => {
            if (p2.id === srcPanelId) return { ...p2, items: p2.items.filter(i => i.id !== itemId) };
            if (p2.id === dstPanelId) return { ...p2, items: [...p2.items, copy] };
            return p2;
          })
        } : t)
      } : ss)
    } : s));
    setCopyMoveModal(null);
    toast.success('Item moved');
  };

  /* ── Save ── */
  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) { setTitleError(true); toast.error('Please enter a template name.'); return; }
    setTitleError(false); setSaving(true);
    try {
      const payload = { title: trimmed, description: description.trim() || undefined, scope: searchParams.get('scope') || 'ORGANISATION', sections: sections as any[] };
      if (isNew || !templateIdRef.current) {
        const saved = await checklistService.createTemplate(payload);
        templateIdRef.current = saved.id?.toString();
        toast.success('Template created!');
        navigate(`/templates/${saved.id}/builder`, { replace: true });
      } else {
        await checklistService.updateTemplate(templateIdRef.current!, payload);
        toast.success('Template saved!');
      }
      setChanges(0);
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  /* ── Derived ── */
  const activeSection = sections.find(s => s.id === sel.sectionId) ?? null;
  const activeSub = activeSection?.subSections.find(ss => ss.id === sel.subId) ?? null;
  const activeTab = activeSub?.tabs.find(t => t.id === sel.tabId) ?? null;
  const activePanel = activeTab?.panels.find(p => p.id === sel.panelId) ?? null;

  const filteredSections = treeSearch
    ? sections.filter(s =>
      s.name.toLowerCase().includes(treeSearch.toLowerCase()) ||
      s.subSections.some(ss =>
        ss.name.toLowerCase().includes(treeSearch.toLowerCase()) ||
        ss.tabs.some(t => t.name.toLowerCase().includes(treeSearch.toLowerCase()))))
    : sections;

  /* ── Loading ── */
  if (loading) return (
    <div className={css.loadingScreen}>
      <div className={css.loadingSpinner} />
      <p className={css.loadingText}>Loading template…</p>
    </div>
  );

  return (
    <div className={css.page}>

      {/* ═══ TOP NAV BAR ═══ */}
      <header className={css.header}>
        <button className={css.backBtn} onClick={() => navigate('/templates')}>
          <ArrowLeft size={14} /> Templates
        </button>
        <span className={css.headerSep}>/</span>
        <span className={css.headerTitle}>{isNew ? 'New Template' : title || 'Edit Template'}</span>
        {changes > 0 && (
          <span className={css.changesChip}>
            <span className={css.changesDot} />
            {changes} unsaved
          </span>
        )}
        {changes > 0 && (
          <button className={css.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : isNew ? <FilePlus2 size={13} /> : <Save size={13} />}
            {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save'}
          </button>
        )}
      </header>

      {/* ═══ TEMPLATE TITLE CARD ═══ */}
      <div className={css.titleCard}>
        <div className={css.titleCardIcon}>
          <LayoutTemplate size={22} color="#33AE95" />
        </div>
        <div className={css.titleCardBody}>
          <div className={css.titleCardMeta}>
            <span className={css.titleCardBadge}>{isNew ? 'New Template' : 'Editing'}</span>
          </div>
          <input
            autoFocus={isNew} value={title}
            onChange={e => { setTitle(e.target.value); setTitleError(false); setChanges(c => c + 1); }}
            placeholder="Template name (required)"
            className={`${css.titleInput} ${titleError ? css.titleInputError : ''}`}
          />
          {titleError && <p className={css.titleErrorMsg}>Template name is required</p>}
          <input
            value={description}
            onChange={e => { setDescription(e.target.value); setChanges(c => c + 1); }}
            placeholder="Short description (optional)"
            className={css.descInput}
          />
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className={css.body}>

        {/* ════ LEFT SIDEBAR ════ */}
        <nav className={css.sidebar}>

          {/* Section header */}
          <div className={css.sidebarHead}>
            <div className={css.sidebarHeadIcon}>
              <FolderOpen size={14} color="#33AE95" />
            </div>
            <span className={css.sidebarHeadTitle}>Template Menu</span>
          </div>

          {/* Search */}
          <div className={css.searchWrap}>
            <div className={css.searchBox}>
              <Search size={12} color="#9CA3AF" style={{ flexShrink: 0 }} />
              <input value={treeSearch} onChange={e => setTreeSearch(e.target.value)}
                placeholder="Search…" className={css.searchInput} />
              {treeSearch && (
                <button onClick={() => setTreeSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', display: 'flex' }}>
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Tree */}
          <div className={css.treeArea}>

            {/* Root node */}
            <div
              className={`${css.nodeRow} ${sel.level === 'root' ? css.nodeRowActive : ''}`}
              onClick={() => setSel(ROOT_SEL)}>
              <button onClick={e => { e.stopPropagation(); toggle(ROOT_ID); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px 8px 8px', color: '#9CA3AF', display: 'flex', flexShrink: 0 }}>
                {expanded.has(ROOT_ID) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              <span style={{ flexShrink: 0, marginRight: 7, display: 'flex', alignItems: 'center' }}>
                {expanded.has(ROOT_ID)
                  ? <FolderOpen size={15} color="#33AE95" />
                  : <Folder size={15} color="#33AE95" />}
              </span>
              <span className={css.nodeLabel} style={{ fontSize: 14, fontWeight: 700, color: sel.level === 'root' ? '#298E7A' : '#263B4F', paddingBlock: 8 }}>
                Menu
              </span>
              <div className={css.nodeActions}>
                <NodeActionBtn icon={<Plus size={11} />} title="Add Section" onClick={e => { e.stopPropagation(); addSection(); }} />
              </div>
            </div>

            {/* Sections */}
            {expanded.has(ROOT_ID) && (
              <div>
                {filteredSections.length === 0 && !treeSearch && (
                  <p style={{ fontSize: 13, color: '#9CA3AF', padding: '8px 16px 8px 34px', lineHeight: 1.6, margin: 0 }}>
                    No sections yet.
                  </p>
                )}

                {filteredSections.map(sec => (
                  <div key={sec.id}>
                    {/* L1: Section */}
                    <div
                      className={`${css.nodeRow} ${sel.sectionId === sec.id && sel.level === 'section' ? css.nodeRowActive : ''}`}
                      onClick={() => setSel({ level: 'section', sectionId: sec.id, subId: null, tabId: null, panelId: null })}>
                      <button onClick={e => { e.stopPropagation(); toggle(sec.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 4px 7px 22px', color: '#9CA3AF', display: 'flex', flexShrink: 0 }}>
                        {expanded.has(sec.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <span style={{ flexShrink: 0, marginRight: 7, display: 'flex', alignItems: 'center' }}>
                        {expanded.has(sec.id) ? <FolderOpen size={14} color="#33AE95" /> : <Folder size={14} color="#33AE95" />}
                      </span>
                      <SidebarNodeLabel nodeId={sec.id} name={sec.name}
                        isActive={sel.sectionId === sec.id && sel.level === 'section'} bold
                        editingNodeId={editingNodeId} setEditingNodeId={setEditingNodeId}
                        onRename={name => renameSection(sec.id, name)} />
                      <div className={css.nodeActions}>
                        <NodeActionBtn icon={<Plus size={11} />} title="Add Subsection" onClick={e => { e.stopPropagation(); addSub(sec.id); }} />
                        <NodeActionBtn icon={<Edit2 size={11} />} title="Rename" onClick={e => { e.stopPropagation(); setEditingNodeId(sec.id); }} />
                        <NodeActionBtn icon={<Trash2 size={11} />} title="Delete" danger onClick={e => { e.stopPropagation(); delSection(sec.id); }} />
                      </div>
                    </div>

                    {/* L2: Subsections */}
                    {expanded.has(sec.id) && sec.subSections.map(ss => (
                      <div key={ss.id}>
                        <div
                          className={`${css.nodeRow} ${sel.subId === ss.id && sel.level === 'subsection' ? css.nodeRowActive : ''}`}
                          onClick={() => setSel({ level: 'subsection', sectionId: sec.id, subId: ss.id, tabId: null, panelId: null })}>
                          <button onClick={e => { e.stopPropagation(); toggle(ss.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 4px 7px 40px', color: '#9CA3AF', display: 'flex', flexShrink: 0 }}>
                            {expanded.has(ss.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                          <span style={{ flexShrink: 0, marginRight: 7, display: 'flex', alignItems: 'center' }}>
                            <FolderOpen size={13} color="#6B7280" />
                          </span>
                          <SidebarNodeLabel nodeId={ss.id} name={ss.name}
                            isActive={sel.subId === ss.id && sel.level === 'subsection'}
                            editingNodeId={editingNodeId} setEditingNodeId={setEditingNodeId}
                            onRename={name => renameSub(sec.id, ss.id, name)} />
                          <div className={css.nodeActions}>
                            <NodeActionBtn icon={<Plus size={10} />} title="Add Inspection" onClick={e => { e.stopPropagation(); addInspection(sec.id, ss.id); }} />
                            <NodeActionBtn icon={<Edit2 size={10} />} title="Rename" onClick={e => { e.stopPropagation(); setEditingNodeId(ss.id); }} />
                            <NodeActionBtn icon={<Trash2 size={10} />} title="Delete" danger onClick={e => { e.stopPropagation(); delSub(sec.id, ss.id); }} />
                          </div>
                        </div>

                        {/* L3: Inspections */}
                        {expanded.has(ss.id) && ss.tabs.map(tab => (
                          <div key={tab.id}>
                            <div
                              className={`${css.nodeRow} ${sel.tabId === tab.id && sel.level === 'inspection' ? css.nodeRowActive : ''}`}
                              onClick={() => setSel({ level: 'inspection', sectionId: sec.id, subId: ss.id, tabId: tab.id, panelId: null })}>
                              <button onClick={e => { e.stopPropagation(); toggle(tab.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 4px 7px 58px', color: '#9CA3AF', display: 'flex', flexShrink: 0 }}>
                                {expanded.has(tab.id) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                              </button>
                              <span style={{ flexShrink: 0, marginRight: 7, display: 'flex', alignItems: 'center' }}>
                                <FileText size={12} color={sel.tabId === tab.id ? '#298E7A' : '#9CA3AF'} />
                              </span>
                              <SidebarNodeLabel nodeId={tab.id} name={tab.name}
                                isActive={sel.tabId === tab.id && sel.level === 'inspection'} small
                                editingNodeId={editingNodeId} setEditingNodeId={setEditingNodeId}
                                onRename={name => renameInspection(sec.id, ss.id, tab.id, name)} />
                              <div className={css.nodeActions}>
                                <NodeActionBtn icon={<Edit2 size={10} />} title="Rename" onClick={e => { e.stopPropagation(); setEditingNodeId(tab.id); }} />
                                <NodeActionBtn icon={<Trash2 size={10} />} title="Delete" danger onClick={e => { e.stopPropagation(); delInspection(sec.id, ss.id, tab.id); }} />
                              </div>
                            </div>

                            {/* L4: Panels */}
                            {expanded.has(tab.id) && tab.panels.map(panel => {
                              const isPSel = panel.panelType === 'SELECTION';
                              return (
                                <div key={panel.id}
                                  className={`${css.nodeRow} ${sel.panelId === panel.id ? css.nodeRowActive : ''}`}
                                  onClick={() => setSel({ level: 'panel', sectionId: sec.id, subId: ss.id, tabId: tab.id, panelId: panel.id })}>
                                  <span style={{ flexShrink: 0, padding: '7px 4px 7px 76px', display: 'flex', alignItems: 'center' }}>
                                    {isPSel
                                      ? <CheckCircle2 size={11} color={sel.panelId === panel.id ? '#16A34A' : '#9CA3AF'} />
                                      : <AlertTriangle size={11} color={sel.panelId === panel.id ? '#DC2626' : '#9CA3AF'} />}
                                  </span>
                                  <SidebarNodeLabel nodeId={panel.id} name={panel.name}
                                    isActive={sel.panelId === panel.id} small
                                    editingNodeId={editingNodeId} setEditingNodeId={setEditingNodeId}
                                    onRename={name => renamePanel(panel.id, name)} />
                                  <div className={css.nodeActions}>
                                    <NodeActionBtn icon={<Edit2 size={10} />} title="Rename" onClick={e => { e.stopPropagation(); setEditingNodeId(panel.id); }} />
                                    <NodeActionBtn icon={<Trash2 size={10} />} title="Delete" danger onClick={e => { e.stopPropagation(); delPanel(panel.id); }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          <div className={css.sidebarFooter}>
            <button className={css.sidebarAddBtn} onClick={addSection}>
              <Plus size={13} /> Add Section
            </button>
            <button className={css.sidebarDelBtn} disabled={!sel.sectionId}
              onClick={() => { if (sel.sectionId) delSection(sel.sectionId); }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </nav>

        {/* ════ RIGHT WORKSPACE ════ */}
        <main className={css.workspace}>

          {/* Breadcrumb bar */}
          <div className={css.breadcrumbBar}>
            <button className={`${css.bcBtn} ${sel.level === 'root' ? css.bcActive : css.bcLink}`}
              onClick={() => setSel(ROOT_SEL)}>
              <FolderOpen size={13} /> Template Menu
            </button>
            {activeSection && <>
              <ChevronRight size={12} color="#D1D5DB" style={{ flexShrink: 0 }} />
              <button className={`${css.bcBtn} ${sel.level === 'section' ? css.bcActive : css.bcLink}`}
                onClick={() => setSel({ level: 'section', sectionId: activeSection.id, subId: null, tabId: null, panelId: null })}>
                {activeSection.name}
              </button>
            </>}
            {activeSub && <>
              <ChevronRight size={12} color="#D1D5DB" style={{ flexShrink: 0 }} />
              <button className={`${css.bcBtn} ${sel.level === 'subsection' ? css.bcActive : css.bcLink}`}
                onClick={() => setSel({ level: 'subsection', sectionId: activeSection!.id, subId: activeSub.id, tabId: null, panelId: null })}>
                {activeSub.name}
              </button>
            </>}
            {activeTab && <>
              <ChevronRight size={12} color="#D1D5DB" style={{ flexShrink: 0 }} />
              <button className={`${css.bcBtn} ${sel.level === 'inspection' ? css.bcActive : css.bcLink}`}
                onClick={() => setSel({ level: 'inspection', sectionId: activeSection!.id, subId: activeSub!.id, tabId: activeTab.id, panelId: null })}>
                {activeTab.name}
              </button>
            </>}
            {activePanel && <>
              <ChevronRight size={12} color="#D1D5DB" style={{ flexShrink: 0 }} />
              <span className={`${css.bcBtn} ${css.bcActive}`}>{activePanel.name}</span>
            </>}
          </div>

          {/* Scrollable content */}
          <div className={css.scrollArea} style={{ paddingBottom: sel.level === 'panel' ? 72 : 20 }}>
            {sel.level === 'root' && (
              <CardGrid
                title="Template Menu"
                subtitle={`${sections.length} section${sections.length !== 1 ? 's' : ''}`}
                emptyMsg="No sections yet. Click '+ Add Section' in the sidebar or the button above."
                items={sections.map(sec => ({
                  id: sec.id, name: sec.name,
                  meta: `${sec.subSections.length} subsection${sec.subSections.length !== 1 ? 's' : ''}`,
                  icon: <FolderOpen size={22} color="#33AE95" />,
                  onClick: () => setSel({ level: 'section', sectionId: sec.id, subId: null, tabId: null, panelId: null }),
                }))}
                onAdd={addSection} addLabel="Add Section"
              />
            )}
            {sel.level === 'section' && activeSection && (
              <CardGrid
                title={activeSection.name}
                subtitle={`${activeSection.subSections.length} subsection${activeSection.subSections.length !== 1 ? 's' : ''}`}
                emptyMsg="No subsections yet. Hover the section in the menu and click (+) to add one."
                items={activeSection.subSections.map(ss => ({
                  id: ss.id, name: ss.name,
                  meta: `${ss.tabs.length} inspection${ss.tabs.length !== 1 ? 's' : ''}`,
                  icon: <FolderOpen size={22} color="#33AE95" />,
                  onClick: () => setSel({ level: 'subsection', sectionId: activeSection.id, subId: ss.id, tabId: null, panelId: null }),
                }))}
                onAdd={() => addSub(activeSection.id)} addLabel="Add Subsection"
              />
            )}
            {sel.level === 'subsection' && activeSub && activeSection && (
              <CardGrid
                title={activeSub.name}
                subtitle={`${activeSub.tabs.length} inspection${activeSub.tabs.length !== 1 ? 's' : ''}`}
                emptyMsg="No inspections yet. Hover the subsection and click (+) to add one."
                items={activeSub.tabs.map(tab => {
                  const total = tab.panels.reduce((a, p) => a + p.items.length, 0);
                  return {
                    id: tab.id, name: tab.name,
                    meta: `${tab.panels.length} section${tab.panels.length !== 1 ? 's' : ''} · ${total} item${total !== 1 ? 's' : ''}`,
                    icon: <FileText size={22} color="#6366F1" />,
                    onClick: () => setSel({ level: 'inspection', sectionId: activeSection.id, subId: activeSub.id, tabId: tab.id, panelId: null }),
                  };
                })}
                onAdd={() => addInspection(activeSection.id, activeSub.id)} addLabel="Add Inspection"
              />
            )}
            {sel.level === 'inspection' && activeTab && activeSection && activeSub && (
              <InspectionHub
                tab={activeTab}
                onSelectPanel={panelId => setSel({ level: 'panel', sectionId: activeSection.id, subId: activeSub.id, tabId: activeTab.id, panelId })}
                onAddPanel={addPanel}
              />
            )}
            {sel.level === 'panel' && activePanel && activeTab && (
              <PanelEditor
                panel={activePanel} tab={activeTab}
                itemStates={itemStates} setItemStates={setItemStates}
                selItemIds={selItemIds} setSelItemIds={setSelItemIds}
                onDelPanel={delPanel} onRenamePanel={renamePanel}
                onAddItem={addItem} onDelItem={delItem} onRenameItem={renameItem}
              />
            )}
          </div>

          {/* Workspace footer — shown at panel (item editor) level */}
          {sel.level === 'panel' && activePanel && (
            <WorkspaceFooter
              selCount={selItemIds.size} activePanel={activePanel}
              onAddItem={addItemToFirstPanel}
              onDeleteSelected={delSelectedItems}
              onCopy={() => {
                if (selItemIds.size !== 1) { toast.info('Select exactly one item to copy.'); return; }
                const [iid] = selItemIds;
                copyItem(activePanel.id, iid);
              }}
              onCopyMove={() => {
                if (selItemIds.size !== 1) { toast.info('Select exactly one item.'); return; }
                const [iid] = selItemIds;
                setCopyMoveModal({ itemId: iid, panelId: activePanel.id });
              }}
            />
          )}
        </main>
      </div>

      {/* Copy & Move Modal */}
      {copyMoveModal && activeTab && (
        <CopyMoveModal
          panels={activeTab.panels}
          srcPanelId={copyMoveModal.panelId}
          onMove={dst => moveItem(copyMoveModal.panelId, copyMoveModal.itemId, dst)}
          onClose={() => setCopyMoveModal(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Sidebar helpers
───────────────────────────────────────────────────────────────── */
function SidebarNodeLabel({ nodeId, name, isActive, bold, small, editingNodeId, setEditingNodeId, onRename }: {
  nodeId: string; name: string; isActive: boolean; bold?: boolean; small?: boolean;
  editingNodeId: string | null; setEditingNodeId: (id: string | null) => void;
  onRename: (name: string) => void;
}) {
  const [val, setVal] = useState(name);
  useEffect(() => setVal(name), [name]);
  if (editingNodeId === nodeId) {
    return (
      <input autoFocus value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { onRename(val || name); setEditingNodeId(null); }}
        onKeyDown={e => { if (e.key === 'Enter') { onRename(val || name); setEditingNodeId(null); } e.stopPropagation(); }}
        onClick={e => e.stopPropagation()}
        className={css.nodeLabelInput}
        style={{ fontSize: small ? 13 : 14 }}
      />
    );
  }
  return (
    <span className={css.nodeLabel} style={{
      fontSize: small ? 13 : 14,
      fontWeight: bold ? 600 : isActive ? 500 : 400,
      color: isActive ? '#298E7A' : '#263B4F',
      paddingBlock: small ? 7 : 8,
    }}>
      {name}
    </span>
  );
}

function NodeActionBtn({ icon, title, onClick, danger }: { icon: React.ReactNode; title?: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      className={`${css.nodeActionBtn} ${danger ? css.nodeActionBtnDanger : ''}`}>
      {icon}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Card Grid (Section / Subsection level view)
───────────────────────────────────────────────────────────────── */
function CardGrid({ title, subtitle, emptyMsg, items, onAdd, addLabel }: {
  title: string; subtitle: string; emptyMsg: string;
  items: { id: string; name: string; meta: string; icon: React.ReactNode; onClick: () => void }[];
  onAdd: () => void; addLabel: string;
}) {
  return (
    <div className={css.fadeUp}>
      <div className={css.cgHeader}>
        <div>
          <h2 className={css.cgTitle}>{title}</h2>
          <p className={css.cgSub}>{subtitle}</p>
        </div>
        <button className={css.cgAddBtn} onClick={onAdd}>
          <Plus size={13} /> {addLabel}
        </button>
      </div>
      {items.length === 0
        ? <p className={css.cgEmpty}>{emptyMsg}</p>
        : (
          <div className={css.cgGrid}>
            {items.map(item => (
              <button key={item.id} className={css.cgCard} onClick={item.onClick}>
                <div className={css.cgCardIcon}>{item.icon}</div>
                <div className={css.cgCardName}>{item.name}</div>
                <div className={css.cgCardMeta}>{item.meta}</div>
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Inspection Hub (Level 3 workspace — shows panel cards)
───────────────────────────────────────────────────────────────── */
function InspectionHub({ tab, onSelectPanel, onAddPanel }: {
  tab: BuilderTab;
  onSelectPanel: (panelId: string) => void;
  onAddPanel: (type: BuilderPanelType) => void;
}) {
  return (
    <div className={css.fadeUp}>
      <div className={css.ieHeader}>
        <div>
          <h2 className={css.ieTitle}>{tab.name}</h2>
          <p className={css.ieSub}>{tab.panels.length} inspection section{tab.panels.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AddPanelBtn type="SELECTION" onClick={() => onAddPanel('SELECTION')} />
          <AddPanelBtn type="DAMAGE" onClick={() => onAddPanel('DAMAGE')} />
        </div>
      </div>

      {tab.panels.length === 0 ? (
        <div className={css.ieEmpty}>
          No inspection sections yet.<br />Click "+ Selection Section" or "+ Damaged Section" to add one.
        </div>
      ) : (
        <div className={css.cgGrid}>
          {tab.panels.map(panel => {
            const isSel = panel.panelType === 'SELECTION';
            return (
              <button key={panel.id} className={css.cgCard} onClick={() => onSelectPanel(panel.id)}>
                <div className={css.cgCardIcon}>
                  {isSel
                    ? <CheckCircle2 size={22} color="#29A356" />
                    : <AlertTriangle size={22} color="#EF4444" />}
                </div>
                <div className={css.cgCardName}>{panel.name}</div>
                <div className={css.cgCardMeta}>
                  {isSel ? 'Selection' : 'Damaged'} · {panel.items.length} item{panel.items.length !== 1 ? 's' : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Panel Editor (Level 4 workspace — items for one panel)
───────────────────────────────────────────────────────────────── */
interface PanelEditorProps {
  panel: BuilderPanel;
  tab: BuilderTab;
  itemStates: Record<string, ItemState>;
  setItemStates: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>;
  selItemIds: Set<string>;
  setSelItemIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onDelPanel: (id: string) => void;
  onRenamePanel: (id: string, name: string) => void;
  onAddItem: (panelId: string) => void;
  onDelItem: (panelId: string, itemId: string) => void;
  onRenameItem: (panelId: string, itemId: string, label: string) => void;
}

function PanelEditor({ panel, tab, itemStates, setItemStates, selItemIds, setSelItemIds, onDelPanel, onRenamePanel, onAddItem, onDelItem, onRenameItem }: PanelEditorProps) {
  const setItemState = (itemId: string, state: ItemState) =>
    setItemStates(p => ({ ...p, [itemId]: state }));
  const isSel = panel.panelType === 'SELECTION';

  return (
    <div className={css.fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className={css.ieHeader}>
        <div>
          <h2 className={css.ieTitle}>{panel.name}</h2>
          <p className={css.ieSub}>
            {isSel ? 'Selection' : 'Damaged'} section · {tab.name} · {panel.items.length} item{panel.items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <PanelCard
        panel={panel} isSel={isSel}
        itemStates={itemStates} selItemIds={selItemIds} setSelItemIds={setSelItemIds}
        onRenamePanel={onRenamePanel} onDelPanel={onDelPanel}
        onAddItem={onAddItem} onDelItem={onDelItem} onRenameItem={onRenameItem}
        onToggleItem={item => {
          if (isSel) setItemState(item.id, itemStates[item.id] === 'selected' ? 'none' : 'selected');
        }}
        onToggleCorrect={item => setItemState(item.id, itemStates[item.id] === 'correct' ? 'none' : 'correct')}
        onToggleDamage={item => setItemState(item.id, itemStates[item.id] === 'damaged' ? 'none' : 'damaged')}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Panel Card
───────────────────────────────────────────────────────────────── */
interface PanelCardProps {
  panel: BuilderPanel; isSel: boolean;
  itemStates: Record<string, ItemState>; selItemIds: Set<string>;
  setSelItemIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onRenamePanel: (id: string, name: string) => void; onDelPanel: (id: string) => void;
  onAddItem: (panelId: string) => void;
  onDelItem: (panelId: string, itemId: string) => void;
  onRenameItem: (panelId: string, itemId: string, label: string) => void;
  onToggleItem: (item: BuilderItem) => void;
  onToggleCorrect: (item: BuilderItem) => void;
  onToggleDamage: (item: BuilderItem) => void;
}

function PanelCard({ panel, isSel, itemStates, selItemIds, setSelItemIds, onRenamePanel, onDelPanel, onAddItem, onDelItem, onRenameItem, onToggleItem, onToggleCorrect, onToggleDamage }: PanelCardProps) {
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(panel.name);
  const [panelPhotos, setPanelPhotos] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setNameVal(panel.name), [panel.name]);

  const accent = isSel ? '#29A356' : '#EF4444';
  const accentLight = isSel ? 'rgba(41,163,86,0.08)' : 'rgba(239,68,68,0.06)';
  const accentBorder = isSel ? 'rgba(41,163,86,0.20)' : 'rgba(239,68,68,0.20)';

  const toggleSel = (itemId: string) =>
    setSelItemIds(p => { const n = new Set(p); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const urls = files.map(f => URL.createObjectURL(f));
    setPanelPhotos(p => [...p, ...urls]);
    e.target.value = '';
  };

  return (
    <div className={`${css.panelCard} ${isSel ? css.panelCardHeadSel : css.panelCardHeadDmg}`}>

      {/* Card header */}
      <div className={css.panelHead} style={{ background: accentLight, borderBottom: `1px solid ${accentBorder}` }}>
        {isSel
          ? <CheckCircle2 size={15} style={{ color: accent, flexShrink: 0 }} />
          : <AlertTriangle size={15} style={{ color: accent, flexShrink: 0 }} />}
        {editName
          ? <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
            onBlur={() => { onRenamePanel(panel.id, nameVal || panel.name); setEditName(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onRenamePanel(panel.id, nameVal || panel.name); setEditName(false); } }}
            className={css.panelHeadNameInput}
            style={{ borderBottom: `1px solid ${accent}` }} />
          : <span onDoubleClick={() => { setEditName(true); setNameVal(panel.name); }}
            className={css.panelHeadName}>{panel.name}</span>}
        <span className={isSel ? css.panelBadgeSel : css.panelBadgeDmg}>
          {isSel ? 'SELECTION' : 'DAMAGED'}
        </span>
        {!isSel && (
          <>
            <button
              className={css.panelCameraBtn}
              title="Upload photos"
              onClick={() => photoInputRef.current?.click()}>
              <Camera size={14} />
              {panelPhotos.length > 0 && (
                <span className={css.panelCameraCount}>{panelPhotos.length}</span>
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handlePhotoAdd}
            />
          </>
        )}
        <button onClick={() => onDelPanel(panel.id)} className={css.panelDelBtn}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Photo strip — damage panels only */}
      {!isSel && panelPhotos.length > 0 && (
        <div className={css.panelPhotoStrip}>
          {panelPhotos.map((url, idx) => (
            <div key={idx} className={css.panelPhotoThumb}>
              <img src={url} alt={`Photo ${idx + 1}`} className={css.panelPhotoImg} />
              <button
                className={css.panelPhotoRemove}
                onClick={() => setPanelPhotos(p => p.filter((_, i) => i !== idx))}>
                <X size={9} />
              </button>
            </div>
          ))}
          <button
            className={css.panelPhotoAdd}
            onClick={() => photoInputRef.current?.click()}>
            <Camera size={14} />
            <span>Add</span>
          </button>
        </div>
      )}

      {/* Items */}
      <div>
        {panel.items.length === 0 && (
          <p className={css.panelEmpty}>No items yet. Click "Add Item" below.</p>
        )}
        {panel.items.map(item => {
          const state = itemStates[item.id] ?? 'none';
          return isSel
            ? <SelectionRow key={item.id} item={item} state={state} checked={selItemIds.has(item.id)}
              onCheck={() => toggleSel(item.id)} onToggle={() => onToggleItem(item)}
              onDelete={() => onDelItem(panel.id, item.id)}
              onRename={l => onRenameItem(panel.id, item.id, l)} />
            : <DamageRow key={item.id} item={item} state={state} checked={selItemIds.has(item.id)}
              onCheck={() => toggleSel(item.id)}
              onCorrect={() => onToggleCorrect(item)} onDamage={() => onToggleDamage(item)}
              onDelete={() => onDelItem(panel.id, item.id)}
              onRename={l => onRenameItem(panel.id, item.id, l)} />;
        })}
      </div>

      {/* Card footer */}
      <button onClick={() => onAddItem(panel.id)}
        className={`${css.panelFooterBtn} ${isSel ? css.panelFooterBtnSel : css.panelFooterBtnDmg}`}>
        <Plus size={12} /> Add Item
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Item Rows
───────────────────────────────────────────────────────────────── */
function SelectionRow({ item, state, checked, onCheck, onToggle, onDelete, onRename }: {
  item: BuilderItem; state: ItemState; checked: boolean;
  onCheck: () => void; onToggle: () => void; onDelete: () => void; onRename: (l: string) => void;
}) {
  const [editLabel, setEditLabel] = useState(false);
  const [val, setVal] = useState(item.label);
  useEffect(() => setVal(item.label), [item.label]);
  const active = state === 'selected';

  return (
    <div className={`${css.itemRow} ${active ? css.itemRowSelected : ''}`} onClick={onToggle}>
      <label className="ip-checkbox-label" onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={onCheck} />
      </label>
      <span className={css.itemDot} style={{ background: active ? '#29A356' : '#CFD5DE' }} />
      {editLabel
        ? <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          onBlur={() => { onRename(val || item.label); setEditLabel(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onRename(val || item.label); setEditLabel(false); } e.stopPropagation(); }}
          onClick={e => e.stopPropagation()}
          className={css.itemLabelInput}
          style={{ borderBottom: '1px solid #29A356' }} />
        : <span onDoubleClick={e => { e.stopPropagation(); setEditLabel(true); setVal(item.label); }}
          className={css.itemLabel}
          style={{ color: active ? '#16A34A' : '#263B4F', fontWeight: active ? 500 : 400 }}>
          {item.label}
        </span>}
      {active && <span className={css.itemSelBadge}>SELECTED</span>}
      <button onClick={e => { e.stopPropagation(); onDelete(); }} className={css.itemDeleteBtn}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function DamageRow({ item, state, checked, onCheck, onCorrect, onDamage, onDelete, onRename }: {
  item: BuilderItem; state: ItemState; checked: boolean;
  onCheck: () => void; onCorrect: () => void; onDamage: () => void;
  onDelete: () => void; onRename: (l: string) => void;
}) {
  const [editLabel, setEditLabel] = useState(false);
  const [val, setVal] = useState(item.label);
  const [severity, setSeverity] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const itemPhotoRef = useRef<HTMLInputElement>(null);
  useEffect(() => setVal(item.label), [item.label]);
  const isDamaged = state === 'damaged';
  const isCorrect = state === 'correct';

  const handleItemPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const urls = Array.from(e.target.files ?? []).map(f => URL.createObjectURL(f));
    setPhotos(p => [...p, ...urls]);
    e.target.value = '';
  };

  return (
    <div style={{ borderBottom: '1px solid #F3F4F6' }}>
      <div className={`${css.itemRow} ${isDamaged ? css.itemRowDamaged : ''} ${isCorrect ? css.itemRowCorrect : ''}`}>
        <label className="ip-checkbox-label" onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <input type="checkbox" checked={checked} onChange={onCheck} />
        </label>
        {editLabel
          ? <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onBlur={() => { onRename(val || item.label); setEditLabel(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(val || item.label); setEditLabel(false); } e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            className={css.itemLabelInput} />
          : <span onDoubleClick={e => { e.stopPropagation(); setEditLabel(true); setVal(item.label); }}
            className={css.itemLabel}>{item.label}</span>}
        {/* Correct / Damaged / Camera */}
        <button onClick={e => { e.stopPropagation(); onCorrect(); }}
          className={`${css.dmgToggleBtn} ${isCorrect ? css.dmgToggleBtnCorrectOn : css.dmgToggleBtnCorrect}`}>
          <CheckCircle2 size={11} /> Correct
        </button>
        <button onClick={e => { e.stopPropagation(); onDamage(); }}
          className={`${css.dmgToggleBtn} ${isDamaged ? css.dmgToggleBtnDamageOn : css.dmgToggleBtnDamage}`}>
          <XCircle size={11} /> Damaged
        </button>
        <button
          className={`${css.itemCameraBtn} ${photos.length > 0 ? css.itemCameraBtnActive : ''}`}
          title="Upload photos"
          onClick={e => { e.stopPropagation(); itemPhotoRef.current?.click(); }}>
          <Camera size={12} />
          {photos.length > 0 && <span className={css.itemCameraCount}>{photos.length}</span>}
        </button>
        <input ref={itemPhotoRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleItemPhoto} />
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className={css.itemDeleteBtn}>
          <Trash2 size={12} />
        </button>
      </div>

      {/* Expanded damage fields */}
      {isDamaged && (
        <div className={`${css.dmgFields} ${css.fadeUp}`}>
          <div className={css.dmgFieldsRow}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className={css.dmgFieldLabel}>Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} className={css.dmgSelect}>
                <option value="">Select…</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div style={{ flex: 3, minWidth: 200 }}>
              <label className={css.dmgFieldLabel}>Recommendation</label>
              <input value={recommendation} onChange={e => setRecommendation(e.target.value)}
                placeholder="Describe corrective action…"
                className={css.dmgInput} />
            </div>
          </div>
          <div>
            <label className={css.dmgFieldLabel}>Photo Evidence</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {photos.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: 54, height: 54 }}>
                  <img src={url} alt={`Photo ${idx + 1}`}
                    style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(223,69,58,0.25)', display: 'block' }} />
                  <button onClick={() => setPhotos(p => p.filter((_, i) => i !== idx))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#DF453A', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button onClick={() => itemPhotoRef.current?.click()}
                style={{ width: 54, height: 54, borderRadius: 8, border: '1px dashed rgba(223,69,58,0.25)', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: '#DF453A', transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(223,69,58,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Camera size={14} /><span className={css.dmgAddLabel}>Add</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Add Panel Button
───────────────────────────────────────────────────────────────── */
function AddPanelBtn({ type, onClick }: { type: BuilderPanelType; onClick: () => void }) {
  const isSel = type === 'SELECTION';
  return (
    <button onClick={onClick}
      className={`${css.addPanelBtn} ${isSel ? css.addPanelBtnSel : css.addPanelBtnDmg}`}>
      <Plus size={12} /> {isSel ? 'Selection Section' : 'Damaged Section'}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Workspace Footer — Glassmorphism toolbar
───────────────────────────────────────────────────────────────── */
function WorkspaceFooter({ selCount, activePanel, onAddItem, onDeleteSelected, onCopy, onCopyMove }: {
  selCount: number; activePanel: BuilderPanel;
  onAddItem: () => void; onDeleteSelected: () => void; onCopy: () => void; onCopyMove: () => void;
}) {
  return (
    <div className={css.wFooter}>
      <FooterBtn icon={<Plus size={13} />} label="Add Item" primary onClick={onAddItem} />
      <div className={css.wFooterDivider} />
      <FooterBtn icon={<Trash2 size={13} />} label={selCount > 0 ? `Delete (${selCount})` : 'Delete'} danger onClick={onDeleteSelected} disabled={selCount === 0} />
      <FooterBtn icon={<Edit2 size={13} />} label="Edit" onClick={() => toast.info('Double-click an item label to rename it.')} />
      <FooterBtn icon={<Copy size={13} />} label="Copy" onClick={onCopy} disabled={selCount !== 1} />
      <FooterBtn icon={<MoveRight size={13} />} label="Copy & Move" onClick={onCopyMove} disabled={selCount !== 1} />
      <div className={css.wFooterSpacer} />
      <span className={css.wFooterMeta}>
        {activePanel.items.length} item{activePanel.items.length !== 1 ? 's' : ''} total
      </span>
    </div>
  );
}

function FooterBtn({ icon, label, onClick, primary, danger, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  primary?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`${css.fBtn} ${primary ? css.fBtnPrimary : ''} ${danger ? css.fBtnDanger : ''}`}>
      {icon} {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Copy & Move Modal
───────────────────────────────────────────────────────────────── */
function CopyMoveModal({ panels, srcPanelId, onMove, onClose }: {
  panels: BuilderPanel[]; srcPanelId: string;
  onMove: (dst: string) => void; onClose: () => void;
}) {
  const targets = panels.filter(p => p.id !== srcPanelId);
  return (
    <div className={css.modalOverlay} onClick={onClose}>
      <div className={css.modalBox} onClick={e => e.stopPropagation()}>
        <h3 className={css.modalTitle}>Copy & Move to…</h3>
        <p className={css.modalSub}>Choose the destination Inspection Section.</p>
        {targets.length === 0
          ? <p className={css.modalEmpty}>No other sections available in this inspection.</p>
          : targets.map(p => {
            const isSel = p.panelType === 'SELECTION';
            return (
              <button key={p.id} onClick={() => onMove(p.id)} className={css.modalItemBtn}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isSel ? '#16A34A' : '#DC2626', background: isSel ? 'rgba(41,163,86,0.10)' : 'rgba(239,68,68,0.10)', padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>
                  {isSel ? 'SEL' : 'DMG'}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <MoveRight size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
              </button>
            );
          })}
        <button onClick={onClose} className={css.modalCancelBtn}>Cancel</button>
      </div>
    </div>
  );
}
