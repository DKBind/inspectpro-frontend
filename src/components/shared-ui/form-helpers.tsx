/**
 * Shared micro-helpers used across create/edit forms throughout the app.
 * Import from here instead of defining locally in each page.
 */
import React from 'react';
import { Label } from './Label/label';

// ─── Input class builder ────────────────────────────────────────────────────

/** Returns Tailwind classes for a standard form input.
 *  @param hasError  highlights border in red when true
 *  @param accent    focus-ring colour: 'blue' (default) | 'purple'
 */
export const inputCls = (hasError?: boolean, accent: 'blue' | 'purple' = 'blue') => {
  const focus =
    accent === 'purple'
      ? 'focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20'
      : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20';
  return `h-10 bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 ${focus} transition-all ${hasError ? 'border-red-500' : ''}`;
};

// ─── Section header ─────────────────────────────────────────────────────────

export function Sec({
  icon,
  label,
  children,
  iconColor = 'text-blue-400',
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  /** Tailwind colour class for the icon, e.g. "text-purple-400". Defaults to "text-blue-400". */
  iconColor?: string;
}) {
  return (
    <section>
      {label && (
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className={iconColor}>{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
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
        <Label className="text-slate-300 text-sm font-medium">{label}</Label>
        {required && <span className="text-red-400 text-xs">*</span>}
        {hint && <span className="text-slate-500 text-xs">({hint})</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
        {icon}
      </span>
      <div className="[&_input]:pl-9">{children}</div>
    </div>
  );
}

// ─── Read-only view row ──────────────────────────────────────────────────────

export function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 uppercase tracking-wide font-medium shrink-0 w-24">{label}</span>
      <span className="text-sm text-slate-200 text-right break-all">{value}</span>
    </div>
  );
}
