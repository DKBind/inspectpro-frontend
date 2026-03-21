export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  projectStatus?: string;

  clientId?: string;
  clientName?: string;
  clientCompany?: string;

  franchiseId?: string;
  franchiseName?: string;

  managerId?: string;
  managerName?: string;
  managerEmail?: string;

  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;

  startDatePlanned?: string;
  startDateActual?: string;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;

  totalBudget?: number;
  contractValue?: number;

  propertyTypeId?: number;
  propertyTypeName?: string;
  projectSpecs?: Record<string, string>;
  specTemplate?: { fields: Array<{ key: string; label: string; type: string; required?: boolean; options?: string[] }> };

  createdAt?: string;
}

export interface ProjectRequest {
  name: string;
  clientId: string;
  managerId?: string;
  description?: string;
  projectStatus?: string;

  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;

  startDatePlanned?: string;
  startDateActual?: string;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;

  totalBudget?: number;
  contractValue?: number;

  propertyTypeId?: number;
  projectSpecs?: Record<string, string>;
}
