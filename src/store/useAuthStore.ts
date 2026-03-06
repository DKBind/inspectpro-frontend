import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'super_admin' | 'admin';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  roles: UserRole[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isFirstLogin: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string, isFirstLogin?: boolean) => void;
  setAccessToken: (accessToken: string) => void;
  setFirstLoginDone: () => void;
  switchRole: (role: UserRole) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isFirstLogin: false,
      setAuth: (user, accessToken, refreshToken, isFirstLogin = false) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true, isFirstLogin }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setFirstLoginDone: () => set({ isFirstLogin: false }),
      switchRole: (role: UserRole) =>
        set((state) => ({ user: state.user ? { ...state.user, role } : null })),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isFirstLogin: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
