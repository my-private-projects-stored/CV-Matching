param(
  [string]$QueueName = "application_scoring_queue",
  [string]$DlqName = "application_scoring_queue_dlq",
  [int]$Count = 1,
  [string]$Actor = $env:USERNAME,
  [string]$AuditFile,
  [string]$WebhookUrl,
  [string]$WebhookAuthHeaderName = "",
  [string]$WebhookAuthToken = "",
  [string]$WebhookSigningSecret = "",
  [string]$WebhookSignatureHeader = "X-CV-Replay-Signature",
  [string]$WebhookTimestampHeader = "X-CV-Replay-Timestamp",
  [string]$WebhookIdempotencyHeader = "X-CV-Replay-Idempotency-Key",
  [string]$WebhookIdempotencyKey = "",
  [int]$WebhookMinIntervalSeconds = 0,
  [int]$WebhookMaxAttempts = 1,
  [int]$WebhookRetryBackoffMs = 500,
  [int]$WebhookRetryJitterMs = 0,
  [int]$WebhookTimeoutSeconds = 10,
  [int]$WebhookAttemptErrorsMax = 5,
  [string]$WebhookThrottleStateFile = "./scripts/replay-audit-webhook-state.json",
  [string]$CommitSha = "",
  [string]$WorkflowRunUrl = "",
  [string]$Repository = "",
  [string]$RefName = "",
  [string]$RunnerClass = "",
  [string]$ApplicationId,
  [int]$MaxAgeMinutes = 0,
  [switch]$DryRun,
  [switch]$ReplayAll,
  [int]$SampleCount = 3
)

$ErrorActionPreference = "Stop"

if ($ReplayAll) {
  $Count = [int]::MaxValue
}

function Invoke-RedisCli {
  param(
    [string]$Command
  )

  docker compose --profile app exec -T redis sh -lc "redis-cli --raw $Command"
}

