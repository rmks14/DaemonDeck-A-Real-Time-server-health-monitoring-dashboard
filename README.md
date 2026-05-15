# Simple Auth Starter

A small React and Express starter with demo login, JWT auth, protected dashboard routes, role-based sections, server overview details, and a backend health check.

## What It Uses

- `backend` - Express, TypeScript, signed expiring JWT auth, real system metrics via `systeminformation`
- `frontend` - React, TypeScript, Vite

Demo users:

```txt
demo / password123
viewer / password123
operator / password123
```

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
GET   /api/logs                      Viewer/operator/admin logs
GET   /api/processes                 Operator/admin process list
POST  /api/processes/:id/restart     Operator/admin restart action
GET   /api/server/overview           Admin-only server overview
GET   /api/admin/users               Admin user list
PATCH /api/admin/users/:id/role      Admin role management
GET   /api/admin/alerts              Admin alert rules
PATCH /api/admin/alerts/:id          Admin alert rule toggle
POST  /api/admin/system-actions      Admin system action
```

## Roles

```txt
viewer    Metrics and logs
operator  Metrics, logs, and process restarts
admin     Metrics, logs, process restarts, users, alerts, and system actions
```

## Server Overview

The admin overview shows compact cards for CPU, memory, disk, uptime, hostname,
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
