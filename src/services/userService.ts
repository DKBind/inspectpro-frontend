import { api } from './api';
import type { UserResponse, UserRequest, RoleResponse, RoleModuleAssignment } from './models/user';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalElements?: number;
}

export const userService = {
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
};
