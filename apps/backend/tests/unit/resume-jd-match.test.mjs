import test from 'node:test';
import assert from 'node:assert/strict';

const ResumeModel = (await import('../../src/models/Resume.js')).default;
const { buildResumeJdMatch, jdMatchDependencies } = await import('../../src/services/resume.service.js');
const { QDRANT_VECTOR_SIZE } = await import('../../src/infrastructure/qdrant/client.js');

test('buildResumeJdMatch computes hybrid score when vectors are available', async () => {
  const originalFindById = ResumeModel.findById;
  const originalGetResumeVectorPoint = jdMatchDependencies.getResumeVectorPoint;
  const originalGenerateEmbedding = jdMatchDependencies.generateEmbedding;
  const originalFetchIdfsForKeywords = jdMatchDependencies.fetchIdfsForKeywords;

  const mockResume = {
    _id: '64f000000000000000000002',
    qdrantId: 'qdrant-resume-1',
    rawText: 'Experienced Node.js and MongoDB backend engineer',
    parsedData: {
      additional: {
        technicalSkills: ['Node.js', 'MongoDB']
      }
    }
  };

  ResumeModel.findById = async () => mockResume;

  // Mock Qdrant resume vector point (dimension QDRANT_VECTOR_SIZE)
  const mockVector = new Array(QDRANT_VECTOR_SIZE).fill(0);
  mockVector[0] = 1.0; // Simple unit vector
  jdMatchDependencies.getResumeVectorPoint = async () => ({
    id: 'qdrant-resume-1',
    vector: mockVector
  });

  // Mock embedding generation for JD (return same vector)
  jdMatchDependencies.generateEmbedding = async () => mockVector;

  // Mock IDF fetch to avoid DB query buffering timeout
  jdMatchDependencies.fetchIdfsForKeywords = async () => ({ idfMap: {}, totalDocs: 1 });

  try {
    const result = await buildResumeJdMatch(mockResume._id, {
      job_description: 'Looking for a Node.js developer'
    });

    assert.equal(result.resume_id, mockResume._id);
    assert.equal(result.match_percentage, 100); // 1.0 similarity + 1.0 keyword match
    assert.equal(result.keyword_score, 100);
    assert.equal(result.semantic_score, 100);
    assert.ok(result.matched_keywords.includes('NODE.JS'));
  } finally {
    ResumeModel.findById = originalFindById;
    jdMatchDependencies.getResumeVectorPoint = originalGetResumeVectorPoint;
    jdMatchDependencies.generateEmbedding = originalGenerateEmbedding;
    jdMatchDependencies.fetchIdfsForKeywords = originalFetchIdfsForKeywords;
  }
});

test('buildResumeJdMatch falls back to keyword match when Qdrant fails', async () => {
  const originalFindById = ResumeModel.findById;
  const originalGetResumeVectorPoint = jdMatchDependencies.getResumeVectorPoint;

  const mockResume = {
    _id: '64f000000000000000000002',
    qdrantId: 'qdrant-resume-1',
    rawText: 'Experienced Node.js backend engineer',
    parsedData: {
      additional: {
        technicalSkills: ['Node.js']
      }
    }
  };

  ResumeModel.findById = async () => mockResume;

  // Mock Qdrant error
  jdMatchDependencies.getResumeVectorPoint = async () => {
    throw new Error('Qdrant down');
  };

  try {
    const result = await buildResumeJdMatch(mockResume._id, {
      job_description: 'Looking for a Node.js developer'
    });

    assert.equal(result.resume_id, mockResume._id);
    assert.equal(result.match_percentage, 100); // Falling back to 100% keyword ratio
    assert.equal(result.keyword_score, 100);
    assert.equal(result.semantic_score, null);
  } finally {
    ResumeModel.findById = originalFindById;
    jdMatchDependencies.getResumeVectorPoint = originalGetResumeVectorPoint;
  }
});
