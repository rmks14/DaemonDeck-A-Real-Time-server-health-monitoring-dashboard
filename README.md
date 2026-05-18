# ServerPulse

A React and Express server monitoring dashboard with demo login, JWT auth,
role-based access, real system metrics, live metric updates, and process actions.

## What It Uses

- `backend` - Express, TypeScript, signed expiring JWT auth, real system metrics via `systeminformation`, WebSocket live metrics
- `frontend` - React, TypeScript, Vite, Recharts, nginx for Docker static serving

Demo users:

```txt
demo / password123
viewer / password123
operator / password123
```

## Run With Docker

```bash
cp .env.docker.example .env
docker compose up --build
```

PowerShell:

```powershell
Copy-Item .env.docker.example .env
docker compose up --build
```

Open `http://localhost:8080`.

The frontend container serves the built app with nginx and proxies `/api` plus
the live metrics WebSocket to the backend container. Change
`AUTH_TOKEN_SECRET` in `.env` before sharing or deploying the app.

Docker reports the system data visible from inside the backend container. For
true host-level monitoring, run the backend directly on the host or add host
access intentionally for your deployment target.

## Run Backend

```bash
cd backend
npm install
npm run dev
```

The API runs on `http://localhost:5000`.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

## API

```txt
GET   /api/health                    Public health check
POST  /api/auth/login                Demo login
GET   /api/auth/me                   Current session user
POST  /api/auth/logout               End current session
GET   /api/metrics                   Viewer/operator/admin metrics
GET   /api/metrics/cpu               CPU metrics
GET   /api/metrics/memory            Memory metrics
GET   /api/metrics/disk              Disk metrics
GET   /api/logs                      Viewer/operator/admin logs
GET   /api/processes                 Viewer/operator/admin process list
GET   /api/process-actions           Operator/admin managed process actions
POST  /api/process-actions/:id/restart Operator/admin managed restart
DELETE /api/processes/:id            Operator/admin process kill
GET   /api/server/overview           Viewer/operator/admin server overview
WS    /api/live/metrics              Authenticated live metrics stream
GET   /api/admin/users               Admin user list
PATCH /api/admin/users/:id/role      Admin role management
GET   /api/admin/alerts              Admin alert rules
PATCH /api/admin/alerts/:id          Admin alert rule toggle
POST  /api/admin/system-actions      Admin system action
```

## Roles

```txt
viewer    Dashboard, metrics, logs, and read-only processes
operator  Viewer permissions plus process actions
admin     Metrics, logs, process restarts, users, alerts, and system actions
```

## Server Overview

The overview shows compact cards for CPU, memory, disk, uptime, hostname,
operating system, kernel, health, running process count, active service count,
and warning/critical alert counts.

Health thresholds:

```txt
CPU    > 80% warning, > 90% critical
Memory > 85% warning, > 95% critical
Disk   > 80% warning, > 90% critical
```

## Environment

Optional local env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## Notes

JWTs are signed with `AUTH_TOKEN_SECRET` and expire after `SESSION_TTL_MINUTES`. Keep the same secret across backend restarts so browser refreshes can restore the session. Demo credentials are for local development only; change or remove them before deploying anywhere public.
