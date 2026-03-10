import { api } from './api';
import type { OrganisationCreateRequest, OrganisationResponse } from './models/organisation';

export const organisationService = {
  /**
   * Creates a new organization with its subscription and default/custom roles
   */
  createOrganisation: async (data: OrganisationCreateRequest): Promise<OrganisationResponse> => {
    return await api.post<OrganisationResponse>('/organisations', data);
  },
};
