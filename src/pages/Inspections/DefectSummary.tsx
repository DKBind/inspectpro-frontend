import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2,
  Layers, FileText, AlertOctagon, Printer,
} from 'lucide-react';
import { toast } from 'sonner';

import { checklistService } from '@/services/checklistService';
import type { DefectSummaryResponse, DefectItem } from '@/services/models/checklist';

// ─── Severity meta ────────────────────────────────────────────────────────────
const SEV_META: Record<string, { bg: string; color: string; border: string }> = {
  LOW:      { bg: 'rgba(34,197,94,0.08)',   color: '#16a34a', border: 'rgba(34,197,94,0.25)'  },
  MEDIUM:   { bg: 'rgba(245,158,11,0.08)',  color: '#b45309', border: 'rgba(245,158,11,0.3)'  },
  HIGH:     { bg: 'rgba(239,68,68,0.08)',   color: '#dc2626', border: 'rgba(239,68,68,0.28)'  },
  CRITICAL: { bg: 'rgba(127,29,29,0.12)',   color: '#991b1b', border: 'rgba(239,68,68,0.5)'   },
};

const STATUS_META: Record<string, { bg: string; color: string }> = {
  OPEN:        { bg: 'rgba(239,68,68,0.08)',   color: '#dc2626' },
  IN_PROGRESS: { bg: 'rgba(245,158,11,0.08)',  color: '#b45309' },
  RESOLVED:    { bg: 'rgba(34,197,94,0.08)',   color: '#16a34a' },
  VERIFIED:    { bg: 'rgba(59,130,246,0.08)',  color: '#2563EB' },
};

function SevBadge({ sev }: { sev?: string }) {
  if (!sev) return null;
  const m = SEV_META[sev] ?? SEV_META.MEDIUM;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {sev}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const m = STATUS_META[status] ?? STATUS_META.OPEN;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20,
      background: m.bg, color: m.color,
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {status?.replace('_', ' ')}
    </span>
  );
}

function DefectCard({ defect }: { defect: DefectItem }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 20px',
      borderBottom: '1px solid #F9FAFB', alignItems: 'flex-start',
    }}>
      {/* Left icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: 'rgba(239,68,68,0.08)', color: '#dc2626',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={15} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: '#263B4F', margin: 0 }}>
            {defect.itemLabel}
          </p>
          {defect.isCustom && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
              background: '#EEF2FF', color: '#4338ca',
            }}>CUSTOM</span>
          )}
          <SevBadge sev={defect.severity} />
          <StatusBadge status={defect.defectStatus} />
        </div>

        {defect.resolutionNotes && (
          <div style={{
            display: 'flex', gap: 7, alignItems: 'flex-start',
            padding: '8px 12px', borderRadius: 8,
            background: '#FAFAFA', border: '1px solid #F0F0F0', marginTop: 6,
          }}>
            <FileText size={12} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12.5, color: '#374151', margin: 0, lineHeight: 1.5 }}>
              {defect.resolutionNotes}
            </p>
          </div>
        )}

        {defect.comments && (
          <p style={{ fontSize: 12, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.5 }}>
            <em>Inspector note:</em> {defect.comments}
          </p>
        )}

        {defect.photoUrl && (
          <img
            src={defect.photoUrl}
            alt="Defect photo"
            style={{ marginTop: 8, maxWidth: 220, borderRadius: 8, border: '1px solid #E5E7EB' }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, color: '#9CA3AF' }}>
        <RefreshCw size={26} style={{ color: '#33AE95', marginBottom: 12, animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13 }}>Loading defect summary…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, color: '#9CA3AF' }}>
        <AlertOctagon size={26} style={{ marginBottom: 12, color: '#D1D5DB' }} />
        <p style={{ fontSize: 14, color: '#6B7280' }}>No report available.</p>
      </div>
    );
  }

  const sectionEntries = Object.entries(report.sections);
  const criticalCount = sectionEntries
    .flatMap(([, items]) => items)
    .filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#263B4F', margin: '0 0 4px' }}>
            Defect Summary Report
          </h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            {report.projectName} — auto-generated from all DEFECTIVE inspection results
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 9,
              border: '1px solid #E5E7EB', background: 'white',
              fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: '#33AE95', color: 'white',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(51,174,149,0.3)',
            }}
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          {
            label: 'Total Defects',
            value: report.totalDefects,
            bg: 'rgba(239,68,68,0.06)',
            border: 'rgba(239,68,68,0.2)',
            color: '#dc2626',
            icon: <AlertTriangle size={18} />,
          },
          {
            label: 'Sections Affected',
            value: sectionEntries.length,
            bg: 'rgba(245,158,11,0.06)',
            border: 'rgba(245,158,11,0.2)',
            color: '#b45309',
            icon: <Layers size={18} />,
          },
          {
            label: 'High / Critical',
            value: criticalCount,
            bg: 'rgba(127,29,29,0.06)',
            border: 'rgba(239,68,68,0.3)',
            color: '#991b1b',
            icon: <AlertOctagon size={18} />,
          },
          {
            label: 'Items Inspected',
            value: '—',
            bg: 'rgba(51,174,149,0.06)',
            border: 'rgba(51,174,149,0.2)',
            color: '#33AE95',
            icon: <CheckCircle2 size={18} />,
          },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: 1, minWidth: 150,
            padding: '14px 18px', borderRadius: 14,
            background: stat.bg, border: `1px solid ${stat.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: stat.color }}>
              {stat.icon}
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {stat.label}
              </span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: stat.color, margin: 0 }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* No defects */}
      {report.totalDefects === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '70px 24px', background: 'white', borderRadius: 14,
          border: '1px solid #E5E7EB', color: '#9CA3AF',
        }}>
          <CheckCircle2 size={42} style={{ color: '#22c55e', marginBottom: 14 }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>
            No defects recorded
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            All inspection items for this project passed without defects.
          </p>
        </div>
      ) : (
        /* Section cards */
        sectionEntries.map(([sectionName, defects]) => (
          <div key={sectionName} style={{
            background: 'white', border: '1px solid #E5E7EB', borderRadius: 14,
            overflow: 'hidden', marginBottom: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '13px 20px', background: '#FAFAFA',
              borderBottom: '1px solid #F0F0F0',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'rgba(239,68,68,0.1)', color: '#dc2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Layers size={15} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#263B4F', flex: 1 }}>
                {sectionName}
              </span>
              <span style={{
                fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(239,68,68,0.08)', color: '#dc2626',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                {defects.length} defect{defects.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Defect rows */}
            {defects.map((d, i) => (
              <React.Fragment key={d.resultId ?? i}>
                <DefectCard defect={d} />
              </React.Fragment>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
