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
  roles: RoleItem[];
  superAdmin: boolean;
  firstLogin: boolean; // true when user still has the default password
  accessToken: string;
  idToken: string;
  refreshToken: string;
  isFirstLogin?: boolean;
}

export const authService = {
  login: async (email: string, password?: string): Promise<LoginResponse> => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
    if (!res.status) throw new Error(res.message || 'Login failed');
    return res.object as LoginResponse;
  },

  sendOtp: async (email: string): Promise<void> => {
    const res = await api.post<ApiResponse<null>>('/auth/forgot-password', { email });
    if (!res.status) throw new Error(res.message || 'Failed to send OTP');
  },

  verifyOtp: async (email: string, otp: string): Promise<string> => {
    const res = await api.post<ApiResponse<{ resetToken: string }>>('/auth/verify-otp', { email, otp });
    if (!res.status) throw new Error(res.message || 'Invalid OTP');
    return res.object!.resetToken;
  },

  resetPassword: async (resetToken: string, newPassword: string): Promise<void> => {
    const res = await api.post<ApiResponse<null>>('/auth/reset-password', { resetToken, newPassword });
    if (!res.status) throw new Error(res.message || 'Failed to reset password');
  },

  changePassword: async (newPassword: string): Promise<void> => {
    const res = await api.post<ApiResponse<null>>('/auth/change-password', { newPassword });
    if (!res.status) throw new Error(res.message || 'Failed to change password');
  },

  refreshTokens: async (refreshToken: string): Promise<{ accessToken: string; idToken: string }> => {
    const res = await api.post<ApiResponse<{ accessToken: string; idToken: string }>>('/auth/refresh-token', { refreshToken });
    if (!res.status) throw new Error(res.message || 'Token refresh failed');
    return res.object!;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
  },
};
