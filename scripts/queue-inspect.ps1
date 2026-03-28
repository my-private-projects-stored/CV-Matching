param(
  [string]$QueueName = "application_scoring_queue",
  [string]$DlqName = "application_scoring_queue_dlq",
  [switch]$ShowSamples,
  [int]$SampleCount = 3
)

$ErrorActionPreference = "Stop"

function Invoke-RedisCliJson {
  param(
    [string]$Command
  )

  docker compose --profile app exec -T redis sh -lc "redis-cli $Command"
}

Write-Host "Queue inspection" -ForegroundColor Cyan
Write-Host "Queue: $QueueName"
Write-Host "DLQ  : $DlqName"

$queueDepth = Invoke-RedisCliJson -Command "LLEN $QueueName"
$dlqDepth = Invoke-RedisCliJson -Command "LLEN $DlqName"

Write-Host "Queue depth: $queueDepth"
Write-Host "DLQ depth  : $dlqDepth"

if ($ShowSamples) {
  Write-Host "\nQueue samples:" -ForegroundColor Yellow
  Invoke-RedisCliJson -Command "LRANGE $QueueName 0 $([Math]::Max(0, $SampleCount - 1))"

  Write-Host "\nDLQ samples:" -ForegroundColor Yellow
  Invoke-RedisCliJson -Command "LRANGE $DlqName 0 $([Math]::Max(0, $SampleCount - 1))"
}
