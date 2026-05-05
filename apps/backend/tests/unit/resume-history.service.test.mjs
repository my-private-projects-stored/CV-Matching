import test from 'node:test';
import assert from 'node:assert/strict';

const ResumeModel = (await import('../../src/models/Resume.js')).default;
const { getResumeVersionHistory } = await import('../../src/services/resume.service.js');

test('resume history returns chronological versions for the candidate', async () => {
  const originalFindById = ResumeModel.findById;
  const originalFind = ResumeModel.find;

  const currentResume = {
    _id: '64f000000000000000000002',
    candidateId: '64f000000000000000000001',
    parentResumeId: '64f000000000000000000001',
    filename: 'tailored.pdf',
    isMaster: false,
    processingStatus: 'ready',
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
    updatedAt: new Date('2026-05-03T11:00:00.000Z'),
  };

  const versions = [
    {
      _id: '64f000000000000000000001',
      candidateId: '64f000000000000000000001',
      parentResumeId: null,
      filename: 'master.pdf',
      isMaster: true,
      processingStatus: 'ready',
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      updatedAt: new Date('2026-05-01T11:00:00.000Z'),
    },
    {
      _id: '64f000000000000000000002',
      candidateId: '64f000000000000000000001',
      parentResumeId: '64f000000000000000000001',
      filename: 'tailored.pdf',
      isMaster: false,
      processingStatus: 'ready',
      createdAt: new Date('2026-05-03T10:00:00.000Z'),
      updatedAt: new Date('2026-05-03T11:00:00.000Z'),
    },
  ];

  ResumeModel.findById = async (resumeId) => (resumeId === currentResume._id ? currentResume : null);
  ResumeModel.find = () => ({
    sort: () => versions,
  });

  try {
    const history = await getResumeVersionHistory(currentResume._id);

    assert.equal(history.resume_id, currentResume._id);
    assert.equal(history.candidate_id, currentResume.candidateId);
    assert.equal(history.root_resume_id, versions[0]._id);
    assert.equal(history.current_resume_id, currentResume._id);
    assert.equal(history.versions.length, 2);
    assert.equal(history.versions[0].resume_id, versions[0]._id);
    assert.equal(history.versions[1].resume_id, versions[1]._id);
    assert.equal(history.versions[0].is_master, true);
    assert.equal(history.versions[1].parent_id, versions[1].parentResumeId);
  } finally {
    ResumeModel.findById = originalFindById;
    ResumeModel.find = originalFind;
  }
});