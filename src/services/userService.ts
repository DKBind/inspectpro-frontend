import { api } from './api';
import type {
  UserResponse, UserRequest,
  RoleResponse, RoleCreateRequest, RoleModuleAssignment,
  ModuleResponse, PermissionItem, RoleUserItem,
} from './models/user';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalElements?: number;
}

export const userService = {
  // ── Users ─────────────────────────────────────────────────────────────────

  listUsersByRole: async (roleId: number, orgId?: string): Promise<UserResponse[]> => {
    const url = orgId ? `/users/by-role/${roleId}?orgId=${orgId}` : `/users/by-role/${roleId}`;
    const res = await api.get<ApiResponse<UserResponse[]>>(url);
    if (!res.status) throw new Error(res.message || 'Failed to fetch users by role');
    return res.object ?? [];
  },

  listUsers: async (page = 0, size = 10): Promise<{ users: UserResponse[]; total: number }> => {
    const res = await api.get<ApiResponse<UserResponse[]>>(`/users?page=${page}&size=${size}`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch users');
    return { users: res.object ?? [], total: res.totalElements ?? 0 };
  },

  getUserById: async (id: string): Promise<UserResponse> => {
    const res = await api.get<ApiResponse<UserResponse>>(`/users/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch user');
    return res.object as UserResponse;
  },

  createUser: async (data: UserRequest): Promise<UserResponse> => {
    const res = await api.post<ApiResponse<UserResponse>>('/users', data);
    if (!res.status) throw new Error(res.message || 'Failed to create user');
    return res.object as UserResponse;
  },

  updateUser: async (id: string, data: UserRequest): Promise<UserResponse> => {
    const res = await api.put<ApiResponse<UserResponse>>(`/users/${id}`, data);
    if (!res.status) throw new Error(res.message || 'Failed to update user');
    return res.object as UserResponse;
  },

  deleteUser: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/users/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to delete user');
  },

  changePassword: async (newPassword: string): Promise<void> => {
    const res = await api.patch<ApiResponse<null>>('/users/me/password', { password: newPassword });
    if (!res.status) throw new Error(res.message || 'Failed to update password');
  },

  // ── Roles ─────────────────────────────────────────────────────────────────

  listRoles: async (orgId?: string): Promise<RoleResponse[]> => {
    const url = orgId ? `/roles?orgId=${orgId}` : '/roles';
    const res = await api.get<ApiResponse<RoleResponse[]>>(url);
    if (!res.status) throw new Error(res.message || 'Failed to fetch roles');
    return res.object ?? [];
  },

  getRoleModules: async (roleId: number): Promise<RoleModuleAssignment[]> => {
    const res = await api.get<ApiResponse<RoleModuleAssignment[]>>(`/roles/${roleId}/modules`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch role modules');
    return res.object ?? [];
  },

  createRole: async (data: RoleCreateRequest): Promise<RoleResponse> => {
    const res = await api.post<ApiResponse<RoleResponse>>('/roles', data);
    if (!res.status) throw new Error(res.message || 'Failed to create role');
    return res.object as RoleResponse;
  },

  updateRole: async (roleId: number, data: RoleCreateRequest): Promise<RoleResponse> => {
    const res = await api.put<ApiResponse<RoleResponse>>(`/roles/${roleId}`, data);
    if (!res.status) throw new Error(res.message || 'Failed to update role');
    return res.object as RoleResponse;
  },

  deleteRole: async (roleId: number): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/roles/${roleId}`);
    if (!res.status) throw new Error(res.message || 'Failed to delete role');
  },

  toggleRoleStatus: async (roleId: number): Promise<RoleResponse> => {
    const res = await api.patch<ApiResponse<RoleResponse>>(`/roles/${roleId}/status`, {});
    if (!res.status) throw new Error(res.message || 'Failed to toggle role status');
    return res.object as RoleResponse;
  },

  getRoleUsers: async (roleId: number): Promise<RoleUserItem[]> => {
    const res = await api.get<ApiResponse<RoleUserItem[]>>(`/roles/${roleId}/users`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch role users');
    return res.object ?? [];
  },

  // ── Modules & Permissions ─────────────────────────────────────────────────

  listRolesWithModules: async (orgId?: string): Promise<{ roleId: number; roleName: string; modules: RoleModuleAssignment[] }[]> => {
    const url = orgId ? `/roles/with-modules?orgId=${orgId}` : '/roles/with-modules';
    const res = await api.get<ApiResponse<{ roleId: number; roleName: string; modules: RoleModuleAssignment[] }[]>>(url);
    if (!res.status) throw new Error(res.message || 'Failed to fetch roles with modules');
    return res.object ?? [];
  },

  listModules: async (): Promise<ModuleResponse[]> => {
    const res = await api.get<ApiResponse<ModuleResponse[]>>('/modules');
    if (!res.status) throw new Error(res.message || 'Failed to fetch modules');
    return res.object ?? [];
  },

  listPermissions: async (): Promise<PermissionItem[]> => {
    const res = await api.get<ApiResponse<PermissionItem[]>>('/permissions');
    if (!res.status) throw new Error(res.message || 'Failed to fetch permissions');
    return res.object ?? [];
  },
};
