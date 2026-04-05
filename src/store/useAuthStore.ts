import { create } from 'zustand';

export type UserRole = string;

export interface RoleInfo {
  roleId: number;
  roleName: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  roleId?: number;
  roles: RoleInfo[];
  orgId?: string;
  orgName?: string;
  isSuperAdmin?: boolean;
  imageUrl?: string | null;
}

interface AuthState {
  // ── Persisted as plain localStorage keys ─────────────────
  idToken: string | null;
  refreshToken: string | null;

  // ── In-memory only (never stored) ─────────────────────────
  user: User | null;
  isFirstLogin: boolean;
  isAppReady: boolean;

  // ── Actions ───────────────────────────────────────────────
  setTokens: (idToken: string, refreshToken: string) => void;
  refreshIdToken: (idToken: string) => void;
  setUser: (user: User, isFirstLogin?: boolean) => void;
  updateUser: (patch: Partial<User>) => void;
  setAppReady: (ready: boolean) => void;
  setFirstLoginDone: () => void;
  switchRole: (roleName: string, roleId: number) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  // Hydrate tokens directly from localStorage on store creation
  idToken: localStorage.getItem('idToken'),
  refreshToken: localStorage.getItem('refreshToken'),

  user: null,
  isFirstLogin: false,
  isAppReady: false,

  setTokens: (idToken, refreshToken) => {
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ idToken, refreshToken, isAppReady: false });
  },

  refreshIdToken: (idToken) => {
    localStorage.setItem('idToken', idToken);
    set({ idToken });
  },

  setUser: (user, isFirstLogin = false) =>
    set({ user, isFirstLogin }),

  updateUser: (patch) =>
    set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),

  setAppReady: (ready) => set({ isAppReady: ready }),

  setFirstLoginDone: () => set({ isFirstLogin: false }),

  switchRole: (roleName, roleId) =>
    set((s) => ({
      user: s.user ? { ...s.user, role: roleName, roleId } : null,
      isAppReady: false,
    })),

  clearAuth: () => {
    localStorage.clear();
    set({ idToken: null, refreshToken: null, user: null, isFirstLogin: false, isAppReady: false });
  },
}));
