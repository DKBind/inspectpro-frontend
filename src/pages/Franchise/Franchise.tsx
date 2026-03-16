import { useEffect, useState } from 'react';
import { GitBranch, Plus, Globe, RefreshCw, Eye, Pencil, Trash2, XCircle, CheckCircle, AlertTriangle, Building2 } from 'lucide-react';
import { toast } from 'sonner';

import { organisationService } from '@/services/organisationService';
import type { OrganisationResponse } from '@/services/models/organisation';
import { FranchiseCreateModal } from './FranchiseCreateModal';
import { OrganisationViewModal } from '@/pages/Organisation/OrganisationViewModal';
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
import styles from '@/pages/Organisation/Organisation.module.css';

const Franchise = () => {
  const [franchises, setFranchises]   = useState<OrganisationResponse[]>([]);
  const [loading, setLoading]         = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(10);
  const [totalPages, setTotalPages]   = useState(0);
  const [totalItems, setTotalItems]   = useState(0);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editFranchise, setEditFranchise] = useState<OrganisationResponse | null>(null);
  const [viewFranchise, setViewFranchise] = useState<OrganisationResponse | null>(null);
  const [deleteId, setDeleteId]           = useState<string | null>(null);
  const [deleting, setDeleting]           = useState(false);

  const [toggleTarget, setToggleTarget] = useState<{ org: OrganisationResponse; newStatus: boolean } | null>(null);
  const [toggling, setToggling]         = useState(false);

  const fetchFranchises = async (page = currentPage, size = pageSize) => {
    setLoading(true);
    try {
      const data = await organisationService.getFranchises(page - 1, size);
      setFranchises(data.content);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalElements);
    } catch {
      setFranchises([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFranchises(currentPage, pageSize); }, [currentPage, pageSize]);

  const handleSuccess = () => { setCurrentPage(1); fetchFranchises(1, pageSize); };

  const openCreate = () => { setEditFranchise(null); setFormModalOpen(true); };

  const openEdit = async (f: OrganisationResponse) => {
    try { setEditFranchise(await organisationService.getOrganisationByUuid(f.uuid)); }
    catch { setEditFranchise(f); }
    setFormModalOpen(true);
  };

  const openView = async (f: OrganisationResponse) => {
    try { setViewFranchise(await organisationService.getOrganisationByUuid(f.uuid)); }
    catch { setViewFranchise(f); }
  };

  const doToggleStatus = async (org: OrganisationResponse, newStatus: boolean) => {
    setToggling(true);
    try {
      const statusId = newStatus ? 1 : 2;
      const updated = await organisationService.updateOrganisationStatus(org.uuid, statusId);
      setFranchises((prev) =>
        prev.map((o) => (o.uuid === org.uuid ? { ...o, isActive: updated.isActive, statusName: updated.statusName } : o))
      );
      toast.success(`Franchise marked as ${newStatus ? 'Active' : 'Inactive'}`);
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
      toast.success('Franchise deleted successfully');
      setDeleteId(null);
      const newTotalPages = Math.max(1, Math.ceil((totalItems - 1) / pageSize));
      const targetPage = currentPage > newTotalPages ? newTotalPages : currentPage;
      setCurrentPage(targetPage);
      fetchFranchises(targetPage, pageSize);
    } catch (error: any) {
      toast.error('Failed to delete', { description: error?.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Franchises</h1>
          <p className={styles.pageSubtitle}>Manage franchise branches linked to their parent organisations.</p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <Plus style={{ display: 'inline', width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} />
          Create Franchise
        </button>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>
            <GitBranch style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }} />
            All Franchises
          </h3>
          <button className={styles.refreshBtn} onClick={() => fetchFranchises(currentPage, pageSize)} title="Refresh">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              <p style={{ marginTop: 12 }}>Loading...</p>
            </div>
          ) : franchises.length === 0 ? (
            <div className={styles.emptyState}>
              <GitBranch style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
              <p>No franchises yet.</p>
              <p className={styles.emptySubtext}>Click "Create Franchise" to set one up.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Franchise</th>
                    <th>Parent Organisation</th>
                    <th>Contact Person</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {franchises.map((f) => (
                    <tr key={f.uuid} className={styles.tableRow}>
                      <td>
                        <div className={styles.orgCell}>
                          <div className={styles.orgIcon}>
                            <GitBranch style={{ width: 14, height: 14 }} />
                          </div>
                          <div>
                            <span className={styles.orgName}>{f.name ?? '—'}</span>
                            {f.domain && (
                              <p className={styles.orgMeta}>
                                <Globe style={{ display: 'inline', width: 11, height: 11, marginRight: 3 }} />
                                {f.domain}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 style={{ width: 13, height: 13, opacity: 0.5 }} />
                          <span className={styles.mutedCell}>{f.parentOrgName ?? '—'}</span>
                        </div>
                      </td>
                      <td className={styles.mutedCell}>{f.contactedPersonName ?? '—'}</td>
                      <td className={styles.mutedCell}>{f.email ?? '—'}</td>
                      <td>
                        <button
                          className={`${styles.statusToggle} ${f.isActive ? styles.toggleOn : styles.toggleOff}`}
                          onClick={() => setToggleTarget({ org: f, newStatus: !f.isActive })}
                          disabled={toggling}
                          title={f.isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <span className={styles.toggleKnob}>
                            {f.isActive ? <CheckCircle size={8} /> : <XCircle size={8} />}
                          </span>
                        </button>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button className={styles.actionBtn} onClick={() => openView(f)} title="View"><Eye size={14} /></button>
                          <button className={styles.actionBtn} onClick={() => openEdit(f)} title="Edit"><Pencil size={14} /></button>
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setDeleteId(f.uuid)} title="Delete"><Trash2 size={14} /></button>
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

      <FranchiseCreateModal
        open={formModalOpen}
        onOpenChange={(open) => { setFormModalOpen(open); if (!open) setEditFranchise(null); }}
        onSuccess={handleSuccess}
        editOrg={editFranchise}
      />

      <OrganisationViewModal org={viewFranchise} onClose={() => setViewFranchise(null)} />

      {/* Status Toggle Confirmation */}
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
                ? <>Activating <span className="text-white font-medium">{toggleTarget?.org.name}</span> will restore access.</>
                : <>Deactivating <span className="text-white font-medium">{toggleTarget?.org.name}</span> may impact access.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setToggleTarget(null)} disabled={toggling}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">Cancel</Button>
            <Button onClick={() => toggleTarget && doToggleStatus(toggleTarget.org, toggleTarget.newStatus)}
              disabled={toggling} className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold min-w-28">
              {toggling ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</span> : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md !bg-[#0d1117] !border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <DialogTitle className="text-white">Delete Franchise</DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 pl-[52px]">
              This action cannot be undone. The franchise and all its data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={deleting}
              className="text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700">Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-28">
              {deleting ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</span> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Franchise;
