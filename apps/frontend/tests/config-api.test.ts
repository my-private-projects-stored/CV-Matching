import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
}));

import {
  clearAllApiKeys,
  deleteApiKey,
  fetchApiKeyStatus,
  fetchCompanyProfileConfig,
  fetchLlmConfig,
  fetchPrivacyConfig,
  fetchSystemStatus,
  resetDatabase,
  updateCompanyProfileConfig,
  updateLlmConfig,
  updatePrivacyConfig,
} from '@/lib/api/config';
import { apiFetch } from '@/lib/api/client';

const mockedApiFetch = vi.mocked(apiFetch);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('settings API client', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it('fetchSystemStatus requests /status and returns parsed payload', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        status: 'ready',
        llm_configured: true,
        llm_healthy: true,
        has_master_resume: false,
        database_stats: {
          total_resumes: 0,
          total_jobs: 0,
          total_improvements: 0,
          has_master_resume: false,
        },
      })
    );

    const result = await fetchSystemStatus();

    expect(result.status).toBe('ready');
    expect(mockedApiFetch).toHaveBeenCalledWith('/status', { credentials: 'include' });
  });

  it('updateLlmConfig sends PUT body and surfaces backend detail errors', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ detail: 'Model is not allowed' }, 400));

    await expect(
      updateLlmConfig({ provider: 'openai', model: 'invalid-model', api_key: 'sk-test' })
    ).rejects.toThrow('Model is not allowed');

    expect(mockedApiFetch).toHaveBeenCalledWith('/config/llm-api-key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider: 'openai', model: 'invalid-model', api_key: 'sk-test' }),
    });
  });

  it('updateLlmConfig preserves error_code for policy-aware UI', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          message: 'Blocked by privacy mode',
          error_code: 'provider_blocked_by_privacy_mode',
        },
        400
      )
    );

    await expect(
      updateLlmConfig({ provider: 'openai', model: 'gpt-5-nano-2025-08-07' })
    ).rejects.toMatchObject({
      errorCode: 'provider_blocked_by_privacy_mode',
      statusCode: 400,
    });
  });

  it('fetchLlmConfig returns masked API key config', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        provider: 'openai',
        model: 'gpt-5-nano-2025-08-07',
        api_key: 'sk-t****90',
        api_base: 'https://api.openai.com/v1',
      })
    );

    const result = await fetchLlmConfig();

    expect(result.provider).toBe('openai');
    expect(result.api_key).toContain('****');
  });

  it('fetchApiKeyStatus returns provider status list', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        providers: [
          { provider: 'openai', configured: true, masked_key: 'sk-o****56' },
          { provider: 'google', configured: false, masked_key: null },
        ],
      })
    );

    const result = await fetchApiKeyStatus();

    expect(result.providers).toHaveLength(2);
    expect(result.providers[0]?.provider).toBe('openai');
    expect(mockedApiFetch).toHaveBeenCalledWith('/config/api-keys', { credentials: 'include' });
  });

  it('deleteApiKey accepts 204 No Content without error', async () => {
    mockedApiFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteApiKey('openai')).resolves.toBeUndefined();
    expect(mockedApiFetch).toHaveBeenCalledWith('/config/api-keys/openai', {
      method: 'DELETE',
      credentials: 'include',
    });
  });

  it('clearAllApiKeys and resetDatabase send expected requests', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Database reset completed' }, 200));

    await expect(clearAllApiKeys()).resolves.toBeUndefined();
    await expect(resetDatabase()).resolves.toBeUndefined();

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, '/config/api-keys?confirm=CLEAR_ALL_KEYS', {
      method: 'DELETE',
      credentials: 'include',
    });

    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, '/config/reset', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'RESET_ALL_DATA' }),
    });
  });

  it('fetchCompanyProfileConfig and updateCompanyProfileConfig call expected endpoints', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(
        jsonResponse({
          company_name: 'Acme Inc',
          overview: 'Builds AI tools',
          industry: 'Software',
          company_size: '51-200',
          address: 'Hanoi',
          website: 'https://acme.example',
          brand_primary_color: '#1D4ED8',
          brand_logo_url: 'https://acme.example/logo.png',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          company_name: 'Acme Inc',
          overview: 'Builds AI tools globally',
          industry: 'Software',
          company_size: '51-200',
          address: 'Hanoi',
          website: 'https://acme.example',
          brand_primary_color: '#1D4ED8',
          brand_logo_url: 'https://acme.example/logo.png',
        })
      );

    const profile = await fetchCompanyProfileConfig();
    expect(profile.company_name).toBe('Acme Inc');

    const updated = await updateCompanyProfileConfig({
      overview: 'Builds AI tools globally',
    });
    expect(updated.overview).toContain('globally');

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, '/config/company-profile', {
      credentials: 'include',
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, '/config/company-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ overview: 'Builds AI tools globally' }),
    });
  });

  it('fetchPrivacyConfig and updatePrivacyConfig call expected endpoints', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(jsonResponse({ privacy_mode: 'hybrid' }))
      .mockResolvedValueOnce(jsonResponse({ privacy_mode: 'local_only' }));

    const privacy = await fetchPrivacyConfig();
    expect(privacy.privacy_mode).toBe('hybrid');

    const updated = await updatePrivacyConfig({ privacy_mode: 'local_only' });
    expect(updated.privacy_mode).toBe('local_only');

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, '/config/privacy', {
      credentials: 'include',
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, '/config/privacy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ privacy_mode: 'local_only' }),
    });
  });
});
