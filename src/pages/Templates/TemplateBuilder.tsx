import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronRight, ChevronDown, Search, X,
  Loader2, ArrowLeft, Save, FilePlus2, Edit2,
  AlertTriangle, CheckCircle2,
  FolderOpen, Folder, LayoutTemplate, Copy, ArrowUp, ArrowDown, ArrowRight,
} from 'lucide-react';
import { checklistService } from '@/services/checklistService';
import type {
  TemplateNode, BuilderItem, BuilderPanelType, TemplateResponse,
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

const emptyFolder = (name: string): TemplateNode => ({
  id: genId(), name, type: 'FOLDER', children: [],
});

const emptyLeaf = (name: string, panelType: BuilderPanelType): TemplateNode => ({
  id: genId(), name, type: 'LEAF', panelType, items: [],
});

// ── Immutable tree helpers ──────────────────────────────────────────────────

function mapNode(
  nodes: TemplateNode[],
  id: string,
  fn: (n: TemplateNode) => TemplateNode,
): TemplateNode[] {
  return nodes.map(n => {
    if (n.id === id) return fn(n);
    if (n.type === 'FOLDER' && n.children?.length) {
      return { ...n, children: mapNode(n.children, id, fn) };
    }
    return n;
  });
}

function removeNode(nodes: TemplateNode[], id: string): TemplateNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => {
      if (n.type === 'FOLDER' && n.children?.length) {
        return { ...n, children: removeNode(n.children, id) };
      }
      return n;
    });
}

function addChildTo(nodes: TemplateNode[], parentId: string, child: TemplateNode): TemplateNode[] {
  return nodes.map(n => {
    if (n.id === parentId && n.type === 'FOLDER') {
      return { ...n, children: [...(n.children ?? []), child] };
    }
    if (n.type === 'FOLDER' && n.children?.length) {
      return { ...n, children: addChildTo(n.children, parentId, child) };
    }
    return n;
  });
}

function findNode(nodes: TemplateNode[], id: string): TemplateNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === 'FOLDER' && n.children?.length) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Returns ancestry path from root up to and including the node with `id`. */
function findPath(nodes: TemplateNode[], id: string, path: TemplateNode[] = []): TemplateNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return [...path, n];
    if (n.type === 'FOLDER' && n.children?.length) {
      const found = findPath(n.children, id, [...path, n]);
      if (found) return found;
    }
  }
  return null;
}

/** Deep-clone a node tree with fresh IDs. */
function deepCloneNode(node: TemplateNode, name?: string): TemplateNode {
  return {
    ...node,
    id: genId(),
    name: name ?? node.name,
    children: (node.children ?? []).map(c => deepCloneNode(c)),
    items: (node.items ?? []).map(i => ({ ...i, id: genId() })),
  };
}

/** Check whether a name already exists among siblings at the same level. */
function isDuplicateName(nodes: TemplateNode[], parentId: string | null, name: string): boolean {
  const siblings = parentId ? (findNode(nodes, parentId)?.children ?? []) : nodes;
  return siblings.some(n => n.name.trim().toLowerCase() === name.trim().toLowerCase());
}

/** Count total items under a subtree (for progress roll-up display). */
function countItems(nodes: TemplateNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === 'LEAF') count += n.items?.length ?? 0;
    else if (n.children?.length) count += countItems(n.children);
  }
  return count;
}

/** Count leaf nodes (panels) under a subtree. */
// function countLeaves(nodes: TemplateNode[]): number {
//   let count = 0;
//   for (const n of nodes) {
//     if (n.type === 'LEAF') count++;
//     else if (n.children?.length) count += countLeaves(n.children);
//   }
//   return count;
// }

/** Convert old BuilderSection[] format to TemplateNode[] (backward compat). */
function sectionsToNodes(sections: any[]): TemplateNode[] {
  if (!sections?.length) return [];
  return sections.map((sec: any) => {
    // Already in new node format?
    if (sec.type === 'FOLDER' || sec.type === 'LEAF') return sec as TemplateNode;

    // New BuilderSection format (has subSections)
    if (sec.subSections) {
      return {
        id: sec.id ?? genId(),
        name: sec.name || sec.sectionName || 'Section',
        type: 'FOLDER' as const,
        children: (sec.subSections ?? []).map((sub: any) => ({
          id: sub.id ?? genId(),
          name: sub.name || 'Subsection',
          type: 'FOLDER' as const,
          children: (sub.tabs ?? []).map((tab: any) => ({
            id: tab.id ?? genId(),
            name: tab.name || 'Tab',
            type: 'FOLDER' as const,
            children: (tab.panels ?? []).map((panel: any) => ({
              id: panel.id ?? genId(),
              name: panel.name || 'Panel',
              type: 'LEAF' as const,
              panelType: panel.panelType ?? 'SELECTION',
              items: panel.items ?? [],
            })),
          })),
        })),
      };
    }

    // Legacy flat section (has direct items)
    return {
      id: genId(),
      name: sec.sectionName || sec.name || 'Section',
      type: 'FOLDER' as const,
      children: [{
        id: genId(),
        name: 'General',
        type: 'LEAF' as const,
        panelType: 'SELECTION' as const,
        items: (sec.items ?? []).map((i: any) => ({
          id: genId(), label: i.label || '', responseType: 'TEXT',
          options: [], commonComments: [], required: false, conditionalLogic: null,
        })),
      }],
    };
  });
}

type ItemState = 'none' | 'selected' | 'correct' | 'damaged';

interface TemplateBuilderProps {
  id?: string;
  onFinish?: (finalizedTemplateId: string) => void;
  isSubComponent?: boolean;
}

