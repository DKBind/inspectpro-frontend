import { api } from './api';
import type { ProjectRequest, ProjectResponse } from './models/project';
import type { PageResponse } from './models/organisation';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
  totalCount?: number;
}

export const projectService = {

  listProjects: async (page = 0, size = 10): Promise<PageResponse<ProjectResponse>> => {
    const res = await api.get<ApiResponse<PageResponse<ProjectResponse>>>(
      `/projects?page=${page}&size=${size}`,
    );
    if (!res.status) throw new Error(res.message || 'Failed to fetch projects');
    return (res.object as PageResponse<ProjectResponse>) ?? { content: [], totalElements: 0, totalPages: 0, currentPage: 0, pageSize: size };
  },

  createProject: async (data: ProjectRequest): Promise<ProjectResponse> => {
    const res = await api.post<ApiResponse<ProjectResponse>>('/projects', data);
    if (!res.status) throw new Error(res.message || 'Failed to create project');
    return res.object as ProjectResponse;
  },

  getProject: async (id: string): Promise<ProjectResponse> => {
    const res = await api.get<ApiResponse<ProjectResponse>>(`/projects/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to fetch project');
    return res.object as ProjectResponse;
  },

  updateProject: async (id: string, data: ProjectRequest): Promise<ProjectResponse> => {
    const res = await api.put<ApiResponse<ProjectResponse>>(`/projects/${id}`, data);
    if (!res.status) throw new Error(res.message || 'Failed to update project');
    return res.object as ProjectResponse;
  },

  deleteProject: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/projects/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to delete project');
  },
};
