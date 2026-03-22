import Resume from "../models/Resume.js";
import { ensureQdrantId } from "../utils/qdrant-id.js";
import { generateEmbedding } from "./embedding.service.js";
import { deleteResumeVector, upsertResumeVector } from "./vector-index.service.js";

function shouldRegenerateResumeEmbedding(payload = {}) {
  return ["rawText", "parsedData"].some((key) => key in payload);
}

function extractResumeEmbeddingText(resume) {
  if (resume.rawText && String(resume.rawText).trim()) {
    return String(resume.rawText);
  }

  return JSON.stringify(resume.parsedData || {});
}

// Tao CV moi va gan qdrantId de mapping sang Qdrant.
export async function createResume(payload) {
  const { embeddingVector, ...resumeData } = payload;
  const resume = new Resume(resumeData);
  ensureQdrantId(resume);
  const saved = await resume.save();
  let vector = embeddingVector;

  if (!Array.isArray(vector) || vector.length === 0) {
    vector = await generateEmbedding(extractResumeEmbeddingText(saved));
  }

  if (Array.isArray(vector) && vector.length > 0) {
    await upsertResumeVector({
      qdrantId: saved.qdrantId,
      vector,
      payload: {
        mongoId: String(saved._id),
        candidateId: String(saved.candidateId),
        isAnalyzed: saved.isAnalyzed,
      },
    });

    saved.isAnalyzed = true;
    await saved.save();
  }

  return saved;
}

// Cap nhat CV va bo sung qdrantId neu du lieu cu chua co.
export async function updateResumeById(resumeId, payload) {
  const { embeddingVector, ...resumeData } = payload;
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  Object.assign(resume, resumeData);
  ensureQdrantId(resume);
  const saved = await resume.save();
  const mustRegenerate = shouldRegenerateResumeEmbedding(resumeData);

  let vector = embeddingVector;
  if ((!Array.isArray(vector) || vector.length === 0) && mustRegenerate) {
    vector = await generateEmbedding(extractResumeEmbeddingText(saved));
  }

  if (Array.isArray(vector) && vector.length > 0) {
    await upsertResumeVector({
      qdrantId: saved.qdrantId,
      vector,
      payload: {
        mongoId: String(saved._id),
        candidateId: String(saved.candidateId),
        isAnalyzed: saved.isAnalyzed,
      },
    });

    saved.isAnalyzed = true;
    await saved.save();
  }

  return saved;
}

export async function deleteResumeById(resumeId) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  await deleteResumeVector(resume.qdrantId);
  await resume.deleteOne();
  return resume;
}
