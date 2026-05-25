import type { ResumeData } from '@/components/dashboard/resume-component';

export interface ImprovedResult {
  request_id?: string;
  resume_id?: string;
  job_id?: string;
  improved_data?: ResumeData;
  data?:
    | ResumeData
    | {
        improved_data?: ResumeData;
        resume?: ResumeData;
        improvements?: Array<{
          suggestion: string;
          lineNumber?: number | null;
        }>;
      };
  improvements?: Array<{
    suggestion: string;
    lineNumber?: number | null;
  }>;
  message?: string;
}
