$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

Write-Host "[1/5] Starting infrastructure with health checks..."
docker compose --profile app up -d mongo redis qdrant worker-embedding-sbert

Write-Host "[2/5] Waiting for services to become healthy..."
$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
    $status = docker compose ps --format json | ConvertFrom-Json
    $required = @("cvm-mongo", "cvm-redis", "cvm-qdrant", "cvm-worker-embedding-sbert")

    $allHealthy = $true
    foreach ($name in $required) {
        $svc = $status | Where-Object { $_.Name -eq $name }
        if (-not $svc -or $svc.Health -ne "healthy") {
            $allHealthy = $false
            break
        }
    }

    if ($allHealthy) {
        $healthy = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $healthy) {
    throw "Services did not become healthy in time"
}

Set-Location "apps/backend"

$env:MONGO_URI = "mongodb://admin:admin123@127.0.0.1:27017/?authSource=admin"
$env:MONGO_URI_TEST = "mongodb://admin:admin123@127.0.0.1:27017/?authSource=admin"
$env:EMBEDDING_SERVICE_URL = "http://127.0.0.1:8010"
$env:RUN_INTEGRATION_TESTS = "1"

Write-Host "[3/5] Bootstrapping Qdrant collections..."
npm run bootstrap:qdrant

Write-Host "[4/5] Seeding demo data..."
npm run seed:demo

Write-Host "[5/5] Running integration tests..."
npm run test:integration

Write-Host "Verification completed successfully."
