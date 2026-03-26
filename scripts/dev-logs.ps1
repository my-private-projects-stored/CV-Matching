param(
    [string[]]$Services,
    [int]$Tail = 200,
    [switch]$Follow,
    [switch]$Prod
)

$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

$cmd = if ($Prod) {
    "docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app logs --tail $Tail"
} else {
    "docker compose --profile app logs --tail $Tail"
}

if ($Follow) {
    $cmd += " -f"
}

if ($Services -and $Services.Count -gt 0) {
    $cmd += " " + ($Services -join " ")
}

Invoke-Expression $cmd
