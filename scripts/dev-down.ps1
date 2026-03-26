param(
    [switch]$Volumes,
    [switch]$Prod
)

$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

if ($Prod) {
    if ($Volumes) {
        docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app down -v
    } else {
        docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app down
    }
} else {
    if ($Volumes) {
        docker compose --profile app down -v
    } else {
        docker compose --profile app down
    }
}
