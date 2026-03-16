import { create } from 'zustand';
import type { OrgModuleDTO, UserModuleAccessDTO } from '@/services/models/module';

interface ModuleState {
  /** Modules the org is allowed to access (from subscription plan) */
  modules: OrgModuleDTO[];
  /** Modules the user can access via their assigned roles, with per-module permissions */
  accessModules: UserModuleAccessDTO[];

  setModules: (modules: OrgModuleDTO[]) => void;
  setAccessModules: (modules: UserModuleAccessDTO[]) => void;
  clearModules: () => void;

  /** Returns true if the user has the given permission on the module at the specified route */
  hasPermission: (route: string, permission: string) => boolean;
}

export const useModuleStore = create<ModuleState>()((set, get) => ({
  modules: [],
  accessModules: [],

  setModules: (modules) => set({ modules }),
  setAccessModules: (accessModules) => set({ accessModules }),
  clearModules: () => set({ modules: [], accessModules: [] }),

  hasPermission: (route, permission) => {
    const mod = get().accessModules.find((m) => m.route === route);
    return mod?.permissions.includes(permission) ?? false;
  },
}));
