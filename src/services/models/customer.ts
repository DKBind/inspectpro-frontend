export interface CustomerResponse {
  id: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  companyName?: string;
  notes?: string;
  isActive: boolean;

  subscriptionId?: string;
  subscriptionPlanName?: string;

  franchiseId?: string;
  franchiseName?: string;

  statusId?: number;
  statusName?: string;
  statusColourCode?: string;

  createdAt?: string;
}

export interface CustomerRequest {
  firstName: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  companyName?: string;
  notes?: string;
  subscriptionId?: string;
  statusId?: number;
}

export interface CustomerLimitInfo {
  current: number;
  max: number;
}
