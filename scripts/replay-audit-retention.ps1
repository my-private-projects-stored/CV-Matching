param(
  [string]$AuditFile = "./scripts/replay-audit.local.jsonl",
  [int]$MaxLines = 5000,
  [switch]$CompressArchive
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $AuditFile)) {
  Write-Host "Replay audit file not found: $AuditFile" -ForegroundColor Yellow
  exit 0
}

$lines = Get-Content -Path $AuditFile -Encoding utf8
$lineCount = @($lines).Count

if ($lineCount -le $MaxLines) {
  Write-Host "No rotation required. Current lines: $lineCount, MaxLines: $MaxLines" -ForegroundColor Green
  exit 0
}

$directory = Split-Path -Path $AuditFile -Parent
if ([string]::IsNullOrWhiteSpace($directory)) {
  $directory = "."
}

$baseName = [System.IO.Path]::GetFileNameWithoutExtension($AuditFile)
$extension = [System.IO.Path]::GetExtension($AuditFile)
$timestamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$archivePath = Join-Path $directory "$baseName.$timestamp$extension"

Move-Item -Path $AuditFile -Destination $archivePath -Force

if ($CompressArchive) {
  $zipPath = "$archivePath.zip"
  Compress-Archive -Path $archivePath -DestinationPath $zipPath -Force
  Remove-Item -Path $archivePath -Force
  $archivePath = $zipPath
}

New-Item -ItemType File -Path $AuditFile -Force | Out-Null

Write-Host "Replay audit rotated." -ForegroundColor Cyan
Write-Host "Archive: $archivePath"
Write-Host "New active file: $AuditFile"
