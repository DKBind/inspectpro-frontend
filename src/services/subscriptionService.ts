import { api } from './api';
import type {
  StatusInfo,
  SubscriptionRequest,
  SubscriptionResponse,
  OrgSubscriptionRequest,
  OrgSubscriptionResponse,
} from './models/subscription';
import type { ModuleResponse } from './models/module';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
}

export const subscriptionService = {
  // ─── Global plan endpoints ───────────────────────────────────────────────

  getStatuses: async (): Promise<StatusInfo[]> => {
    const response = await api.get<ApiResponse<StatusInfo[]>>('/subscriptions/statuses');
    if (!response.status) throw new Error(response.message || 'Failed to fetch statuses');
    return response.object as StatusInfo[];
  },

  listSubscriptions: async (): Promise<SubscriptionResponse[]> => {
    const response = await api.get<ApiResponse<SubscriptionResponse[]>>('/subscriptions');
    if (!response.status) throw new Error(response.message || 'Failed to fetch subscriptions');
    return response.object as SubscriptionResponse[];
  },

  createSubscription: async (data: SubscriptionRequest): Promise<SubscriptionResponse> => {
    const response = await api.post<ApiResponse<SubscriptionResponse>>('/subscriptions', data);
    if (!response.status) throw new Error(response.message || 'Failed to create subscription');
    return response.object as SubscriptionResponse;
  },

  updateSubscription: async (id: string, data: SubscriptionRequest): Promise<SubscriptionResponse> => {
    const response = await api.put<ApiResponse<SubscriptionResponse>>(`/subscriptions/${id}`, data);
    if (!response.status) throw new Error(response.message || 'Failed to update subscription');
    return response.object as SubscriptionResponse;
  },

  deleteSubscription: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<null>>(`/subscriptions/${id}`);
    if (!response.status) throw new Error(response.message || 'Failed to delete subscription');
  },

  toggleStatus: async (id: string): Promise<SubscriptionResponse> => {
    const response = await api.patch<ApiResponse<SubscriptionResponse>>(`/subscriptions/${id}/status`, {});
    if (!response.status) throw new Error(response.message || 'Failed to toggle status');
    return response.object as SubscriptionResponse;
  },

  listActiveSubscriptions: async (): Promise<SubscriptionResponse[]> => {
    const response = await api.get<ApiResponse<SubscriptionResponse[]>>('/subscriptions/active');
    if (!response.status) throw new Error(response.message || 'Failed to fetch active subscriptions');
    return response.object as SubscriptionResponse[];
  },

  /** All subscription plans created by a specific org (for franchise assignment). */
  listSubscriptionsByOrgId: async (orgId: string): Promise<SubscriptionResponse[]> => {
    const response = await api.get<ApiResponse<SubscriptionResponse[]>>(
      `/organisations/${orgId}/subscription-plans`,
    );
    if (!response.status) throw new Error(response.message || 'Failed to fetch org subscription plans');
    return (response.object as SubscriptionResponse[]) ?? [];
  },

  /** Active subscription plans created by a specific org. */
  listActiveSubscriptionsByOrgId: async (orgId: string): Promise<SubscriptionResponse[]> => {
    const response = await api.get<ApiResponse<SubscriptionResponse[]>>(
      `/organisations/${orgId}/subscription-plans/active`,
    );
    if (!response.status) throw new Error(response.message || 'Failed to fetch active org subscription plans');
    return (response.object as SubscriptionResponse[]) ?? [];
  },

  // ─── Plan module management ──────────────────────────────────────────────

  setPlanModules: async (planId: string, moduleIds: number[]): Promise<SubscriptionResponse> => {
    const response = await api.put<ApiResponse<SubscriptionResponse>>(
      `/subscriptions/${planId}/modules`,
      moduleIds,
    );
    if (!response.status) throw new Error(response.message || 'Failed to set plan modules');
    return response.object as SubscriptionResponse;
  },

  // ─── Org-level endpoints ─────────────────────────────────────────────────

  getOrgSubscription: async (orgUuid: string): Promise<OrgSubscriptionResponse> => {
    const response = await api.get<ApiResponse<OrgSubscriptionResponse>>(`/organisations/${orgUuid}/subscription`);
    if (!response.status) throw new Error(response.message || 'No subscription found');
    return response.object as OrgSubscriptionResponse;
  },

  assignOrgSubscription: async (
    orgUuid: string,
    data: OrgSubscriptionRequest,
  ): Promise<OrgSubscriptionResponse> => {
    const response = await api.post<ApiResponse<OrgSubscriptionResponse>>(
      `/organisations/${orgUuid}/subscription`,
      data,
    );
    if (!response.status) throw new Error(response.message || 'Failed to save subscription');
    return response.object as OrgSubscriptionResponse;
  },

  getOrgModules: async (orgUuid: string): Promise<ModuleResponse[]> => {
    const response = await api.get<ApiResponse<ModuleResponse[]>>(`/organisations/${orgUuid}/modules`);
    if (!response.status) throw new Error(response.message || 'Failed to fetch org modules');
    return (response.object as ModuleResponse[]) ?? [];
  },
};
