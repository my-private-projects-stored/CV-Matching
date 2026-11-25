import { apiPost } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export interface PracticeQuestionItem {
  category: string;
  question: string;
  expectedSignal: string;
  sampleAnswer?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface PracticeQuestionSetResponse {
  questionSet: {
    _id: string;
    targetAudience: 'candidate' | 'recruiter';
    language: 'vi' | 'en';
    questions: PracticeQuestionItem[];
    generationMode: 'llm' | 'template_fallback';
  };
  generation_mode: 'llm' | 'template_fallback';
}

export async function generatePracticeInterviewQuestions(payload: {
  jobTitle?: string;
  skills?: string[];
  missingKeywords?: string[];
  language?: 'vi' | 'en';
}): Promise<PracticeQuestionSetResponse> {
  const res = await apiPost('/interviews/questions', {
    ...payload,
    targetAudience: 'candidate',
  });
  await assertOk(res, 'Failed to generate practice interview questions');
  return res.json();
}
