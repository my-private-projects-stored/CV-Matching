# CV-Matching Monorepo

![Backend Integration](https://github.com/my-private-projects-stored/CV-Matching/actions/workflows/backend-integration.yml/badge.svg)
![Frontend Quality](https://github.com/my-private-projects-stored/CV-Matching/actions/workflows/frontend-quality.yml/badge.svg)

Monorepo for CV matching workflows, including backend APIs, frontend apps, workers, and infrastructure.

## Quick Links

- Backend integration workflow: .github/workflows/backend-integration.yml
- Frontend quality workflow: .github/workflows/frontend-quality.yml
- Task log: task-completed.md
- Backend app: apps/backend
- Frontend app: apps/frontend

## Run Locally (Backend Integration)

Prerequisites:
- Node.js 20+
- npm 10+
- Docker Desktop with Docker Compose

PowerShell (repo root):

```powershell
./scripts/run-backend-integration.ps1 2>&1 | Out-File -FilePath ./scripts/last-backend-integration.txt -Encoding utf8
```

What this wrapper does:
- Detects a reachable Mongo URI and exports `MONGO_URI` + `MONGO_URI_TEST`
- Starts required services (`redis`, `qdrant`, `worker-embedding-sbert`) with Docker Compose
- Bootstraps Qdrant collections
- Runs backend integration tests in `apps/backend`

## Run With Docker

The root compose file is [docker-compose.yml](docker-compose.yml).

1. Start core app dependencies (Mongo, Redis, Qdrant, embedding worker):

```powershell
docker compose --profile app up -d mongo redis qdrant worker-embedding-sbert
```

2. Check service status and health:

```powershell
docker compose --profile app ps
```

3. Optional full local verification (infra + seed + integration):

```powershell
./scripts/full-verify.ps1
```

4. Stop and clean containers when done:

```powershell
docker compose --profile app down
```

Notes:
- `gateway-backend` and `frontend` services in [docker-compose.yml](docker-compose.yml) are scaffold placeholders in this repo state.
- The tested path today is running backend integration from host via [scripts/run-backend-integration.ps1](scripts/run-backend-integration.ps1) while infrastructure runs in Docker.

## CI Troubleshooting

If backend CI fails in `.github/workflows/backend-integration.yml`:

1. Download artifact `backend-integration-log` from the failed run.
2. If failure is in matrix job `isolated-critical`, download `isolated-integration-log-<test_file>` for the exact failing test.
3. Compare with your latest local log in [scripts/last-backend-integration.txt](scripts/last-backend-integration.txt).
4. Reproduce with the same test command in `apps/backend/tests/integration` and env values from the workflow.
