import { api } from './api';
import type { CustomerRequest, CustomerResponse, CustomerLimitInfo } from './models/customer';
import type { PageResponse } from './models/organisation';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalCount?: number;
}

export const customerService = {

  // ─── Caller-aware endpoints (no orgId required) ──────────────────────────

  listClients: async (page = 0, size = 10): Promise<PageResponse<CustomerResponse>> => {
    // Backend returns flat: { status, message, totalElements, object: CustomerResponse[] }
    const raw = await api.get<{ status: boolean; message: string; totalElements?: number; object: CustomerResponse[] | null }>(
      `/clients?page=${page}&size=${size}`,
    );
    if (!raw.status) throw new Error(raw.message || 'Failed to fetch clients');
    const items = raw.object ?? [];
    const total = raw.totalElements ?? items.length;
    return {
      content: items,
      totalElements: total,
      totalPages: Math.ceil(total / size) || 0,
      currentPage: page,
      pageSize: size,
    };
  },

  createClient: async (data: CustomerRequest): Promise<CustomerResponse> => {
    const res = await api.post<ApiResponse<CustomerResponse>>('/clients', data);
    if (!res.status) throw new Error(res.message || 'Failed to create client');
    return res.object as CustomerResponse;
  },

  updateClient: async (id: string, data: CustomerRequest): Promise<CustomerResponse> => {
    const res = await api.put<ApiResponse<CustomerResponse>>(`/clients/${id}`, data);
    if (!res.status) throw new Error(res.message || 'Failed to update client');
    return res.object as CustomerResponse;
  },

  deleteClient: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/clients/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to delete client');
  },

  // ─── Org-scoped endpoints (legacy) ───────────────────────────────────────

  createCustomer: async (franchiseId: string, data: CustomerRequest): Promise<CustomerResponse> => {
    const res = await api.post<ApiResponse<CustomerResponse>>(
      `/organisations/${franchiseId}/customers`, data,
    );
    if (!res.status) throw new Error(res.message || 'Failed to create customer');
    return res.object as CustomerResponse;
  },

  listCustomers: async (franchiseId: string, page = 0, size = 10): Promise<PageResponse<CustomerResponse>> => {
    const res = await api.get<ApiResponse<PageResponse<CustomerResponse>>>(
      `/organisations/${franchiseId}/customers?page=${page}&size=${size}`,
    );
    if (!res.status) throw new Error(res.message || 'Failed to fetch customers');
    return res.object as PageResponse<CustomerResponse>;
  },

  getCustomer: async (franchiseId: string, customerId: string): Promise<CustomerResponse> => {
    const res = await api.get<ApiResponse<CustomerResponse>>(
      `/organisations/${franchiseId}/customers/${customerId}`,
    );
    if (!res.status) throw new Error(res.message || 'Failed to fetch customer');
    return res.object as CustomerResponse;
  },

  updateCustomer: async (
    franchiseId: string,
    customerId: string,
    data: CustomerRequest,
  ): Promise<CustomerResponse> => {
    const res = await api.put<ApiResponse<CustomerResponse>>(
      `/organisations/${franchiseId}/customers/${customerId}`, data,
    );
    if (!res.status) throw new Error(res.message || 'Failed to update customer');
    return res.object as CustomerResponse;
  },

  deleteCustomer: async (franchiseId: string, customerId: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(
      `/organisations/${franchiseId}/customers/${customerId}`,
    );
    if (!res.status) throw new Error(res.message || 'Failed to delete customer');
  },

  canAddCustomer: async (franchiseId: string): Promise<{ allowed: boolean; info?: CustomerLimitInfo }> => {
    const res = await api.get<ApiResponse<CustomerLimitInfo>>(
      `/organisations/${franchiseId}/can-add-customer`,
    );
    return { allowed: res.status, info: res.object ?? undefined };
  },
};
