export function createSearchParams(query?: string | URLSearchParams | null): URLSearchParams {
  if (!query) {
    return new URLSearchParams();
  }

  if (query instanceof URLSearchParams) {
    return new URLSearchParams(query.toString());
  }

  return new URLSearchParams(query);
}

export function setOrDeleteQueryParam(
  params: URLSearchParams,
  key: string,
  value?: string | null
): void {
  if (value) {
    params.set(key, value);
    return;
  }

  params.delete(key);
}

export function buildPathWithQuery(
  pathname: string,
  query?: string | URLSearchParams | null
): string {
  const params = createSearchParams(query);
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

type JobsFilterKey = 'search' | 'status' | 'page' | 'location';
type JobsFilterSource = 'top-level' | 'jobs-return';

const JOBS_FILTER_PRECEDENCE: Record<JobsFilterKey, JobsFilterSource[]> = {
  search: ['jobs-return', 'top-level'],
  status: ['jobs-return', 'top-level'],
  page: ['jobs-return', 'top-level'],
  location: ['jobs-return', 'top-level'],
};

function normalizeJobsFilterValue(key: JobsFilterKey, value: string | null): string {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '';
  }

  if (key === 'page') {
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return '';
    }
    return String(parsed);
  }

  if (key === 'status') {
    if (normalized !== 'all' && normalized !== 'active' && normalized !== 'closed') {
      return '';
    }
  }

  return normalized;
}

export function applyJobsFilterPrecedence(
  params: URLSearchParams,
  contextQuery?: string | URLSearchParams | null
): void {
  const topLevel = createSearchParams(contextQuery);
  const jobsReturn = createSearchParams(topLevel.get('jobs_return_query'));
  const keys: JobsFilterKey[] = ['search', 'status', 'page', 'location'];

  keys.forEach((key) => {
    const resolved = JOBS_FILTER_PRECEDENCE[key]
      .map((source) =>
        source === 'jobs-return'
          ? normalizeJobsFilterValue(key, jobsReturn.get(key))
          : normalizeJobsFilterValue(key, topLevel.get(key))
      )
      .find((value) => Boolean(value));

    setOrDeleteQueryParam(params, key, resolved || '');
  });
}

type ApplicationsReturnKey =
  | 'rc_changed_by'
  | 'rc_after'
  | 'rc_before'
  | 'rc_preset'
  | 'rc_focus'
  | 'sc_status'
  | 'sc_changed_by'
  | 'sc_after'
  | 'sc_before'
  | 'sc_preset'
  | 'sc_page'
  | 'flow_panel'
  | 'sh_open'
  | 'sc_open'
  | 'fb_open';

type ApplicationsReturnSource = 'top-level' | 'flow-return';

const APPLICATIONS_RETURN_PRECEDENCE: Record<ApplicationsReturnKey, ApplicationsReturnSource[]> = {
  rc_changed_by: ['flow-return', 'top-level'],
  rc_after: ['flow-return', 'top-level'],
  rc_before: ['flow-return', 'top-level'],
  rc_preset: ['flow-return', 'top-level'],
  rc_focus: ['flow-return', 'top-level'],
  sc_status: ['flow-return', 'top-level'],
  sc_changed_by: ['flow-return', 'top-level'],
  sc_after: ['flow-return', 'top-level'],
  sc_before: ['flow-return', 'top-level'],
  sc_preset: ['flow-return', 'top-level'],
  sc_page: ['flow-return', 'top-level'],
  flow_panel: ['flow-return', 'top-level'],
  sh_open: ['flow-return', 'top-level'],
  sc_open: ['flow-return', 'top-level'],
  fb_open: ['flow-return', 'top-level'],
};

