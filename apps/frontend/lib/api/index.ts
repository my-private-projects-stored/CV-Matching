/**
 * API Module Exports
 *
 * Centralized exports for all API-related functionality.
 */

// Client utilities
export {
  API_URL,
  API_BASE,
  AUTH_STORAGE_KEY,
  AUTH_TOKEN_COOKIE,
  apiFetch,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
  getUploadUrl,
  fetchHealth,
  setAuthTokenCookie,
  readAuthTokenCookie,
} from './client';

// Resume operations
export {
  uploadJobDescriptions,
  improveResume,
  previewImproveResume,
  confirmImproveResume,
  fetchResume,
  fetchResumeList,
  fetchMasterResume,
  fetchResumeHistory,
  setResumeAsMaster,
  restoreResumeVersion,
  updateResume,
  downloadResumePdf,
  deleteResume,
  renameResume,
  retryProcessing,
  fetchJobDescription,
  matchResumeToJd,
  createBlankResume,
  reorderResumeSections,
  addResumeSection,
  updateResumeSection,
  deleteResumeSection,
  generateCoverLetter,
  generateOutreachMessage,
  updateCoverLetter,
  updateOutreachMessage,
  downloadCoverLetterPdf,
  downloadOriginalResumeFile,
  type ResumeListItem,
  type JdMatchResult,
  type ResumeSectionMeta,
} from './resume';

// Application operations
export {
  createApplication,
  fetchRankedApplications,
  fetchMyApplicationHistory,
  fetchCandidateApplicationHistory,
  updateApplicationStatus,
  bulkUpdateApplicationStatus,
  fetchApplicationFeedback,
  fetchApplicationStatusSummary,
  fetchRecentStatusChanges,
  exportRecentStatusChangesCsv,
  fetchApplicationStatusHistory,
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
  fetchFeatureConfig,
  updateFeatureConfig,
  fetchPrivacyConfig,
  updatePrivacyConfig,
  fetchLanguageConfig,
  updateLanguageConfig,
  fetchPromptConfig,
  updatePromptConfig,
  fetchApiKeyStatus,
  updateApiKeys,
  deleteApiKey,
  clearAllApiKeys,
  resetDatabase,
  PROVIDER_INFO,
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

// Candidate profile operations
export {
  fetchMyCandidateProfile,
  fetchCandidateProfileById,
  updateMyCandidateProfile,
  type CandidateProfilePayload,
  type CandidateProfileResponse,
} from './candidate-profile';

// Company operations
export {
  fetchMyCompany,
  updateMyCompany,
  fetchCompanyById,
  type CompanyProfile,
} from './company';

// Vector admin operations
export {
  indexJobVector,
  indexResumeVector,
  searchResumesByJobVector,
  searchJobsByResumeVector,
  scorePair,
  type VectorSearchMatch,
  type HybridScorePairResult,
} from './vectors';

// Notification operations
export {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
  type NotificationType,
} from './notifications';

// User admin operations
export { fetchUsers, updateUserDisabled, type UserListResponse } from './users';

// Enrichment operations
export {
  analyzeResume,
  generateEnhancements,
  applyEnhancements,
  regenerateItems,
  applyRegeneratedItems,
} from './enrichment';

// Jobs
export {
  fetchJobs,
  fetchJobById,
  createJob,
  uploadJobDescriptionsForJob,
  updateJob,
  closeJob,
  reopenJob,
  deleteJob,
  type JobItem,
  type JobStatus,
  type JobCategory,
  type CreateJobPayload,
  type UpdateJobPayload,
} from './jobs';

// Auth
export { signup, login, fetchMe, forgotPassword, resetPassword, changePassword } from './auth';
