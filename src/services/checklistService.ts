import { api } from './api';
import type {
  TemplateRequest,
  TemplateResponse,
  InspectionRequest,
  InspectionResponse,
} from './models/checklist';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalCount?: number;
}

export const checklistService = {
  // ─── Templates ─────────────────────────────────────────────────────────────

  listGlobalTemplates: async (): Promise<TemplateResponse[]> => {
    const res = await api.get<ApiResponse<TemplateResponse[]>>('/templates?global=true');
    if (!res.status) throw new Error(res.message || 'Failed to fetch templates');
    return (res.object as TemplateResponse[]) ?? [];
  },

  listProjectTemplates: async (projectId: string): Promise<TemplateResponse[]> => {
    const res = await api.get<ApiResponse<TemplateResponse[]>>(`/templates?projectId=${projectId}`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch templates');
    return (res.object as TemplateResponse[]) ?? [];
  },

  getTemplate: async (id: string): Promise<TemplateResponse> => {
    const res = await api.get<ApiResponse<TemplateResponse>>(`/templates/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch template');
    return res.object as TemplateResponse;
  },

  createTemplate: async (data: TemplateRequest): Promise<TemplateResponse> => {
    const res = await api.post<ApiResponse<TemplateResponse>>('/templates', data);
    if (!res.status) throw new Error(res.message || 'Failed to create template');
    return res.object as TemplateResponse;
  },

  updateTemplate: async (id: string, data: TemplateRequest): Promise<TemplateResponse> => {
    const res = await api.put<ApiResponse<TemplateResponse>>(`/templates/${id}`, data);
    if (!res.status) throw new Error(res.message || 'Failed to update template');
    return res.object as TemplateResponse;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/templates/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to delete template');
  },

  importTemplate: async (templateId: string, projectId: string): Promise<TemplateResponse> => {
    const res = await api.post<ApiResponse<TemplateResponse>>(
      `/templates/${templateId}/import?projectId=${projectId}`,
      {}
    );
    if (!res.status) throw new Error(res.message || 'Failed to import template');
    return res.object as TemplateResponse;
  },

  // ─── Inspections ───────────────────────────────────────────────────────────

  startInspection: async (data: InspectionRequest): Promise<InspectionResponse> => {
    const res = await api.post<ApiResponse<InspectionResponse>>('/inspections', data);
    if (!res.status) throw new Error(res.message || 'Failed to start inspection');
    return res.object as InspectionResponse;
  },

  listInspections: async (projectId: string): Promise<InspectionResponse[]> => {
    const res = await api.get<ApiResponse<InspectionResponse[]>>(`/inspections?projectId=${projectId}`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch inspections');
    return (res.object as InspectionResponse[]) ?? [];
  },

  submitInspection: async (
    id: string,
    data: InspectionRequest
  ): Promise<InspectionResponse> => {
    const res = await api.post<ApiResponse<InspectionResponse>>(`/inspections/${id}/submit`, data);
    if (!res.status) throw new Error(res.message || 'Failed to submit inspection');
    return res.object as InspectionResponse;
  },
};
