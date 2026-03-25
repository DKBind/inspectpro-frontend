import { api } from './api';
import type {
  TemplateRequest,
  TemplateResponse,
  InspectionRequest,
  InspectionResponse,
  SnapshotResponse,
  InspectionWithResultsResponse,
  InspectionResultResponse,
  HipStatus,
  DefectSummaryResponse,
} from './models/checklist';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalCount?: number;
}

export const checklistService = {
  // ─── Template Picker ────────────────────────────────────────────────────────

  /** Returns GLOBAL + org's ORGANISATION templates + "Create from Scratch" sentinel. */
  getPickerTemplates: async (): Promise<TemplateResponse[]> => {
    const res = await api.get<ApiResponse<TemplateResponse[]>>('/templates/picker');
    if (!res.status) throw new Error(res.message || 'Failed to fetch picker templates');
    return (res.object as TemplateResponse[]) ?? [];
  },

  // ─── Templates CRUD ─────────────────────────────────────────────────────────

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

  // ─── Clone & Snapshot ───────────────────────────────────────────────────────

  /**
   * Clones a template into a PROJECT snapshot and generates InspectionResult rows.
   * `customQuestions` are appended as custom rows (isCustom=true).
   */
  snapshotTemplate: async (
    templateId: string,
    projectId: string,
    customQuestions?: { label: string; responseType?: string }[]
  ): Promise<SnapshotResponse> => {
    const res = await api.post<ApiResponse<SnapshotResponse>>(
      `/templates/${templateId}/snapshot?projectId=${projectId}`,
      { customQuestions: customQuestions ?? [] }
    );
    if (!res.status) throw new Error(res.message || 'Failed to snapshot template');
    return res.object as SnapshotResponse;
  },

  importTemplate: async (templateId: string, projectId: string): Promise<SnapshotResponse> => {
    const res = await api.post<ApiResponse<SnapshotResponse>>(
      `/templates/${templateId}/import?projectId=${projectId}`,
      {}
    );
    if (!res.status) throw new Error(res.message || 'Failed to import template');
    return res.object as SnapshotResponse;
  },

  // ─── Inspection Execution ────────────────────────────────────────────────────

  /** Load an inspection with all its result rows. */
  getInspectionWithResults: async (inspectionId: string): Promise<InspectionWithResultsResponse> => {
    const res = await api.get<ApiResponse<InspectionWithResultsResponse>>(
      `/inspections/${inspectionId}/results`
    );
    if (!res.status) throw new Error(res.message || 'Failed to load inspection');
    return res.object as InspectionWithResultsResponse;
  },

  /** Update a single result row (status + comments). */
  updateInspectionResult: async (
    resultId: number,
    data: { responseValue: HipStatus; comments?: string; photoUrl?: string }
  ): Promise<InspectionResultResponse> => {
    const res = await api.patch<ApiResponse<InspectionResultResponse>>(
      `/inspection-results/${resultId}`,
      data
    );
    if (!res.status) throw new Error(res.message || 'Failed to update result');
    return res.object as InspectionResultResponse;
  },

  // ─── Defect Summary Report ───────────────────────────────────────────────────

  getDefectSummary: async (projectId: string): Promise<DefectSummaryResponse> => {
    const res = await api.get<ApiResponse<DefectSummaryResponse>>(
      `/projects/${projectId}/defect-summary`
    );
    if (!res.status) throw new Error(res.message || 'Failed to fetch defect summary');
    return res.object as DefectSummaryResponse;
  },

  // ─── Legacy Inspections ──────────────────────────────────────────────────────

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

  submitInspection: async (id: string, data: InspectionRequest): Promise<InspectionResponse> => {
    const res = await api.post<ApiResponse<InspectionResponse>>(`/inspections/${id}/submit`, data);
    if (!res.status) throw new Error(res.message || 'Failed to submit inspection');
    return res.object as InspectionResponse;
  },
};
