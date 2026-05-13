# Simple Auth Starter

A small React and Express starter with demo login, an authenticated dashboard, server overview details, and a backend health check.

## What It Uses

- `backend` - Express, TypeScript, in-memory demo sessions
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
GET  /api/health           Public health check
POST /api/auth/login       Demo login
GET  /api/auth/me          Current session user
POST /api/auth/logout      End current session
GET  /api/server/overview  Protected server overview
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

Sessions are stored in memory, so signing in again is required after the backend restarts. This keeps the starter simple; add a database or real auth provider when the project needs persistence.
