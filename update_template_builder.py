import re
import os

filepath = "src/pages/Templates/TemplateBuilder.tsx"
with open(filepath, 'r') as f:
    content = f.read()

# 1. Update addRootFolder
content = content.replace("""  const addRootFolder = (name?: string) => {
    const node = emptyFolder(name ?? `Section ${nodes.length + 1}`);
    dirty(p => [...p, node]);
    setSelectedId(node.id);
    setExpandedIds(p => new Set([...p, '__root__', node.id]));
  };""", """  const addRootFolder = (name?: string) => {
    if (nodes.filter(n => n.type === 'FOLDER').length >= 1) {
      toast.error('Only one main root section is allowed.');
      return;
    }
    const node = emptyFolder(name ?? `Section ${nodes.length + 1}`);
    dirty(p => [...p, node]);
    setSelectedId(node.id);
    setExpandedIds(p => new Set([...p, '__root__', node.id]));
  };""")

# 2. Add copyState 
content = content.replace("""  const [addNodeType, setAddNodeType] = useState<'FOLDER' | 'LEAF'>('FOLDER');
  const [addLeafPanelType, setAddLeafPanelType] = useState<BuilderPanelType>('SELECTION');

  // Name-validation modal state
  const [nameModal, setNameModal] = useState<{
    type: 'FOLDER' | 'LEAF';
    leafType: BuilderPanelType;
    parentId: string | null;
  } | null>(null);""", """  const [copyState, setCopyState] = useState<string | null>(null);

  // Name-validation modal state
  const [nameModal, setNameModal] = useState<{
    type: 'FOLDER' | 'LEAF';
    leafType: BuilderPanelType;
    parentId: string | null;
  } | null>(null);""")

# 3. Modify addRootLeaf / addChildLeaf
content = content.replace("""  const addRootLeaf = (type: BuilderPanelType, name?: string) => {
    const node = emptyLeaf(name ?? `${type === 'SELECTION' ? 'Selection' : 'Damage'} ${nodes.length + 1}`, type);
    dirty(p => [...p, node]);
    setSelectedId(null); // root LEAFs not shown in workspace; stay at root view
  };""", """  const addRootLeaf = (type: BuilderPanelType, name?: string, reportName?: string) => {
    const node = { ...emptyLeaf(name ?? `${type === 'SELECTION' ? 'Selection' : 'Damage'} ${nodes.length + 1}`, type), reportName };
    dirty(p => [...p, node]);
    setSelectedId(null); // root LEAFs not shown in workspace; stay at root view
  };""")

content = content.replace("""  const addChildLeaf = (parentId: string, type: BuilderPanelType, name?: string) => {
    const parent = findNode(nodes, parentId);
    const leafCount = (parent?.children ?? []).filter(c => c.type === 'LEAF').length;
    const child = emptyLeaf(name ?? `${type === 'SELECTION' ? 'Selection' : 'Damage'} ${leafCount + 1}`, type);
    dirty(p => addChildTo(p, parentId, child));
    setSelectedId(parentId);   // stay in parent folder so checklist view refreshes
    setExpandedIds(p => new Set([...p, parentId]));
  };""", """  const addChildLeaf = (parentId: string, type: BuilderPanelType, name?: string, reportName?: string) => {
    const parent = findNode(nodes, parentId);
    const leafCount = (parent?.children ?? []).filter(c => c.type === 'LEAF').length;
    const child = { ...emptyLeaf(name ?? `${type === 'SELECTION' ? 'Selection' : 'Damage'} ${leafCount + 1}`, type), reportName };
    dirty(p => addChildTo(p, parentId, child));
    setSelectedId(parentId);   // stay in parent folder so checklist view refreshes
    setExpandedIds(p => new Set([...p, parentId]));
  };""")

# 4. Modify handleNameModalConfirm
content = content.replace("""  const handleNameModalConfirm = (name: string) => {
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
      if (parentId) addChildLeaf(parentId, leafType, name);
      else addRootLeaf(leafType, name);
    }
    setNameModal(null);
  };""", """  const handleNameModalConfirm = (name: string, reportName?: string) => {
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
  };""")

# 5. Modify copyFolder
content = content.replace("""  /* ── Copy folder ── */
  const copyFolder = (nodeId: string) => {
    const node = findNode(nodes, nodeId);
    if (!node) return;
    const path = findPath(nodes, nodeId);
    const parentId = path && path.length > 1 ? path[path.length - 2].id : null;
    const copy = deepCloneNode(node, `Copy of ${node.name}`);
    if (parentId) dirty(p => addChildTo(p, parentId, copy));
    else dirty(p => [...p, copy]);
    toast.success(`"${node.name}" copied.`);
  };""", """  /* ── Copy folder ── */
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
  };""")

