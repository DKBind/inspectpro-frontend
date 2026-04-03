/**
 * Shared micro-helpers used across create/edit forms throughout the app.
 * Import from here instead of defining locally in each page.
 */
import React from 'react';
import { Label } from './Label/label';

// ─── Input class builder ────────────────────────────────────────────────────

/** Returns Tailwind classes for a standard form input.
 *  @param hasError  highlights border in red when true
 */
export const inputCls = (hasError?: boolean) => {
  return `h-10 bg-white border-[#E5E7EB] text-[#263B4F] placeholder:text-[#9CA3AF] focus:border-[#1a7bbd] focus:ring-1 focus:ring-[#1a7bbd]/20 transition-all ${hasError ? '!border-[#DF453A]' : ''}`;
};

// ─── Section header ─────────────────────────────────────────────────────────

export function Sec({
  icon,
  label,
  children,
  iconColor = 'text-[#1a7bbd]',
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  /** Tailwind colour class for the icon. Defaults to brand teal. */
  iconColor?: string;
}) {
  return (
    <section>
      {label && (
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className={iconColor}>{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">{label}</span>
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Form field wrapper ──────────────────────────────────────────────────────

export function Fld({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-[#263B4F] text-sm font-medium">{label}</Label>
        {required && <span className="text-[#DF453A] text-xs">*</span>}
        {hint && <span className="text-[#6B7280] text-xs">({hint})</span>}
      </div>
      {children}
      {error && <p className="text-xs text-[#DF453A]">{error}</p>}
    </div>
  );
}

// ─── Icon-prefix input wrapper ───────────────────────────────────────────────

export function IcoInput({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none z-10">
        {icon}
      </span>
      <div className="[&_input]:pl-9">{children}</div>
    </div>
  );
}

// ─── Read-only view row ──────────────────────────────────────────────────────

export function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[#E5E7EB] last:border-0">
      <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium shrink-0 w-24">{label}</span>
      <span className="text-sm text-[#263B4F] text-right break-all">{value}</span>
    </div>
  );
}
