export interface FieldInfo {
  fieldTitle: string;
  fieldDescription?: string;
  fieldType: 'INPUT' | 'CHECKBOX';
}

export interface TemplateResponse {
  id: string;
  title: string;
  description?: string;
  isGlobal: boolean;
  projectId?: string;
  projectName?: string;
  organisationId?: string;
  organisationName?: string;
  fields: FieldInfo[];
  fieldCount: number;
  createdAt?: string;
}

export interface TemplateRequest {
  title: string;
  description?: string;
  isGlobal: boolean;
  projectId?: string;
  fields: {
    fieldTitle: string;
    fieldDescription?: string;
    fieldType: 'INPUT' | 'CHECKBOX';
  }[];
}

export interface AnswerInfo {
  fieldTitle: string;
  fieldType: 'INPUT' | 'CHECKBOX';
  answer: string;
  photoUrl?: string | null;
}

export interface InspectionResponse {
  id: string;
  projectId: string;
  projectName?: string;
  templateId: string;
  templateTitle?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  notes?: string;
  answers: AnswerInfo[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InspectionRequest {
  projectId: string;
  templateId: string;
  notes?: string;
  answers: {
    fieldTitle: string;
    fieldType: string;
    answer: string;
    photoUrl?: string | null;
  }[];
}
