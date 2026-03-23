import { api } from './api';

interface ApiResponse<T> {
  status: boolean;
  message: string;
  object: T | null;
}

export interface SpecField {
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'boolean';
  required?: boolean;
  options?: string[];
  default?: boolean;
}

export interface PropertyTypeResponse {
  id: number;
  name: string;
  /** spec_template is a parsed array; string fallback kept for safety */
  specTemplate?: SpecField[] | string;
}

/** Normalise specTemplate regardless of whether it came back as an array or a JSON string */
export function parseSpecFields(template: SpecField[] | string | undefined | null): SpecField[] {
  if (!template) return [];
  if (Array.isArray(template)) return template;
  try { return JSON.parse(template) as SpecField[]; } catch { return []; }
}

export const propertyTypeService = {

  listPropertyTypes: async (): Promise<PropertyTypeResponse[]> => {
    const res = await api.get<ApiResponse<PropertyTypeResponse[]>>('/property-types');
    if (!res.status) throw new Error(res.message || 'Failed to fetch property types');
    return (res.object as PropertyTypeResponse[]) ?? [];
  },

  createPropertyType: async (data: { name: string; specTemplate?: SpecField[] }): Promise<PropertyTypeResponse> => {
    const res = await api.post<ApiResponse<PropertyTypeResponse>>('/property-types', data);
    if (!res.status) throw new Error(res.message || 'Failed to create property type');
    return res.object as PropertyTypeResponse;
  },

  updatePropertyType: async (id: string, data: { name?: string; specTemplate?: SpecField[] }): Promise<PropertyTypeResponse> => {
    const res = await api.put<ApiResponse<PropertyTypeResponse>>(`/property-types/${id}`, data);
    if (!res.status) throw new Error(res.message || 'Failed to update property type');
    return res.object as PropertyTypeResponse;
  },

  deletePropertyType: async (id: string): Promise<void> => {
    const res = await api.delete<ApiResponse<null>>(`/property-types/${id}`);
    if (!res.status) throw new Error(res.message || 'Failed to delete property type');
  },
};
