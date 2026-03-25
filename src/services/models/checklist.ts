// ─── Scope ───────────────────────────────────────────────────────────────────

export type TemplateScope = 'GLOBAL' | 'ORGANISATION' | 'PROJECT' | 'SCRATCH';

// ─── HIP Hierarchy ───────────────────────────────────────────────────────────

export interface ItemInfo {
  label: string;
  responseType?: string;           // HIP, PASS_FAIL, TEXT, PHOTO, DROPDOWN
  options?: string[];
  commonComments?: string[];
}

export interface SectionInfo {
  sectionName: string;
  items: ItemInfo[];
}

export interface FieldInfo {
  fieldTitle: string;
  fieldDescription?: string;
  fieldType: 'INPUT' | 'CHECKBOX';
}

// ─── Template ─────────────────────────────────────────────────────────────────

export interface TemplateResponse {
  id: string | null;               // null for the "SCRATCH" sentinel
  title: string;
  description?: string;
  scope: TemplateScope;
  isGlobal: boolean;
  isLocked: boolean;
  projectId?: string;
  projectName?: string;
  organisationId?: string;
  organisationName?: string;
  sections: SectionInfo[];
  sectionCount: number;
  fields: FieldInfo[];             // legacy
  fieldCount: number;
  createdAt?: string;
}

export interface TemplateRequest {
  title: string;
  description?: string;
  scope?: string;                  // GLOBAL | ORGANISATION | PROJECT
  isGlobal?: boolean;              // legacy
  isLocked?: boolean;
  projectId?: string;
  sections?: {
    sectionName: string;
    items: {
      label: string;
      responseType?: string;
      options?: string[];
      commonComments?: string[];
    }[];
  }[];
  fields?: {                       // legacy
    fieldTitle: string;
    fieldDescription?: string;
    fieldType: 'INPUT' | 'CHECKBOX';
  }[];
}

// ─── Snapshot (Clone & Initialise) ───────────────────────────────────────────

export interface SnapshotResponse {
  inspectionId: string;
  snapshotTemplateId: string;
  totalRows: number;
}

// ─── Inspection Execution ─────────────────────────────────────────────────────

export type HipStatus = 'ACCEPTABLE' | 'DEFECTIVE' | 'MARGINAL' | 'NOT_INSPECTED';

export interface InspectionResultResponse {
  id: number;
  sectionName: string;
  itemLabel: string;
  responseValue?: HipStatus;
  comments?: string;
  photoUrl?: string;
  isCustom: boolean;
  defectId?: string;
  severity?: string;       // LOW | MEDIUM | HIGH | CRITICAL
  defectStatus?: string;   // OPEN | IN_PROGRESS | RESOLVED | VERIFIED
}

export interface InspectionWithResultsResponse {
  id: string;
  projectId: string;
  projectName?: string;
  templateId: string;
  templateTitle?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  notes?: string;
  results: InspectionResultResponse[];
  createdAt?: string;
}

// ─── Defect Summary ───────────────────────────────────────────────────────────

export interface DefectItem {
  resultId: number;
  itemLabel: string;
  comments?: string;
  photoUrl?: string;
  isCustom: boolean;
  defectId?: string;
  severity?: string;
  defectStatus?: string;
  resolutionNotes?: string;
}

export interface DefectSummaryResponse {
  projectId: string;
  projectName: string;
  totalDefects: number;
  sections: Record<string, DefectItem[]>;
}

// ─── Legacy (kept for backward compat) ───────────────────────────────────────

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
