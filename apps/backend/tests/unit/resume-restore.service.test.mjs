import test from 'node:test';
import assert from 'node:assert/strict';

const ResumeModel = (await import('../../src/models/Resume.js')).default;
const { restoreFromVersion } = await import('../../src/services/resume.service.js');

test('restore from version copies content from version to current resume', async () => {
  const originalFindById = ResumeModel.findById;
  const originalCreate = ResumeModel.create;
  const createdSnapshots = [];

  const currentResume = {
    _id: '64f000000000000000000002',
    candidateId: '64f000000000000000000001',
    fileUrl: 'file://current.pdf',
    title: 'Current Resume',
    rawText: 'Current raw text',
    parsedData: { name: 'Current' },
    jobDescription: null,
    jobId: null,
    restoredFromVersionId: null,
    restoredAt: null,
    isAnalyzed: true,
    isMaster: false,
    filename: 'current.pdf',
    sourceFile: { filename: 'current.pdf' },
    save: async function() {
      // Mock save
      return this;
    },
  };

  const versionResume = {
    _id: '64f000000000000000000003',
    candidateId: '64f000000000000000000001',
    fileUrl: 'file://version.pdf',
    title: 'Version Resume',
    rawText: 'Version raw text',
    parsedData: { name: 'Version' },
    jobDescription: 'Test job description',
    jobId: 'job123',
  };

  ResumeModel.findById = async (resumeId) => {
    if (resumeId === currentResume._id) return currentResume;
    if (resumeId === versionResume._id) return versionResume;
    return null;
  };
  ResumeModel.create = async (snapshotData) => {
    createdSnapshots.push(snapshotData);
    return { ...snapshotData, _id: '64f000000000000000000004' };
  };

  try {
    const result = await restoreFromVersion(currentResume._id, versionResume._id);

    assert.equal(result._id, currentResume._id);
    assert.equal(result.restoredFromVersionId, versionResume._id);
    assert.ok(result.restoredAt);
    assert.equal(createdSnapshots.length, 1);
  } finally {
    ResumeModel.findById = originalFindById;
    ResumeModel.create = originalCreate;
  }
});

test('restore from version returns null if current resume not found', async () => {
  const originalFindById = ResumeModel.findById;

  ResumeModel.findById = async () => null;

  try {
    const result = await restoreFromVersion('nonexistent', 'version123');
    assert.equal(result, null);
  } finally {
    ResumeModel.findById = originalFindById;
  }
});

test('restore from version returns null if version resume not found', async () => {
  const originalFindById = ResumeModel.findById;

  const currentResume = {
    _id: '64f000000000000000000002',
    candidateId: '64f000000000000000000001',
  };

  ResumeModel.findById = async (resumeId) => (resumeId === currentResume._id ? currentResume : null);

  try {
    const result = await restoreFromVersion(currentResume._id, 'nonexistent');
    assert.equal(result, null);
  } finally {
    ResumeModel.findById = originalFindById;
  }
});

test('restore from version returns null if resumes belong to different candidates', async () => {
  const originalFindById = ResumeModel.findById;

  const currentResume = {
    _id: '64f000000000000000000002',
    candidateId: '64f000000000000000000001',
  };

  const versionResume = {
    _id: '64f000000000000000000003',
    candidateId: '64f000000000000000000999', // Different candidate
  };

  ResumeModel.findById = async (resumeId) => {
    if (resumeId === currentResume._id) return currentResume;
    if (resumeId === versionResume._id) return versionResume;
    return null;
  };

  try {
    const result = await restoreFromVersion(currentResume._id, versionResume._id);
    assert.equal(result, null);
  } finally {
    ResumeModel.findById = originalFindById;
  }
});
