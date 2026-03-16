/** DTO returned by GET /api/my-modules — org's allowed modules from their subscription */
export interface OrgModuleDTO {
  moduleId: number;
  name: string;
  route: string;
  icon: string;
  category: string;
}

/** DTO returned by GET /api/my-access — modules the user can access via their role, with permissions */
export interface UserModuleAccessDTO {
  moduleId: number;
  name: string;
  route: string;
  icon: string;
  category: string;
  permissions: string[]; // e.g. ["READ", "CREATE", "UPDATE", "DELETE"]
}

export interface ModuleResponse {
  id: number;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  icon?: string;
  route?: string;
  priority?: number;
  statusName?: string;
  statusColourCode?: string;
  active: boolean;
}

export interface ModuleRequest {
  name: string;
  description?: string;
  category?: string;
  type?: string;
  icon?: string;
  route?: string;
  priority?: number;
  statusId?: number;
}
