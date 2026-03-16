import { api } from './api';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
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
  superAdmin: boolean;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  login: async (email: string): Promise<LoginResponse> => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email });
    if (!res.status) throw new Error(res.message || 'Login failed');
    return res.object as LoginResponse;
  },
};
