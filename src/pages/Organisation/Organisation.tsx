import { useEffect, useState } from 'react';
import { Building2, Plus, Globe, Crown, RefreshCw, Eye, Pencil, Trash2, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { organisationService } from '@/services/organisationService';
import type { OrganisationResponse } from '@/services/models/organisation';
import { OrganisationCreateModal } from './OrganisationCreateModal';
import { OrganisationViewModal } from './OrganisationViewModal';
import Pagination from '@/components/ui/Pagination/Pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import styles from './Organisation.module.css';

function getPlanBadgeClass(planName?: string): string {
  const p = (planName ?? '').toUpperCase();
  if (p.includes('FREE')) return styles.planFree;
  if (p.includes('STARTER') || p.includes('BASIC')) return styles.planStarter;
  if (p.includes('PRO') || p.includes('PROFESSIONAL')) return styles.planPro;
  if (p.includes('ENTERPRISE') || p.includes('PREMIUM')) return styles.planEnterprise;
  const palettes = [styles.planPalette1, styles.planPalette2, styles.planPalette3, styles.planPalette4];
  const hash = (planName ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

const Organisation = () => {
  const [organisations, setOrganisations] = useState<OrganisationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination (1-based for UI, converted to 0-based for API)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OrganisationResponse | null>(null);
  const [viewOrg, setViewOrg] = useState<OrganisationResponse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Status toggle
  const [toggleTarget, setToggleTarget] = useState<{ org: OrganisationResponse; newStatus: boolean } | null>(null);
  const [toggling, setToggling] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchOrganisations = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const data = await organisationService.getOrganisations(page - 1, size);
      setOrganisations(data.content);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalElements);
    } catch {
      setOrganisations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganisations(currentPage, pageSize);
  }, [currentPage, pageSize]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleSuccess = () => {
    setCurrentPage(1);
    fetchOrganisations(1, pageSize);
  };

  const openCreate = () => { setEditOrg(null); setFormModalOpen(true); };

  const openEdit = async (org: OrganisationResponse) => {
    try {
      const fresh = await organisationService.getOrganisationByUuid(org.uuid);
      setEditOrg(fresh);
    } catch {
      setEditOrg(org);
    }
    setFormModalOpen(true);
  };

  const openView = async (org: OrganisationResponse) => {
    try {
      const fresh = await organisationService.getOrganisationByUuid(org.uuid);
      setViewOrg(fresh);
    } catch {
      setViewOrg(org);
    }
  };

  const confirmDelete = (uuid: string) => {
    setDeleteId(uuid);
  };

  const handleToggleStatus = (org: OrganisationResponse) => {
    setToggleTarget({ org, newStatus: !org.isActive });
  };

  const doToggleStatus = async (org: OrganisationResponse, newStatus: boolean) => {
    setToggling(true);
    try {
      const statusId = newStatus ? 1 : 2;
      const updated = await organisationService.updateOrganisationStatus(org.uuid, statusId);
      setOrganisations((prev) =>
        prev.map((o) => (o.uuid === org.uuid ? { ...o, isActive: updated.isActive, statusName: updated.statusName } : o))
      );
      toast.success(`Organisation marked as ${newStatus ? 'Active' : 'Inactive'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update status');
    } finally {
      setToggling(false);
      setToggleTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await organisationService.deleteOrganisation(deleteId);
      toast.success('Organisation deleted successfully');
      setDeleteId(null);
      const newTotal = totalItems - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
      const targetPage = currentPage > newTotalPages ? newTotalPages : currentPage;
      setCurrentPage(targetPage);
      fetchOrganisations(targetPage, pageSize);
    } catch (error: any) {
      toast.error('Failed to delete', { description: error?.message });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Organisations</h1>
          <p className={styles.pageSubtitle}>Manage all organisations, subscriptions, and team configurations.</p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <Plus style={{ display: 'inline', width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
          Create Organisation
        </button>
      </div>

      {/* Table Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>
            <Building2 style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }} />
            All Organisations
            {/* {!loading && <span className={styles.countBadge}>{totalItems}</span>} */}
          </h3>
          <button className={styles.refreshBtn} onClick={() => fetchOrganisations(currentPage, pageSize)} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              <p style={{ marginTop: 12 }}>Loading...</p>
            </div>
          ) : organisations.length === 0 ? (
            <div className={styles.emptyState}>
              <Building2 style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
              <p>No organisations yet.</p>
              <p className={styles.emptySubtext}>Click "Create Organisation" to set one up.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Contact Person</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organisations.map((org) => (
                    <tr key={org.uuid} className={styles.tableRow}>
                      <td>
                        <div className={styles.orgCell}>
                          <div className={styles.orgIcon}>
                            <Building2 style={{ width: 14, height: 14 }} />
                          </div>
                          <div>
                            <span className={styles.orgName}>{org.name ?? '—'}</span>
                            {org.domain && (
                              <p className={styles.orgMeta}>
                                <Globe style={{ display: 'inline', width: 11, height: 11, marginRight: 3 }} />
                                {org.domain}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={styles.mutedCell}>{org.contactedPersonName ?? '—'}</td>
                      <td className={styles.mutedCell}>{org.email ?? '—'}</td>
                      <td>
                        <span className={`${styles.planBadge} ${getPlanBadgeClass(org.planType)}`}>
                          <Crown style={{ display: 'inline', width: 11, height: 11, marginRight: 4, verticalAlign: 'middle' }} />
                          {org.planType ?? '—'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`${styles.statusToggle} ${org.isActive ? styles.toggleOn : styles.toggleOff}`}
                          onClick={() => handleToggleStatus(org)}
                          disabled={toggling}
                          title={org.isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <span className={styles.toggleKnob}>
                            {org.isActive
                              ? <CheckCircle size={8} />
                              : <XCircle size={8} />}
                          </span>
                        </button>
                      </td>

                      <td>
                        <div className={styles.actionBtns}>
                          <button className={styles.actionBtn} onClick={() => openView(org)} title="View">
                            <Eye size={14} />
                          </button>
                          <button className={styles.actionBtn} onClick={() => openEdit(org)} title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => confirmDelete(org.uuid)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.paginationArea}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <OrganisationCreateModal
        open={formModalOpen}
        onOpenChange={(open) => { setFormModalOpen(open); if (!open) setEditOrg(null); }}
        onSuccess={handleSuccess}
        editOrg={editOrg}
      />

      {/* View Modal */}
      <OrganisationViewModal org={viewOrg} onClose={() => setViewOrg(null)} />

      {/* Status Toggle Confirmation Dialog */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-yellow-600/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-yellow-400" />
              </div>
              <DialogTitle className="text-white">Confirm Status Change</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 pl-[52px]">
              {toggleTarget?.newStatus
                ? <>Activating <span className="text-white font-medium">{toggleTarget?.org.name}</span> will restore access for this organisation. Are you sure you want to proceed?</>
                : <>Deactivating <span className="text-white font-medium">{toggleTarget?.org.name}</span> may impact reporting and access. Are you sure you want to proceed?</>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setToggleTarget(null)} disabled={toggling}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
              Cancel
            </Button>
            <Button
              onClick={() => toggleTarget && doToggleStatus(toggleTarget.org, toggleTarget.newStatus)}
              disabled={toggling}
              className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold min-w-28">
              {toggling ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating...
                </span>
              ) : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-white">Delete Organisation</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 pl-[52px]">
              This action cannot be undone. The organisation and all its associated data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={deleting}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Organisation;
