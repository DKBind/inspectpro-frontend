import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, SlidersHorizontal, Copy, Trash2, Edit2,
  LayoutTemplate, X, ChevronDown, AlertTriangle,
} from 'lucide-react';
import { checklistService } from '@/services/checklistService';
import { propertyTypeService } from '@/services/propertyTypeService';
import type { TemplateResponse, TemplateStatusName, OwnerType } from '@/services/models/checklist';
import { useAuthStore } from '@/store/useAuthStore';
import { ROUTES } from '@/components/Constant/Route';
import Loader from '@/components/shared-ui/Loader/Loader';
import EmptyPlaceholder from '@/components/shared-ui/EmptyPlaceholder/EmptyPlaceholder';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import css from './TemplateList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmModal {
  type: 'status' | 'delete' | 'copy';
  template: TemplateResponse;
  newStatus?: TemplateStatusName;
  targetOwnerId?: string;
  targetOwnerType?: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_TOKENS: Record<string, string> = {
  ACTIVE: 'var(--status-active)',
  INACTIVE: 'var(--status-inactive)',
  DRAFT: 'var(--status-draft)',
};

function StatusBadge({ name, colour, onClick }: {
  name?: string;
  colour?: string;
  onClick?: () => void;
}) {
  const bg = colour ?? STATUS_TOKENS[name ?? ''] ?? 'var(--status-draft)';
  return (
    <button
      className={css.statusBadge}
      style={{ '--badge-color': bg } as React.CSSProperties}
      onClick={onClick}
      aria-label={`Status: ${name ?? 'DRAFT'}. Click to change`}
      title="Click to change status"
    >
      {name ?? 'DRAFT'}
    </button>
  );
}

// ─── TemplateList ─────────────────────────────────────────────────────────────

