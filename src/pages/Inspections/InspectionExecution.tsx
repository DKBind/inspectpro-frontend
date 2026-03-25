import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle,
  ChevronDown, Layers, MessageSquare, Zap, Send,
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type {
  InspectionWithResultsResponse,
  InspectionResultResponse,
  HipStatus,
} from '@/services/models/checklist';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/shared-ui/Dialog/dialog';
import { Button } from '@/components/shared-ui/Button/button';
import styles from './InspectionExecution.module.css';

// ─── HIP Button config ────────────────────────────────────────────────────────
const HIP_BUTTONS: { value: HipStatus; label: string; short: string; cls: string }[] = [
  { value: 'ACCEPTABLE',    label: 'Acceptable',    short: 'A',  cls: styles.hipBtnA  },
  { value: 'DEFECTIVE',     label: 'Defective',     short: 'D',  cls: styles.hipBtnD  },
  { value: 'MARGINAL',      label: 'Marginal',      short: 'M',  cls: styles.hipBtnM  },
  { value: 'NOT_INSPECTED', label: 'Not Inspected', short: 'NI', cls: styles.hipBtnNI },
];

const SEV_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type Severity = typeof SEV_OPTIONS[number];

// ─── Defect Record Modal ───────────────────────────────────────────────────────
interface DefectModalProps {
  open: boolean;
  itemLabel: string;
  onSave: (severity: Severity, notes: string) => void;
  onClose: () => void;
}