/* ─────────────────────────────────────────────────────────────────
   TemplateBuilder — Root
   Can be used as a standalone page (params) or as a sub-component (props).
───────────────────────────────────────────────────────────────── */
export default function TemplateBuilder({ id: propId, onFinish, isSubComponent }: TemplateBuilderProps = {}) {
  const { id: paramsId } = useParams<{ id: string }>();
  const id = propId || paramsId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const templateIdRef = useRef<string | undefined>(isNew ? undefined : id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [nodes, setNodes] = useState<TemplateNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which LEAF panel is "open" inside the selected folder (Level 2 drill-down)
  const [selectedLeafId, setSelectedLeafId] = useState<string | null>(null);
  // Which panel row is "focused" (selected in Level 1 for toolbar actions)
  const [focusedLeafId, setFocusedLeafId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['__root__']));
  const [globalOveralls, setGlobalOveralls] = useState<string[]>(['Satisfactory', 'Marginal', 'Poor', 'Safety', 'None-N/A']);
  const [overallsModalOpen, setOverallsModalOpen] = useState(false);
  const [changes, setChanges] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [treeSearch, setTreeSearch] = useState('');
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);

  // Name-validation modal state
  const [nameModal, setNameModal] = useState<{
    type: 'FOLDER' | 'LEAF';
    leafType: BuilderPanelType;
    parentId: string | null;
  } | null>(null);

  // Add-item modal state (RHS checklist)
  const [addItemModal, setAddItemModal] = useState<{
    leafId: string;
    existingLabels: string[];
  } | null>(null);

  // Move/Copy item to another panel
  const [moveCopyModal, setMoveCopyModal] = useState<{
    itemId: string;
    fromLeafId: string;
    mode: 'move' | 'copy';
  } | null>(null);

  // Reset drill-down state whenever the selected folder changes
  useEffect(() => { setSelectedLeafId(null); setFocusedLeafId(null); }, [selectedId]);
  // Reset focused row when entering Level 2
  useEffect(() => { if (selectedLeafId) setFocusedLeafId(null); }, [selectedLeafId]);

  /* load */
  useEffect(() => {
    if (isNew) { setGlobalOveralls(['Satisfactory', 'Marginal', 'Poor', 'Safety', 'None-N/A']); setLoading(false); return; }
    setLoading(true);
    checklistService.getTemplate(id!).then((tpl: TemplateResponse) => {
      setTitle(tpl.title || '');
      setDescription((tpl as any).description || '');
      templateIdRef.current = tpl.id?.toString();
      // Prefer new recursive nodes, fall back to legacy sections
      const loaded = (tpl.nodes && tpl.nodes.length > 0)
        ? tpl.nodes
        : sectionsToNodes(tpl.sections ?? []);
      setNodes(loaded);
      setGlobalOveralls(tpl.globalOveralls ?? ['Satisfactory', 'Marginal', 'Poor', 'Safety', 'None-N/A']);
      if (loaded.length > 0) {
        setExpandedIds(new Set(['__root__', loaded[0].id]));
      }
    }).catch(() => toast.error('Failed to load template')).finally(() => setLoading(false));
  }, [id, isNew]);

  const dirty = useCallback((fn: (p: TemplateNode[]) => TemplateNode[]) => {
    setNodes(fn); setChanges(c => c + 1);
  }, []);

  const toggleExpand = (nodeId: string) =>
    setExpandedIds(p => { const n = new Set(p); n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId); return n; });

  /* ── Node CRUD ── */
  const addRootFolder = (name?: string) => {
    if (nodes.filter(n => n.type === 'FOLDER').length >= 1) {
      toast.error('Only one main root section is allowed.');
      return;
    }
    const node = emptyFolder(name ?? `Section ${nodes.length + 1}`);
    dirty(p => [...p, node]);
    setSelectedId(node.id);
    setExpandedIds(p => new Set([...p, '__root__', node.id]));
  };

  const addRootLeaf = (type: BuilderPanelType, name?: string, reportName?: string) => {
    const node = { ...emptyLeaf(name ?? `${type === 'SELECTION' ? 'Selection' : 'Damage'} ${nodes.length + 1}`, type), reportName };
    dirty(p => [...p, node]);
    setSelectedId(null); // root LEAFs not shown in workspace; stay at root view
  };

  const addChildFolder = (parentId: string, name?: string) => {
    const parent = findNode(nodes, parentId);
    const childCount = parent?.children?.length ?? 0;
    const child = emptyFolder(name ?? `Group ${childCount + 1}`);
    dirty(p => addChildTo(p, parentId, child));
    setSelectedId(child.id);
    setExpandedIds(p => new Set([...p, parentId, child.id]));
  };

  const addChildLeaf = (parentId: string, type: BuilderPanelType, name?: string, reportName?: string) => {
    const parent = findNode(nodes, parentId);
    const leafCount = (parent?.children ?? []).filter(c => c.type === 'LEAF').length;
    const child = { ...emptyLeaf(name ?? `${type === 'SELECTION' ? 'Selection' : 'Damage'} ${leafCount + 1}`, type), reportName };
    dirty(p => addChildTo(p, parentId, child));
    setSelectedId(parentId);   // stay in parent folder so checklist view refreshes
    setExpandedIds(p => new Set([...p, parentId]));
  };

  const renameNode = (nodeId: string, name: string) =>
    dirty(p => mapNode(p, nodeId, n => ({ ...n, name })));

  const deleteNode = (nodeId: string) => {
    dirty(p => removeNode(p, nodeId));
    if (selectedId === nodeId) setSelectedId(null);
    if (selectedLeafId === nodeId) setSelectedLeafId(null);
  };

  /* ── Item CRUD (inside LEAF nodes) ── */
  // const addItem = (leafId: string) => {
  //   const item = emptyItem();
  //   dirty(p => mapNode(p, leafId, n => ({ ...n, items: [...(n.items ?? []), item] })));
  // };

  const deleteItem = (leafId: string, itemId: string) => {
    dirty(p => mapNode(p, leafId, n => ({ ...n, items: (n.items ?? []).filter(i => i.id !== itemId) })));
  };

  const renameItem = (leafId: string, itemId: string, label: string) => {
    dirty(p => mapNode(p, leafId, n => ({
      ...n, items: (n.items ?? []).map(i => i.id === itemId ? { ...i, label } : i),
    })));
  };

  const openModal = (type: 'FOLDER' | 'LEAF', leafType: BuilderPanelType, parentId: string | null) => {
    setNameModal({ type, leafType, parentId });
  };

  const handleNameModalConfirm = (name: string, reportName?: string) => {
    if (!nameModal) return;
    const { type, leafType, parentId } = nameModal;

    if (isDuplicateName(nodes, parentId, name)) {
      toast.error(`A node named "${name}" already exists in this folder.`);
      return;
    }

    if (type === 'FOLDER') {
      if (parentId) addChildFolder(parentId, name);
      else addRootFolder(name);
    } else {
      if (parentId) addChildLeaf(parentId, leafType, name, reportName);
      else addRootLeaf(leafType, name, reportName);
    }
    setNameModal(null);
  };

  /* ── Copy folder ── */
  const copyFolder = (nodeId: string) => {
    setCopyState(nodeId);
  };

  const executeCopyFolder = (nodeId: string, newName: string) => {
    const node = findNode(nodes, nodeId);
    if (!node) return;
    const path = findPath(nodes, nodeId);
    const parentId = path && path.length > 1 ? path[path.length - 2].id : null;
    const copy = deepCloneNode(node, newName);
    if (parentId) dirty(p => addChildTo(p, parentId, copy));
    else {
      if (nodes.filter(n => n.type === 'FOLDER').length >= 1) {
        toast.error('Cannot copy root folder as only one is allowed.');
        return;
      }
      dirty(p => [...p, copy]);
    }
    toast.success(`"${node.name}" copied to "${newName}".`);
  };

  /* ── Item sort ── */
  const moveItemUp = (leafId: string, itemId: string) => {
    dirty(p => mapNode(p, leafId, n => {
      const items = [...(n.items ?? [])];
      const idx = items.findIndex(i => i.id === itemId);
      if (idx <= 0) return n;
      [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
      return { ...n, items };
    }));
  };

  const moveItemDown = (leafId: string, itemId: string) => {
    dirty(p => mapNode(p, leafId, n => {
      const items = [...(n.items ?? [])];
      const idx = items.findIndex(i => i.id === itemId);
      if (idx < 0 || idx >= items.length - 1) return n;
      [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
      return { ...n, items };
    }));
  };

  /** Add item with a validated name and optional PDF report alias. */
  const addItemWithName = (leafId: string, label: string, reportName?: string) => {
    const item: BuilderItem = {
      ...emptyItem(),
      label,
      reportName: reportName && reportName !== label ? reportName : undefined,
    };
    dirty(p => mapNode(p, leafId, n => ({ ...n, items: [...(n.items ?? []), item] })));
  };

  /** Move an item from one LEAF panel to another. */
  const moveItemToLeaf = (fromLeafId: string, itemId: string, toLeafId: string) => {
    const fromLeaf = findNode(nodes, fromLeafId);
    const item = fromLeaf?.items?.find(i => i.id === itemId);
    if (!item || fromLeafId === toLeafId) return;
    dirty(p => {
      let tree = mapNode(p, fromLeafId, n => ({ ...n, items: (n.items ?? []).filter(i => i.id !== itemId) }));
      tree = mapNode(tree, toLeafId, n => ({ ...n, items: [...(n.items ?? []), { ...item }] }));
      return tree;
    });
  };

  /** Copy an item from one LEAF panel to another (fresh id). */
  const copyItemToLeaf = (fromLeafId: string, itemId: string, toLeafId: string) => {
    const fromLeaf = findNode(nodes, fromLeafId);
    const item = fromLeaf?.items?.find(i => i.id === itemId);
    if (!item) return;
    const copy = { ...item, id: genId() };
    dirty(p => mapNode(p, toLeafId, n => ({ ...n, items: [...(n.items ?? []), copy] })));
  };

  /* ── Leaf (panel) sort & copy within a folder ── */
  const moveLeafUp = (leafId: string) => {
    if (!selectedId) return;
    dirty(p => mapNode(p, selectedId, n => {
      const ch = [...(n.children ?? [])];
      const i = ch.findIndex(c => c.id === leafId);
      if (i <= 0) return n;
      [ch[i - 1], ch[i]] = [ch[i], ch[i - 1]];
      return { ...n, children: ch };
    }));
  };

  const moveLeafDown = (leafId: string) => {
    if (!selectedId) return;
    dirty(p => mapNode(p, selectedId, n => {
      const ch = [...(n.children ?? [])];
      const i = ch.findIndex(c => c.id === leafId);
      if (i < 0 || i >= ch.length - 1) return n;
      [ch[i], ch[i + 1]] = [ch[i + 1], ch[i]];
      return { ...n, children: ch };
    }));
  };

  const copyLeaf = (leafId: string) => {
    if (!selectedId) return;
    const leaf = findNode(nodes, leafId);
    if (!leaf) return;
    const copy = deepCloneNode(leaf, `Copy of ${leaf.name}`);
    dirty(p => mapNode(p, selectedId, n => ({ ...n, children: [...(n.children ?? []), copy] })));
  };

  /* ── Save ── */
  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) { setTitleError(true); toast.error('Please enter a template name.'); return; }
    setTitleError(false); setSaving(true);
    try {
      const payload = {
        title: trimmed,
        description: description.trim() || undefined,
        scope: searchParams.get('scope') || 'ORGANISATION',
        nodes: nodes as any[],
        globalOveralls,
        sections: [],
      };
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
  const selectedNode = selectedId ? findNode(nodes, selectedId) : null;
  const breadcrumb = selectedId ? findPath(nodes, selectedId) ?? [] : [];
  const parentInPath = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null;
  const selectedLeafNode = selectedLeafId ? findNode(nodes, selectedLeafId) : null;
  const goBack = () => {
    if (selectedLeafId !== null) {
      setSelectedLeafId(null); // Level 2 → Level 1
    } else {
      setSelectedId(parentInPath?.id ?? null); // Level 1 → parent folder
    }
  };

  const filteredNodes = treeSearch
    ? nodes.filter(n => nodeMatchesSearch(n, treeSearch.toLowerCase()))
    : nodes;

  /* ── Loading ── */
  if (loading) return (
    <div className={css.loadingScreen}>
      <div className={css.loadingSpinner} />
      <p className={css.loadingText}>Loading template…</p>
    </div>
  );

  return (
    <div className={css.page}>

      {/* ═══ NAME MODAL ═══ */}
      {nameModal && (
        <NameModal
          title={nameModal.type === 'FOLDER' ? 'New Folder' : `New ${nameModal.leafType === 'SELECTION' ? 'Selection' : 'Damage'} Panel`}
          placeholder={nameModal.type === 'FOLDER' ? 'e.g. Exterior' : 'e.g. Roof Inspection'}
          showReportName={nameModal.type === 'LEAF'}
          onConfirm={handleNameModalConfirm}
          onCancel={() => setNameModal(null)}
        />
      )}

      {/* ═══ COPY MODAL ═══ */}
      {copyState && (
        <NameModal
          title="Copy Section"
          placeholder="New Name"
          onConfirm={(name) => { executeCopyFolder(copyState, name); setCopyState(null); }}
          onCancel={() => setCopyState(null)}
        />
      )}

      {/* ═══ ADD ITEM MODAL ═══ */}
      {addItemModal && (
        <AddItemModal
          existingLabels={addItemModal.existingLabels}
          onConfirm={(label, reportName) => {
            addItemWithName(addItemModal.leafId, label, reportName);
            setAddItemModal(null);
          }}
          onCancel={() => setAddItemModal(null)}
        />
      )}

      {/* ═══ MOVE / COPY MODAL ═══ */}
      {moveCopyModal && (
        <MoveCopyModal
          mode={moveCopyModal.mode}
          nodes={nodes}
          fromLeafId={moveCopyModal.fromLeafId}
          onConfirm={(toLeafId) => {
            if (moveCopyModal.mode === 'move') moveItemToLeaf(moveCopyModal.fromLeafId, moveCopyModal.itemId, toLeafId);
            else copyItemToLeaf(moveCopyModal.fromLeafId, moveCopyModal.itemId, toLeafId);
            setMoveCopyModal(null);
          }}
          onCancel={() => setMoveCopyModal(null)}
        />
      )}

      {/* ═══ OVERALLS MODAL ═══ */}
      {overallsModalOpen && (
        <OverallsModal
          initialOveralls={globalOveralls}
          onConfirm={(list) => { setGlobalOveralls(list); setChanges(c => c + 1); setOverallsModalOpen(false); }}
          onCancel={() => setOverallsModalOpen(false)}
        />
      )}

      {/* ═══ TOP NAV BAR ═══ */}
      <header className={css.header}>
        {(() => {
          const backTo = searchParams.get('back');
          if (backTo) {
            // Came from project creation — go back to the project page
            const label = backTo.startsWith('/projects/') ? 'Back to Project' : 'Back';
            return (
              <button className={css.backBtn} onClick={() => navigate(backTo)}>
                <ArrowLeft size={14} /> {label}
              </button>
            );
          }
          return (
            <button className={css.backBtn} onClick={() => navigate('/templates')}>
              <ArrowLeft size={14} /> Templates
            </button>
          );
        })()}
        <span className={css.headerSep}>/</span>
        <span className={css.headerTitle}>{isNew ? 'New Template' : title || 'Edit Template'}</span>
        {/* {changes > 0 && (
          <span className={css.changesChip}>
            <span className={css.changesDot} />
            {changes} unsaved
          </span>
        )} */}
        {changes > 0 && (
          <button className={css.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : isNew ? <FilePlus2 size={13} /> : <Save size={13} />}
            {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save'}
          </button>
        )}
        {isSubComponent && (
          <button
            className={css.saveBtn}
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', marginLeft: 12 }}
            onClick={() => onFinish?.(templateIdRef.current || '')}
            disabled={saving}
          >
            <CheckCircle2 size={13} /> Finish Mapping
          </button>
        )}
      </header>

      {/* ═══ TEMPLATE TITLE CARD ═══ */}
      <div className={css.titleCard}>
        <div className={css.titleCardIcon}>
          <LayoutTemplate size={22} color="#1a7bbd" />
        </div>
        <div className={css.titleCardBody}>
          <div className={css.titleCardMeta} style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
            <span className={css.titleCardBadge}>{isNew ? 'New Template' : 'Editing'}</span>
            <button onClick={() => setOverallsModalOpen(true)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#64748B' }}>Configure Global Ratings</button>
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
          <div className={css.sidebarHead}>
            <div className={css.sidebarHeadIcon}>
              <FolderOpen size={14} color="#1a7bbd" />
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
            {filteredNodes.length === 0 && !treeSearch && (
              <p style={{ fontSize: 13, color: '#9CA3AF', padding: '16px', margin: 0, textAlign: 'center' }}>
                No sections yet.<br />Click <strong>+</strong> above to add one.
              </p>
            )}
            {filteredNodes.map(node => (
              <RecursiveTreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                expandedIds={expandedIds}
                editingNodeId={editingNodeId}
                onSelect={setSelectedId}
                onToggle={toggleExpand}
                onRename={renameNode}
                onDelete={deleteNode}
                onCopy={copyFolder}
                onAddFolder={(parentId) => openModal('FOLDER', 'SELECTION', parentId)}
                onAddLeaf={(parentId, type) => openModal('LEAF', type, parentId)}
                setEditingNodeId={setEditingNodeId}
              />
            ))}
          </div>

          {/* Sidebar footer */}
          <div className={css.sidebarFooter}>
            <button className={css.sidebarAddBtn} onClick={() => {
              const rootNodes = nodes.filter(n => n.type === 'FOLDER');
              if (rootNodes.length === 0) {
                openModal('FOLDER', 'SELECTION', null);
              } else {
                const parentId = selectedId && findNode(nodes, selectedId)?.type === 'FOLDER' ? selectedId : rootNodes[0].id;
                openModal('FOLDER', 'SELECTION', parentId);
              }
            }}>
              <Plus size={13} /> Add New
            </button>
          </div>
        </nav>

        {/* ════ RIGHT WORKSPACE ════ */}
        <main className={css.workspace}>

          {/* Breadcrumb bar */}
          <div className={css.breadcrumbBar}>
            {(selectedId !== null || selectedLeafId !== null) && (
              <>
                <button className={css.bcBackBtn} onClick={goBack}>
                  <ArrowLeft size={12} />
                  {selectedLeafId !== null
                    ? (selectedNode?.name ?? 'Panels')
                    : (parentInPath ? parentInPath.name : 'Menu')}
                </button>
                <span className={css.bcBarDivider} />
              </>
            )}
            <button className={`${css.bcBtn} ${selectedId === null ? css.bcActive : css.bcLink}`}
              onClick={() => { setSelectedId(null); setSelectedLeafId(null); }}>
              <FolderOpen size={13} /> Inspection Checklist
            </button>
            {breadcrumb.map((crumb, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  <ChevronRight size={12} color="#D1D5DB" style={{ flexShrink: 0 }} />
                  <button
                    className={`${css.bcBtn} ${isLast && !selectedLeafId ? css.bcActive : css.bcLink}`}
                    onClick={() => {
                      setSelectedId(crumb.id);
                      if (isLast) setSelectedLeafId(null); // clicking current folder goes back to Level 1
                    }}>
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
            {/* Level 2: append panel name as the active (last) crumb */}
            {selectedLeafNode && (
              <>
                <ChevronRight size={12} color="#D1D5DB" style={{ flexShrink: 0 }} />
                <button className={`${css.bcBtn} ${css.bcActive}`}>
                  {selectedLeafNode.name}
                </button>
              </>
            )}
          </div>

          {/* Scrollable content */}
          <div className={css.scrollArea} style={{ paddingBottom: 20 }}>

            {/* Root level — show folder cards only */}
            {selectedId === null && (
              nodes.filter(n => n.type === 'FOLDER').length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 14 }}>
                  <FolderOpen size={44} color="#D1D5DB" />
                  <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0, textAlign: 'center' }}>
                    No folders yet.<br />Click <strong>+</strong> in the sidebar to add one.
                  </p>
                </div>
              ) : (
                <div className={css.fadeUp}>
                  <div className={css.cgHeader}>
                    <div>
                      <h2 className={css.cgTitle}>Template Menu</h2>
                      <p className={css.cgSub}>{nodes.filter(n => n.type === 'FOLDER').length} folder{nodes.filter(n => n.type === 'FOLDER').length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className={css.cgGrid}>
                    {nodes.filter(n => n.type === 'FOLDER').map(node => (
                      <button key={node.id} className={css.cgCard} onClick={() => setSelectedId(node.id)}>
                        <div className={css.cgCardIcon}><FolderOpen size={22} color="#1a7bbd" /></div>
                        <div className={css.cgCardName}>{node.name}</div>
                        <div className={css.cgCardMeta}>{countItems(node.children ?? [])} item{countItems(node.children ?? []) !== 1 ? 's' : ''}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* Folder selected — Level 1 (panel cards) or Level 2 (items) */}
            {selectedNode?.type === 'FOLDER' && (
              <FolderChecklistView
                folder={selectedNode}
                itemStates={itemStates}
                setItemStates={setItemStates}
                selectedLeafId={selectedLeafId}
                onSelectLeaf={setSelectedLeafId}
                focusedLeafId={focusedLeafId}
                onFocusLeaf={setFocusedLeafId}
                onAddItem={(leafId) => {
                  const leaf = findNode(nodes, leafId);
                  const existingLabels = (leaf?.items ?? []).map(i => i.label);
                  setAddItemModal({ leafId, existingLabels });
                }}
                onDeleteItem={(leafId, itemId) => deleteItem(leafId, itemId)}
                onRenameItem={(leafId, itemId, label) => renameItem(leafId, itemId, label)}
                onMoveItemUp={(leafId, itemId) => moveItemUp(leafId, itemId)}
                onMoveItemDown={(leafId, itemId) => moveItemDown(leafId, itemId)}
                onMoveItem={(leafId, itemId) => setMoveCopyModal({ itemId, fromLeafId: leafId, mode: 'move' })}
                onCopyItem={(leafId, itemId) => setMoveCopyModal({ itemId, fromLeafId: leafId, mode: 'copy' })}
                onDeleteLeaf={(leafId) => deleteNode(leafId)}
              />
            )}

          </div>

          {/* ── Fixed bottom toolbar (Level 1 panel management) ── */}
          {selectedNode?.type === 'FOLDER' && selectedLeafId === null && (() => {
            const leaves = (selectedNode.children ?? []).filter(c => c.type === 'LEAF');
            const focusedIdx = focusedLeafId ? leaves.findIndex(l => l.id === focusedLeafId) : -1;
            const hasFocus = focusedIdx >= 0;
            return (
              <div className={css.panelToolbar}>
                <div className={css.panelToolbarGroup}>
                  <button className={css.panelToolbarBtn}
                    disabled={!hasFocus || focusedIdx === 0}
                    onClick={() => focusedLeafId && moveLeafUp(focusedLeafId)}>
                    <ArrowUp size={13} /> Up
                  </button>
                  <button className={css.panelToolbarBtn}
                    disabled={!hasFocus || focusedIdx === leaves.length - 1}
                    onClick={() => focusedLeafId && moveLeafDown(focusedLeafId)}>
                    <ArrowDown size={13} /> Down
                  </button>
                  <button className={css.panelToolbarBtn}
                    disabled={!hasFocus}
                    onClick={() => focusedLeafId && copyLeaf(focusedLeafId)}>
                    <Copy size={13} /> Copy
                  </button>
                  <button className={`${css.panelToolbarBtn} ${css.panelToolbarBtnDanger}`}
                    disabled={!hasFocus}
                    onClick={() => focusedLeafId && deleteNode(focusedLeafId)}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
                <div className={css.panelToolbarGroup}>
                  <button className={`${css.panelToolbarBtn} ${css.panelToolbarBtnSel}`}
                    onClick={() => openModal('LEAF', 'SELECTION', selectedNode.id)}>
                    <Plus size={13} /> Selection
                  </button>
                  <button className={`${css.panelToolbarBtn} ${css.panelToolbarBtnDmg}`}
                    onClick={() => openModal('LEAF', 'DAMAGE', selectedNode.id)}>
                    <Plus size={13} /> Damage
                  </button>
                </div>
              </div>
            );
          })()}

        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Folder Checklist View — Level 1: Panel Cards / Level 2: Items
───────────────────────────────────────────────────────────────── */
function FolderChecklistView({
  folder, itemStates, setItemStates,
  selectedLeafId, onSelectLeaf,
  focusedLeafId, onFocusLeaf,
  onAddItem, onDeleteItem, onRenameItem, onMoveItemUp, onMoveItemDown,
  onMoveItem, onCopyItem,
  onDeleteLeaf,
}: {
  folder: TemplateNode;
  itemStates: Record<string, ItemState>;
  setItemStates: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>;
  selectedLeafId: string | null;
  onSelectLeaf: (leafId: string | null) => void;
  focusedLeafId: string | null;
  onFocusLeaf: (leafId: string | null) => void;
  onAddItem: (leafId: string) => void;
  onDeleteItem: (leafId: string, itemId: string) => void;
  onRenameItem: (leafId: string, itemId: string, label: string) => void;
  onMoveItemUp: (leafId: string, itemId: string) => void;
  onMoveItemDown: (leafId: string, itemId: string) => void;
  onMoveItem: (leafId: string, itemId: string) => void;
  onCopyItem: (leafId: string, itemId: string) => void;
  onDeleteLeaf: (leafId: string) => void;
}) {
  const leaves = (folder.children ?? []).filter(c => c.type === 'LEAF');
  const totalItems = leaves.reduce((acc, l) => acc + (l.items?.length ?? 0), 0);

  /* ── Level 2: Items for a specific panel ── */
  if (selectedLeafId) {
    const leaf = leaves.find(l => l.id === selectedLeafId);
    if (!leaf) return null;
    const isSel = leaf.panelType === 'SELECTION';
    const accent = isSel ? '#29A356' : '#EF4444';
    const accentLight = isSel ? 'rgba(41,163,86,0.07)' : 'rgba(239,68,68,0.05)';
    const accentBorder = isSel ? 'rgba(41,163,86,0.18)' : 'rgba(239,68,68,0.18)';
    const items = leaf.items ?? [];

    return (
      <div className={css.fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Panel header strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: accentLight, border: `1px solid ${accentBorder}`,
          borderRadius: 10, padding: '10px 14px',
        }}>
          {isSel
            ? <CheckCircle2 size={18} style={{ color: accent, flexShrink: 0 }} />
            : <AlertTriangle size={18} style={{ color: accent, flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <div className={css.cgTitle} style={{ margin: 0 }}>{leaf.name}</div>
            <div className={css.cgSub} style={{ margin: 0 }}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </div>
          </div>
          <span className={isSel ? css.panelBadgeSel : css.panelBadgeDmg}>
            {isSel ? 'SELECTION' : 'DAMAGE'}
          </span>
        </div>


        {/* Items list */}
        <div className={`${css.panelCard} ${isSel ? css.panelCardHeadSel : css.panelCardHeadDmg}`}>
          {items.length === 0 && (
            <p className={css.panelEmpty}>No items yet. Click "Add Item" below.</p>
          )}
          {items.map((item, idx) => {
            const state = itemStates[item.id] ?? 'none';
            return isSel
              ? <SelectionRow key={item.id} item={item} state={state}
                onToggle={() => setItemStates(p => ({ ...p, [item.id]: state === 'selected' ? 'none' : 'selected' }))}
                onDelete={() => onDeleteItem(leaf.id, item.id)}
                onRename={l => onRenameItem(leaf.id, item.id, l)}
                onMoveUp={idx > 0 ? () => onMoveItemUp(leaf.id, item.id) : undefined}
                onMoveDown={idx < items.length - 1 ? () => onMoveItemDown(leaf.id, item.id) : undefined}
                onMoveToFolder={() => onMoveItem(leaf.id, item.id)}
                onCopyToFolder={() => onCopyItem(leaf.id, item.id)} />
              : <DamageRow key={item.id} item={item} state={state}
                onCorrect={() => setItemStates(p => ({ ...p, [item.id]: state === 'correct' ? 'none' : 'correct' }))}
                onDamage={() => setItemStates(p => ({ ...p, [item.id]: state === 'damaged' ? 'none' : 'damaged' }))}
                onDelete={() => onDeleteItem(leaf.id, item.id)}
                onRename={l => onRenameItem(leaf.id, item.id, l)}
                onMoveUp={idx > 0 ? () => onMoveItemUp(leaf.id, item.id) : undefined}
                onMoveDown={idx < items.length - 1 ? () => onMoveItemDown(leaf.id, item.id) : undefined}
                onMoveToFolder={() => onMoveItem(leaf.id, item.id)}
                onCopyToFolder={() => onCopyItem(leaf.id, item.id)} />;
          })}
          <button onClick={() => onAddItem(leaf.id)}
            className={`${css.panelFooterBtn} ${isSel ? css.panelFooterBtnSel : css.panelFooterBtnDmg}`}>
            <Plus size={12} /> Add Item
          </button>
        </div>
      </div>
    );
  }

  /* ── Level 1: Panel rows list ── */
  return (
    <div className={css.fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Folder header */}
      <div className={css.cgHeader} style={{ marginBottom: 12 }}>
        <div>
          <h2 className={css.cgTitle}>{folder.name}</h2>
          <p className={css.cgSub}>
            {leaves.length} panel{leaves.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {leaves.length === 0 && (
        <div className={css.panelCardsEmpty}>
          <LayoutTemplate size={40} color="#D1D5DB" />
          <p>No panels yet.<br />Use the toolbar below to add a panel.</p>
        </div>
      )}

      {/* Panel rows */}
      <div className={css.panelRowList}>
        {leaves.map((leaf) => {
          const isSel = leaf.panelType === 'SELECTION';
          const accent = isSel ? '#29A356' : '#EF4444';
          const accentLight = isSel ? 'rgba(41,163,86,0.07)' : 'rgba(239,68,68,0.05)';
          const isFocused = focusedLeafId === leaf.id;
          const items = leaf.items ?? [];

          return (
            <div
              key={leaf.id}
              className={`${css.panelRowItem} ${isFocused ? css.panelRowItemFocused : ''}`}
              onClick={() => onFocusLeaf(isFocused ? null : leaf.id)}
            >
              {/* Colored top border */}
              <div className={css.panelRowAccent} style={{ background: accent }} />

              <div className={css.panelRowContent} style={{ background: isFocused ? accentLight : undefined }}>
                {/* Left: chevron + icon + name */}
                <span style={{ color: accent, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <ChevronRight size={14} />
                </span>
                {isSel
                  ? <CheckCircle2 size={15} style={{ color: accent, flexShrink: 0 }} />
                  : <AlertTriangle size={15} style={{ color: accent, flexShrink: 0 }} />}
                <div className={css.panelRowLabel}>
                  <span className={css.panelHeadName}>{leaf.name}</span>
                  <span className={css.panelAccordionSub}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Right: badge + delete + open */}
                <span className={isSel ? css.panelBadgeSel : css.panelBadgeDmg}>
                  {isSel ? 'SELECTION' : 'DAMAGE'}
                </span>
                <button
                  className={css.panelDelBtn}
                  title="Delete panel"
                  onClick={e => { e.stopPropagation(); onDeleteLeaf(leaf.id); }}>
                  <Trash2 size={13} />
                </button>
                <button
                  className={css.panelRowOpenBtn}
                  title="Open items"
                  onClick={e => { e.stopPropagation(); onSelectLeaf(leaf.id); }}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Recursive Tree Node (sidebar)
───────────────────────────────────────────────────────────────── */
interface RecursiveTreeNodeProps {
  node: TemplateNode;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  editingNodeId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  onAddFolder: (parentId: string) => void;
  onAddLeaf: (parentId: string, type: BuilderPanelType) => void;
  setEditingNodeId: (id: string | null) => void;
}

function RecursiveTreeNode({
  node, depth, selectedId, expandedIds, editingNodeId,
  onSelect, onToggle, onRename, onDelete, onCopy, onAddFolder, onAddLeaf, setEditingNodeId,
}: RecursiveTreeNodeProps) {
  const isFolder = node.type === 'FOLDER';
  const isLeaf = node.type === 'LEAF';
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const basePad = 22 + depth * 14;
  const isSel = isLeaf && node.panelType === 'SELECTION';

  return (
    <div>
      <div
        className={`${css.nodeRow} ${isSelected ? css.nodeRowActive : ''}`}
        onClick={() => onSelect(node.id)}>
        {/* Chevron — folders only */}
        {isFolder ? (
          <button
            onClick={e => { e.stopPropagation(); onToggle(node.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: `7px 4px 7px ${basePad}px`, color: '#9CA3AF', display: 'flex', flexShrink: 0 }}>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ paddingLeft: basePad + 16, paddingRight: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }} />
        )}

        {/* Icon */}
        <span style={{ flexShrink: 0, marginRight: 7, display: 'flex', alignItems: 'center' }}>
          {isFolder
            ? (isExpanded ? <FolderOpen size={14} color={isSelected ? '#1a7bbd' : '#6B7280'} /> : <Folder size={14} color={isSelected ? '#1a7bbd' : '#6B7280'} />)
            : isSel
              ? <CheckCircle2 size={12} color={isSelected ? '#16A34A' : '#9CA3AF'} />
              : <AlertTriangle size={12} color={isSelected ? '#DC2626' : '#9CA3AF'} />}
        </span>

        {/* Label */}
        <SidebarNodeLabel
          nodeId={node.id} name={node.name} isActive={isSelected}
          bold={depth === 0} small={depth > 0}
          editingNodeId={editingNodeId} setEditingNodeId={setEditingNodeId}
          onRename={name => onRename(node.id, name)}
        />

        {/* Actions */}
        <div className={css.nodeActions}>
          {isFolder && (
            <NodeActionBtn icon={<Plus size={10} />} title="Add Child" onClick={e => { e.stopPropagation(); onAddFolder(node.id); }} />
          )}
          {isFolder && depth > 0 && (
            <NodeActionBtn icon={<Copy size={10} />} title="Copy Folder" onClick={e => { e.stopPropagation(); onCopy(node.id); }} />
          )}
          <NodeActionBtn icon={<Edit2 size={10} />} title="Rename" onClick={e => { e.stopPropagation(); setEditingNodeId(node.id); }} />
          <NodeActionBtn icon={<Trash2 size={10} />} title="Delete" danger onClick={e => { e.stopPropagation(); onDelete(node.id); }} />
        </div>
      </div>

      {/* Children — only FOLDER nodes shown in sidebar tree; LEAFs appear as cards in workspace */}
      {isFolder && isExpanded && node.children?.filter(c => c.type === 'FOLDER').map(child => (
        <RecursiveTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          editingNodeId={editingNodeId}
          onSelect={onSelect}
          onToggle={onToggle}
          onRename={onRename}
          onDelete={onDelete}
          onCopy={onCopy}
          onAddFolder={onAddFolder}
          onAddLeaf={onAddLeaf}
          setEditingNodeId={setEditingNodeId}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Node Card Grid (Folder workspace view)
───────────────────────────────────────────────────────────────── */
// function NodeCardGrid({ title, subtitle, emptyMsg, nodes, onSelect, onAddSelection, onAddDamage }: {
//   title: string; subtitle: string; emptyMsg: string;
//   nodes: TemplateNode[];
//   onSelect: (id: string) => void;
//   onAddFolder: () => void;
//   onAddSelection: () => void;
//   onAddDamage: () => void;
// }) {
//   return (
//     <div className={css.fadeUp}>
//       <div className={css.cgHeader}>
//         <div>
//           <h2 className={css.cgTitle}>{title}</h2>
//           <p className={css.cgSub}>{subtitle}</p>
//         </div>
//         <div style={{ display: 'flex', gap: 8 }}>
//           {/* <button className={css.cgAddBtn} onClick={onAddFolder}>
//             <Folder size={13} /> Add Group
//           </button> */}
//           <button className={css.cgAddBtn} onClick={onAddSelection}
//             style={{ background: 'linear-gradient(135deg, #29A356, #1e7a3f)' }}>
//             <CheckCircle2 size={13} /> Selection
//           </button>
//           <button className={css.cgAddBtn} onClick={onAddDamage}
//             style={{ background: 'linear-gradient(135deg, #EF4444, #dc2626)' }}>
//             <AlertTriangle size={13} /> Damage
//           </button>
//         </div>
//       </div>

//       {nodes.length === 0
//         ? <p className={css.cgEmpty}>{emptyMsg}</p>
//         : (
//           <div className={css.cgGrid}>
//             {nodes.map(node => {
//               const isFolder = node.type === 'FOLDER';
//               const isLeaf = node.type === 'LEAF';
//               const isSel = isLeaf && node.panelType === 'SELECTION';
//               const childCount = isFolder ? (node.children?.length ?? 0) : 0;
//               const itemCount = isFolder ? countItems(node.children ?? []) : (node.items?.length ?? 0);
//               const leafCount = isFolder ? countLeaves(node.children ?? []) : 0;

//               return (
//                 <button key={node.id} className={css.cgCard} onClick={() => onSelect(node.id)}>
//                   <div className={css.cgCardIcon}>
//                     {isFolder
//                       ? <FolderOpen size={22} color="#33AE95" />
//                       : isSel
//                         ? <CheckCircle2 size={22} color="#29A356" />
//                         : <AlertTriangle size={22} color="#EF4444" />}
//                   </div>
//                   <div className={css.cgCardName}>{node.name}</div>
//                   <div className={css.cgCardMeta}>
//                     {isFolder
//                       ? `${childCount} child${childCount !== 1 ? 'ren' : ''} · ${leafCount} leaf${leafCount !== 1 ? 's' : ''} · ${itemCount} item${itemCount !== 1 ? 's' : ''}`
//                       : `${isSel ? 'Selection' : 'Damage'} · ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
//                   </div>
//                 </button>
//               );
//             })}
//           </div>
//         )}
//     </div>
//   );
// }

/* ─────────────────────────────────────────────────────────────────
   Leaf Editor (item list for a LEAF node)
───────────────────────────────────────────────────────────────── */
// function LeafEditor({ leaf, parentName, itemStates, setItemStates, onBack, onAddItem, onDeleteItem, onRenameItem, onMoveItemUp, onMoveItemDown, onRenameLeaf, onDeleteLeaf }: {
//   leaf: TemplateNode;
//   parentName: string;
//   itemStates: Record<string, ItemState>;
//   setItemStates: React.Dispatch<React.SetStateAction<Record<string, ItemState>>>;
//   onBack: () => void;
//   onAddItem: () => void;
//   onDeleteItem: (itemId: string) => void;
//   onRenameItem: (itemId: string, label: string) => void;
//   onMoveItemUp: (itemId: string) => void;
//   onMoveItemDown: (itemId: string) => void;
//   onRenameLeaf: (name: string) => void;
//   onDeleteLeaf: () => void;
// }) {
//   const isSel = leaf.panelType === 'SELECTION';
//   const accent = isSel ? '#29A356' : '#EF4444';
//   const accentLight = isSel ? 'rgba(41,163,86,0.08)' : 'rgba(239,68,68,0.06)';
//   const accentBorder = isSel ? 'rgba(41,163,86,0.20)' : 'rgba(239,68,68,0.20)';
//   const items = leaf.items ?? [];

//   const [editName, setEditName] = useState(false);
//   const [nameVal, setNameVal] = useState(leaf.name);
//   useEffect(() => setNameVal(leaf.name), [leaf.name]);

//   const setItemState = (itemId: string, state: ItemState) =>
//     setItemStates(p => ({ ...p, [itemId]: state }));

//   return (
//     <div className={css.fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
//       <button className={css.leafBackBtn} onClick={onBack}>
//         <ArrowLeft size={13} /> Back to {parentName}
//       </button>
//       <div className={css.ieHeader}>
//         <div>
//           <h2 className={css.ieTitle}>{leaf.name}</h2>
//           <p className={css.ieSub}>{isSel ? 'Selection' : 'Damage'} leaf · {items.length} item{items.length !== 1 ? 's' : ''}</p>
//         </div>
//       </div>

//       {/* Panel card */}
//       <div className={`${css.panelCard} ${isSel ? css.panelCardHeadSel : css.panelCardHeadDmg}`}>

//         {/* Header */}
//         <div className={css.panelHead} style={{ background: accentLight, borderBottom: `1px solid ${accentBorder}` }}>
//           {isSel
//             ? <CheckCircle2 size={15} style={{ color: accent, flexShrink: 0 }} />
//             : <AlertTriangle size={15} style={{ color: accent, flexShrink: 0 }} />}
//           {editName
//             ? <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
//               onBlur={() => { onRenameLeaf(nameVal || leaf.name); setEditName(false); }}
//               onKeyDown={e => { if (e.key === 'Enter') { onRenameLeaf(nameVal || leaf.name); setEditName(false); } }}
//               className={css.panelHeadNameInput}
//               style={{ borderBottom: `1px solid ${accent}` }} />
//             : <span onDoubleClick={() => { setEditName(true); setNameVal(leaf.name); }}
//               className={css.panelHeadName}>{leaf.name}</span>}
//           <span className={isSel ? css.panelBadgeSel : css.panelBadgeDmg}>
//             {isSel ? 'SELECTION' : 'DAMAGED'}
//           </span>
//           <button onClick={onDeleteLeaf} className={css.panelDelBtn}>
//             <Trash2 size={13} />
//           </button>
//         </div>

//         {/* Items */}
//         <div>
//           {items.length === 0 && <p className={css.panelEmpty}>No items yet. Click "Add Item" below.</p>}
//           {items.map((item, idx) => {
//             const state = itemStates[item.id] ?? 'none';
//             return isSel
//               ? <SelectionRow key={item.id} item={item} state={state}
//                 onToggle={() => setItemState(item.id, state === 'selected' ? 'none' : 'selected')}
//                 onDelete={() => onDeleteItem(item.id)}
//                 onRename={l => onRenameItem(item.id, l)}
//                 onMoveUp={idx > 0 ? () => onMoveItemUp(item.id) : undefined}
//                 onMoveDown={idx < items.length - 1 ? () => onMoveItemDown(item.id) : undefined} />
//               : <DamageRow key={item.id} item={item} state={state}
//                 onCorrect={() => setItemState(item.id, state === 'correct' ? 'none' : 'correct')}
//                 onDamage={() => setItemState(item.id, state === 'damaged' ? 'none' : 'damaged')}
//                 onDelete={() => onDeleteItem(item.id)}
//                 onRename={l => onRenameItem(item.id, l)}
//                 onMoveUp={idx > 0 ? () => onMoveItemUp(item.id) : undefined}
//                 onMoveDown={idx < items.length - 1 ? () => onMoveItemDown(item.id) : undefined} />;
//           })}
//         </div>

//         {/* Card footer */}
//         <button onClick={onAddItem}
//           className={`${css.panelFooterBtn} ${isSel ? css.panelFooterBtnSel : css.panelFooterBtnDmg}`}>
//           <Plus size={12} /> Add Item
//         </button>
//       </div>
//     </div>
//   );
// }

/* ─────────────────────────────────────────────────────────────────
   Workspace Footer
───────────────────────────────────────────────────────────────── */
// function WorkspaceFooter({ leafType, onAddItem }: {
//   leafType: string;
//   onAddItem: () => void;
// }) {
//   return (
//     <div className={css.wFooter}>
//       <div className={css.wFooterSpacer} />
//       <button className={`${css.fBtn} ${css.fBtnPrimary}`} onClick={onAddItem}>
//         <Plus size={13} /> Add {leafType === 'SELECTION' ? 'Selection' : 'Damage'} Item
//       </button>
//     </div>
//   );
// }

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
      flex: 1,
    }}>
      {name}
    </span>
  );
}

function NodeActionBtn({ icon, title, onClick, danger }: {
  icon: React.ReactNode; title?: string; onClick: (e: React.MouseEvent) => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`${css.nodeActionBtn} ${danger ? css.nodeActionBtnDanger : ''}`}>
      {icon}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Item Rows (Selection & Damage)
───────────────────────────────────────────────────────────────── */
function SelectionRow({ item, state: _state, onToggle: _onToggle, onDelete, onRename, onMoveUp, onMoveDown, onMoveToFolder, onCopyToFolder }: {
  item: BuilderItem; state: ItemState;
  onToggle: () => void; onDelete: () => void; onRename: (l: string) => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  onMoveToFolder?: () => void; onCopyToFolder?: () => void;
}) {
  const [editLabel, setEditLabel] = useState(false);
  const [val, setVal] = useState(item.label);
  useEffect(() => setVal(item.label), [item.label]);

  return (
    <div className={css.itemRow}>
      {editLabel
        ? <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          onBlur={() => { onRename(val || item.label); setEditLabel(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onRename(val || item.label); setEditLabel(false); } e.stopPropagation(); }}
          onClick={e => e.stopPropagation()}
          className={css.itemLabelInput}
          style={{ borderBottom: '1px solid #29A356' }} />
        : <span onDoubleClick={e => { e.stopPropagation(); setEditLabel(true); setVal(item.label); }}
          className={css.itemLabel}
          style={{ color: '#263B4F', fontWeight: 400 }}>
          {item.label}
          {item.reportName && item.reportName !== item.label && (
            <span className={css.itemReportAlias} title="PDF report name">{item.reportName}</span>
          )}
        </span>}
      <div className={css.itemActionsGroup}>
        <div className={css.itemSortBtns}>
          <button className={css.itemSortBtn} disabled={!onMoveUp} onClick={e => { e.stopPropagation(); onMoveUp?.(); }} title="Move up"><ArrowUp size={12} /></button>
          <button className={css.itemSortBtn} disabled={!onMoveDown} onClick={e => { e.stopPropagation(); onMoveDown?.(); }} title="Move down"><ArrowDown size={12} /></button>
        </div>
        {onMoveToFolder && (
          <button onClick={e => { e.stopPropagation(); onMoveToFolder(); }} className={css.itemActionBtn} title="Move to folder">
            <ArrowRight size={14} />
          </button>
        )}
        {onCopyToFolder && (
          <button onClick={e => { e.stopPropagation(); onCopyToFolder(); }} className={css.itemActionBtn} title="Copy to folder">
            <Copy size={13} />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className={css.itemDeleteBtn} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function DamageRow({ item, onDelete, onRename, onMoveUp, onMoveDown, onMoveToFolder, onCopyToFolder }: {
  item: BuilderItem; state: ItemState;
  onCorrect: () => void; onDamage: () => void;
  onDelete: () => void; onRename: (l: string) => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  onMoveToFolder?: () => void; onCopyToFolder?: () => void;
}) {
  const [editLabel, setEditLabel] = useState(false);
  const [val, setVal] = useState(item.label);
  useEffect(() => setVal(item.label), [item.label]);

  return (
    <div style={{ borderBottom: '1px solid #F3F4F6' }}>
      <div className={css.itemRow}>
        {editLabel
          ? <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onBlur={() => { onRename(val || item.label); setEditLabel(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(val || item.label); setEditLabel(false); } e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            className={css.itemLabelInput} />
          : <span onDoubleClick={e => { e.stopPropagation(); setEditLabel(true); setVal(item.label); }}
            className={css.itemLabel}>{item.label}</span>}
        <div className={css.itemActionsGroup}>
          <div className={css.itemSortBtns}>
            <button className={css.itemSortBtn} disabled={!onMoveUp} onClick={e => { e.stopPropagation(); onMoveUp?.(); }} title="Move up"><ArrowUp size={12} /></button>
            <button className={css.itemSortBtn} disabled={!onMoveDown} onClick={e => { e.stopPropagation(); onMoveDown?.(); }} title="Move down"><ArrowDown size={12} /></button>
          </div>
          {onMoveToFolder && (
            <button onClick={e => { e.stopPropagation(); onMoveToFolder(); }} className={css.itemActionBtn} title="Move to folder">
              <ArrowRight size={14} />
            </button>
          )}
          {onCopyToFolder && (
            <button onClick={e => { e.stopPropagation(); onCopyToFolder(); }} className={css.itemActionBtn} title="Copy to folder">
              <Copy size={13} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className={css.itemDeleteBtn} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Search helper
───────────────────────────────────────────────────────────────── */
function nodeMatchesSearch(node: TemplateNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.type === 'FOLDER' && node.children?.some(c => nodeMatchesSearch(c, q))) return true;
  if (node.type === 'LEAF' && node.items?.some(i => i.label.toLowerCase().includes(q))) return true;
  return false;
}

/* ─────────────────────────────────────────────────────────────────
   Name Validation Modal
───────────────────────────────────────────────────────────────── */
function OverallsModal({ initialOveralls, onConfirm, onCancel }: {
  initialOveralls: string[];
  onConfirm: (list: string[]) => void;
  onCancel: () => void;
}) {
  const [list, setList] = useState([...initialOveralls]);
  const [val, setVal] = useState('');

  const add = () => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setVal('');
    }
  };

  return (
    <div className={css.modalOverlay} onClick={onCancel}>
      <div className={css.modalBox} onClick={e => e.stopPropagation()} style={{ width: 400 }}>
        <h3 className={css.modalTitle}>Global Damage Ratings</h3>
        <p style={{ fontSize: 13, color: '#64748B', margin: 0, marginTop: -8 }}>
          Configure the scale used at the top of every Damage panel.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
          {list.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', padding: '6px 12px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
              <span style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: 500 }}>{item}</span>
              <button onClick={() => setList(list.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {list.length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF' }}>No ratings configured.</p>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Add new rating..." className={css.modalInput} style={{ flex: 1 }} />
          <button onClick={add} disabled={!val.trim() || list.includes(val.trim())} style={{ background: '#1a7bbd', color: 'white', border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
        </div>

        <div className={css.modalActions} style={{ marginTop: 16 }}>
          <button className={css.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={css.modalConfirmBtn} onClick={() => onConfirm(list)}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function NameModal({ title, placeholder, showReportName, onConfirm, onCancel }: {
  title: string;
  placeholder: string;
  showReportName?: boolean;
  onConfirm: (name: string, reportName?: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState('');
  const [useCustomReport, setUseCustomReport] = useState(false);
  const [reportName, setReportName] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const finalReport = useCustomReport && reportName.trim() ? reportName.trim() : trimmed;
    onConfirm(trimmed, showReportName ? finalReport : undefined);
  };

  return (
    <div className={css.modalOverlay} onClick={onCancel}>
      <div className={css.modalBox} onClick={e => e.stopPropagation()}>
        <h3 className={css.modalTitle}>{title}</h3>
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={placeholder}
          className={css.modalInput}
        />
        {showReportName && (
          <>
            <label className={css.modalCheckboxRow} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
              <input type="checkbox" checked={useCustomReport}
                onChange={e => setUseCustomReport(e.target.checked)} className={css.modalCheckbox} />
              Set a custom name for the PDF report?
            </label>
            {useCustomReport && (
              <input
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
                placeholder={val || 'Display name in PDF'}
                className={css.modalInput}
                style={{ marginTop: 8 }}
              />
            )}
          </>
        )}
        <div className={css.modalActions}>
          <button className={css.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={css.modalConfirmBtn} onClick={submit} disabled={!val.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Add Item Modal (RHS — itemName + optional PDF reportName)
───────────────────────────────────────────────────────────────── */
function AddItemModal({ existingLabels, onConfirm, onCancel }: {
  existingLabels: string[];
  onConfirm: (label: string, reportName: string) => void;
  onCancel: () => void;
}) {
  const [itemName, setItemName] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const isDuplicate = itemName.trim() !== '' &&
    existingLabels.some(l => l.trim().toLowerCase() === itemName.trim().toLowerCase());
  const canSubmit = itemName.trim() !== '' && !isDuplicate;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm(itemName.trim(), itemName.trim());
  };

  return (
    <div className={css.modalOverlay} onClick={onCancel}>
      <div className={css.modalBox} onClick={e => e.stopPropagation()}>
        <h3 className={css.modalTitle}>Add Item</h3>

        <label className={css.modalFieldLabel}>Item Name <span style={{ color: '#EF4444' }}>*</span></label>
        <input
          ref={inputRef}
          value={itemName}
          onChange={e => setItemName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. Roof Tiles"
          className={`${css.modalInput} ${isDuplicate ? css.modalInputError : ''}`}
        />
        {isDuplicate && <p className={css.modalErrorMsg}>An item with this name already exists.</p>}

        <div className={css.modalActions}>
          <button className={css.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={css.modalConfirmBtn} onClick={submit} disabled={!canSubmit}>
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Move / Copy to Panel Modal
───────────────────────────────────────────────────────────────── */
function collectLeaves(nodes: TemplateNode[], prefix = ''): { leaf: TemplateNode; path: string }[] {
  const result: { leaf: TemplateNode; path: string }[] = [];
  for (const n of nodes) {
    if (n.type === 'LEAF') result.push({ leaf: n, path: prefix ? `${prefix} › ${n.name}` : n.name });
    if (n.type === 'FOLDER' && n.children?.length)
      result.push(...collectLeaves(n.children, prefix ? `${prefix} › ${n.name}` : n.name));
  }
  return result;
}

function MoveCopyModal({ mode, nodes, fromLeafId, onConfirm, onCancel }: {
  mode: 'move' | 'copy';
  nodes: TemplateNode[];
  fromLeafId: string;
  onConfirm: (toLeafId: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState('');
  const leaves = collectLeaves(nodes).filter(e => e.leaf.id !== fromLeafId);

  return (
    <div className={css.modalOverlay} onClick={onCancel}>
      <div className={css.modalBox} onClick={e => e.stopPropagation()}>
        <h3 className={css.modalTitle}>{mode === 'move' ? 'Move Item to Panel' : 'Copy Item to Panel'}</h3>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px' }}>Select a target panel.</p>

        {leaves.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
            No other panels available.
          </p>
        ) : (
          <div className={css.mvPanelList}>
            {leaves.map(({ leaf, path }) => (
              <button key={leaf.id}
                className={`${css.mvPanelItem} ${selected === leaf.id ? css.mvPanelItemActive : ''}`}
                onClick={() => setSelected(leaf.id)}>
                <span className={leaf.panelType === 'SELECTION' ? css.mvBadgeSel : css.mvBadgeDmg}>
                  {leaf.panelType === 'SELECTION' ? 'SEL' : 'DMG'}
                </span>
                <span className={css.mvPanelPath}>{path}</span>
              </button>
            ))}
          </div>
        )}

        <div className={css.modalActions}>
          <button className={css.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={css.modalConfirmBtn} onClick={() => onConfirm(selected)} disabled={!selected}>
            {mode === 'move' ? 'Move Here' : 'Copy Here'}
          </button>
        </div>
      </div>
    </div>
  );
}
