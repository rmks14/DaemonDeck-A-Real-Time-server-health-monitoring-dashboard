import crypto from "node:crypto";
import os from "node:os";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request } from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

type Role = "viewer" | "operator" | "admin";

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  password: string;
};

type HealthStatus = "Healthy" | "Warning" | "Critical";

type ServerOverview = {
  hostname: string;
  operatingSystem: string;
  kernel: string;
  platform: string;
  uptimeSeconds: number;
  currentTime: string;
  health: HealthStatus;
};

const users: User[] = [
  {
    id: "user-1",
    name: "Demo User",
    username: "demo",
    email: "demo@example.com",
    role: "admin",
    password: "password123",
  },
  {
    id: "user-2",
    name: "Viewer User",
    username: "viewer",
    email: "viewer@example.com",
    role: "viewer",
    password: "password123",
  },
  {
    id: "user-3",
    name: "Operator User",
    username: "operator",
    email: "operator@example.com",
    role: "operator",
    password: "password123",
  },
];

const sessions = new Map<string, string>();

app.use(cors({ origin: clientUrl }));
app.use(express.json());

function publicUser(user: User) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

function getToken(req: Request) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function getCurrentUser(req: Request) {
  const token = getToken(req);
  const userId = token ? sessions.get(token) : null;
  return users.find((user) => user.id === userId) || null;
}

function getServerHealth(): HealthStatus {
  return "Healthy";
}

function getServerOverview(): ServerOverview {
  return {
    hostname: os.hostname(),
    operatingSystem: os.type(),
    kernel: os.release(),
    platform: os.platform(),
    uptimeSeconds: Math.floor(os.uptime()),
    currentTime: new Date().toISOString(),
    health: getServerHealth(),
  };
}

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/server/overview", (req, res) => {
  if (!getCurrentUser(req)) {
    res.status(401).json({ message: "Invalid or expired session." });
    return;
  }

  res.json(getServerOverview());
});

app.post("/api/auth/login", (req, res) => {
  const identifier = String(req.body?.identifier || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!identifier || !password) {
    res.status(400).json({ message: "Email/username and password are required." });
    return;
  }

  const user = users.find(
    (candidate) =>
      candidate.password === password &&
      (candidate.email.toLowerCase() === identifier ||
        candidate.username.toLowerCase() === identifier),
  );

  if (!user) {
    res.status(401).json({ message: "Invalid email/username or password." });
    return;
  }

  const token = crypto.randomUUID();
  sessions.set(token, user.id);
  res.json({ token, user: publicUser(user) });
});

app.get("/api/auth/me", (req, res) => {
  const user = getCurrentUser(req);

  if (!user) {
    res.status(401).json({ message: "Invalid or expired session." });
    return;
  }

  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  const token = getToken(req);

  if (token) {
    sessions.delete(token);
  }

  res.json({ message: "Logged out." });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
