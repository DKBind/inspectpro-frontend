// ─── Shared ───────────────────────────────────────────────────────────────────

export interface StatusInfo {
  id: number;
  name: string;
  colourCode?: string;
}

// ─── Global subscription plan ─────────────────────────────────────────────────

export interface SubscriptionResponse {
  id: string;
  planName: string;
  price?: number;
  currency?: string;
  status?: StatusInfo;
  durationMonths?: number;
  notes?: string;
}

export interface SubscriptionRequest {
  planName: string;
  price?: number;
  durationMonths?: number;
  statusId?: number;
  notes?: string;
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
