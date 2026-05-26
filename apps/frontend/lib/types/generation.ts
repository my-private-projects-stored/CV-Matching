/**
 * Shared types for LLM generation metadata.
 * Used across cover letter, outreach, interview, and tailor improve pages.
 */

/** Indicates whether the content was AI-generated or fell back to a rule-based template. */
export type GenerationMode = 'llm' | 'template_fallback';

/** Metadata about the LLM that generated the content. */
export interface LlmMetadata {
  provider?: string | null;
  model?: string | null;
  response_model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}

/**
 * Structured result for text-generation endpoints (cover letter, outreach).
 * The `content` field holds the generated text.
 */
export interface GenerationTextResult {
  content: string;
  generation_mode?: GenerationMode | null;
  llm_metadata?: LlmMetadata | null;
}