export default function TemplateList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  // Determine role bucket
  const orgId = user?.orgId;

  // ── State ──────────────────────────────────────────────────────────────────

  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Search
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatusId, setFilterStatusId] = useState<number | null>(null);
  const [filterFranchiseId, setFilterFranchiseId] = useState<string | null>(null);
  const [statusOptions, setStatusOptions] = useState<{ value: number; label: string }[]>([]);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Copy target picker (Platform Admin)
  const [copyTargetOwnerId, setCopyTargetOwnerId] = useState<string | null>(null);
  const [copyTargetOwnerType, setCopyTargetOwnerType] = useState<string>('ORGANISATION');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async (pg = currentPage, sz = pageSize) => {
    setLoading(true);
    try {
      const result = await checklistService.listTemplates({
        search: search || undefined,
        statusId: filterStatusId ?? undefined,
        franchiseId: filterFranchiseId ?? undefined,
        page: pg - 1,
        size: sz,
      });
      setTemplates(result.templates);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatusId, filterFranchiseId, currentPage, pageSize]);

  // Load status options once
  useEffect(() => {
    // Status options are resolved from backend; we build static options here
    setStatusOptions([
      { value: 1, label: 'Draft' },
      { value: 2, label: 'Active' },
      { value: 3, label: 'Inactive' },
    ]);
  }, []);

  useEffect(() => {
    fetchTemplates(1, pageSize);
    setCurrentPage(1);
  }, [search, filterStatusId, filterFranchiseId]);

  useEffect(() => {
    fetchTemplates(currentPage, pageSize);
  }, [currentPage, pageSize]);

  // ── Debounced search ───────────────────────────────────────────────────────

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(e.target.value), 300);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleStatusBadgeClick = (t: TemplateResponse) => {
    if (!canEdit(t)) return;
    // Cycle: DRAFT → ACTIVE → INACTIVE → DRAFT
    const cycle: TemplateStatusName[] = ['DRAFT', 'ACTIVE', 'INACTIVE'];
    const cur = (t.statusName ?? 'DRAFT') as TemplateStatusName;
    const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    setConfirmModal({ type: 'status', template: t, newStatus: next });
  };

  const handleCopyClick = (t: TemplateResponse) => {
    if (isSuperAdmin) {
      // Show modal to pick target
      setCopyTargetOwnerId(null);
      setCopyTargetOwnerType('ORGANISATION');
      setConfirmModal({ type: 'copy', template: t });
    } else {
      setConfirmModal({ type: 'copy', template: t });
    }
  };

  const handleDeleteClick = (t: TemplateResponse) => {
    setConfirmModal({ type: 'delete', template: t });
  };

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setConfirmLoading(true);
    try {
      const { type, template } = confirmModal;

      if (type === 'status' && confirmModal.newStatus) {
        await checklistService.changeTemplateStatus(template.id!, confirmModal.newStatus);
        toast.success(`Status changed to ${confirmModal.newStatus}`);
      } else if (type === 'copy') {
        const target = isSuperAdmin && copyTargetOwnerId
          ? { targetOwnerId: copyTargetOwnerId, targetOwnerType: copyTargetOwnerType }
          : undefined;
        await checklistService.copyTemplate(template.id!, target);
        toast.success(`"Copy of ${template.title}" created as DRAFT`);
      } else if (type === 'delete') {
        await checklistService.deleteTemplate(template.id!);
        toast.success(`"${template.title}" permanently deleted`);
      }
      setConfirmModal(null);
      fetchTemplates(currentPage, pageSize);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Action failed');
    } finally {
      setConfirmLoading(false);
    }
  };

  // ── Permission helpers ─────────────────────────────────────────────────────

  const canEdit = (t: TemplateResponse) => {
    if (isSuperAdmin) return true;
    return t.ownerId === orgId;
  };

  const canDelete = (t: TemplateResponse) => canEdit(t);

  // ── Column definitions per role ───────────────────────────────────────────

  const renderScopeLabel = (t: TemplateResponse): string => {
    if (isSuperAdmin) return t.ownerType === 'FRANCHISE' ? 'Franchise' : 'Organisation';
    // Org user
    if (orgId && t.ownerId === orgId) return 'Own';
    if (t.ownerType === 'FRANCHISE') return 'Franchise';
    return 'Global';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={css.page}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          <div className={css.searchWrap}>
            <LayoutTemplate className={css.searchIcon} size={16} />
            <input
              className={css.searchInput}
              placeholder="Search templates..."
              value={searchInput}
              onChange={handleSearchChange}
              aria-label="Search templates"
            />
            {searchInput && (
              <button className={css.clearBtn} onClick={clearSearch} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={css.toolbarRight}>
          <button
            className={css.iconBtn}
            onClick={() => fetchTemplates(currentPage, pageSize)}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>

          <div className={css.filterWrap}>
            <button
              className={`${css.iconBtn} ${filterOpen ? css.iconBtnActive : ''}`}
              onClick={() => setFilterOpen(v => !v)}
              aria-label="Filter"
              title="Filter"
            >
              <SlidersHorizontal size={16} />
              <ChevronDown size={12} className={`${css.filterChevron} ${filterOpen ? css.filterChevronOpen : ''}`} />
            </button>

            {filterOpen && (
              <div className={css.filterPanel}>
                <p className={css.filterLabel}>Status</p>
                <DropdownSelect
                  options={statusOptions}
                  value={filterStatusId}
                  onChange={v => setFilterStatusId(v as number | null)}
                  placeholder="All statuses"
                  clearable
                />
                {/* Franchise filter — only for Org User and Platform Admin */}
                {(isSuperAdmin) && (
                  <>
                    <p className={css.filterLabel} style={{ marginTop: 12 }}>Owner</p>
                    <DropdownSelect
                      options={[]}
                      value={filterFranchiseId}
                      onChange={v => setFilterFranchiseId(v as string | null)}
                      placeholder="All owners"
                      clearable
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <button
            className={css.newBtn}
            onClick={() => navigate('/templates/new/builder')}
            aria-label="New Template"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={css.tableWrap}>
        {loading ? (
          <div className={css.loaderWrap}>
            <Loader variant="inline" type="spinner" text="Loading templates..." />
          </div>
        ) : templates.length === 0 ? (
          <EmptyPlaceholder
            icon={<LayoutTemplate size={40} />}
            title={search ? 'No templates found' : 'No templates created yet'}
            description={search ? 'Try adjusting your search or filters.' : 'Create your first template to get started.'}
            actionLabel="+ New Template"
            onAction={() => navigate('/templates/new/builder')}
          />
        ) : (
          <table className={css.table}>
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Property Type</th>
                <th>Sub-Type</th>
                <th>Scope</th>
                {isSuperAdmin && <th>Owner</th>}
                <th>Status</th>
                <th>Created On</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className={css.row}>
                  <td className={css.nameCell}>
                    <span className={css.templateName}>{t.title}</span>
                    {t.description && <span className={css.templateDesc}>{t.description}</span>}
                  </td>
                  <td>{t.propertyTypeName ?? '—'}</td>
                  <td>{t.propertySubTypeName ?? '—'}</td>
                  <td>
                    <span className={`${css.scopeTag} ${css['scope_' + renderScopeLabel(t).replace(' ', '_')]}`}>
                      {renderScopeLabel(t)}
                    </span>
                  </td>
                  {isSuperAdmin && <td className={css.ownerCell}>{t.ownerName ?? '—'}</td>}
                  <td>
                    <StatusBadge
                      name={t.statusName}
                      colour={t.statusColour}
                      onClick={canEdit(t) ? () => handleStatusBadgeClick(t) : undefined}
                    />
                  </td>
                  <td className={css.dateCell}>
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>{t.createdByName || '—'}</td>
                  <td>
                    <div className={css.actions}>
                      {canEdit(t) && (
                        <button
                          className={css.actionBtn}
                          onClick={() => navigate(`/templates/${t.id}/builder`)}
                          aria-label={`Edit ${t.title}`}
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      <button
                        className={css.actionBtn}
                        onClick={() => handleCopyClick(t)}
                        aria-label={`Copy ${t.title}`}
                        title="Copy"
                      >
                        <Copy size={15} />
                      </button>
                      {canDelete(t) && (
                        <button
                          className={`${css.actionBtn} ${css.actionBtnDelete}`}
                          onClick={() => handleDeleteClick(t)}
                          aria-label={`Delete ${t.title}`}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!loading && templates.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      )}

      {/* ── Confirmation Modal ──────────────────────────────────────────── */}
      {confirmModal && (
        <div className={css.modalOverlay} role="dialog" aria-modal="true">
          <div className={css.modal}>
            <div className={css.modalIcon}>
              <AlertTriangle size={32} />
            </div>

            {confirmModal.type === 'status' && (
              <>
                <h3 className={css.modalTitle}>Change Status</h3>
                <p className={css.modalBody}>
                  Are you sure you want to change the status of{' '}
                  <strong>{confirmModal.template.title}</strong> to{' '}
                  <strong>{confirmModal.newStatus}</strong>?
                </p>
              </>
            )}

            {confirmModal.type === 'copy' && (
              <>
                <h3 className={css.modalTitle}>Copy Template</h3>
                {isSuperAdmin ? (
                  <>
                    <p className={css.modalBody}>
                      Select the target organisation or franchise for{' '}
                      <strong>{confirmModal.template.title}</strong>.
                    </p>
                    <div className={css.modalField}>
                      <label className={css.modalFieldLabel}>Target Owner</label>
                      <DropdownSelect
                        options={[]}
                        value={copyTargetOwnerId}
                        onChange={v => setCopyTargetOwnerId(v as string | null)}
                        placeholder="Search organisation or franchise..."
                        searchable
                      />
                    </div>
                    <div className={css.modalField}>
                      <label className={css.modalFieldLabel}>Owner Type</label>
                      <DropdownSelect
                        options={[
                          { value: 'ORGANISATION', label: 'Organisation' },
                          { value: 'FRANCHISE', label: 'Franchise' },
                        ]}
                        value={copyTargetOwnerType}
                        onChange={v => setCopyTargetOwnerType(v as string)}
                        searchable={false}
                        clearable={false}
                      />
                    </div>
                  </>
                ) : (
                  <p className={css.modalBody}>
                    Copy <strong>{confirmModal.template.title}</strong> within your scope?
                    A new DRAFT copy will be created.
                  </p>
                )}
              </>
            )}

            {confirmModal.type === 'delete' && (
              <>
                <h3 className={css.modalTitle}>Delete Template</h3>
                <p className={css.modalBody}>
                  This will permanently delete{' '}
                  <strong>{confirmModal.template.title}</strong>. This action cannot be undone.
                </p>
              </>
            )}

            <div className={css.modalActions}>
              <button
                className={css.cancelBtn}
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancel
              </button>
              <button
                className={`${css.confirmBtn} ${confirmModal.type === 'delete' ? css.confirmBtnDanger : ''}`}
                onClick={handleConfirm}
                disabled={confirmLoading || (confirmModal.type === 'copy' && isSuperAdmin && !copyTargetOwnerId)}
              >
                {confirmLoading ? (
                  <Loader variant="inline" type="spinner" small />
                ) : confirmModal.type === 'delete' ? (
                  'Delete Permanently'
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
