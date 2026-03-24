$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\..\apps\backend"

function Get-EnvValueFromFile {
    param(
        [string]$FilePath,
        [string]$Key
    )

    if (-not (Test-Path $FilePath)) {
        return $null
    }

    $pattern = '^\s*' + [regex]::Escape($Key) + '\s*='
    $line = Get-Content $FilePath | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    return ($line -replace ('^\s*' + [regex]::Escape($Key) + '\s*=\s*'), '').Trim()
}

function Test-MongoUri {
    param(
        [string]$Uri
    )

    if ([string]::IsNullOrWhiteSpace($Uri)) {
        return $false
    }

    $env:__CVM_MONGO_URI = $Uri
    & node -e "const { MongoClient } = require('mongodb'); const uri = process.env.__CVM_MONGO_URI; (async () => { const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 }); try { await client.connect(); await client.db('admin').command({ ping: 1 }); process.exit(0); } catch { process.exit(1); } finally { try { await client.close(); } catch {} } })();" | Out-Null
    $ok = ($LASTEXITCODE -eq 0)
    Remove-Item Env:__CVM_MONGO_URI -ErrorAction SilentlyContinue

    return $ok
}

function Resolve-FirstReachableMongoUri {
    param(
        [string[]]$Candidates
    )

    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        Write-Host "  probing Mongo URI: $candidate"
        if (Test-MongoUri -Uri $candidate) {
            return $candidate
        }
    }

    return $null
}

$mongoUriFromEnv = if (-not [string]::IsNullOrWhiteSpace($env:MONGO_URI)) { $env:MONGO_URI } else { $null }
$workspaceRoot = Resolve-Path "$PSScriptRoot\.."
$rootDotEnvPath = Join-Path $workspaceRoot ".env"
$backendDotEnvPath = Join-Path (Get-Location) ".env"

$mongoRootUsername = if (-not [string]::IsNullOrWhiteSpace($env:MONGO_ROOT_USERNAME)) { $env:MONGO_ROOT_USERNAME } else { Get-EnvValueFromFile -FilePath $rootDotEnvPath -Key "MONGO_ROOT_USERNAME" }
$mongoRootPassword = if (-not [string]::IsNullOrWhiteSpace($env:MONGO_ROOT_PASSWORD)) { $env:MONGO_ROOT_PASSWORD } else { Get-EnvValueFromFile -FilePath $rootDotEnvPath -Key "MONGO_ROOT_PASSWORD" }

if ([string]::IsNullOrWhiteSpace($mongoRootUsername)) {
    $mongoRootUsername = "admin"
}

if ([string]::IsNullOrWhiteSpace($mongoRootPassword)) {
    $mongoRootPassword = "admin123"
}

$mongoUriFromComposeDefaults = "mongodb://$mongoRootUsername`:$mongoRootPassword@127.0.0.1:27017/?authSource=admin"
$mongoUriFromBackendDotEnv = Get-EnvValueFromFile -FilePath $backendDotEnvPath -Key "MONGO_URI"
$mongoUriNoAuthLocal = "mongodb://127.0.0.1:27017"
$mongoUriNoAuthLocalDb = "mongodb://127.0.0.1:27017/cv_matching_db"

$mongoUriCandidates = @(
    $env:MONGO_URI_TEST,
    $mongoUriFromEnv,
    $mongoUriFromComposeDefaults,
    $mongoUriFromBackendDotEnv,
    $mongoUriNoAuthLocal,
    $mongoUriNoAuthLocalDb
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

Write-Host "Detecting reachable Mongo URI..."
$resolvedMongoUri = Resolve-FirstReachableMongoUri -Candidates $mongoUriCandidates

if (-not $resolvedMongoUri) {
    throw "Could not connect to Mongo with any known URI candidate."
}

$env:MONGO_URI_TEST = $resolvedMongoUri
$env:MONGO_URI = $resolvedMongoUri

$embedUrlFromEnv = if (-not [string]::IsNullOrWhiteSpace($env:EMBEDDING_SERVICE_URL)) { $env:EMBEDDING_SERVICE_URL } else { $null }
if (-not $embedUrlFromEnv) {
    $env:EMBEDDING_SERVICE_URL = "http://127.0.0.1:8010"
}

Write-Host "Ensuring integration dependencies (redis, qdrant, embedding worker) are running..."
try {
    Set-Location $workspaceRoot
    docker compose --profile app up -d redis qdrant worker-embedding-sbert | Out-Host

    Write-Host "Waiting for integration dependencies to become healthy..."
    $healthy = $false
    for ($i = 0; $i -lt 90; $i++) {
        $status = docker compose --profile app ps --format json | ConvertFrom-Json
        $required = @("cvm-redis", "cvm-qdrant", "cvm-worker-embedding-sbert")

        $allHealthy = $true
        foreach ($name in $required) {
            $svc = $status | Where-Object { $_.Name -eq $name }
            if (-not $svc) {
                $allHealthy = $false
                break
            }

            $serviceState = [string]$svc.State
            $healthState = [string]$svc.Health
            if ($serviceState -ne "running") {
                $allHealthy = $false
                break
            }

            if ($healthState -and $healthState -ne "healthy") {
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
        throw "Integration dependencies did not become healthy in time"
    }
} catch {
    Write-Warning "Could not start docker services automatically. Continuing with existing local services. $_"
}

Set-Location "$PSScriptRoot\..\apps\backend"
$env:RUN_INTEGRATION_TESTS = "1"

Write-Host "Running backend integration tests with:"
Write-Host "  MONGO_URI_TEST=$($env:MONGO_URI_TEST)"
Write-Host "  MONGO_URI=$($env:MONGO_URI)"
Write-Host "  EMBEDDING_SERVICE_URL=$($env:EMBEDDING_SERVICE_URL)"

Write-Host "Bootstrapping Qdrant collections..."
npm run bootstrap:qdrant

npm run test:integration
