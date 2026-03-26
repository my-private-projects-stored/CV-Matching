param(
    [switch]$Prod
)

$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

if ($Prod) {
    docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app ps
} else {
    docker compose --profile app ps
}

node -e "const run=async()=>{const backend=await fetch('http://127.0.0.1:3001/api/health');const frontend=await fetch('http://127.0.0.1:3000');if(!backend.ok||!frontend.ok){console.error('Smoke failed',{backend:backend.status,frontend:frontend.status});process.exit(1);}console.log('Smoke OK',{backend:backend.status,frontend:frontend.status});};run().catch((e)=>{console.error(e);process.exit(1);});"