function Write-ReplayAudit {
  param(
    [string]$Status,
    [int]$Requested,
    [int]$Available,
    [int]$Replayed,
    [int]$Eligible,
    [int]$Scanned,
    [string]$Reason = ""
  )

  $maxAttemptStatusSequence = 8

  function Set-WebhookFinalStatus {
    param(
      [hashtable]$Delivery,
      [string]$NewStatus
    )

    if ([string]::IsNullOrWhiteSpace($NewStatus)) {
      return
    }

    if ($Delivery.final_status -ne $NewStatus) {
      $Delivery.state_transition_count = [int]$Delivery.state_transition_count + 1
      $Delivery.final_status = $NewStatus
      $Delivery.attempt_status_sequence_tail_status_expected = $Delivery.final_status
      $Delivery.last_transition_at_utc = [DateTime]::UtcNow.ToString("o")

      $sequence = [System.Collections.ArrayList]@($Delivery.attempt_status_sequence)
      [void]$sequence.Add($NewStatus)
      while ($sequence.Count -gt $maxAttemptStatusSequence) {
        $Delivery.attempt_status_sequence_truncated = $true
        $sequence.RemoveAt(0)
      }
      $Delivery.attempt_status_sequence = @($sequence)
      $Delivery.attempt_status_sequence_count = [int]$Delivery.attempt_status_sequence.Count
      $Delivery.attempt_status_sequence_is_empty = ($Delivery.attempt_status_sequence_count -eq 0)
      $Delivery.attempt_status_sequence_last_index = [int]$Delivery.attempt_status_sequence.Count - 1
      $Delivery.attempt_status_sequence_tail_status = $(if ($Delivery.attempt_status_sequence_count -gt 0) { $Delivery.attempt_status_sequence[$Delivery.attempt_status_sequence_count - 1] } else { $null })
      $Delivery.attempt_status_sequence_tail_status_present = ($null -ne $Delivery.attempt_status_sequence_tail_status)
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope = $(if ($Delivery.attempt_status_sequence_count -gt 0) { "tail_and_final" } else { "tail_only" })
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code = $(if ($Delivery.attempt_status_sequence_count -gt 0) { 1 } else { 0 })
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code_valid = ($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code -in @(0, 1))
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_consistent = (
        (($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope -eq "tail_only") -and ($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code -eq 0)) -or
        (($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope -eq "tail_and_final") -and ($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code -eq 1))
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code_matches_scope = $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_consistent
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_label_code_pair = "$($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope):$($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code)"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code = 1
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_valid = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code -in @(1)
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source = (
        (($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source -eq "derived") -and
        ($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code -eq 1))
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source -eq
        ((($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source -eq "derived") -and
        ($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code -eq 1)))
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope = "source_only"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope -eq "source_only"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_source = "derived"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_source_version = "v1"
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_source_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_source -eq "derived"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source -eq "derived"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source -eq "derived"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source -eq "derived"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source -eq "derived"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source -eq "derived"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version -eq "v1"
      )
      $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_consistent = (
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_label_code_pair -eq
        "$($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope):$($Delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code)"
      )
      $Delivery.attempt_status_sequence_tail_status_deviation = (($Delivery.attempt_status_sequence_count -gt 0) -and ($Delivery.attempt_status_sequence_tail_status -ne $Delivery.attempt_status_sequence_tail_status_expected))
      $Delivery.attempt_status_sequence_tail_matches_final = (($Delivery.attempt_status_sequence_count -eq 0) -or ($Delivery.attempt_status_sequence_tail_status -eq $Delivery.final_status))
      $Delivery.attempt_status_sequence_tail_status_consistent = (
        (($Delivery.attempt_status_sequence_tail_status_present -eq ($Delivery.attempt_status_sequence_count -gt 0)) -and
        (($Delivery.attempt_status_sequence_count -eq 0) -or ($Delivery.attempt_status_sequence_tail_status -eq $Delivery.attempt_status_sequence_tail_status_expected)) -and
        $Delivery.attempt_status_sequence_tail_matches_final)
      )

      if ($Delivery.attempt_status_sequence_tail_status_consistent) {
        $Delivery.attempt_status_sequence_tail_status_consistency_reason = "ok"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_code = 0
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_detail = "tail status is aligned with expected and final status semantics"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_source = "derived"
      } elseif ($Delivery.attempt_status_sequence_tail_status_present -ne ($Delivery.attempt_status_sequence_count -gt 0)) {
        $Delivery.attempt_status_sequence_tail_status_consistency_reason = "tail_presence_mismatch"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_code = 1
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_detail = "tail status presence flag does not match sequence non-empty state"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_source = "validated"
      } elseif ($Delivery.attempt_status_sequence_count -gt 0 -and $Delivery.attempt_status_sequence_tail_status -ne $Delivery.attempt_status_sequence_tail_status_expected) {
        $Delivery.attempt_status_sequence_tail_status_consistency_reason = "tail_expected_mismatch"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_code = 2
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_detail = "tail status differs from expected tail status derived from final status"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_source = "validated"
      } elseif (-not $Delivery.attempt_status_sequence_tail_matches_final) {
        $Delivery.attempt_status_sequence_tail_status_consistency_reason = "tail_final_mismatch"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_code = 3
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_detail = "tail status does not match final status"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_source = "validated"
      } else {
        $Delivery.attempt_status_sequence_tail_status_consistency_reason = "unknown_inconsistency"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_code = 9
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_detail = "tail consistency evaluation failed with an unknown state combination"
        $Delivery.attempt_status_sequence_tail_status_consistency_reason_source = "validated"
      }
      if ($Delivery.status_transition_window_size -gt 0) {
        $Delivery.attempt_status_sequence_window_utilization_ratio = [Math]::Round(([double]$Delivery.attempt_status_sequence_count / [double]$Delivery.status_transition_window_size), 4)
        $Delivery.attempt_status_sequence_window_headroom = [Math]::Max(0, [int]$Delivery.status_transition_window_size - [int]$Delivery.attempt_status_sequence_count)
      } else {
        $Delivery.attempt_status_sequence_window_utilization_ratio = 0
        $Delivery.attempt_status_sequence_window_headroom = 0
      }
      $Delivery.attempt_status_sequence_consistent = (
        (($Delivery.attempt_status_sequence_count -eq $Delivery.attempt_status_sequence.Count) -and
        (($Delivery.attempt_status_sequence_count -eq 0 -and $Delivery.attempt_status_sequence_last_index -eq -1) -or
        ($Delivery.attempt_status_sequence_count -gt 0 -and $Delivery.attempt_status_sequence_last_index -eq ($Delivery.attempt_status_sequence_count - 1))))
      )
    }
  }

  $webhookConfigured = -not [string]::IsNullOrWhiteSpace($WebhookUrl)
  $maxAttempts = $(if ($webhookConfigured) { [Math]::Max(1, [int]$WebhookMaxAttempts) } else { 0 })
  $timeoutSeconds = $(if ($webhookConfigured) { [Math]::Max(1, [int]$WebhookTimeoutSeconds) } else { 0 })
  $endpointHost = $null
  $endpointHostClassification = $null

  if ($webhookConfigured) {
    try {
      $uri = [Uri]$WebhookUrl
      $endpointHost = $uri.Host

      if ([string]::IsNullOrWhiteSpace($endpointHost)) {
        $endpointHostClassification = "unknown"
      } elseif ($endpointHost -eq "localhost" -or $endpointHost -eq "127.0.0.1" -or $endpointHost -eq "::1") {
        $endpointHostClassification = "loopback"
      } elseif ($endpointHost -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)') {
        $endpointHostClassification = "private_ipv4"
      } elseif ($endpointHost -match '(\.internal$|\.local$)') {
        $endpointHostClassification = "internal_dns"
      } else {
        $endpointHostClassification = "public_dns_or_ip"
      }
    } catch {
      $endpointHost = $null
      $endpointHostClassification = "invalid_url"
    }
  }

  $webhookDelivery = [ordered]@{
    configured = [bool]$webhookConfigured
    delivery_mode = $(if ($webhookConfigured) { "attempted" } else { "not_configured" })
    result_bucket = $(if ($webhookConfigured) { "failed" } else { "not_configured" })
    terminal_state = $(if ($webhookConfigured) { "failed" } else { "not_configured" })
    attempted = 0
    max_attempts = $maxAttempts
    state_transition_count = 0
    status_transition_window_size = $maxAttemptStatusSequence
    last_transition_at_utc = $null
    attempt_status_sequence = @()
    attempt_status_sequence_count = 0
    attempt_status_sequence_is_empty = $true
    attempt_status_sequence_last_index = -1
    attempt_status_sequence_tail_status = $null
    attempt_status_sequence_tail_status_present = $false
    attempt_status_sequence_tail_status_expected = $(if ($webhookConfigured) { "pending" } else { "not_configured" })
    attempt_status_sequence_tail_status_deviation = $false
    attempt_status_sequence_tail_matches_final = $true
    attempt_status_sequence_tail_status_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason = "ok"
    attempt_status_sequence_tail_status_consistency_reason_code = 0
    attempt_status_sequence_tail_status_consistency_reason_detail = "tail status is aligned with expected and final status semantics"
    attempt_status_sequence_tail_status_consistency_reason_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope = "tail_only"
    attempt_status_sequence_tail_status_consistency_reason_scope_code = 0
    attempt_status_sequence_tail_status_consistency_reason_scope_code_valid = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_code_matches_scope = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_label_code_pair = "tail_only:0"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code = 1
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_valid = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope = "source_only"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_source = "derived"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_source_version = "v1"
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_source_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_source_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_source_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_source_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version_source_scope_version_source_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_consistent = $true
    attempt_status_sequence_tail_status_consistency_reason_scope_pair_consistent = $true
    attempt_status_sequence_window_utilization_ratio = 0
    attempt_status_sequence_window_headroom = $maxAttemptStatusSequence
    attempt_status_sequence_consistent = $true
    attempt_status_sequence_truncated = $false
    sent = $false
    final_status = $(if ($webhookConfigured) { "pending" } else { "not_configured" })
    throttled = $false
    last_status_code = $null
    timeout_seconds = $(if ($webhookConfigured) { $timeoutSeconds } else { $null })
    duration_ms = $null
    total_backoff_ms = $(if ($webhookConfigured) { 0 } else { $null })
    endpoint_host = $endpointHost
    endpoint_host_classification = $endpointHostClassification
    attempt_errors = @()
    last_error_at_utc = $null
    last_success_at_utc = $null
    success_after_retry = $false
    retry_count = 0
    final_error_code = $null
    error_family = $null
  }

  $audit = [ordered]@{
    event = "dlq_replay"
    status = $Status
    timestamp_utc = [DateTime]::UtcNow.ToString("o")
    actor = $(if ([string]::IsNullOrWhiteSpace($Actor)) { "unknown" } else { $Actor })
    queue_name = $QueueName
    dlq_name = $DlqName
    requested = $Requested
    available = $Available
    replayed = $Replayed
    eligible = $Eligible
    scanned = $Scanned
    filters = [ordered]@{
      application_id = $(if ([string]::IsNullOrWhiteSpace($ApplicationId)) { $null } else { $ApplicationId })
      max_age_minutes = $(if ($MaxAgeMinutes -gt 0) { $MaxAgeMinutes } else { $null })
      replay_all = [bool]$ReplayAll
      dry_run = [bool]$DryRun
    }
    reason = $(if ([string]::IsNullOrWhiteSpace($Reason)) { $null } else { $Reason })
    repository = $(if ([string]::IsNullOrWhiteSpace($Repository)) { $null } else { $Repository })
    ref_name = $(if ([string]::IsNullOrWhiteSpace($RefName)) { $null } else { $RefName })
    commit_sha = $(if ([string]::IsNullOrWhiteSpace($CommitSha)) { $null } else { $CommitSha })
    workflow_run_url = $(if ([string]::IsNullOrWhiteSpace($WorkflowRunUrl)) { $null } else { $WorkflowRunUrl })
    runner_class = $(if ([string]::IsNullOrWhiteSpace($RunnerClass)) { $null } else { $RunnerClass })
    webhook_delivery = $webhookDelivery
  }

  $json = $null

  if ($webhookConfigured) {
    if ($WebhookMinIntervalSeconds -gt 0) {
      $lastSentUtc = $null

      if (Test-Path -Path $WebhookThrottleStateFile) {
        try {
          $stateRaw = Get-Content -Path $WebhookThrottleStateFile -Raw -Encoding utf8
          $state = $stateRaw | ConvertFrom-Json -ErrorAction Stop
          $lastSentUtc = [string]$state.last_sent_utc
        } catch {
          $lastSentUtc = $null
        }
      }

      if (-not [string]::IsNullOrWhiteSpace($lastSentUtc)) {
        try {
          $elapsed = ([DateTime]::UtcNow - ([DateTime]::Parse($lastSentUtc)).ToUniversalTime()).TotalSeconds
          if ($elapsed -lt $WebhookMinIntervalSeconds) {
            Write-Host "Replay audit webhook throttled by min interval ($WebhookMinIntervalSeconds seconds)." -ForegroundColor Yellow
            Set-WebhookFinalStatus -Delivery $webhookDelivery -NewStatus "throttled"
            $webhookDelivery.throttled = $true
            $webhookDelivery.delivery_mode = "throttled"
            $webhookDelivery.result_bucket = "throttled"
            $webhookDelivery.terminal_state = "throttled"
          }
        } catch {
          # Ignore state parse issues and continue sending webhook.
        }
      }
    }

    if (-not $webhookDelivery.throttled) {
      $webhookStartUtc = [DateTime]::UtcNow
      $headers = @{}

      if (-not [string]::IsNullOrWhiteSpace($WebhookAuthHeaderName) -and -not [string]::IsNullOrWhiteSpace($WebhookAuthToken)) {
        $headers[$WebhookAuthHeaderName] = $WebhookAuthToken
      }

      $baseBackoffMs = [Math]::Max(0, [int]$WebhookRetryBackoffMs)
      $jitterMs = [Math]::Max(0, [int]$WebhookRetryJitterMs)
      $attemptErrorsMax = [Math]::Max(0, [int]$WebhookAttemptErrorsMax)
      $totalBackoffMs = 0
      $sent = $false

      for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        $webhookDelivery.attempted = $attempt
        Set-WebhookFinalStatus -Delivery $webhookDelivery -NewStatus "attempting"

        $json = $audit | ConvertTo-Json -Depth 8 -Compress

        if (-not [string]::IsNullOrWhiteSpace($WebhookSigningSecret)) {
          $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
          $toSign = "$timestamp.$json"

          $hmac = New-Object System.Security.Cryptography.HMACSHA256
          $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($WebhookSigningSecret)
          $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($toSign))
          $signatureHex = -join ($signatureBytes | ForEach-Object { $_.ToString("x2") })

          $headers[$WebhookSignatureHeader] = "sha256=$signatureHex"
          $headers[$WebhookTimestampHeader] = $timestamp
        }

        if (-not [string]::IsNullOrWhiteSpace($WebhookIdempotencyHeader)) {
          $idempotencyValue = $WebhookIdempotencyKey
          if ([string]::IsNullOrWhiteSpace($idempotencyValue)) {
            $idHash = New-Object System.Security.Cryptography.SHA256Managed
            $idBytes = $idHash.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($json))
            $idHex = -join ($idBytes | ForEach-Object { $_.ToString("x2") })
            $idempotencyValue = $idHex
          }

          $headers[$WebhookIdempotencyHeader] = $idempotencyValue
        }

        try {
          if ($headers.Count -gt 0) {
            Invoke-RestMethod -Uri $WebhookUrl -Method Post -ContentType "application/json" -Headers $headers -Body $json -TimeoutSec $timeoutSeconds | Out-Null
          } else {
            Invoke-RestMethod -Uri $WebhookUrl -Method Post -ContentType "application/json" -Body $json -TimeoutSec $timeoutSeconds | Out-Null
          }

          $sent = $true
          $webhookDelivery.sent = $true
          Set-WebhookFinalStatus -Delivery $webhookDelivery -NewStatus "success"
          $webhookDelivery.result_bucket = "success"
          $webhookDelivery.terminal_state = "success"
          $webhookDelivery.last_status_code = 200
          $webhookDelivery.last_success_at_utc = [DateTime]::UtcNow.ToString("o")
          $webhookDelivery.success_after_retry = ($attempt -gt 1)
          $webhookDelivery.final_error_code = $null
          $webhookDelivery.error_family = $null
          break
        } catch {
          $statusCode = "unknown"
          $errorMessage = $_.Exception.Message
          if ($null -ne $_.Exception.Response) {
            try {
              $statusCode = [int]$_.Exception.Response.StatusCode
            } catch {
              $statusCode = "unknown"
            }
          }

          $webhookDelivery.last_status_code = $statusCode
          Set-WebhookFinalStatus -Delivery $webhookDelivery -NewStatus $(if ($attempt -lt $maxAttempts) { "retrying" } else { "failed" })
          $webhookDelivery.last_error_at_utc = [DateTime]::UtcNow.ToString("o")
          $webhookDelivery.result_bucket = "failed"
          if ($attempt -ge $maxAttempts) {
            $webhookDelivery.terminal_state = "failed"
          }

          if ($statusCode -is [int]) {
            if ($statusCode -eq 429) {
              $webhookDelivery.final_error_code = "rate_limited"
            } elseif ($statusCode -eq 401 -or $statusCode -eq 403) {
              $webhookDelivery.final_error_code = "auth_error"
            } elseif ($statusCode -eq 404) {
              $webhookDelivery.final_error_code = "not_found"
            } elseif ($statusCode -ge 500) {
              $webhookDelivery.final_error_code = "server_error"
            } elseif ($statusCode -ge 400) {
              $webhookDelivery.final_error_code = "client_error"
            } else {
              $webhookDelivery.final_error_code = "http_error"
            }
          } elseif (-not [string]::IsNullOrWhiteSpace($errorMessage) -and $errorMessage -match '(?i)timed out|timeout') {
            $webhookDelivery.final_error_code = "timeout"
          } elseif (-not [string]::IsNullOrWhiteSpace($errorMessage) -and $errorMessage -match '(?i)name or service not known|no such host|dns|remote name could not be resolved|unable to connect|connection') {
            $webhookDelivery.final_error_code = "network_error"
          } else {
            $webhookDelivery.final_error_code = "transport_error"
          }

          switch ($webhookDelivery.final_error_code) {
            "rate_limited" { $webhookDelivery.error_family = "client"; break }
            "auth_error" { $webhookDelivery.error_family = "client"; break }
            "not_found" { $webhookDelivery.error_family = "client"; break }
            "client_error" { $webhookDelivery.error_family = "client"; break }
            "server_error" { $webhookDelivery.error_family = "server"; break }
            "timeout" { $webhookDelivery.error_family = "transport"; break }
            "network_error" { $webhookDelivery.error_family = "transport"; break }
            "transport_error" { $webhookDelivery.error_family = "transport"; break }
            "http_error" { $webhookDelivery.error_family = "protocol"; break }
            default { $webhookDelivery.error_family = "unknown"; break }
          }

          if ($attemptErrorsMax -gt 0 -and $webhookDelivery.attempt_errors.Count -lt $attemptErrorsMax) {
            $truncatedMessage = $errorMessage
            if (-not [string]::IsNullOrWhiteSpace($truncatedMessage) -and $truncatedMessage.Length -gt 240) {
              $truncatedMessage = $truncatedMessage.Substring(0, 240)
            }

            $webhookDelivery.attempt_errors += [ordered]@{
              attempt = $attempt
              status_code = $statusCode
              error = $truncatedMessage
            }
          }

          if ($attempt -lt $maxAttempts) {
            $baseDelayMs = [int][Math]::Min(30000, $baseBackoffMs * [Math]::Pow(2, $attempt - 1))
            $retryJitterMs = 0
            if ($jitterMs -gt 0) {
              $retryJitterMs = Get-Random -Minimum 0 -Maximum ($jitterMs + 1)
            }
            $retryDelayMs = [Math]::Min(30000, $baseDelayMs + $retryJitterMs)
            $totalBackoffMs += $retryDelayMs

            Write-Host "Replay audit webhook send failed (attempt $attempt/$maxAttempts, status=$statusCode). Retrying in $retryDelayMs ms (base=$baseDelayMs, jitter=$retryJitterMs)..." -ForegroundColor Yellow
            if ($retryDelayMs -gt 0) {
              Start-Sleep -Milliseconds $retryDelayMs
            }
          } else {
            Write-Host "::warning::Failed to send replay-audit webhook notification after $maxAttempts attempt(s) (status=$statusCode, timeout=${timeoutSeconds}s, error=$errorMessage)."
          }
        }
      }

      if ($sent) {
        if ($WebhookMinIntervalSeconds -gt 0 -and -not [string]::IsNullOrWhiteSpace($WebhookThrottleStateFile)) {
          $throttleDir = Split-Path -Path $WebhookThrottleStateFile -Parent
          if (-not [string]::IsNullOrWhiteSpace($throttleDir)) {
            New-Item -ItemType Directory -Path $throttleDir -Force | Out-Null
          }

          $stateOut = [ordered]@{
            last_sent_utc = [DateTime]::UtcNow.ToString("o")
            last_status = $Status
          }
          ($stateOut | ConvertTo-Json -Depth 4) | Out-File -FilePath $WebhookThrottleStateFile -Encoding utf8
        }

        Write-Host "Replay audit webhook notification sent." -ForegroundColor Cyan
      }

      $webhookDurationMs = [Math]::Floor(([DateTime]::UtcNow - $webhookStartUtc).TotalMilliseconds)
      $webhookDelivery.duration_ms = [int][Math]::Max(0, $webhookDurationMs)
      $webhookDelivery.total_backoff_ms = [int][Math]::Max(0, $totalBackoffMs)
      $webhookDelivery.retry_count = [int][Math]::Max(0, $webhookDelivery.attempted - 1)
    }
  }

  $json = $audit | ConvertTo-Json -Depth 8 -Compress

  Write-Host "Replay audit (json):" -ForegroundColor Cyan
  Write-Host $json

  if (-not [string]::IsNullOrWhiteSpace($AuditFile)) {
    $directory = Split-Path -Path $AuditFile -Parent
    if (-not [string]::IsNullOrWhiteSpace($directory)) {
      New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    Add-Content -Path $AuditFile -Value $json -Encoding utf8
    Write-Host "Replay audit appended to file: $AuditFile" -ForegroundColor Cyan
  }
}

