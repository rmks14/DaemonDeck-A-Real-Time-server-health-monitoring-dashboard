import crypto from "node:crypto";
import os from "node:os";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const configuredSessionTtlMinutes = Number(process.env.SESSION_TTL_MINUTES);
const sessionTtlMinutes =
  Number.isFinite(configuredSessionTtlMinutes) &&
  configuredSessionTtlMinutes > 0
    ? configuredSessionTtlMinutes
    : 60;
const sessionTtlSeconds = Math.floor(sessionTtlMinutes * 60);
const authTokenSecret = getAuthTokenSecret();

type Role = "viewer" | "operator" | "admin";
type HealthStatus = "Healthy" | "Warning" | "Critical";
type LogLevel = "info" | "warning" | "critical";

type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  password: string;
};

type PublicUser = Omit<User, "password">;

type JwtPayload = {
  sub: string;
  role: Role;
  exp: number;
  iat: number;
  jti: string;
};

type CurrentSession = {
  user: User;
  payload: JwtPayload;
};

type ServerOverview = {
  hostname: string;
  operatingSystem: string;
  kernel: string;
  platform: string;
  uptimeSeconds: number;
  currentTime: string;
  health: HealthStatus;
};

type ServiceRecord = {
  id: string;
  name: string;
  status: "running" | "restarting";
  lastRestartedAt: string | null;
};

type AlertRule = {
  id: string;
  name: string;
  condition: string;
  enabled: boolean;
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

const services: ServiceRecord[] = [
  { id: "api", name: "API server", status: "running", lastRestartedAt: null },
  { id: "worker", name: "Background worker", status: "running", lastRestartedAt: null },
  { id: "scheduler", name: "Task scheduler", status: "running", lastRestartedAt: null },
];

const alertRules: AlertRule[] = [
  {
    id: "alert-memory",
    name: "Low memory",
    condition: "Free memory below 15%",
    enabled: true,
  },
  {
    id: "alert-uptime",
    name: "Recent restart",
    condition: "System uptime below 5 minutes",
    enabled: false,
  },
];

const activityLogs = [
  {
    id: crypto.randomUUID(),
    level: "info" as LogLevel,
    message: "Dashboard API started",
    createdAt: new Date().toISOString(),
  },
];

const revokedTokens = new Map<string, number>();

app.use(cors({ origin: clientUrl }));
app.use(express.json());

function getAuthTokenSecret() {
  if (process.env.AUTH_TOKEN_SECRET) {
    return process.env.AUTH_TOKEN_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_TOKEN_SECRET must be set in production.");
  }

  console.warn(
    "AUTH_TOKEN_SECRET is not set. Using an insecure development secret.",
  );
  return "dev-only-change-me";
}

function publicUser(user: User): PublicUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

function getBearerToken(req: Request) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwtInput(input: string) {
  return crypto
    .createHmac("sha256", authTokenSecret)
    .update(input)
    .digest("base64url");
}

function signaturesMatch(actualSignature: string, expectedSignature: string) {
  const actual = Buffer.from(actualSignature);
  const expected = Buffer.from(expectedSignature);

  return (
    actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  );
}

function isRole(value: unknown): value is Role {
  return value === "viewer" || value === "operator" || value === "admin";
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<JwtPayload>;

  return (
    typeof payload.sub === "string" &&
    isRole(payload.role) &&
    typeof payload.exp === "number" &&
    Number.isFinite(payload.exp) &&
    typeof payload.iat === "number" &&
    Number.isFinite(payload.iat) &&
    typeof payload.jti === "string"
  );
}

function cleanupRevokedTokens() {
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const [tokenId, expiresAt] of revokedTokens) {
    if (expiresAt <= nowSeconds) {
      revokedTokens.delete(tokenId);
    }
  }
}

function createJwt(user: User) {
  cleanupRevokedTokens();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    iat: nowSeconds,
    exp: nowSeconds + sessionTtlSeconds,
    jti: crypto.randomUUID(),
  };
  const encodedHeader = encodeJson({ alg: "HS256", typ: "JWT" });
  const encodedPayload = encodeJson(payload);
  const signature = signJwtInput(`${encodedHeader}.${encodedPayload}`);

  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    payload,
  };
}

