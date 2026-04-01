import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, MapPin,
  User, Calendar, Rocket,
  ChevronRight, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { checklistService } from '@/services/checklistService';
import type { InspectionListItem } from '@/services/models/checklist';
import styles from './InspectionList.module.css';
import Pagination from '@/components/shared-ui/Pagination/Pagination';

type Filter = 'all' | 'pending' | 'completed';

export default function InspectionList() {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<InspectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

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

  const filtered = useMemo(() => {
    return inspections.filter((i) => {
      if (filter === 'pending') return i.status === 'DRAFT';
      if (filter === 'completed') return i.status === 'COMPLETED' || i.status === 'SUBMITTED';
      return true;
    });
  }, [inspections, filter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const paginatedInspections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

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
      {/* ── Tab Bar ───────────────────────────────────────────────────── */}
      <div className={styles.tabBar}>
        {(['all', 'pending', 'completed'] as Filter[]).map((f) => (
          <button
            key={f}
            className={`${styles.tab} ${filter === f ? styles.tabActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Completed'}
            <span className={styles.tabCount}>
              {f === 'all' ? inspections.length : f === 'pending' ? pendingCount : completedCount}
            </span>
          </button>
        ))}
      </div>

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>
            {filter === 'all' ? 'No inspections assigned yet' : `No ${filter} inspections`}
          </p>
          <p className={styles.emptyDesc}>
            {filter === 'all'
              ? 'Once a project has an assigned template, inspections will appear here.'
              : `Switch to "All" to see every inspection.`}
          </p>
        </div>
      )}

      {/* ── Inspection Cards ──────────────────────────────────────────── */}
      <div className={styles.grid}>
        {paginatedInspections.map((item) => {
          const pct =
            item.totalResults > 0
              ? Math.round((item.answeredResults / item.totalResults) * 100)
              : 0;
          const isComplete = item.status === 'COMPLETED' || item.status === 'SUBMITTED';
          const isDraft = item.status === 'DRAFT';
          const isInProgress = isDraft && pct > 0;
          const badgeClass = isComplete
            ? styles.statusComplete
            : isInProgress
            ? styles.statusInProgress
            : styles.statusNotStarted;
          const badgeLabel = isComplete ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started';

          return (
            <div key={item.id} className={styles.card}>
              <div className={styles.cardStrip} />

              <div className={styles.cardContent}>
                {/* Project name + status badge */}
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{item.projectName}</h3>
                  <span className={`${styles.statusBadge} ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                </div>

                {/* Address */}
                {item.address && (
                  <div className={styles.addressRow}>
                    <MapPin size={11} style={{ flexShrink: 0 }} />
                    <span>{item.address}</span>
                  </div>
                )}

                {/* Organisation */}
                {item.organisationName && (
                  <div className={styles.addressRow}>
                    <Building2 size={11} style={{ flexShrink: 0, color: '#33AE95' }} />
                    <span>{item.organisationName}</span>
                  </div>
                )}

                {/* Client + Date */}
                <div className={styles.cardMeta}>
                  {item.clientName && (
                    <div className={styles.infoRow}>
                      <User size={11} style={{ color: '#33AE95', flexShrink: 0 }} />
                      <span>{item.clientName}</span>
                    </div>
                  )}
                  {item.createdAt && (
                    <div className={styles.infoRow}>
                      <Calendar size={11} style={{ color: '#94A3B8', flexShrink: 0 }} />
                      <span>
                        {new Date(item.createdAt).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className={styles.progressWrap}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #33AE95, #2a9a84)' }}
                    />
                  </div>
                  <span className={styles.progressPct}>{pct}%</span>
                </div>

                {/* Action button */}
                <div className={styles.cardFooter}>
                  {isComplete ? (
                    <button className={styles.viewResultsBtn} onClick={() => handleStart(item)}>
                      View Results <ChevronRight size={14} />
                    </button>
                  ) : isDraft && item.totalResults === 0 ? (
                    <button className={styles.startBtn} disabled>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      Preparing…
                    </button>
                  ) : (
                    <button className={styles.startBtn} onClick={() => handleStart(item)}>
                      <Rocket size={14} />
                      {pct > 0 ? 'Continue' : 'Start'} Inspection
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className={styles.paginationRow}>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filtered.length / pageSize)}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setCurrentPage(1);
            }}
            pageSizeOptions={[6, 12, 24]}
          />
        </div>
      )}
    </div>
  );
}
