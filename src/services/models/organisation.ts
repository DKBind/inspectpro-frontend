// ─── Address ──────────────────────────────────────────────────────────────────

export interface OrganisationAddressRequest {
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface OrganisationAddressResponse {
  id?: number;
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export interface CustomRoleRequest {
  name: string;
  description: string;
  designation: string;
}

// ─── Create / Update Requests ─────────────────────────────────────────────────

export interface OrganisationCreateRequest {
  name: string;
  email: string;
  domain?: string;
  subscriptionId?: string;
  parentOrgId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  phoneNumber?: string;
  contactedPersonName?: string;
  contactedPersonEmail?: string;
  contactedPersonPhoneNumber?: string;
  altContactPersonName?: string;
  altContactPersonEmail?: string;
  altContactPersonPhoneNumber?: string;
  extraInfo?: string;
  gstin?: string;
  pan?: string;
  tan?: string;
  address?: OrganisationAddressRequest;
  customRoles?: CustomRoleRequest[];
}

export interface OrganisationUpdateRequest {
  name?: string;
  email?: string;
  domain?: string;
  planType?: string;
  phoneNumber?: string;
  contactedPersonName?: string;
  contactedPersonEmail?: string;
  contactedPersonPhoneNumber?: string;
  altContactPersonName?: string;
  altContactPersonEmail?: string;
  altContactPersonPhoneNumber?: string;
  extraInfo?: string;
  gstin?: string;
  pan?: string;
  tan?: string;
  address?: OrganisationAddressRequest;
  isActive?: boolean;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export interface OrganisationResponse {
  uuid: string;
  name: string;
  email: string;
  domain?: string;
  planType: string;
  isActive: boolean;
  phoneNumber?: string;
  contactedPersonName?: string;
  contactedPersonEmail?: string;
  contactedPersonPhoneNumber?: string;
  altContactPersonName?: string;
  altContactPersonEmail?: string;
  altContactPersonPhoneNumber?: string;
  extraInfo?: string;
  gstin?: string;
  pan?: string;
  tan?: string;
  statusId?: number;
  statusName?: string;
  statusColourCode?: string;
  address?: OrganisationAddressResponse;
  subscriptionId?: string;
  subscriptionPlanName?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
  parentOrgId?: string;
  parentOrgName?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// ─── Common ───────────────────────────────────────────────────────────────────

export interface CommonOrgRole {
  id: number;
  name: string;
  description: string;
  designation: string;
  isActive: boolean;
  createdAt: string;
}
