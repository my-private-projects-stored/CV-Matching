$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

function Test-MongoUri {
    param(
        [string]$Uri
    )

    if ([string]::IsNullOrWhiteSpace($Uri)) {
        return $false
    }

    Push-Location "apps/backend"
    $env:__CVM_MONGO_URI = $Uri
    & node -e "const { MongoClient } = require('mongodb'); const uri = process.env.__CVM_MONGO_URI; (async () => { const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 }); try { await client.connect(); await client.db('admin').command({ ping: 1 }); process.exit(0); } catch { process.exit(1); } finally { try { await client.close(); } catch {} } })();" | Out-Null
    $ok = ($LASTEXITCODE -eq 0)
    Remove-Item Env:__CVM_MONGO_URI -ErrorAction SilentlyContinue
    Pop-Location

    return $ok
}

function Resolve-MongoUri {
    $candidates = @(
        $env:MONGO_URI_TEST,
        $env:MONGO_URI,
        "mongodb://admin:admin123@127.0.0.1:27017/?authSource=admin",
        "mongodb://127.0.0.1:27017",
        "mongodb://127.0.0.1:27017/cv_matching_db"
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

    foreach ($uri in $candidates) {
        Write-Host "Probing Mongo URI: $uri"
        if (Test-MongoUri -Uri $uri) {
            return $uri
        }
    }

    return $null
}

Write-Host "[1/4] Starting required dependency: qdrant"
docker compose --profile app up -d qdrant | Out-Host

Write-Host "[2/4] Resolving a reachable Mongo URI"
$resolvedMongoUri = Resolve-MongoUri
if (-not $resolvedMongoUri) {
    throw "Could not resolve a reachable Mongo URI for product E2E verification"
}

Write-Host "Using Mongo URI: $resolvedMongoUri"

Write-Host "[3/4] Running backend product E2E integration tests"
Set-Location "apps/backend"
$env:MONGO_URI_TEST = $resolvedMongoUri
$env:MONGO_URI = $resolvedMongoUri
$env:RUN_INTEGRATION_TESTS = "1"
npm run test:integration:e2e-product

Write-Host "[4/4] Running frontend product flow tests"
Set-Location "../frontend"
npm run test -- tests/product-flow-page.test.tsx

Write-Host "Product E2E verification completed successfully."
