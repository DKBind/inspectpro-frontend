import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Globe, Crown, Calendar, AlertTriangle, CreditCard, Pencil } from 'lucide-react';
import { organisationService } from '@/services/organisationService';
import type { OrganisationResponse } from '@/services/models/organisation';
import styles from './OrganisationDetail.module.css';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import SubscriptionModal from './SubscriptionModal';
import type { OrgSubscriptionResponse } from '@/services/models/subscription';
import { subscriptionService } from '@/services/subscriptionService';

const getPlanBadgeClass = (plan: string | undefined) => {
  switch (plan) {
    case 'FREE': return styles.planFree;
    case 'STARTER': return styles.planStarter;
    case 'PRO': return styles.planPro;
    case 'ENTERPRISE': return styles.planEnterprise;
    default: return styles.planFree;
  }
};

const getPlanLabel = (plan: string | undefined) => {
  switch (plan) {
    case 'FREE': return 'Free';
    case 'STARTER': return 'Starter';
    case 'PRO': return 'Professional';
    case 'ENTERPRISE': return 'Enterprise';
    default: return plan ?? '—';
  }
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const STATUS_BADGE: Record<string, string> = {
  TRIAL: styles.subTrial,
  ACTIVE: styles.subActive,
  SUSPENDED: styles.subSuspended,
  CANCELLED: styles.subCancelled,
  EXPIRED: styles.subExpired,
  PAST_DUE: styles.subExpired,
};

const OrganisationDetail = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const [org, setOrg] = useState<OrganisationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  // Subscription
  const [subscription, setSubscription] = useState<OrgSubscriptionResponse | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    setLoading(true);
    organisationService.getOrganisationByUuid(uuid)
      .then(setOrg)
      .catch((e) => setError(e.message || 'Failed to load organisation'))
      .finally(() => setLoading(false));
  }, [uuid]);

  useEffect(() => {
    if (!uuid) return;
    setSubLoading(true);
    subscriptionService.getOrgSubscription(uuid)
      .then(setSubscription)
      .catch(() => setSubscription(null))
      .finally(() => setSubLoading(false));
  }, [uuid]);

  const handleToggleStatus = (currentOrg: OrganisationResponse) => {
    setPendingStatus(!currentOrg.isActive);
    setShowStatusConfirm(true);
  };

  const doToggle = async () => {
    if (!org || pendingStatus === null) return;
    setToggling(true);
    try {
      const statusId = pendingStatus ? 1 : 2;
      const updated = await organisationService.updateOrganisationStatus(org.uuid, statusId);
      setOrg({ ...org, isActive: updated.isActive, statusName: updated.statusName });
      toast.success(`Organisation is now ${updated.isActive ? 'Active' : 'Inactive'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update status');
    } finally {
      setToggling(false);
      setShowStatusConfirm(false);
      setPendingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Loading organisation...</div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <p>{error ?? 'Organisation not found.'}</p>
          <button className={styles.backBtn} onClick={() => navigate('/organisation')}>
            Go back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/organisation')}>
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Back
          </button>
          <div className={styles.headerInfo}>
            <div className={styles.orgIconLarge}>
              <Building2 style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>{org.name}</h1>
              <p className={styles.pageSubtitle}>/{org.email}</p>
            </div>
          </div>
        </div>
        {/* Status Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[#6B7280]">
            {org.isActive ? 'Active' : 'Inactive'}
          </span>
          <button
            className={`${styles.statusToggle} ${org.isActive ? styles.toggleOn : styles.toggleOff}`}
            onClick={() => handleToggleStatus(org)}
            disabled={toggling}
            title={org.isActive ? 'Click to deactivate' : 'Click to activate'}
          />
        </div>
      </div>

      {/* Details Grid */}
      <div className={styles.grid}>
        {/* Overview Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Overview</h3>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Organisation Name</span>
              <span className={styles.detailValue}>{org.name ?? '—'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Email</span>
              <span className={`${styles.detailValue} ${styles.emailValue}`}>{org.email ?? '—'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Domain</span>
              <span className={styles.detailValue}>
                {org.domain ? (
                  <>
                    <Globe style={{ display: 'inline', width: 13, height: 13, marginRight: 5, verticalAlign: 'middle' }} />
                    {org.domain}
                  </>
                ) : '—'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Created</span>
              <span className={styles.detailValue}>
                <Calendar style={{ display: 'inline', width: 13, height: 13, marginRight: 5, verticalAlign: 'middle' }} />
                {formatDate(org.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Plan Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Plan</h3>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.planDisplay}>
              <div className={styles.planIconWrapper}>
                <Crown style={{ width: 24, height: 24 }} />
              </div>
              <div>
                <div className={styles.planName}>{getPlanLabel(org.planType as string)}</div>
                <div className={styles.planSub}>Current subscription plan</div>
              </div>
              <span className={`${styles.planBadge} ${getPlanBadgeClass(org.planType as string)}`}>
                {getPlanLabel(org.planType as string)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>
            <CreditCard style={{ display: 'inline', width: 15, height: 15, marginRight: 8, verticalAlign: 'middle' }} />
            Subscription
          </h3>
          <button
            className={styles.manageSubBtn}
            onClick={() => setSubModalOpen(true)}
          >
            <Pencil style={{ width: 13, height: 13 }} />
            {subscription ? 'Manage Subscription' : 'Create Subscription'}
          </button>
        </div>
        <div className={styles.panelBody}>
          {subLoading ? (
            <div className={styles.subLoadingRow}>Loading subscription...</div>
          ) : subscription ? (
            <div className={styles.subGrid}>
              <div className={styles.subField}>
                <span className={styles.subLabel}>Status</span>
                <span className={`${styles.subStatusBadge} ${STATUS_BADGE[subscription.status?.name?.toUpperCase() ?? ''] ?? ''}`}>
                  {subscription.status?.name ?? '—'}
                </span>
              </div>
              <div className={styles.subField}>
                <span className={styles.subLabel}>Plan</span>
                <span className={styles.subValue}>{subscription.planName ?? '—'}</span>
              </div>
              <div className={styles.subField}>
                <span className={styles.subLabel}>Price</span>
                <span className={styles.subValue}>
                  {subscription.currency ?? 'INR'} {subscription.price != null ? Number(subscription.price).toLocaleString('en-IN') : '0'}
                </span>
              </div>
              <div className={styles.subField}>
                <span className={styles.subLabel}>Max Users</span>
                <span className={styles.subValue}>{subscription.maxUsers ?? '—'}</span>
              </div>
              <div className={styles.subField}>
                <span className={styles.subLabel}>Period Start</span>
                <span className={styles.subValue}>{formatDate(subscription.periodStart)}</span>
              </div>
              <div className={styles.subField}>
                <span className={styles.subLabel}>Period End</span>
                <span className={styles.subValue}>{formatDate(subscription.periodEnd)}</span>
              </div>
              {subscription.notes && (
                <div className={`${styles.subField} ${styles.subFieldFull}`}>
                  <span className={styles.subLabel}>Notes</span>
                  <span className={styles.subValue}>{subscription.notes}</span>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.subEmpty}>
              <CreditCard style={{ width: 32, height: 32, opacity: 0.25, marginBottom: 8 }} />
              <p>No subscription found for this organisation.</p>
              <button className={styles.subCreateBtn} onClick={() => setSubModalOpen(true)}>
                Create Subscription
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Confirmation Dialog */}
      <Dialog open={showStatusConfirm} onOpenChange={(open) => { if (!open) { setShowStatusConfirm(false); setPendingStatus(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-[#E7970E]/10 border border-[#E7970E]/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-[#E7970E]" />
              </div>
              <DialogTitle className="text-[#263B4F]">Confirm Status Change</DialogTitle>
            </div>
            <DialogDescription className="text-[#6B7280] pl-[52px]">
              {pendingStatus
                ? <>Activating <span className="text-[#263B4F] font-medium">{org.name}</span> will restore access for this organisation. Are you sure?</>
                : <>Deactivating <span className="text-[#263B4F] font-medium">{org.name}</span> may impact reporting and access. Are you sure?</>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => { setShowStatusConfirm(false); setPendingStatus(null); }}
              disabled={toggling}
            >
              Cancel
            </Button>
            <Button
              onClick={doToggle}
              disabled={toggling}
              className="bg-[#E7970E] hover:bg-[#d08a0d] text-white font-semibold min-w-28"
            >
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

      {/* Subscription Modal */}
      {uuid && (
        <SubscriptionModal
          open={subModalOpen}
          onOpenChange={setSubModalOpen}
          orgUuid={uuid}
          orgName={org.name}
          existing={subscription}
          onSuccess={(updated) => setSubscription(updated)}
        />
      )}
    </div>
  );
};

export default OrganisationDetail;
