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
  employeeId?: string;
  phoneNumber?: string;
  gender?: string;
  dateOfBirth?: string;
  bio?: string;
  remark?: string;
  imageUrl?: string;
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
  employeeId?: string;
  password?: string;
  phoneNumber?: string;
  gender?: string;
  dateOfBirth?: string;
  bio?: string;
  remark?: string;
  address?: UserAddressRequest;
  orgId?: string;
  roleId?: number;
  statusId?: number;
}

// ─── Role ─────────────────────────────────────────────────────────────────────

export type RoleScope = 'PLATFORM' | 'ORGANISATION' | 'FRANCHISE';

export interface RoleResponse {
  roleId: number;
  name: string;
  description?: string;
  scope?: RoleScope;
  orgName?: string;
  statusName?: string;
  isActive?: boolean;
  createdByName?: string;
  createdDate?: string;
  assignedUsersCount?: number;
  moduleCount?: number;
}

export interface RoleModulePermission {
  moduleId: number;
  permissionNames: string[];
}

export interface RoleCreateRequest {
  name: string;
  description?: string;
  scope?: RoleScope;
  orgId?: string;
  modules?: RoleModulePermission[];
}

export interface RoleUserItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  statusName?: string;
}

export interface RoleModuleAssignment {
  moduleId: number;
  moduleName: string;
  moduleRoute: string;
  moduleCategory?: string;
  permissionId?: number;
  permissionName?: string; // Read | Write | Update | Delete | Import | Export | Share | All
}

// ─── Module ───────────────────────────────────────────────────────────────────

export interface ModuleResponse {
  id: number;
  name: string;
  description?: string;
  category?: string;
  route?: string;
  icon?: string;
  active?: boolean;
}

// ─── Permission ───────────────────────────────────────────────────────────────

export interface PermissionItem {
  id: number;
  name: string;
}
