# DaemonDeck

Real-time Linux server monitoring dashboard for tracking system health, resource usage, running processes, audit activity, and role-gated operational actions from a web UI.

DaemonDeck is built as a practical DevOps/SRE dashboard: a React frontend, an Express API, live WebSocket metrics, SQLite persistence, JWT authentication, and real host metrics collected with `systeminformation`.

## What It Does

- Monitors CPU, memory, disk, OS details, uptime, and running process count.
- Streams live CPU, memory, and disk metrics over WebSocket.
- Supports live pause/resume, manual refresh, last-updated timestamps, and 5s/10s/30s/1m refresh intervals.
- Shows CPU per-core usage, load average, top CPU processes, and trend charts.
- Shows total/used/free memory, swap usage, top memory processes, and trend charts.
- Shows mounted disk partitions with usage and health status.
- Lists real running processes with PID, name, CPU %, memory %, user, status, and start time.
- Supports process search, CPU/memory sorting, process detail views, manual refresh, and permission-gated kill actions.
- Persists users, bcrypt-hashed passwords, alert rules, and audit logs in SQLite.
- Uses JWT sessions with role-based access control for viewer, operator, and admin users.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React, TypeScript, Vite, Recharts |
| Backend | Node.js, Express, TypeScript |
| Live updates | WebSocket |
| Metrics | `systeminformation` |
| Storage | SQLite with `better-sqlite3` |
| Auth | JWT-style signed tokens, bcrypt password hashing |

## Current Feature Status

| Area | Status |
| --- | --- |
| Login, logout, protected routes | Done |
| Role-based access control | Done |
| SQLite users and hashed passwords | Done |
| Server overview cards | Done |
| CPU monitoring | Done |
| Memory monitoring | Done |
| Disk monitoring | Done |
| Process monitoring | Done |
| WebSocket live metrics | Done |
| Configurable refresh intervals | Done |
| Last updated timestamps | Done |
| Loading, error, and empty states | Done |
| Process details modal | Done |
| Metric trend charts | Done |
| Audit logs | Basic persistent audit logs |
| Alert rules | Basic persistent rules |
| Service monitoring | Not yet |
| Docker monitoring | Not yet |
| Multi-server agent architecture | Not yet |

## Roles

| Role | Permissions |
| --- | --- |
| Viewer | View dashboard, metrics, logs, and process data |
| Operator | Viewer permissions plus process and managed restart actions |
| Admin | Operator permissions plus user roles, alert rules, and system actions |

Demo accounts:

```txt
demo / password123
viewer / password123
operator / password123
```

The demo passwords are stored as bcrypt hashes in SQLite after the first backend start.

## Demo Walkthrough

1. Sign in with `demo / password123` for admin access.
2. Open **Overview** to inspect host health, CPU, memory, disk, uptime, OS, kernel, process count, and alert counts.
3. Open **Metrics** to watch live CPU, memory, and disk charts. Change the refresh interval between `5s`, `10s`, `30s`, and `1m`, or pause live updates.
4. Open **Processes** to search running processes, sort by CPU or memory usage, view process details, and use operator/admin-only process actions.
5. Open **Logs** to review persisted audit activity.
6. Open **Admin** as the demo admin user to manage roles, alert rules, and system actions.

## Screenshots

Recommended screenshots for the project README or resume portfolio:

```txt
docs/screenshots/login.png        Login screen
docs/screenshots/overview.png     Server overview dashboard
docs/screenshots/metrics.png      Live metrics, charts, and refresh interval selector
docs/screenshots/processes.png    Process table and details modal
docs/screenshots/admin.png        Admin role and alert controls
```

Keep screenshots current after UI changes so the README reflects the actual app.

## Architecture

```txt
React Dashboard
  |
  | REST API + WebSocket
  v
Express Backend
  |
  | systeminformation
  v
Local Host Metrics

Express Backend
  |
  | better-sqlite3
  v
SQLite Database
```

## Getting Started

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

The API runs on:

```txt
http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on:

```txt
http://localhost:5173
```

## Environment

Optional local environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Backend options:

```txt
PORT=5000
CLIENT_URL=http://localhost:5173
SESSION_TTL_MINUTES=60
AUTH_TOKEN_SECRET=replace-with-a-long-random-local-secret
DATABASE_PATH=./data/daemondeck.sqlite
```

By default, the backend creates a local SQLite database at:

```txt
backend/data/daemondeck.sqlite
```

Local database files are ignored by Git.

## Health Thresholds

Thresholds are centralized in `backend/src/config/thresholds.ts`.

```txt
CPU     > 80% warning, > 90% critical
Memory  > 85% warning, > 95% critical
Disk    > 80% warning, > 90% critical
```

The dashboard classifies health as:

| Status | Meaning |
| --- | --- |
| Healthy | CPU, memory, and disk are below warning thresholds |
| Warning | At least one metric crossed its warning threshold |
| Critical | At least one metric crossed its critical threshold |

## Security Notes

- Demo credentials are for local development only.
- Set a strong `AUTH_TOKEN_SECRET` before using the app outside local development.
- Process kill actions are permission-gated and require confirmation in the UI.
- The current JWT implementation is custom HMAC signing. A production version should use a maintained JWT library such as `jose` or `jsonwebtoken`.
- Login rate limiting and request-body validation are planned but not implemented yet.

## Development Checks

Build backend:

```bash
cd backend
npm run build
```

Build frontend:

```bash
cd frontend
npm run build
```