const DefectModal: React.FC<DefectModalProps> = ({ open, itemLabel, onSave, onClose }) => {
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) { setSeverity('MEDIUM'); setNotes(''); }
  }, [open]);

  const sevStyle: Record<Severity, string> = {
    LOW:      styles.sevLow,
    MEDIUM:   styles.sevMedium,
    HIGH:     styles.sevHigh,
    CRITICAL: styles.sevCritical,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <AlertTriangle size={18} /> Record Defect
          </DialogTitle>
          <DialogDescription>
            <strong>{itemLabel}</strong> — set severity and add repair notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Severity */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Severity
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              {SEV_OPTIONS.map((s) => (
                <button
                  key={s} type="button"
                  className={`${styles.defectBadge} ${sevStyle[s]}`}
                  style={{
                    cursor: 'pointer', transition: 'opacity 0.15s',
                    opacity: severity === s ? 1 : 0.45,
                    transform: severity === s ? 'scale(1.05)' : 'scale(1)',
                    outline: severity === s ? '2px solid currentColor' : 'none',
                    outlineOffset: 2,
                  }}
                  onClick={() => setSeverity(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Repair notes */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Repair Recommendations
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe required repair or further action…"
              rows={3}
              className={styles.commentArea}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave(severity, notes)}
            style={{ background: '#dc2626' }}
          >
            <AlertTriangle size={13} style={{ marginRight: 5 }} />
            Save Defect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Local state for a result row ─────────────────────────────────────────────
interface LocalResult extends InspectionResultResponse {
  _dirty: boolean;
  _saving: boolean;
}

function toLocal(r: InspectionResultResponse): LocalResult {
  return { ...r, _dirty: false, _saving: false };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InspectionExecution() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const navigate = useNavigate();

  const [inspection, setInspection] = useState<InspectionWithResultsResponse | null>(null);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Defect modal state
  const [defectTarget, setDefectTarget] = useState<LocalResult | null>(null);

  const load = useCallback(async () => {
    if (!inspectionId) return;
    setLoading(true);
    try {
      const data = await checklistService.getInspectionWithResults(inspectionId);
      setInspection(data);
      setResults(data.results.map(toLocal));
      // Open all sections by default
      const secs = new Set(data.results.map((r) => r.sectionName));
      setOpenSections(secs);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to load inspection');
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => { load(); }, [load]);

  // ── Group results by section ─────────────────────────────────────────────────
  const grouped = results.reduce<Record<string, LocalResult[]>>((acc, r) => {
    const k = r.sectionName || 'Uncategorised';
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  // ── Status tally ─────────────────────────────────────────────────────────────
  const tally = results.reduce<Record<HipStatus, number>>(
    (acc, r) => {
      if (r.responseValue) acc[r.responseValue]++;
      return acc;
    },
    { ACCEPTABLE: 0, DEFECTIVE: 0, MARGINAL: 0, NOT_INSPECTED: 0 }
  );
  const answered = results.filter((r) => !!r.responseValue).length;
  const pct = results.length > 0 ? Math.round((answered / results.length) * 100) : 0;

  // ── Set HIP status ────────────────────────────────────────────────────────────
  const setStatus = (resultId: number, status: HipStatus) => {
    setResults((prev) =>
      prev.map((r) => r.id === resultId ? { ...r, responseValue: status, _dirty: true } : r)
    );
    // Auto-save
    saveResult(resultId, status);
    // Open defect modal when DEFECTIVE
    if (status === 'DEFECTIVE') {
      const target = results.find((r) => r.id === resultId);
      if (target) setDefectTarget({ ...target, responseValue: status });
    }
  };

  const saveResult = async (resultId: number, status: HipStatus, comments?: string) => {
    setResults((prev) => prev.map((r) => r.id === resultId ? { ...r, _saving: true } : r));
    try {
      await checklistService.updateInspectionResult(resultId, { responseValue: status, comments });
      setResults((prev) =>
        prev.map((r) => r.id === resultId ? { ...r, _dirty: false, _saving: false } : r)
      );
    } catch {
      setResults((prev) => prev.map((r) => r.id === resultId ? { ...r, _saving: false } : r));
    }
  };

  const updateComment = (resultId: number, comments: string) => {
    setResults((prev) =>
      prev.map((r) => r.id === resultId ? { ...r, comments, _dirty: true } : r)
    );
  };

  const handleDefectSave = async (severity: Severity, notes: string) => {
    if (!defectTarget) return;
    setResults((prev) =>
      prev.map((r) =>
        r.id === defectTarget.id
          ? { ...r, severity, defectStatus: 'OPEN', _dirty: false }
          : r
      )
    );
    try {
      await checklistService.updateInspectionResult(defectTarget.id, {
        responseValue: 'DEFECTIVE',
        comments: notes,
      });
      toast.success('Defect recorded');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to save defect');
    }
    setDefectTarget(null);
  };

  const toggleSection = (name: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const handleSubmit = async () => {
    const pending = results.filter((r) => !r.responseValue).length;
    if (pending > 0) {
      toast.error(`${pending} item(s) still need a status before submitting.`);
      return;
    }
    setSubmitting(true);
    try {
      // Legacy submit endpoint
      await checklistService.submitInspection(inspectionId!, {
        projectId: inspection!.projectId,
        templateId: inspection!.templateId,
        answers: [],
      });
      toast.success('Inspection submitted!');
      navigate(-1);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const sevCls: Record<string, string> = {
    LOW: styles.sevLow, MEDIUM: styles.sevMedium,
    HIGH: styles.sevHigh, CRITICAL: styles.sevCritical,
  };

  if (loading) {
    return (
      <div className={styles.empty}>
        <RefreshCw className={styles.spinner} size={26} />
        <p style={{ fontSize: 13, color: '#9CA3AF' }}>Loading inspection…</p>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className={styles.empty}>
        <AlertTriangle size={26} style={{ color: '#D1D5DB', marginBottom: 12 }} />
        <p style={{ fontSize: 14, color: '#6B7280' }}>Inspection not found.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{inspection.templateTitle ?? 'Inspection'}</h1>
          <p className={styles.subtitle}>
            Project: <strong>{inspection.projectName ?? inspection.projectId}</strong>
            {' · '}Status: <strong>{inspection.status}</strong>
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit Inspection'}
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className={styles.progressWrap}>
        <span className={styles.progressLabel}>{answered}/{results.length} answered</span>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressPct}>{pct}%</span>
        <div className={styles.counters}>
          {tally.ACCEPTABLE > 0 && (
            <span className={`${styles.counter} ${styles.ctrAcceptable}`}>
              <CheckCircle2 size={12} />{tally.ACCEPTABLE} A
            </span>
          )}
          {tally.DEFECTIVE > 0 && (
            <span className={`${styles.counter} ${styles.ctrDefective}`}>
              <AlertTriangle size={12} />{tally.DEFECTIVE} D
            </span>
          )}
          {tally.MARGINAL > 0 && (
            <span className={`${styles.counter} ${styles.ctrMarginal}`}>
              <Zap size={12} />{tally.MARGINAL} M
            </span>
          )}
          {tally.NOT_INSPECTED > 0 && (
            <span className={`${styles.counter} ${styles.ctrNi}`}>
              {tally.NOT_INSPECTED} NI
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      {Object.entries(grouped).map(([sectionName, sectionResults]) => {
        const isOpen = openSections.has(sectionName);
        const sectionAnswered = sectionResults.filter((r) => !!r.responseValue).length;

        return (
          <div key={sectionName} className={styles.sectionCard}>
            <div className={styles.sectionHead} onClick={() => toggleSection(sectionName)}>
              <div className={styles.sectionHeadIcon}><Layers size={15} /></div>
              <span className={styles.sectionTitle}>{sectionName}</span>
              <span className={styles.sectionMeta}>
                {sectionAnswered}/{sectionResults.length}
              </span>
              <ChevronDown
                size={16}
                className={`${styles.sectionChevron} ${isOpen ? styles.sectionChevronOpen : ''}`}
              />
            </div>

            {isOpen && sectionResults.map((result) => (
              <div key={result.id} className={styles.resultRow}>
                <div className={styles.resultLabel}>
                  <p className={styles.itemLabel}>{result.itemLabel}</p>
                  <div className={styles.itemMeta}>
                    {result.isCustom && (
                      <span className={styles.customChip}>Custom</span>
                    )}
                    {result.defectId && result.severity && (
                      <span className={`${styles.defectBadge} ${sevCls[result.severity] ?? styles.sevMedium}`}>
                        <AlertTriangle size={9} />{result.severity}
                      </span>
                    )}
                  </div>

                  {/* Comment */}
                  {result.responseValue && (
                    <textarea
                      rows={2}
                      className={styles.commentArea}
                      placeholder="Add comments…"
                      value={result.comments ?? ''}
                      onChange={(e) => updateComment(result.id, e.target.value)}
                      onBlur={() => result.responseValue && saveResult(result.id, result.responseValue, result.comments)}
                    />
                  )}

                  {/* Defect inline when DEFECTIVE */}
                  {result.responseValue === 'DEFECTIVE' && (
                    <div className={styles.defectInline}>
                      <MessageSquare size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Defective — </span>
                      {result.severity ? (
                        <span className={`${styles.defectBadge} ${sevCls[result.severity] ?? styles.sevMedium}`}>
                          {result.severity}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.recordDefectBtn}
                          onClick={() => setDefectTarget(result)}
                        >
                          <AlertTriangle size={12} /> Record Defect Details
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* HIP Buttons */}
                <div className={styles.hipButtons}>
                  {HIP_BUTTONS.map((btn) => (
                    <button
                      key={btn.value}
                      type="button"
                      className={`${styles.hipBtn} ${btn.cls} ${result.responseValue === btn.value ? styles.active : ''}`}
                      title={btn.label}
                      onClick={() => setStatus(result.id, btn.value)}
                    >
                      {btn.short}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Defect Modal */}
      <DefectModal
        open={!!defectTarget}
        itemLabel={defectTarget?.itemLabel ?? ''}
        onSave={handleDefectSave}
        onClose={() => setDefectTarget(null)}
      />
    </div>
  );
}
