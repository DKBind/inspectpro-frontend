import { api } from './api';
import type { OrganisationCreateRequest, OrganisationResponse } from './models/organisation';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalElements: number;
}

export const organisationService = {
  /**
   * Creates a new organization with its subscription and default/custom roles
   */
  createOrganisation: async (data: OrganisationCreateRequest): Promise<OrganisationResponse> => {
    const response = await api.post<ApiResponse<OrganisationResponse>>('/organisations', data);
    if (!response.status) {
      throw new Error(response.message || 'Failed to create organisation');
    }
    return response.object as OrganisationResponse;
  },
};