# 6. Remove + icon from template menu
content = content.replace("""          <div className={css.sidebarHead}>
            <div className={css.sidebarHeadIcon}>
              <FolderOpen size={14} color="#1a7bbd" />
            </div>
            <span className={css.sidebarHeadTitle}>Template Menu</span>
            <NodeActionBtn icon={<Plus size={11} />} title="Add Section" onClick={() => openModal('FOLDER', 'SELECTION', null)} />
          </div>""", """          <div className={css.sidebarHead}>
            <div className={css.sidebarHeadIcon}>
              <FolderOpen size={14} color="#1a7bbd" />
            </div>
            <span className={css.sidebarHeadTitle}>Template Menu</span>
          </div>""")

# 7. Modify UI Modals render
content = content.replace("""      {/* ═══ NAME MODAL ═══ */}
      {nameModal && (
        <NameModal
          title={nameModal.type === 'FOLDER' ? 'New Folder' : `New ${nameModal.leafType === 'SELECTION' ? 'Selection' : 'Damage'} Panel`}
          placeholder={nameModal.type === 'FOLDER' ? 'e.g. Exterior' : 'e.g. Roof Inspection'}
          onConfirm={handleNameModalConfirm}
          onCancel={() => setNameModal(null)}
        />
      )}""", """      {/* ═══ NAME MODAL ═══ */}
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
      )}""")

# 8. Modify Sidebar Footer / AddPanelOpen removal
import re
sb_footer_pattern = re.compile(r'\{\/\* Sidebar footer \*\/\}.*?<div className=\{css\.sidebarFooter\}>.*?<\/div>\n.*?<\/nav>', re.DOTALL)
replacement_footer = """{/* Sidebar footer */}
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
        </nav>"""
content = sb_footer_pattern.sub(replacement_footer, content)

# 9. Hide copy icon on root folder
content = content.replace("""          {isFolder && (
            <NodeActionBtn icon={<Copy size={10} />} title="Copy Folder" onClick={e => { e.stopPropagation(); onCopy(node.id); }} />
          )}""", """          {isFolder && depth > 0 && (
            <NodeActionBtn icon={<Copy size={10} />} title="Copy Folder" onClick={e => { e.stopPropagation(); onCopy(node.id); }} />
          )}""")

# 10. Update NameModal definition
name_modal_old = """function NameModal({ title, placeholder, onConfirm, onCancel }: {
  title: string;
  placeholder: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
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
        <div className={css.modalActions}>
          <button className={css.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={css.modalConfirmBtn} onClick={submit} disabled={!val.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}"""

name_modal_new = """function NameModal({ title, placeholder, showReportName, onConfirm, onCancel }: {
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
}"""
content = content.replace(name_modal_old, name_modal_new)

# 11. Update AddItemModal definition
add_item_modal_old = """function AddItemModal({ existingLabels, onConfirm, onCancel }: {
  existingLabels: string[];
  onConfirm: (label: string, reportName: string) => void;
  onCancel: () => void;
}) {
  const [itemName, setItemName] = useState('');
  const [useCustomReport, setUseCustomReport] = useState(false);
  const [reportName, setReportName] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const isDuplicate = itemName.trim() !== '' &&
    existingLabels.some(l => l.trim().toLowerCase() === itemName.trim().toLowerCase());
  const canSubmit = itemName.trim() !== '' && !isDuplicate;

  const submit = () => {
    if (!canSubmit) return;
    const finalReport = useCustomReport && reportName.trim() ? reportName.trim() : itemName.trim();
    onConfirm(itemName.trim(), finalReport);
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

        <label className={css.modalCheckboxRow}>
          <input type="checkbox" checked={useCustomReport}
            onChange={e => setUseCustomReport(e.target.checked)} className={css.modalCheckbox} />
          Set a custom name for the PDF report?
        </label>

        {useCustomReport && (
          <>
            <label className={css.modalFieldLabel}>Report Name</label>
            <input
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
              placeholder={itemName || 'Display name in PDF'}
              className={css.modalInput}
            />
          </>
        )}

        <div className={css.modalActions}>
          <button className={css.modalCancelBtn} onClick={onCancel}>Cancel</button>
          <button className={css.modalConfirmBtn} onClick={submit} disabled={!canSubmit}>
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
}"""

add_item_modal_new = """function AddItemModal({ existingLabels, onConfirm, onCancel }: {
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
}"""
content = content.replace(add_item_modal_old, add_item_modal_new)

with open(filepath, 'w') as f:
    f.write(content)

print("Updated TemplateBuilder.tsx")
