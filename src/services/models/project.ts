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

  city?: string;
  state?: string;
  country?: string;
  pincode?: string;

  startDatePlanned?: string;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;

  totalBudget?: number;
  contractValue?: number;

  createdAt?: string;
}

export interface ProjectRequest {
  name: string;
  clientId: string;
  managerId?: string;
  description?: string;
  projectStatus?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  startDatePlanned?: string;
  estimatedCompletionDate?: string;
  totalBudget?: number;
  contractValue?: number;
}