function normalizeApplicationsReturnValue(
  key: ApplicationsReturnKey,
  value: string | null
): string {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '';
  }

  if (key === 'rc_focus') {
    if (normalized !== 'focus' && normalized !== 'all') {
      return '';
    }
  }

  if (key === 'sc_status') {
    const allowed = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];
    if (!allowed.includes(normalized)) {
      return '';
    }
  }

  if (key === 'rc_preset') {
    const allowed = ['all-time', '7d', 'this-month', 'qtd'];
    if (!allowed.includes(normalized)) {
      return '';
    }
  }

  if (key === 'sc_preset') {
    const allowed = ['all-time', '7d', '30d', '90d', 'this-week', 'this-month', 'qtd', 'ytd'];
    if (!allowed.includes(normalized)) {
      return '';
    }
  }

  if (key === 'sc_page') {
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return '';
    }
    return String(parsed);
  }

  if (key === 'flow_panel') {
    if (
      normalized !== 'status-history' &&
      normalized !== 'status-changes' &&
      normalized !== 'feedback'
    ) {
      return '';
    }
  }

  if (key === 'sh_open' || key === 'sc_open' || key === 'fb_open') {
    if (normalized !== '1' && normalized.toLowerCase() !== 'true') {
      return '';
    }
    return '1';
  }

  return normalized;
}

export function applyFlowReturnPrecedence(
  params: URLSearchParams,
  contextQuery?: string | URLSearchParams | null
): void {
  const topLevel = createSearchParams(contextQuery);
  const flowReturn = createSearchParams(topLevel.get('flow_return_query'));
  const keys: ApplicationsReturnKey[] = [
    'rc_changed_by',
    'rc_after',
    'rc_before',
    'rc_preset',
    'rc_focus',
    'sc_status',
    'sc_changed_by',
    'sc_after',
    'sc_before',
    'sc_preset',
    'sc_page',
    'flow_panel',
    'sh_open',
    'sc_open',
    'fb_open',
  ];

  keys.forEach((key) => {
    const resolved = APPLICATIONS_RETURN_PRECEDENCE[key]
      .map((source) =>
        source === 'flow-return'
          ? normalizeApplicationsReturnValue(key, flowReturn.get(key))
          : normalizeApplicationsReturnValue(key, topLevel.get(key))
      )
      .find((value) => Boolean(value));

    setOrDeleteQueryParam(params, key, resolved || '');
  });
}

export function sanitizeApplicationsReturnSnapshot(
  query?: string | URLSearchParams | null,
  options?: {
    stripCandidateIdentity?: boolean;
    stripApplicationIdentity?: boolean;
    stripFocusJobId?: boolean;
  }
): URLSearchParams {
  const params = createSearchParams(query);

  // Keep return snapshots self-contained and avoid context recursion.
  params.delete('source');
  params.delete('flow_ctx');
  params.delete('jobs_return_query');
  params.delete('applications_return_query');

  if (options?.stripCandidateIdentity) {
    params.delete('candidate_id');
    params.delete('candidate_focus');
  }

  if (options?.stripApplicationIdentity) {
    params.delete('application_id');
  }

  if (options?.stripFocusJobId) {
    params.delete('focus_job_id');
  }

  return params;
}

export function sanitizeFlowReturnSnapshot(
  query?: string | URLSearchParams | null,
  options?: {
    stripFlowContext?: boolean;
    stripJobIdentity?: boolean;
    stripApplicationIdentity?: boolean;
    stripCandidateIdentity?: boolean;
    stripPanelOpenFlags?: boolean;
  }
): URLSearchParams {
  const params = createSearchParams(query);

  if (options?.stripFlowContext !== false) {
    params.delete('flow_ctx');
  }

  if (options?.stripJobIdentity !== false) {
    params.delete('job_id');
  }

  if (options?.stripApplicationIdentity !== false) {
    params.delete('application_id');
  }

  if (options?.stripCandidateIdentity !== false) {
    params.delete('candidate_id');
  }

  if (options?.stripPanelOpenFlags !== false) {
    params.delete('sh_open');
    params.delete('sc_open');
    params.delete('fb_open');
  }

  return params;
}

export function sanitizeJobsReturnSnapshot(
  query?: string | URLSearchParams | null,
  options?: {
    stripNestedJobsReturn?: boolean;
    stripApplicationsReturn?: boolean;
  }
): URLSearchParams {
  const params = createSearchParams(query);

  if (options?.stripNestedJobsReturn !== false) {
    params.delete('jobs_return_query');
  }

  if (options?.stripApplicationsReturn !== false) {
    params.delete('applications_return_query');
  }

  return params;
}
