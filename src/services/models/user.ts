export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: string;
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
  lastName: string;
  email: string;
  password?: string;
  gender?: string;
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
