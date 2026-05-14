import crypto from "node:crypto";
import os from "node:os";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request } from "express";

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
const sessionTtlMs = sessionTtlMinutes * 60 * 1000;
const authTokenSecret = getAuthTokenSecret();

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

type Session = {
  userId: string;
  expiresAt: number;
  tokenId: string;
};

type AuthTokenPayload = Session;

type CurrentSession = {
  user: User;
  session: Session;
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

function publicUser(user: User) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

function getToken(req: Request) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function signTokenPart(encodedPayload: string) {
  return crypto
    .createHmac("sha256", authTokenSecret)
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(actualSignature: string, expectedSignature: string) {
  const actual = Buffer.from(actualSignature);
  const expected = Buffer.from(expectedSignature);

  return (
    actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  );
}

function isAuthTokenPayload(value: unknown): value is AuthTokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<AuthTokenPayload>;

  return (
    typeof payload.userId === "string" &&
    typeof payload.expiresAt === "number" &&
    Number.isFinite(payload.expiresAt) &&
    typeof payload.tokenId === "string"
  );
}

function cleanupRevokedTokens() {
  const now = Date.now();

  for (const [tokenId, expiresAt] of revokedTokens) {
    if (expiresAt <= now) {
      revokedTokens.delete(tokenId);
    }
  }
}

function verifyAuthToken(token: string): Session | null {
  const tokenParts = token.split(".");

  if (tokenParts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = tokenParts;

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTokenPart(encodedPayload);

  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;

    if (!isAuthTokenPayload(payload) || payload.expiresAt <= Date.now()) {
      return null;
    }

    if (revokedTokens.has(payload.tokenId)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getCurrentSession(req: Request): CurrentSession | null {
  const token = getToken(req);

  if (!token) {
    return null;
  }

  const session = verifyAuthToken(token);

  if (!session) {
    return null;
  }

  const user = users.find((candidate) => candidate.id === session.userId);

  return user ? { user, session } : null;
}

function createSession(user: User) {
  cleanupRevokedTokens();

  const session = {
    userId: user.id,
    expiresAt: Date.now() + sessionTtlMs,
    tokenId: crypto.randomUUID(),
  };
  const payload: AuthTokenPayload = session;
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const token = `${encodedPayload}.${signTokenPart(encodedPayload)}`;

  return { token, session };
}

function formatSessionExpiresAt(session: Session) {
  return new Date(session.expiresAt).toISOString();
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

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/server/overview", (req, res) => {
  const currentSession = getCurrentSession(req);

  if (!currentSession) {
    res.status(401).json({ message: "Invalid or expired session." });
    return;
  }

  if (currentSession.user.role !== "admin") {
    res.status(403).json({ message: "Admin access is required." });
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

  const { token, session } = createSession(user);
  res.json({
    token,
    user: publicUser(user),
    sessionExpiresAt: formatSessionExpiresAt(session),
  });
});

app.get("/api/auth/me", (req, res) => {
  const currentSession = getCurrentSession(req);

  if (!currentSession) {
    res.status(401).json({ message: "Invalid or expired session." });
    return;
  }

  res.json({
    user: publicUser(currentSession.user),
    sessionExpiresAt: formatSessionExpiresAt(currentSession.session),
  });
});

app.post("/api/auth/logout", (_req, res) => {
  const token = getToken(_req);
  const session = token ? verifyAuthToken(token) : null;

  if (session) {
    revokedTokens.set(session.tokenId, session.expiresAt);
  }

  res.json({ message: "Logged out." });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
