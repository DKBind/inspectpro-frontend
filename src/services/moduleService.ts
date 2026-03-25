import { api } from './api';
import type { ModuleResponse, OrgModuleDTO, UserModuleAccessDTO } from './models/module';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
}

/** Read-only — modules are maintained directly in the database. */
export const moduleService = {
  listModules: async (subscriptionType?: 'ORGANISATION' | 'FRANCHISE'): Promise<ModuleResponse[]> => {
    const url = subscriptionType ? `/modules?subscriptionType=${subscriptionType}` : '/modules';
    const response = await api.get<ApiResponse<ModuleResponse[]>>(url);
    if (!response.status) throw new Error(response.message || 'Failed to fetch modules');
    return response.object as ModuleResponse[];
  },

  /** Returns the modules allowed for an org based on their active subscription. */
  getMyModules: async (orgId: string): Promise<OrgModuleDTO[]> => {
    const response = await api.get<ApiResponse<OrgModuleDTO[]>>(`/my-modules?orgId=${orgId}`);
    if (!response.status) throw new Error(response.message || 'Failed to fetch org modules');
    return response.object as OrgModuleDTO[];
  },

  /** Returns the modules a user can access based on their assigned roles, with permissions. */
  getMyAccess: async (userId: string): Promise<UserModuleAccessDTO[]> => {
    const response = await api.get<ApiResponse<UserModuleAccessDTO[]>>(`/my-access?userId=${userId}`);
    if (!response.status) throw new Error(response.message || 'Failed to fetch access');
    return response.object as UserModuleAccessDTO[];
  },
};
