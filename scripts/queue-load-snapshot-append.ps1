param(
  [string]$InputLogFile = "./scripts/queue-load-trend.log",
  [string]$OutputJsonl = "./scripts/queue-load-trend.jsonl"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $InputLogFile)) {
  Write-Host "Input log file not found: $InputLogFile" -ForegroundColor Yellow
  exit 0
}

$lines = Get-Content -Path $InputLogFile -Encoding utf8
$prefix = "[queue-synthetic-load-json]"
$snapshots = @()

foreach ($line in $lines) {
  if (-not $line.Contains($prefix)) {
    continue
  }

  $jsonText = $line.Substring($line.IndexOf($prefix) + $prefix.Length).Trim()
  if ([string]::IsNullOrWhiteSpace($jsonText)) {
    continue
  }

  try {
    $null = $jsonText | ConvertFrom-Json -ErrorAction Stop
    $snapshots += $jsonText
  } catch {
    Write-Host "Skipping invalid snapshot line: $jsonText" -ForegroundColor Yellow
  }
}

if ($snapshots.Count -eq 0) {
  Write-Host "No queue-load snapshots found in input log." -ForegroundColor Yellow
  exit 0
}

$directory = Split-Path -Path $OutputJsonl -Parent
if (-not [string]::IsNullOrWhiteSpace($directory)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

foreach ($snapshot in $snapshots) {
  Add-Content -Path $OutputJsonl -Value $snapshot -Encoding utf8
}

Write-Host "Appended $($snapshots.Count) snapshot(s) to $OutputJsonl" -ForegroundColor Cyan
