# Simple Auth Starter

This is a small frontend/backend starter for a future auth-based project.

## Folders

- `backend` - Node.js, Express, TypeScript API
- `frontend` - React, TypeScript UI

## Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Environment Files

Copy the example files before running locally:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## Test The Connection

Start the backend and frontend in separate terminals, then open:

```txt
http://localhost:5173
```

Click `Check backend`. If the backend is running, you should see:

```txt
Backend health: ok
```
