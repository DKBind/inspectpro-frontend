import { api } from './api';
import { useAuthStore } from '../store/useAuthStore';
import { decodeEmailFromJwt } from '../lib/utils';


interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
}

export interface LoginResponse {
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

  refreshTokens: async (refreshToken: string): Promise<{ idToken: string }> => {
    const idToken = useAuthStore.getState().idToken;
    const email = idToken ? decodeEmailFromJwt(idToken) : null;
    const res = await api.post<ApiResponse<{ idToken: string }>>('/auth/refresh-token', { refreshToken, email });
    if (!res.status) throw new Error(res.message || 'Token refresh failed');
    return res.object!;
  },

  /** Calls Cognito global sign-out. Caller is responsible for clearing local state. */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};
