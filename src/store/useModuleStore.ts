import { create } from 'zustand';
import type { UserModuleAccessDTO } from '@/services/models/module';

interface ModuleState {
  accessModules: UserModuleAccessDTO[];
  setAccessModules: (modules: UserModuleAccessDTO[]) => void;
  clearModules: () => void;
  hasPermission: (route: string, permission: string) => boolean;
}

export const useModuleStore = create<ModuleState>()((set, get) => ({
  accessModules: [],

  setAccessModules: (accessModules) => set({ accessModules }),

  clearModules: () => set({ accessModules: [] }),

  hasPermission: (route, permission) => {
    const mod = get().accessModules.find((m) => m.route === route);
    return mod?.permissions.includes(permission) ?? false;
  },
}));