function Convert-ToMessage {
  param(
    [string]$RawMessage
  )

  if ([string]::IsNullOrWhiteSpace($RawMessage)) {
    return $null
  }

  try {
    return $RawMessage | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $null
  }
}

function Test-ShouldReplay {
  param(
    [object]$Message,
    [string]$ApplicationId,
    [int]$MaxAgeMinutes
  )

  if (-not $Message) {
    return $false
  }

  if (-not [string]::IsNullOrWhiteSpace($ApplicationId)) {
    if ([string]$Message.application_id -ne $ApplicationId) {
      return $false
    }
  }

  if ($MaxAgeMinutes -gt 0) {
    $reference = $null

    if (-not [string]::IsNullOrWhiteSpace([string]$Message.last_failed_at)) {
      try {
        $reference = [DateTime]::Parse([string]$Message.last_failed_at)
      } catch {
        $reference = $null
      }
    }

    if (-not $reference -and -not [string]::IsNullOrWhiteSpace([string]$Message.dead_lettered_at)) {
      try {
        $reference = [DateTime]::Parse([string]$Message.dead_lettered_at)
      } catch {
        $reference = $null
      }
    }

    if (-not $reference) {
      return $false
    }

    $ageMinutes = [Math]::Floor(([DateTime]::UtcNow - $reference.ToUniversalTime()).TotalMinutes)
    if ($ageMinutes -gt $MaxAgeMinutes) {
      return $false
    }
  }

  return $true
}

