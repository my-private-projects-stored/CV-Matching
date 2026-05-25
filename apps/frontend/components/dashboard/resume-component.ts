export type SectionType = 'personalInfo' | 'text' | 'itemList' | 'stringList';

export interface SectionMeta {
  id: string;
  key: string;
  displayName: string;
  sectionType: SectionType;
  isDefault: boolean;
  isVisible: boolean;
  order: number;
}

export interface ResumeData {
  personalInfo?: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string | null;
    linkedin?: string | null;
    github?: string | null;
  };
  summary?: string;
  workExperience?: Array<{
    id: number | string;
    title?: string;
    company?: string;
    location?: string | null;
    years?: string;
    description?: string[];
  }>;
  education?: Array<{
    id: number | string;
    institution?: string;
    degree?: string;
    years?: string;
    description?: string | null;
  }>;
  personalProjects?: Array<{
    id: number | string;
    name?: string;
    role?: string;
    years?: string;
    github?: string | null;
    website?: string | null;
    description?: string[];
  }>;
  additional?: {
    technicalSkills?: string[];
    languages?: string[];
    certificationsTraining?: string[];
    awards?: string[];
  };
  sectionMeta?: SectionMeta[];
  customSections?: Record<string, unknown>;
}
