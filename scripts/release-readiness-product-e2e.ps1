param(
    [string]$OutputDir = "scripts/reports",
    [int]$ExpectedMinimumChecks = 3,
    [int]$MaxHistoryLines = 2000,
    [switch]$SkipHistoryRetention,
    [int]$QdrantHealthRetries = 5,
    [int]$QdrantHealthRetryDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

function Get-GitBranch {
    try {
        $value = (& git rev-parse --abbrev-ref HEAD 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)) {
            return "unknown"
        }

        return $value.Trim()
    } catch {
        return "unknown"
    }
}

function Get-GitCommitSha {
    try {
        $value = (& git rev-parse HEAD 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)) {
            return "unknown"
        }

        return $value.Trim()
    } catch {
        return "unknown"
    }
}

function Invoke-ReadinessCheck {
    param(
        [string]$Id,
        [string]$Title,
        [scriptblock]$Action
    )

    $start = Get-Date
    $status = "passed"
    $details = "ok"
    $originalLocation = (Get-Location).Path

    try {
        $null = & $Action
    } catch {
        $status = "failed"
        $details = $_.Exception.Message
    } finally {
        Set-Location $originalLocation
    }

    $end = Get-Date
    $durationMs = [int][Math]::Round(($end - $start).TotalMilliseconds)

    return [ordered]@{
        id = $Id
        title = $Title
        status = $status
        details = $details
        started_at_utc = $start.ToUniversalTime().ToString("o")
        ended_at_utc = $end.ToUniversalTime().ToString("o")
        duration_ms = $durationMs
    }
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$checks = @()

$checks += Invoke-ReadinessCheck -Id "qdrant_health" -Title "Qdrant dependency and health endpoint" -Action {
    docker compose --profile app up -d qdrant | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start qdrant service"
    }

    $lastError = $null
    for ($attempt = 1; $attempt -le $QdrantHealthRetries; $attempt++) {
        try {
            $health = Invoke-WebRequest -Uri "http://127.0.0.1:6333/healthz" -Method Get -TimeoutSec 10 -UseBasicParsing
            if ($health.StatusCode -ge 200 -and $health.StatusCode -le 299) {
                return
            }

            $lastError = "Qdrant health endpoint returned status $($health.StatusCode)"
        } catch {
            $lastError = $_.Exception.Message
        }

        if ($attempt -lt $QdrantHealthRetries) {
            Start-Sleep -Seconds $QdrantHealthRetryDelaySeconds
        }
    }

    if ([string]::IsNullOrWhiteSpace($lastError)) {
        throw "Qdrant health check failed after $QdrantHealthRetries attempts"
    }

    throw "Qdrant health check failed after $QdrantHealthRetries attempts: $lastError"
}

$checks += Invoke-ReadinessCheck -Id "flow_entrypoint" -Title "Guided flow entrypoint is linked from dashboard" -Action {
    $dashboardPath = "apps/frontend/app/(default)/dashboard/page.tsx"
    $dashboardContent = Get-Content -Path $dashboardPath -Raw
    if (-not $dashboardContent.Contains("router.push('/flow')")) {
        throw "Dashboard does not contain /flow navigation entrypoint"
    }
}

$checks += Invoke-ReadinessCheck -Id "product_e2e_verify" -Title "Unified product E2E verify script" -Action {
    & "$PSScriptRoot\verify-e2e-product.ps1"
}

$failedCount = @($checks | Where-Object { $_.status -eq "failed" }).Count
$policyViolations = New-Object System.Collections.Generic.List[string]

if ($checks.Count -lt $ExpectedMinimumChecks) {
    $policyViolations.Add(
        "checks_count_below_minimum: expected >= $ExpectedMinimumChecks but got $($checks.Count)"
    )
}

$policyFailed = $policyViolations.Count -gt 0
$overallStatus = if ($failedCount -eq 0 -and -not $policyFailed) { "passed" } else { "failed" }

