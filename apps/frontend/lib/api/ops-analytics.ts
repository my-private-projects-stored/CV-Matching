import { apiFetch, apiPost, apiPut } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export interface ClusterNodeStatus {
  name: string;
  status: 'up' | 'down';
  latency_ms: number;
  http_status?: number;
  error?: string;
}

export interface ClusterHealthResponse {
  status: 'healthy' | 'degraded';
  checked_at: string;
  total_latency_ms: number;
  services: ClusterNodeStatus[];
  workers: ClusterNodeStatus[];
  datastores: ClusterNodeStatus[];
}

export interface QueuesSnapshotResponse {
  depths: Record<string, number>;
  dlqs: {
    application_scoring_queue_dlq: Array<Record<string, unknown>>;
    notification_queue_dlq: Array<Record<string, unknown>>;
  };
}

export interface AuditLogEntry {
  _id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetKey?: string;
  targetUserId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface ScoringWeightsConfig {
  semanticWeight: number;
  keywordWeight: number;
}

export interface MaintenanceModeConfig {
  global: boolean;
  modules: {
    auth: boolean;
    resumes: boolean;
    jobs: boolean;
    applications: boolean;
    recommendations: boolean;
    enrichment: boolean;
    notifications: boolean;
  };
}

export interface AnalyticsOverviewResponse {
  range: string;
  kpis: {
    totalUsers: number;
    usersByRole: Record<string, number>;
    totalResumes: number;
    totalJobs: number;
    activeJobs: number;
    totalApplications: number;
  };
  categoryBreakdown: Record<string, number>;
  series: Array<{
    date: string;
    users: number;
    resumes: number;
    jobs: number;
    applications: number;
  }>;
}

export interface AnalyticsFunnelResponse {
  range: string;
  totalApplications: number;
  stageCounts: Record<string, number>;
  conversionRates: {
    screeningRate: number;
    interviewRate: number;
    offerRate: number;
    hireRate: number;
  };
  aiCorrelation: {
    highScoreGroup: {
      count: number;
      interviewed: number;
      hired: number;
      interviewRate: number;
      hireRate: number;
    };
    lowScoreGroup: {
      count: number;
      interviewed: number;
      hired: number;
      interviewRate: number;
      hireRate: number;
    };
  };
}

export async function fetchClusterHealth(): Promise<ClusterHealthResponse> {
  const res = await apiFetch('/config-analytics/health/cluster');
  await assertOk(res, 'Failed to load cluster health');
  return res.json();
}

export async function fetchQueuesSnapshot(): Promise<QueuesSnapshotResponse> {
  const res = await apiFetch('/config-analytics/queues');
  await assertOk(res, 'Failed to load Redis queues');
  return res.json();
}

export async function retryDlq(
  dlqName: 'application_scoring_queue_dlq' | 'notification_queue_dlq',
  count = 20
): Promise<{ dlqName: string; targetQueue: string; retriedCount: number }> {
  const res = await apiPost('/config-analytics/queues/retry', { dlqName, count });
  await assertOk(res, 'Failed to retry DLQ messages');
  return res.json();
}

export async function triggerVectorReindex(
  target: 'resumes' | 'jobs',
  batchSize = 100
): Promise<{
  alias: string;
  newCollection: string;
  reindexedCount: number;
  alias_swap_ms: number;
}> {
  const res = await apiPost('/config-analytics/vector/reindex', { target, batchSize });
  await assertOk(res, 'Failed to trigger vector reindex');
  return res.json();
}

export async function fetchAuditLogs(params?: {
  action?: string;
  limit?: number;
}): Promise<{ logs: AuditLogEntry[] }> {
  const qs = new URLSearchParams();
  if (params?.action) qs.set('action', params.action);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch(`/config-analytics/audit-logs${suffix}`);
  await assertOk(res, 'Failed to load audit logs');
  return res.json();
}

export async function fetchScoringWeights(): Promise<ScoringWeightsConfig> {
  const res = await apiFetch('/config/scoring-weights');
  await assertOk(res, 'Failed to load scoring weights');
  return res.json();
}

export async function updateScoringWeights(
  weights: ScoringWeightsConfig
): Promise<{ value: ScoringWeightsConfig }> {
  const res = await apiPut('/config/scoring-weights', weights);
  await assertOk(res, 'Failed to update scoring weights');
  return res.json();
}

export async function fetchMaintenanceMode(): Promise<MaintenanceModeConfig> {
  const res = await apiFetch('/config/maintenance');
  await assertOk(res, 'Failed to load maintenance mode');
  return res.json();
}

export async function updateMaintenanceMode(
  config: MaintenanceModeConfig
): Promise<{ value: MaintenanceModeConfig }> {
  const res = await apiPut('/config/maintenance', config);
  await assertOk(res, 'Failed to update maintenance mode');
  return res.json();
}

export async function fetchAnalyticsOverview(
  range: '7d' | '30d' | '90d' = '30d'
): Promise<AnalyticsOverviewResponse> {
  const res = await apiFetch(
    `/config-analytics/analytics/overview?range=${encodeURIComponent(range)}`
  );
  await assertOk(res, 'Failed to load analytics overview');
  return res.json();
}

export async function fetchAnalyticsFunnel(
  range: '7d' | '30d' | '90d' = '30d'
): Promise<AnalyticsFunnelResponse> {
  const res = await apiFetch(
    `/config-analytics/analytics/funnel?range=${encodeURIComponent(range)}`
  );
  await assertOk(res, 'Failed to load recruitment funnel');
  return res.json();
}

export async function downloadAnalyticsCsv(range: '7d' | '30d' | '90d' = '30d'): Promise<string> {
  const res = await apiFetch(
    `/config-analytics/analytics/export?range=${encodeURIComponent(range)}`
  );
  await assertOk(res, 'Failed to export analytics CSV');
  return res.text();
}
