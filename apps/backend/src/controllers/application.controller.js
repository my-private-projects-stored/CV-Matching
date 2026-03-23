import {
  createApplication,
  getApplicationFeedback,
  getApplicationStatusHistory,
  getApplicationStatusSummaryByJob,
  listRecentStatusChangesByJob,
  listCandidateApplicationHistory,
  listRankedApplicationsByJob,
  updateApplicationStatus,
} from "../services/application.service.js";

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createApplicationHandler(req, res, next) {
  try {
    const result = await createApplication(req.body || {});
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(201).json({
      request_id: requestId(),
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listRankedApplicationsHandler(req, res, next) {
  try {
    const result = await listRankedApplicationsByJob(req.query?.job_id, req.query || {});
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listApplicationHistoryHandler(req, res, next) {
  try {
    const result = await listCandidateApplicationHistory(req.query?.candidate_id, req.query || {});
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateApplicationStatusHandler(req, res, next) {
  try {
    const result = await updateApplicationStatus(req.params.id, req.body?.status, req.body?.changed_by);
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getApplicationStatusHistoryHandler(req, res, next) {
  try {
    const result = await getApplicationStatusHistory(req.params.id);
    if (result.error) {
      return res.status(result.code || 404).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getApplicationFeedbackHandler(req, res, next) {
  try {
    const result = await getApplicationFeedback(req.params.id);
    if (result.error) {
      return res.status(result.code || 404).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getApplicationSummaryHandler(req, res, next) {
  try {
    const result = await getApplicationStatusSummaryByJob(req.query?.job_id);
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listRecentStatusChangesHandler(req, res, next) {
  try {
    const result = await listRecentStatusChangesByJob(req.query?.job_id, req.query || {});
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}
