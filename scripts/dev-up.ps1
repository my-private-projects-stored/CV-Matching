param(
    [switch]$NoBuild,
    [switch]$Prod
)

$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

if ($Prod) {
    if ($NoBuild) {
        docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app up -d
    } else {
        docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app up -d --build
    }

    docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app ps
} else {
    if ($NoBuild) {
        docker compose --profile app up -d
    } else {
        docker compose --profile app up -d --build
    }

    docker compose --profile app ps
}
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend health: http://localhost:3001/api/health"