function verifyJwt(token: string): JwtPayload | null {
  const tokenParts = token.split(".");

  if (tokenParts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = tokenParts;

  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signJwtInput(`${encodedHeader}.${encodedPayload}`);

  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }

  try {
    const header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString("utf8"),
    ) as { alg?: unknown; typ?: unknown };
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;

    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    if (!isJwtPayload(payload) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (revokedTokens.has(payload.jti)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getCurrentSession(req: Request): CurrentSession | null {
  const token = getBearerToken(req);
  const payload = token ? verifyJwt(token) : null;

  if (!payload) {
    return null;
  }

  const user = users.find((candidate) => candidate.id === payload.sub);

  return user ? { user, payload } : null;
}

function requireSession(req: Request, res: Response) {
  const session = getCurrentSession(req);

  if (!session) {
    res.status(401).json({ message: "Invalid or expired session." });
    return null;
  }

  return session;
}

function requireRole(req: Request, res: Response, allowedRoles: Role[]) {
  const session = requireSession(req, res);

  if (!session) {
    return null;
  }

  if (!allowedRoles.includes(session.user.role)) {
    res.status(403).json({ message: "You do not have permission to do that." });
    return null;
  }

  return session;
}

function sessionExpiresAt(payload: JwtPayload) {
  return new Date(payload.exp * 1000).toISOString();
}

function addLog(message: string, level: LogLevel = "info") {
  activityLogs.unshift({
    id: crypto.randomUUID(),
    level,
    message,
    createdAt: new Date().toISOString(),
  });

  activityLogs.splice(25);
}

function getServerHealth(): HealthStatus {
  const freeMemoryRatio = os.freemem() / os.totalmem();

  if (freeMemoryRatio < 0.05) {
    return "Critical";
  }

  if (freeMemoryRatio < 0.15) {
    return "Warning";
  }

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

function getMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  return {
    cpuLoadAverage: os.loadavg(),
    freeMemory,
    memoryUsedPercent: Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
    processUptimeSeconds: Math.floor(process.uptime()),
    systemUptimeSeconds: Math.floor(os.uptime()),
    totalMemory,
  };
}

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
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

  const { token, payload } = createJwt(user);
  addLog(`${user.username} signed in`);

  res.json({
    token,
    user: publicUser(user),
    sessionExpiresAt: sessionExpiresAt(payload),
  });
});

app.get("/api/auth/me", (req, res) => {
  const session = requireSession(req, res);

  if (!session) {
    return;
  }

  res.json({
    user: publicUser(session.user),
    sessionExpiresAt: sessionExpiresAt(session.payload),
  });
});

app.post("/api/auth/logout", (req, res) => {
  const token = getBearerToken(req);
  const payload = token ? verifyJwt(token) : null;

  if (payload) {
    revokedTokens.set(payload.jti, payload.exp);
  }

  res.json({ message: "Logged out." });
});

app.get("/api/server/overview", (req, res) => {
  if (!requireRole(req, res, ["admin"])) {
    return;
  }

  res.json(getServerOverview());
});

app.get("/api/metrics", (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json(getMetrics());
});

app.get("/api/logs", (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json({ logs: activityLogs });
});

app.get("/api/processes", (req, res) => {
  if (!requireRole(req, res, ["operator", "admin"])) {
    return;
  }

  res.json({ processes: services });
});

app.post("/api/processes/:id/restart", (req, res) => {
  const session = requireRole(req, res, ["operator", "admin"]);

  if (!session) {
    return;
  }

  const service = services.find((candidate) => candidate.id === req.params.id);

  if (!service) {
    res.status(404).json({ message: "Process was not found." });
    return;
  }

  service.status = "running";
  service.lastRestartedAt = new Date().toISOString();
  addLog(`${session.user.username} restarted ${service.name}`, "warning");

  res.json({ message: `${service.name} restarted.`, process: service });
});

app.get("/api/admin/users", (req, res) => {
  if (!requireRole(req, res, ["admin"])) {
    return;
  }

  res.json({ users: users.map(publicUser) });
});

app.patch("/api/admin/users/:id/role", (req, res) => {
  const session = requireRole(req, res, ["admin"]);

  if (!session) {
    return;
  }

  const role = req.body?.role;
  const user = users.find((candidate) => candidate.id === req.params.id);

  if (!user) {
    res.status(404).json({ message: "User was not found." });
    return;
  }

  if (!isRole(role)) {
    res.status(400).json({ message: "Role must be viewer, operator, or admin." });
    return;
  }

  user.role = role;
  addLog(`${session.user.username} changed ${user.username} to ${role}`, "warning");

  res.json({ user: publicUser(user) });
});

app.get("/api/admin/alerts", (req, res) => {
  if (!requireRole(req, res, ["admin"])) {
    return;
  }

  res.json({ alerts: alertRules });
});

app.patch("/api/admin/alerts/:id", (req, res) => {
  const session = requireRole(req, res, ["admin"]);

  if (!session) {
    return;
  }

  const alert = alertRules.find((candidate) => candidate.id === req.params.id);

  if (!alert) {
    res.status(404).json({ message: "Alert rule was not found." });
    return;
  }

  alert.enabled = Boolean(req.body?.enabled);
  addLog(
    `${session.user.username} ${alert.enabled ? "enabled" : "disabled"} ${alert.name}`,
    "warning",
  );

  res.json({ alert });
});

app.post("/api/admin/system-actions", (req, res) => {
  const session = requireRole(req, res, ["admin"]);

  if (!session) {
    return;
  }

  const action = String(req.body?.action || "").trim();
  const allowedActions = ["run-audit", "clear-cache", "maintenance-check"];

  if (!allowedActions.includes(action)) {
    res.status(400).json({ message: "Unsupported system action." });
    return;
  }

  addLog(`${session.user.username} ran system action: ${action}`, "critical");
  res.json({ message: `System action queued: ${action}` });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
