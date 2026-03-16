import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = string;

/** One role entry with ID — needed to re-fetch modules when switching roles */
export interface RoleInfo {
  roleId: number;
  roleName: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;       // currently active role name
  roleId?: number;      // currently active role ID
  roles: RoleInfo[];    // all roles assigned to this user
  orgId?: string;
  isSuperAdmin?: boolean;
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
  /** Switch the active role in-memory without a page reload */
  switchRole: (roleName: string, roleId: number) => void;
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
      switchRole: (roleName, roleId) =>
        set((state) => ({
          user: state.user ? { ...state.user, role: roleName, roleId } : null,
        })),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isFirstLogin: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist tokens, auth flags, AND user (so role survives page refresh)
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isFirstLogin: state.isFirstLogin,
        user: state.user,
      }),
    }
  )
);
