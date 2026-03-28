param(
  [string]$InputJsonl = "./scripts/queue-load-trend.jsonl",
  [int]$MinSamplesPerTier = 5,
  [string]$OutputJson = "./scripts/queue-load-baseline-suggestion.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $InputJsonl)) {
  Write-Host "Trend JSONL not found: $InputJsonl" -ForegroundColor Yellow
  exit 0
}

$records = @()
Get-Content -Path $InputJsonl -Encoding utf8 | ForEach-Object {
  $line = $_.Trim()
  if ([string]::IsNullOrWhiteSpace($line)) {
    return
  }

  try {
    $records += ($line | ConvertFrom-Json -ErrorAction Stop)
  } catch {
    Write-Host "Skipping invalid JSONL line" -ForegroundColor Yellow
  }
}

if ($records.Count -eq 0) {
  Write-Host "No valid trend records found in $InputJsonl" -ForegroundColor Yellow
  exit 0
}

$tierSamples = @{}
foreach ($record in $records) {
  if (-not $record.snapshot) {
    continue
  }

  foreach ($point in $record.snapshot) {
    $tier = [int]$point.loadCount
    $tps = [double]$point.throughputPerSecond
    if ($tier -le 0 -or $tps -le 0) {
      continue
    }

    if (-not $tierSamples.ContainsKey($tier)) {
      $tierSamples[$tier] = New-Object System.Collections.Generic.List[double]
    }
    $tierSamples[$tier].Add($tps)
  }
}

if ($tierSamples.Keys.Count -eq 0) {
  Write-Host "No throughput samples found for baseline suggestion." -ForegroundColor Yellow
  exit 0
}

function Get-Median {
  param([double[]]$Values)

  if (-not $Values -or $Values.Length -eq 0) {
    return $null
  }

  $sorted = $Values | Sort-Object
  $count = $sorted.Count
  if ($count % 2 -eq 1) {
    return [double]$sorted[[int]($count / 2)]
  }

  $upper = [double]$sorted[[int]($count / 2)]
  $lower = [double]$sorted[[int](($count / 2) - 1)]
  return ($lower + $upper) / 2.0
}

function Get-Percentile {
  param(
    [double[]]$Values,
    [double]$Percent
  )

  if (-not $Values -or $Values.Length -eq 0) {
    return $null
  }

  $sorted = $Values | Sort-Object
  if ($sorted.Count -eq 1) {
    return [double]$sorted[0]
  }

  $p = [Math]::Max(0, [Math]::Min(100, $Percent))
  $rank = ($p / 100.0) * ($sorted.Count - 1)
  $lowerIndex = [Math]::Floor($rank)
  $upperIndex = [Math]::Ceiling($rank)

  if ($lowerIndex -eq $upperIndex) {
    return [double]$sorted[$lowerIndex]
  }

  $lowerValue = [double]$sorted[$lowerIndex]
  $upperValue = [double]$sorted[$upperIndex]
  $weight = $rank - $lowerIndex
  return $lowerValue + (($upperValue - $lowerValue) * $weight)
}

function Get-ConfidenceScore {
  param(
    [int]$SampleCount,
    [double]$Median,
    [double]$Iqr
  )

  $sampleScore = [Math]::Min(1.0, $SampleCount / 20.0)

  $stabilityScore = 0.0
  if ($Median -gt 0) {
    $relativeIqr = $Iqr / $Median
    $stabilityScore = [Math]::Max(0.0, 1.0 - [Math]::Min(1.0, $relativeIqr))
  }

  $combined = (0.6 * $sampleScore) + (0.4 * $stabilityScore)
  return [Math]::Round($combined * 100.0, 1)
}

$suggestion = [ordered]@{}
$sampleSummary = [ordered]@{}
$confidenceByTier = [ordered]@{}

foreach ($tier in ($tierSamples.Keys | Sort-Object)) {
  $values = $tierSamples[$tier].ToArray()
  $sampleSummary[$tier] = $values.Length

  $medianAll = Get-Median -Values $values
  $p25 = Get-Percentile -Values $values -Percent 25
  $p75 = Get-Percentile -Values $values -Percent 75

  $iqr = 0.0
  if ($null -ne $p25 -and $null -ne $p75) {
    $iqr = [Math]::Max(0.0, [double]$p75 - [double]$p25)
  }

  $relativeIqrPct = 0.0
  if ($null -ne $medianAll -and [double]$medianAll -gt 0) {
    $relativeIqrPct = [Math]::Round(($iqr / [double]$medianAll) * 100.0, 2)
  }

  $medianForScore = 0.0
  if ($null -ne $medianAll) {
    $medianForScore = [double]$medianAll
  }

  $confidenceByTier[$tier] = [ordered]@{
    sample_count = $values.Length
    median_tps = $(if ($null -eq $medianAll) { $null } else { [Math]::Round([double]$medianAll, 2) })
    p25_tps = $(if ($null -eq $p25) { $null } else { [Math]::Round([double]$p25, 2) })
    p75_tps = $(if ($null -eq $p75) { $null } else { [Math]::Round([double]$p75, 2) })
    iqr_tps = [Math]::Round($iqr, 2)
    relative_iqr_pct = $relativeIqrPct
    confidence_score = Get-ConfidenceScore -SampleCount $values.Length -Median $medianForScore -Iqr $iqr
  }

  if ($values.Length -lt $MinSamplesPerTier) {
    continue
  }

  $median = Get-Median -Values $values
  if ($null -ne $median) {
    $suggestion[$tier] = [Math]::Round($median, 2)
  }
}

if ($suggestion.Keys.Count -eq 0) {
  Write-Host "Not enough samples for baseline suggestion. MinSamplesPerTier=$MinSamplesPerTier" -ForegroundColor Yellow
  Write-Host "Sample counts by tier: $($sampleSummary | ConvertTo-Json -Compress)"
  exit 0
}

$out = [ordered]@{
  event = "queue_load_baseline_suggestion"
  generated_at_utc = [DateTime]::UtcNow.ToString("o")
  min_samples_per_tier = $MinSamplesPerTier
  sample_counts = $sampleSummary
  confidence_by_tier = $confidenceByTier
  suggested_baseline_tps = $suggestion
}

$directory = Split-Path -Path $OutputJson -Parent
if (-not [string]::IsNullOrWhiteSpace($directory)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$json = $out | ConvertTo-Json -Depth 8
$json | Out-File -FilePath $OutputJson -Encoding utf8

Write-Host "Baseline suggestion generated: $OutputJson" -ForegroundColor Cyan
Write-Host "Suggested SCORING_SYNTHETIC_BASELINE_TPS_JSON: $($suggestion | ConvertTo-Json -Compress)"
