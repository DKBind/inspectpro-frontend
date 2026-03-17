import {
  Building2, Mail, Phone, User, Globe, Crown, MapPin,
  FileText, Calendar, X, CheckCircle2, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/shared-ui/Dialog/dialog';
import type { OrganisationResponse } from '@/services/models/organisation';

interface Props {
  org: OrganisationResponse | null;
  onClose: () => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function planBadgeStyle(planName?: string): string {
  const p = (planName ?? '').toUpperCase();
  if (p.includes('FREE')) return 'text-[#6B7280] bg-[#F3F4F6] border-[#E5E7EB]';
  if (p.includes('STARTER') || p.includes('BASIC')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (p.includes('PRO') || p.includes('PROFESSIONAL')) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (p.includes('ENTERPRISE') || p.includes('PREMIUM')) return 'text-purple-600 bg-purple-50 border-purple-200';
  const palettes = [
    'text-amber-600 bg-amber-50 border-amber-200',
    'text-cyan-600 bg-cyan-50 border-cyan-200',
    'text-rose-600 bg-rose-50 border-rose-200',
    'text-indigo-600 bg-indigo-50 border-indigo-200',
  ];
  const hash = (planName ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

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

  const planName = org.subscriptionPlanName ?? org.planType;

  return (
    <Dialog open={!!org} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-0 gap-0 [&>button]:hidden">
        {/* Header */}
        <div className="relative px-7 pt-7 pb-5 border-b border-[#E5E7EB] bg-white">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#263B4F] transition-all"
          >
            <X size={15} />
          </button>

          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#33AE95]/10 border border-[#33AE95]/30 flex items-center justify-center shrink-0">
              <Building2 size={22} className="text-[#33AE95]" />
            </div>
            <div className="min-w-0 flex-1 pr-10">
              <h2 className="text-xl font-bold text-[#263B4F] truncate">{org.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${planBadgeStyle(planName)}`}>
                  <Crown size={11} />
                  {planName ?? '—'}
                </span>
                {org.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#33AE95]/10 border border-[#33AE95]/30 text-[#33AE95]">
                    <CheckCircle2 size={11} /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#DF453A]/10 border border-[#DF453A]/30 text-[#DF453A]">
                    <XCircle size={11} /> Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6 bg-white">

          {/* Subscription Plan */}
          <ViewSection title="Subscription Plan">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-4 grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-xs text-[#6B7280] uppercase tracking-wide">Plan</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${planBadgeStyle(planName)}`}>
                  <Crown size={11} />
                  {planName ?? '—'}
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-[#6B7280] uppercase tracking-wide">Start Date</p>
                <p className="text-sm text-[#263B4F] font-medium">{formatDate(org.periodStart)}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-[#6B7280] uppercase tracking-wide">End Date</p>
                <p className="text-sm text-[#263B4F] font-medium">{formatDate(org.periodEnd)}</p>
              </div>
            </div>
          </ViewSection>

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
              <div className="flex items-start gap-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl p-4">
                <MapPin size={16} className="text-[#33AE95] mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  {addressLines.map((line, i) => (
                    <p key={i} className={`text-sm ${i === 0 ? 'text-[#263B4F] font-medium' : 'text-[#6B7280]'}`}>
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
                value={formatDate(org.createdAt)}
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
                        color: org.statusColourCode ?? '#6B7280',
                        border: `1px solid ${org.statusColourCode ? `${org.statusColourCode}44` : '#E5E7EB'}`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: org.statusColourCode ?? '#6B7280' }}
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
      <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">{title}</p>
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
    <div className="flex items-start gap-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
      <span className="text-[#6B7280] mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-[#6B7280] mb-0.5">{label}</p>
        {!value ? (
          <p className="text-sm text-[#6B7280]">—</p>
        ) : typeof value === 'string' ? (
          <p className={`text-sm text-[#263B4F] font-medium truncate ${mono ? 'font-mono tracking-wide' : ''}`}>
            {value}
          </p>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