$dlqDepthText = Invoke-RedisCli -Command "LLEN $DlqName"
if ([string]::IsNullOrWhiteSpace($dlqDepthText)) {
  Write-Host "Failed to query DLQ depth. Ensure docker compose service 'redis' is running." -ForegroundColor Red
  exit 1
}

$dlqDepth = [int]($dlqDepthText.Trim())

if ($dlqDepth -le 0) {
  Write-Host "DLQ is empty: $DlqName" -ForegroundColor Yellow
  Write-ReplayAudit -Status "no-op" -Requested $Count -Available 0 -Replayed 0 -Eligible 0 -Scanned 0 -Reason "dlq_empty"
  exit 0
}

$toReplay = [Math]::Min($Count, $dlqDepth)
Write-Host "DLQ replay plan" -ForegroundColor Cyan
Write-Host "Main queue : $QueueName"
Write-Host "DLQ        : $DlqName"
Write-Host "Available  : $dlqDepth"
Write-Host "To replay  : $toReplay"
Write-Host "App filter : $(if ([string]::IsNullOrWhiteSpace($ApplicationId)) { '<none>' } else { $ApplicationId })"
Write-Host "Max age    : $(if ($MaxAgeMinutes -gt 0) { "$MaxAgeMinutes minute(s)" } else { '<disabled>' })"
Write-Host "Mode       : $(if ($DryRun) { 'dry-run' } else { 'execute' })"

