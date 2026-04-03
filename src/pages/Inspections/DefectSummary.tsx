import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2,
  Layers, FileText, AlertOctagon, Printer, Calendar,
  ClipboardList, Info
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type { DefectSummaryResponse, DefectItem } from '@/services/models/checklist';
import styles from './DefectSummary.module.css';

// ─── Severity meta ────────────────────────────────────────────────────────────
const SEV_META: Record<string, { bg: string; color: string; border: string }> = {
  LOW: { bg: '#F0FDF4', color: '#16A34A', border: '#DCFCE7' },
  MEDIUM: { bg: '#FFFBEB', color: '#B45309', border: '#FEF3C7' },
  HIGH: { bg: '#FEF2F2', color: '#DC2626', border: '#FEE2E2' },
  CRITICAL: { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5' },
};

const STATUS_META: Record<string, { bg: string; color: string; border: string }> = {
  OPEN: { bg: '#FEF2F2', color: '#EF4444', border: '#FEE2E2' },
  IN_PROGRESS: { bg: '#EFF6FF', color: '#2563EB', border: '#DBEAFE' },
  RESOLVED: { bg: '#F0FDF4', color: '#16A34A', border: '#DCFCE7' },
  VERIFIED: { bg: '#F5F3FF', color: '#7C3AED', border: '#EDE9FE' },
};

function Badge({ label, type, value }: { label: string; type: 'sev' | 'status'; value: string }) {
  const meta = type === 'sev'
    ? (SEV_META[value] ?? SEV_META.MEDIUM)
    : (STATUS_META[value] ?? STATUS_META.OPEN);

  return (
    <span className={styles.badge} style={{
      background: meta.bg,
      color: meta.color,
      border: `1px solid ${meta.border}`
    }}>
      {label}
    </span>
  );
}

function DefectCard({ defect }: { defect: DefectItem }) {
  return (
    <div className={styles.defectItem}>
      <div className={styles.defectTypeIcon}>
        <AlertTriangle size={18} />
      </div>

      <div className={styles.defectBody}>
        <div className={styles.defectHeader}>
          <h4 className={styles.defectLabel}>{defect.itemLabel}</h4>
          {defect.isCustom && <span className={styles.customBadge}>Custom</span>}
          <Badge label={defect.severity || 'Medium'} type="sev" value={defect.severity || 'MEDIUM'} />
          <Badge label={(defect.defectStatus || 'Open').replace('_', ' ')} type="status" value={defect.defectStatus || 'OPEN'} />
        </div>

        {defect.resolutionNotes && (
          <div className={styles.noteBlock}>
            <Info size={14} style={{ color: '#94A3B8', flexShrink: 0, marginTop: 2 }} />
            <p className={styles.noteText}>{defect.resolutionNotes}</p>
          </div>
        )}

        {defect.comments && (
          <div className={styles.inspectorNote}>
            <FileText size={12} />
            <span>Inspector note: {defect.comments}</span>
          </div>
        )}

        {defect.photoUrl && (
          <img
            src={defect.photoUrl}
            alt="Defect"
            className={styles.defectImage}
            onClick={() => window.open(defect.photoUrl, '_blank')}
          />
        )}
      </div>
    </div>
  );
}

export default function DefectSummary() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<DefectSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await checklistService.getDefectSummary(projectId);
      setReport(data);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to load defect summary');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <RefreshCw size={32} className={styles.spinner} />
        <p>Generating defect report…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={styles.loading}>
        <AlertOctagon size={40} style={{ color: '#CBD5E1', marginBottom: 16 }} />
        <p>No report found for this project.</p>
        <button className={styles.backBtn} onClick={() => navigate(-1)} style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Go Back
        </button>
      </div>
    );
  }

  const sectionEntries = Object.entries(report.sections);
  const criticalCount = sectionEntries
    .flatMap(([, items]) => items)
    .filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH').length;

  return (
    <div className={styles.page}>
      {/* ── Hero Section ────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <h1 className={styles.heroTitle}>Defect Summary Report</h1>
            <p className={styles.heroProject}>
              <ClipboardList size={14} /> {report.projectName}
            </p>
          </div>
          <div className={styles.heroActions}>
            <button className={styles.backBtn} onClick={() => navigate(-1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button className={styles.printBtn} onClick={() => window.print()}>
              <Printer size={14} /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        {[
          {
            label: 'Total Defects',
            value: report.totalDefects,
            icon: <AlertTriangle size={18} />,
            color: '#EF4444',
            bg: '#FEF2F2'
          },
          {
            label: 'Affected Areas',
            value: sectionEntries.length,
            icon: <Layers size={18} />,
            color: '#F59E0B',
            bg: '#FFFBEB'
          },
          {
            label: 'High Priority',
            value: criticalCount,
            icon: <AlertOctagon size={18} />,
            color: '#991B1B',
            bg: '#FEF2F2'
          },
          {
            label: 'Generation Date',
            value: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
            icon: <Calendar size={18} />,
            color: '#1a7bbd',
            bg: '#F0FDF9'
          }
        ].map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statIcon} style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
            <p className={styles.statValue}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      {report.totalDefects === 0 ? (
        <div className={styles.sectionCard} style={{ textAlign: 'center', padding: '60px 20px' }}>
          <CheckCircle2 size={48} style={{ color: '#22C55E', marginBottom: 16 }} />
          <h3 className={styles.heroTitle}>All Clear</h3>
          <p className={styles.heroProject}>No defects were recorded during this inspection.</p>
        </div>
      ) : (
        sectionEntries.map(([name, defects]) => (
          <div key={name} className={styles.sectionCard}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionIcon}>
                <Layers size={16} />
              </div>
              <h3 className={styles.sectionTitle}>{name}</h3>
              <span className={styles.defectCount}>
                {defects.length} {defects.length === 1 ? 'Defect' : 'Defects'}
              </span>
            </div>
            <div className={styles.sectionBody}>
              {defects.map((d, i) => (
                <DefectCard key={d.resultId ?? i} defect={d} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