$generatedAtUtc = (Get-Date).ToUniversalTime()
$stamp = $generatedAtUtc.ToString("yyyyMMdd-HHmmss")
$jsonReportPath = Join-Path $OutputDir "product-e2e-readiness-$stamp.json"
$mdReportPath = Join-Path $OutputDir "product-e2e-readiness-$stamp.md"
$historyPath = Join-Path $OutputDir "product-e2e-readiness-history.jsonl"

$report = [ordered]@{
    schema_version = "1.0.0"
    generated_at_utc = $generatedAtUtc.ToString("o")
    overall_status = $overallStatus
    totals = [ordered]@{
        checks = $checks.Count
        passed = @($checks | Where-Object { $_.status -eq "passed" }).Count
        failed = $failedCount
    }
    policy = [ordered]@{
        expected_minimum_checks = $ExpectedMinimumChecks
        max_history_lines = $MaxHistoryLines
        skip_history_retention = [bool]$SkipHistoryRetention
        violated = $policyFailed
    }
    policy_violations = @($policyViolations)
    context = [ordered]@{
        repository = "CV-Matching"
        branch = Get-GitBranch
        commit_sha = Get-GitCommitSha
        runner_user = $env:USERNAME
        machine = $env:COMPUTERNAME
    }
    checks = $checks
}

$reportJson = $report | ConvertTo-Json -Depth 8
Set-Content -Path $jsonReportPath -Value $reportJson

$mdLines = New-Object System.Collections.Generic.List[string]
$mdLines.Add("# Product E2E Release Readiness")
$mdLines.Add("")
$mdLines.Add("- Generated at (UTC): $($report.generated_at_utc)")
$mdLines.Add("- Overall status: **$($report.overall_status.ToUpper())**")
$mdLines.Add("- Branch: $($report.context.branch)")
$mdLines.Add("- Commit: $($report.context.commit_sha)")
$mdLines.Add("")
$mdLines.Add("## Checklist Results")
$mdLines.Add("")

foreach ($check in $checks) {
    $marker = if ($check.status -eq "passed") { "x" } else { " " }
    $title = [string]$check.title
    $id = [string]$check.id
    $details = [string]$check.details
    $mdLines.Add("- [$marker] $title ($id) - $details")
}

$mdLines.Add("")
$mdLines.Add("## Totals")
$mdLines.Add("")
$mdLines.Add("- Checks: $($report.totals.checks)")
$mdLines.Add("- Passed: $($report.totals.passed)")
$mdLines.Add("- Failed: $($report.totals.failed)")
$mdLines.Add("- Policy Violations: $($report.policy_violations.Count)")

if ($report.policy_violations.Count -gt 0) {
    $mdLines.Add("")
    $mdLines.Add("## Policy Violations")
    $mdLines.Add("")
    foreach ($violation in $report.policy_violations) {
        $mdLines.Add("- $violation")
    }
}

Set-Content -Path $mdReportPath -Value ($mdLines -join [Environment]::NewLine)

$reportCompact = $report | ConvertTo-Json -Depth 8 -Compress
Add-Content -Path $historyPath -Value $reportCompact

if (-not $SkipHistoryRetention -and (Test-Path $historyPath)) {
    $historyLines = @(Get-Content -Path $historyPath | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_)
    })

    if ($historyLines.Count -gt $MaxHistoryLines) {
        $startIndex = $historyLines.Count - $MaxHistoryLines
        $trimmedLines = @($historyLines[$startIndex..($historyLines.Count - 1)])
        Set-Content -Path $historyPath -Value $trimmedLines
    }
}

Write-Host "Release readiness report generated:"
Write-Host "  JSON: $jsonReportPath"
Write-Host "  MD:   $mdReportPath"
Write-Host "  HIST: $historyPath"

if ($overallStatus -ne "passed") {
    throw "Product E2E release readiness failed. See report: $jsonReportPath"
}
