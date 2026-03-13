import { api } from './api';
import type {
  OrganisationCreateRequest,
  OrganisationUpdateRequest,
  OrganisationResponse,
  PageResponse,
} from './models/organisation';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalElements: number;
}

export const organisationService = {
  createOrganisation: async (data: OrganisationCreateRequest): Promise<OrganisationResponse> => {
    const response = await api.post<ApiResponse<OrganisationResponse>>('/organisations', data);
    if (!response.status) throw new Error(response.message || 'Failed to create organisation');
    return response.object as OrganisationResponse;
  },

  getOrganisations: async (
    page = 0,
    size = 10
  ): Promise<PageResponse<OrganisationResponse>> => {
    const response = await api.get<ApiResponse<PageResponse<OrganisationResponse>>>(
      `/organisations?page=${page}&size=${size}`
    );
    if (!response.status) throw new Error(response.message || 'Failed to fetch organisations');
    return response.object as PageResponse<OrganisationResponse>;
  },

  getOrganisationByUuid: async (uuid: string): Promise<OrganisationResponse> => {
    const response = await api.get<ApiResponse<OrganisationResponse>>(`/organisations/${uuid}`);
    if (!response.status) throw new Error(response.message || 'Organisation not found');
    return response.object as OrganisationResponse;
  },

  updateOrganisation: async (
    uuid: string,
    data: OrganisationUpdateRequest
  ): Promise<OrganisationResponse> => {
    const response = await api.put<ApiResponse<OrganisationResponse>>(`/organisations/${uuid}`, data);
    if (!response.status) throw new Error(response.message || 'Failed to update organisation');
    return response.object as OrganisationResponse;
  },

  deleteOrganisation: async (uuid: string): Promise<void> => {
    const response = await api.delete<ApiResponse<null>>(`/organisations/${uuid}`);
    if (!response.status) throw new Error(response.message || 'Failed to delete organisation');
  },

  updateOrganisationStatus: async (uuid: string, statusId: number): Promise<OrganisationResponse> => {
    const response = await api.patch<ApiResponse<OrganisationResponse>>(`/organisations/${uuid}/status`, { statusId });
    if (!response.status) throw new Error(response.message || 'Failed to update status');
    return response.object as OrganisationResponse;
  },
};
