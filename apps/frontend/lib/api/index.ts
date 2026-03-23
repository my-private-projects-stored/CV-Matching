/**
 * API Module Exports
 *
 * Centralized exports for all API-related functionality.
 */

// Client utilities
export {
  API_URL,
  API_BASE,
  apiFetch,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
  getUploadUrl,
} from './client';

// Resume operations
export {
  uploadJobDescriptions,
  improveResume,
  previewImproveResume,
  confirmImproveResume,
  fetchResume,
  fetchResumeList,
  updateResume,
  downloadResumePdf,
  deleteResume,
  type ResumeListItem,
} from './resume';

// Application operations
export {
  createApplication,
  fetchRankedApplications,
  fetchCandidateApplicationHistory,
  updateApplicationStatus,
  fetchApplicationFeedback,
  fetchApplicationStatusSummary,
  type ApplicationStatus,
  type ApplicationAiStatus,
  type RankedCandidateItem,
  type CandidateHistoryItem,
} from './applications';

// Config operations
export {
  fetchLlmConfig,
  fetchLlmApiKey,
  updateLlmConfig,
  updateLlmApiKey,
  testLlmConnection,
  fetchSystemStatus,
  PROVIDER_INFO,
  fetchPromptConfig,
  updatePromptConfig,
  type LLMProvider,
  type LLMConfig,
  type LLMConfigUpdate,
  type DatabaseStats,
  type SystemStatus,
  type LLMHealthCheck,
  type PromptOption,
  type PromptConfig,
  type PromptConfigUpdate,
} from './config';
