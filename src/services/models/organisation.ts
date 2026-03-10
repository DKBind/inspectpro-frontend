export const PlanType = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export type PlanType = typeof PlanType[keyof typeof PlanType];

export interface CustomRoleRequest {
  name: string;
  description: string;
  designation: string;
}

export interface OrganisationCreateRequest {
  name: string;
  slug: string;
  domain?: string;
  planType: PlanType;
  customRoles?: CustomRoleRequest[];
}

export interface OrganisationResponse {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  domain: string;
  planType: PlanType;
  isActive: boolean;
  subscriptionId: string;
  createdAt: string;
}

export interface CommonOrgRole {
  id: number;
  name: string;
  description: string;
  designation: string;
  isActive: boolean;
  createdAt: string;
}