if ($DryRun) {
  Write-Host "\nDry-run sample scan:" -ForegroundColor Yellow
  $scanCount = [Math]::Min($dlqDepth, [Math]::Max($SampleCount, $toReplay))
  $eligibleCount = 0
  for ($i = 0; $i -lt $scanCount; $i++) {
    $raw = Invoke-RedisCli -Command "LINDEX $DlqName $i"
    $message = Convert-ToMessage -RawMessage $raw
    if (Test-ShouldReplay -Message $message -ApplicationId $ApplicationId -MaxAgeMinutes $MaxAgeMinutes) {
      $eligibleCount += 1
      Write-Host "[dry-run] eligible message #$($i + 1):" -ForegroundColor Green
      Write-Host $raw
    }
  }

  Write-Host "Dry-run complete. Re-run without -DryRun to execute replay." -ForegroundColor Cyan
  Write-ReplayAudit -Status "dry-run" -Requested $toReplay -Available $dlqDepth -Replayed 0 -Eligible $eligibleCount -Scanned $scanCount
  exit 0
}

$replayed = 0
$guardCounter = 0
$maxGuards = [Math]::Max($dlqDepth * 2, 50)

while ($replayed -lt $toReplay -and $guardCounter -lt $maxGuards) {
  $guardCounter += 1

  # Rotate tail -> head to inspect candidates while preserving DLQ content.
  $raw = Invoke-RedisCli -Command "RPOPLPUSH $DlqName $DlqName"
  if ([string]::IsNullOrWhiteSpace($raw)) {
    Write-Host "DLQ drained during replay loop." -ForegroundColor Yellow
    break
  }

  $message = Convert-ToMessage -RawMessage $raw
  if (-not (Test-ShouldReplay -Message $message -ApplicationId $ApplicationId -MaxAgeMinutes $MaxAgeMinutes)) {
    continue
  }

  # Move eligible message from DLQ tail to queue head.
  $moved = Invoke-RedisCli -Command "RPOPLPUSH $DlqName $QueueName"
  if ([string]::IsNullOrWhiteSpace($moved)) {
    Write-Host "Replay failed while moving eligible message." -ForegroundColor Yellow
    break
  }

  $replayed += 1
  Write-Host "Replayed message #$replayed" -ForegroundColor Green
}

if ($guardCounter -ge $maxGuards -and $replayed -lt $toReplay) {
  Write-Host "Stopped by guard counter; review filters and DLQ content." -ForegroundColor Yellow
}

if ($replayed -eq 0 -and -not [string]::IsNullOrWhiteSpace($ApplicationId)) {
  Write-Host "No messages matched ApplicationId filter." -ForegroundColor Yellow
}

if ($replayed -eq 0 -and $MaxAgeMinutes -gt 0) {
  Write-Host "No messages matched MaxAgeMinutes filter." -ForegroundColor Yellow
}

$queueDepth = Invoke-RedisCli -Command "LLEN $QueueName"
$dlqDepthAfter = Invoke-RedisCli -Command "LLEN $DlqName"
Write-Host "Replay complete. Replayed: $replayed. Queue depth: $queueDepth, DLQ depth: $dlqDepthAfter" -ForegroundColor Cyan
Write-ReplayAudit -Status "executed" -Requested $toReplay -Available $dlqDepth -Replayed $replayed -Eligible $replayed -Scanned $guardCounter
