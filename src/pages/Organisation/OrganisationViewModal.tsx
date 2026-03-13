import {
  Building2, Mail, Phone, User, Globe, Crown, MapPin,
  FileText, Calendar, X, CheckCircle2, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { OrganisationResponse } from '@/services/models/organisation';

interface Props {
  org: OrganisationResponse | null;
  onClose: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free', STARTER: 'Starter', PRO: 'Professional', ENTERPRISE: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  FREE: 'text-slate-400 bg-slate-800/60 border-slate-700',
  STARTER: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40',
  PRO: 'text-blue-400 bg-blue-900/20 border-blue-800/40',
  ENTERPRISE: 'text-purple-400 bg-purple-900/20 border-purple-800/40',
};

export function OrganisationViewModal({ org, onClose }: Props) {
  if (!org) return null;

  const hasAddress = org.address && Object.values(org.address).some((v) => v && v !== '');
  const hasBusinessIds = org.gstin || org.pan || org.tan;

  const addressLines = org.address
    ? [
      org.address.addressLine1,
      org.address.addressLine2,
      org.address.street,
      [org.address.district, org.address.state].filter(Boolean).join(', '),
      [org.address.country, org.address.pincode].filter(Boolean).join(' - '),
    ].filter(Boolean)
    : [];

  return (
    <Dialog open={!!org} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto !bg-[#0d1117] !border-slate-800 text-white shadow-2xl rounded-2xl p-0 gap-0 [&>button]:hidden ">
        {/* Header */}
        <div className="relative px-7 pt-7 pb-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-[#0d1117]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X size={15} />
          </button>

          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Building2 size={22} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1 pr-10">
              <h2 className="text-xl font-bold text-white truncate">{org.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${PLAN_COLORS[org.planType] ?? PLAN_COLORS.FREE
                    }`}
                >
                  <Crown size={11} />
                  {PLAN_LABELS[org.planType] ?? org.planType}
                </span>
                {org.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-900/20 border border-emerald-800/40 text-emerald-400">
                    <CheckCircle2 size={11} /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-900/20 border border-red-800/40 text-red-400">
                    <XCircle size={11} /> Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6">

          {/* Contact Info */}
          <ViewSection title="Contact Information">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow icon={<Mail size={14} />} label="Email" value={org.email} />
              <InfoRow icon={<Phone size={14} />} label="Phone" value={org.phoneNumber} alwaysShow />
              <InfoRow icon={<User size={14} />} label="Contact Person" value={org.contactedPersonName} alwaysShow />
              {org.domain && (
                <InfoRow icon={<Globe size={14} />} label="Domain" value={org.domain} />
              )}
            </div>
          </ViewSection>

          {/* Business Identifiers */}
          {hasBusinessIds && (
            <ViewSection title="Business Identifiers">
              <div className="grid gap-3 sm:grid-cols-3">
                {org.gstin && <InfoRow icon={<FileText size={14} />} label="GSTIN" value={org.gstin} mono />}
                {org.pan && <InfoRow icon={<FileText size={14} />} label="PAN" value={org.pan} mono />}
                {org.tan && <InfoRow icon={<FileText size={14} />} label="TAN" value={org.tan} mono />}
              </div>
            </ViewSection>
          )}

          {/* Address */}
          {hasAddress && (
            <ViewSection title="Registered Address">
              <div className="flex items-start gap-3 bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                <MapPin size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  {addressLines.map((line, i) => (
                    <p key={i} className={`text-sm ${i === 0 ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </ViewSection>
          )}

          {/* Meta */}
          <ViewSection title="Details">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow
                icon={<Calendar size={14} />}
                label="Created On"
                value={org.createdAt ? new Date(org.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                }) : undefined}
              />
              {org.statusName && (
                <InfoRow
                  icon={<CheckCircle2 size={14} />}
                  label="Status"
                  value={
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        backgroundColor: org.statusColourCode ? `${org.statusColourCode}22` : undefined,
                        color: org.statusColourCode ?? '#94a3b8',
                        border: `1px solid ${org.statusColourCode ? `${org.statusColourCode}44` : '#334155'}`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: org.statusColourCode ?? '#94a3b8' }}
                      />
                      {org.statusName}
                    </span>
                  }
                />
              )}
            </div>
          </ViewSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({
  icon, label, value, mono, alwaysShow,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  alwaysShow?: boolean;
}) {
  if (!value && !alwaysShow) return null;
  return (
    <div className="flex items-start gap-2.5 bg-slate-900/40 border border-slate-800/60 rounded-lg px-3 py-2.5">
      <span className="text-slate-500 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        {!value ? (
          <p className="text-sm text-slate-600">—</p>
        ) : typeof value === 'string' ? (
          <p className={`text-sm text-slate-200 font-medium truncate ${mono ? 'font-mono tracking-wide' : ''}`}>
            {value}
          </p>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
