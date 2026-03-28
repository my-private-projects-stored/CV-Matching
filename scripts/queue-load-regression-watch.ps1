param(
  [string]$TrendJsonl = "./scripts/queue-load-trend.jsonl",
  [int]$WarnStreakThreshold = 3,
  [switch]$FailOnStreak,
  [string]$WebhookUrl = "",
  [string]$WebhookAuthHeaderName = "",
  [string]$WebhookAuthToken = "",
  [string]$WebhookSigningSecret = "",
  [string]$WebhookSignatureHeader = "X-CV-Queue-Signature",
  [string]$WebhookTimestampHeader = "X-CV-Queue-Timestamp",
  [string]$CommitSha = "",
  [string]$WorkflowRunUrl = "",
  [string]$Repository = "",
  [string]$RefName = "",
  [string]$RunnerClass = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $TrendJsonl)) {
  Write-Host "Trend JSONL not found: $TrendJsonl" -ForegroundColor Yellow
  exit 0
}

$records = @()
Get-Content -Path $TrendJsonl -Encoding utf8 | ForEach-Object {
  $line = $_.Trim()
  if ([string]::IsNullOrWhiteSpace($line)) {
    return
  }

  try {
    $records += ($line | ConvertFrom-Json -ErrorAction Stop)
  } catch {
    # Ignore malformed lines.
  }
}

if ($records.Count -eq 0) {
  Write-Host "No valid records to evaluate for regression watch." -ForegroundColor Yellow
  exit 0
}

$ordered = $records | Sort-Object {
  try {
    [DateTime]::Parse($_.timestamp_utc)
  } catch {
    [DateTime]::MinValue
  }
}

$currentStreak = 0
$maxStreak = 0

foreach ($record in $ordered) {
  $warningCount = 0
  try {
    $warningCount = [int]($record.baseline_warning_count)
  } catch {
    $warningCount = 0
  }

  if ($warningCount -gt 0) {
    $currentStreak += 1
    if ($currentStreak -gt $maxStreak) {
      $maxStreak = $currentStreak
    }
  } else {
    $currentStreak = 0
  }
}

$message = "Queue-load warn regression streak: current=$currentStreak max=$maxStreak threshold=$WarnStreakThreshold"
Write-Host $message -ForegroundColor Cyan

if ($currentStreak -ge $WarnStreakThreshold) {
  $warning = "::warning::Queue-load regression warning streak reached ($currentStreak >= $WarnStreakThreshold)."
  Write-Host $warning

  function Convert-BytesToHex {
    param([byte[]]$Bytes)

    if (-not $Bytes) {
      return ""
    }

    return -join ($Bytes | ForEach-Object { $_.ToString("x2") })
  }

  if (-not [string]::IsNullOrWhiteSpace($WebhookUrl)) {
    $payload = [ordered]@{
      event = "queue_load_warn_streak"
      timestamp_utc = [DateTime]::UtcNow.ToString("o")
      current_streak = $currentStreak
      max_streak = $maxStreak
      threshold = $WarnStreakThreshold
      fail_on_streak = [bool]$FailOnStreak
      repository = $(if ([string]::IsNullOrWhiteSpace($Repository)) { $null } else { $Repository })
      ref_name = $(if ([string]::IsNullOrWhiteSpace($RefName)) { $null } else { $RefName })
      commit_sha = $(if ([string]::IsNullOrWhiteSpace($CommitSha)) { $null } else { $CommitSha })
      workflow_run_url = $(if ([string]::IsNullOrWhiteSpace($WorkflowRunUrl)) { $null } else { $WorkflowRunUrl })
      runner_class = $(if ([string]::IsNullOrWhiteSpace($RunnerClass)) { $null } else { $RunnerClass })
    }

    $body = $payload | ConvertTo-Json -Depth 6
    $headers = @{}

    if (-not [string]::IsNullOrWhiteSpace($WebhookAuthHeaderName) -and -not [string]::IsNullOrWhiteSpace($WebhookAuthToken)) {
      $headers[$WebhookAuthHeaderName] = $WebhookAuthToken
    }

    if (-not [string]::IsNullOrWhiteSpace($WebhookSigningSecret)) {
      $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
      $toSign = "$timestamp.$body"

      $hmac = New-Object System.Security.Cryptography.HMACSHA256
      $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($WebhookSigningSecret)
      $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($toSign))
      $signatureHex = Convert-BytesToHex -Bytes $signatureBytes

      $headers[$WebhookSignatureHeader] = "sha256=$signatureHex"
      $headers[$WebhookTimestampHeader] = $timestamp
    }

    try {
      if ($headers.Count -gt 0) {
        Invoke-RestMethod -Uri $WebhookUrl -Method Post -ContentType "application/json" -Headers $headers -Body $body | Out-Null
      } else {
        Invoke-RestMethod -Uri $WebhookUrl -Method Post -ContentType "application/json" -Body $body | Out-Null
      }
      Write-Host "Webhook notification sent for queue-load warn streak." -ForegroundColor Cyan
    } catch {
      Write-Host "::warning::Failed to send queue-load warn-streak webhook notification."
    }
  }

  if ($FailOnStreak) {
    Write-Host "::error::Failing due to warn streak threshold breach." 
    exit 1
  }
}
