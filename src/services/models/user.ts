// ─── Address (mirrors organisation_address table structure) ───────────────────

export interface UserAddressRequest {
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface UserAddressResponse {
  id?: number;
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  gender?: string;
  bio?: string;
  remark?: string;
  address?: UserAddressResponse;
  orgId?: string;
  orgName?: string;
  roleId?: number;
  roleName?: string;
  statusId?: number;
  statusName?: string;
  statusColourCode?: string;
  createdDate?: string;
}

export interface UserRequest {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password?: string;
  gender?: string;
  bio?: string;
  remark?: string;
  address?: UserAddressRequest;
  orgId?: string;
  roleId?: number;
  statusId?: number;
}

export interface RoleResponse {
  roleId: number;
  name: string;
  description?: string;
  designation?: string;
}

export interface RoleModuleAssignment {
  moduleId: number;
  moduleName: string;
  moduleRoute: string;
  moduleCategory?: string;
  permissionId?: number;
  permissionName?: string; // Read | Write | None | Delete | All
}
