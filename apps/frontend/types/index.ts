export type UserRole = 'candidate' | 'recruiter' | 'admin';
export type ApplicationStatus = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export type AiStatus = 'pending' | 'parsing' | 'scoring' | 'completed' | 'failed';
export type JobCategory = 'IT' | 'Accounting' | 'Marketing';
export type JobStatus = 'active' | 'closed' | 'deleted';

export interface AiScores {
  semanticScore: number;
  keywordScore: number;
  hybridScore: number;
}

export interface AiDetails {
  matchedKeywords: string[];
  missingKeywords: string[];
}

export interface StatusHistoryEntry {
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedAt: string;
  changedBy: string;
}

export interface Application {
  _id: string;
  jobId: string;
  resumeId: string;
  status: ApplicationStatus;
  aiStatus: AiStatus;
  aiScores: AiScores;
  aiDetails: AiDetails;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  _id: string;
  recruiterId: string;
  title: string;
  description: string;
  requirements: string;
  benefits?: string;
  applicationDeadline?: string;
  category: JobCategory;
  location?: string;
  experienceLevel?: string;
  status: JobStatus;
  isAnalyzed: boolean;
  keywords: string[];
  applications_count?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  _id: string;
  candidateId: string;
  fileUrl: string;
  title?: string;
  isMaster: boolean;
  isAnalyzed: boolean;
  processingStatus: string;
  parsedData: Record<string, unknown>;
  builderData?: {
    sections?: Record<string, unknown>;
    sectionMeta?: Array<Record<string, unknown>>;
    template?: 'classic-single' | 'modern-single' | 'classic-two-column' | 'modern-two-column';
    formatSettings?: Record<string, unknown>;
    customSections?: Record<string, unknown>;
  };
  coverLetter?: string;
  outreachMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  disabled?: boolean;
  candidateProfile?: Record<string, unknown>;
}
