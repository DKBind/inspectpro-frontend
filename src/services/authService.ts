import { api } from './api';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
}

export interface RoleItem {
  roleId: number;
  roleName: string;
}

export interface LoginResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  orgId?: string;
  orgName?: string;
  roleId?: number;
  roleName?: string;
  roles: RoleItem[];   // all roles assigned to the user
  superAdmin: boolean;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  login: async (email: string, password?: string): Promise<LoginResponse> => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
    if (!res.status) throw new Error(res.message || 'Login failed');
    return res.object as LoginResponse;
  },
};
