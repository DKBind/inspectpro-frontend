// ─── Shared ───────────────────────────────────────────────────────────────────

export interface StatusInfo {
  id: number;
  name: string;
  colourCode?: string;
}

export interface ModuleInfo {
  id: number;
  name: string;
  description?: string;
  category?: string;
  type?: string;
}

// ─── Global subscription plan ─────────────────────────────────────────────────

export interface SubscriptionResponse {
  id: string;
  /** null = global plan (super_admin); set = org-owned plan for franchises */
  createdByOrgId?: string;
  /** true when createdByOrgId is null — system-level plan available to all root orgs */
  global: boolean;
  planName: string;
  price?: number;
  currency?: string;
  status?: StatusInfo;
  durationMonths?: number;
  maxUsers?: number;
  billingCycle?: string;
  notes?: string;
  modules?: ModuleInfo[];
}

export interface SubscriptionRequest {
  planName: string;
  price?: number;
  durationMonths?: number;
  maxUsers?: number;
  billingCycle?: string;
  statusId?: number;
  notes?: string;
  moduleIds?: number[];
  /** Set to org UUID when org user creates plans for their franchises */
  createdByOrgId?: string;
}

// ─── Org-level subscription ───────────────────────────────────────────────────

export interface OrgSubscriptionResponse {
  orgSubscriptionId: string;
  subscriptionId: string;
  planName: string;
  price?: number;
  currency?: string;
  status?: StatusInfo;
  maxUsers?: number;
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
  active: boolean;
}

export interface OrgSubscriptionRequest {
  subscriptionId: string;
  priceOverride?: number;
  currency?: string;
  maxUsers?: number;
  notes?: string;
  periodStart?: string;
  periodEnd?: string;
}
