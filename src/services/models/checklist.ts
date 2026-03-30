// ─── Scope ───────────────────────────────────────────────────────────────────

export type TemplateScope = 'GLOBAL' | 'ORGANISATION' | 'PROJECT' | 'SCRATCH';

// ─── Recursive Template Node (new unlimited-depth tree) ───────────────────────

export type TemplateNodeType = 'FOLDER' | 'LEAF';

export interface TemplateNode {
  id: string;
  name: string;
  type: TemplateNodeType;
  /** "SELECTION" | "DAMAGE" — only meaningful when type = LEAF */
  panelType?: BuilderPanelType;
  /** Inspection items — LEAF only */
  items?: BuilderItem[];
  /** Child nodes — FOLDER only (self-referential, unlimited depth) */
  children?: TemplateNode[];
}

// ─── Template Builder Types ───────────────────────────────────────────────────

export type BuilderResponseType = 'DROPDOWN' | 'RADIO' | 'TEXT' | 'CHECKBOX' | 'NUMBER' | 'PHOTO' | 'PASS_FAIL';
export type BuilderPanelType = 'SELECTION' | 'DAMAGE';

export interface BuilderConditionalRule {
  itemId: string;
  operator: 'EQUALS' | 'NOT_EQUALS';
  value: string;
}

export interface BuilderItem {
  id: string;
  label: string;
  /** Alias shown in PDF reports. Defaults to label when not set. */
  reportName?: string;
  responseType: BuilderResponseType;
  options: string[];
  commonComments: string[];
  required: boolean;
  conditionalLogic: BuilderConditionalRule | null;
}

export interface BuilderPanel {
  id: string;
  name: string;
  panelType: BuilderPanelType;
  items: BuilderItem[];
}

export interface BuilderTab {
  id: string;
  name: string;
  panels: BuilderPanel[];
}

export interface BuilderSubSection {
  id: string;
  name: string;
  tabs: BuilderTab[];
}

export interface BuilderSection {
  id: string;
  name: string;
  subSections: BuilderSubSection[];
}

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
  /** New recursive tree — populated for templates saved in the new format */
  nodes?: TemplateNode[];
  sections: SectionInfo[];
  sectionCount: number;
  fields: FieldInfo[];             // legacy
  fieldCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateRequest {
  title: string;
  description?: string;
  scope?: string;                  // GLOBAL | ORGANISATION | PROJECT
  isGlobal?: boolean;              // legacy
  isLocked?: boolean;
  projectId?: string;
  /** New recursive node tree — takes precedence over sections when present */
  nodes?: TemplateNode[];
  sections?: any[];
  fields?: {
    fieldTitle: string;
    fieldDescription?: string;
    fieldType: 'INPUT' | 'CHECKBOX';
  }[];
}

// ─── Inspection List (Inspector Dashboard) ───────────────────────────────────

export interface InspectionListItem {
  id: string;
  status: 'DRAFT' | 'COMPLETED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  createdAt?: string;

  projectId: string;
  projectName: string;
  projectStatus?: string;
  address?: string;

  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;

  organisationId?: string;
  organisationName?: string;

  templateId?: string;
  templateTitle?: string;

  totalResults: number;
  answeredResults: number;
}

// ─── Snapshot (Clone & Initialise) ───────────────────────────────────────────

export interface SnapshotResponse {
  inspectionId: string;
  snapshotTemplateId: string;
  totalRows?: number;
  totalChecklists?: number;
}

// ─── Inspection Checklist (folder-driven execution model) ─────────────────────

export type ChecklistStatus = 'CORRECT' | 'DAMAGED' | 'N/A';

export interface ChecklistItem {
  id: string;
  itemLabel: string;
  panelType: 'SELECTION' | 'DAMAGE';
  status?: ChecklistStatus;
  comment?: string;
  photos?: string[];
  sortOrder: number;
  isCustom: boolean;
  folderId?: string;
  folderName?: string;
  templateNodeId?: string;
}

export interface FolderNode {
  id: string;
  name: string;
  type: 'FOLDER';
  parentId?: string;
  children?: FolderNode[];
}

// ─── Inspection Execution ─────────────────────────────────────────────────────

export type HipStatus = 'ACCEPTABLE' | 'DEFECTIVE' | 'MARGINAL' | 'NOT_INSPECTED';

export interface InspectionResultResponse {
  id: number;
  sectionName: string;
  itemLabel: string;
  logicType?: 'SELECTION' | 'DAMAGE'; // from TemplateBuilder panelType; null for legacy items
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
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
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
