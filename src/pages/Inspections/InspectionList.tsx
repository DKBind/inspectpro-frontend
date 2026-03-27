import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, RefreshCw, AlertTriangle, MapPin,
  User, Building2, FileText, Rocket, CheckCircle2,
  ChevronRight, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { checklistService } from '@/services/checklistService';
import type { InspectionListItem } from '@/services/models/checklist';
import styles from './InspectionList.module.css';

type Filter = 'all' | 'pending' | 'completed';

export default function InspectionList() {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<InspectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    (async () => {
      try {
        const data = await checklistService.listAllInspections();
        setInspections(data);
      } catch (e: unknown) {
        toast.error((e as Error).message || 'Failed to load inspections');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = inspections.filter((i) => {
    if (filter === 'pending') return i.status === 'DRAFT';
    if (filter === 'completed') return i.status === 'COMPLETED' || i.status === 'SUBMITTED';
    return true;
  });

  const pendingCount = inspections.filter((i) => i.status === 'DRAFT').length;
  const completedCount = inspections.filter(
    (i) => i.status === 'COMPLETED' || i.status === 'SUBMITTED'
  ).length;

  const handleStart = (item: InspectionListItem) => {
    navigate(`/inspections/${item.id}`);
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <RefreshCw className={styles.spinner} size={28} />
        <p>Loading inspections…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.pageIcon}>
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>Inspections</h1>
            <p className={styles.pageSubtitle}>
              {inspections.length} total · {pendingCount} pending · {completedCount} completed
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs ───────────────────────────────────────────────── */}
      <div className={styles.filterRow}>
        {(['all', 'pending', 'completed'] as Filter[]).map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `All (${inspections.length})` : f === 'pending' ? `Pending (${pendingCount})` : `Completed (${completedCount})`}
          </button>
        ))}
      </div>

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          <ClipboardCheck size={40} style={{ color: '#D1D5DB', marginBottom: 14 }} />
          <p className={styles.emptyTitle}>
            {filter === 'all' ? 'No inspections assigned yet' : `No ${filter} inspections`}
          </p>
          <p className={styles.emptyDesc}>
            {filter === 'all'
              ? 'Once an organisation assigns a template to a project, it will appear here.'
              : `Switch to "All" to see every inspection.`}
          </p>
        </div>
      )}

      {/* ── Inspection Cards ──────────────────────────────────────────── */}
      <div className={styles.grid}>
        {filtered.map((item) => {
          const pct = item.totalResults > 0
            ? Math.round((item.answeredResults / item.totalResults) * 100)
            : 0;
          const isComplete = item.status === 'COMPLETED' || item.status === 'SUBMITTED';
          const isDraft = item.status === 'DRAFT';

          return (
            <div key={item.id} className={`${styles.card} ${isComplete ? styles.cardComplete : ''}`}>
              {/* Status badge */}
              <div className={styles.cardTop}>
                <span className={`${styles.statusBadge} ${isComplete ? styles.statusComplete : styles.statusPending}`}>
                  {isComplete
                    ? <><CheckCircle2 size={11} /> Completed</>
                    : <><Clock size={11} /> Pending</>}
                </span>
                {item.createdAt && (
                  <span className={styles.cardDate}>
                    {new Date(item.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              {/* Project name */}
              <div className={styles.projectName}>{item.projectName}</div>

              {/* Address */}
              {item.address && (
                <div className={styles.addressRow}>
                  <MapPin size={13} className={styles.metaIcon} />
                  <span>{item.address}</span>
                </div>
              )}

              <div className={styles.divider} />

              {/* Meta grid: client, org, template */}
              <div className={styles.metaGrid}>
                {item.clientName && (
                  <div className={styles.metaRow}>
                    <User size={13} className={styles.metaIcon} />
                    <div>
                      <span className={styles.metaLabel}>Client</span>
                      <span className={styles.metaValue}>{item.clientName}</span>
                      {item.clientEmail && (
                        <span className={styles.metaSecondary}>{item.clientEmail}</span>
                      )}
                    </div>
                  </div>
                )}

                {item.organisationName && (
                  <div className={styles.metaRow}>
                    <Building2 size={13} className={styles.metaIcon} />
                    <div>
                      <span className={styles.metaLabel}>Organisation</span>
                      <span className={styles.metaValue}>{item.organisationName}</span>
                    </div>
                  </div>
                )}

                {item.templateTitle && (
                  <div className={styles.metaRow}>
                    <FileText size={13} className={styles.metaIcon} />
                    <div>
                      <span className={styles.metaLabel}>Template</span>
                      <span className={styles.metaValue}>{item.templateTitle}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.divider} />

              {/* Progress bar */}
              <div className={styles.progressWrap}>
                <div className={styles.progressInfo}>
                  <span className={styles.progressLabel}>
                    {item.answeredResults}/{item.totalResults} items answered
                  </span>
                  <span className={styles.progressPct}>{pct}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${pct}%`,
                      background: isComplete
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : pct > 0
                        ? 'linear-gradient(90deg, #33AE95, #2a9a84)'
                        : undefined,
                    }}
                  />
                </div>
              </div>

              {/* Action button */}
              <div className={styles.cardFooter}>
                {isComplete ? (
                  <button
                    className={styles.viewBtn}
                    onClick={() => handleStart(item)}
                  >
                    <ChevronRight size={14} /> View Results
                  </button>
                ) : isDraft && item.totalResults === 0 ? (
                  <button className={styles.startBtn} disabled>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Preparing…
                  </button>
                ) : (
                  <button
                    className={styles.startBtn}
                    onClick={() => handleStart(item)}
                  >
                    <Rocket size={14} />
                    {pct > 0 ? 'Continue Inspection' : 'Start Inspection'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
