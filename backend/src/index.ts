import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

dotenv.config();

const app = express();

const port = Number(process.env.PORT) || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

type PublicUser = {
  id: string;
  name: string;
  username: string;
  email: string;
};

type UserRecord = PublicUser & {
  password: string;
};

const users: UserRecord[] = [
  {
    id: "user-1",
    name: "Demo User",
    username: "demo",
    email: "demo@example.com",
    password: "password123",
  },
];

const sessions = new Map<string, PublicUser>();

app.use(cors({ origin: clientUrl }));
app.use(express.json());

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
  };
}

function getBearerToken(req: Request) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function requireSession(req: Request, res: Response) {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({ message: "Missing auth token." });
    return null;
  }

  const user = sessions.get(token);

  if (!user) {
    res.status(401).json({ message: "Invalid or expired auth token." });
    return null;
  }

  return { token, user };
}

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", (req, res) => {
  const identifier = String(req.body.identifier || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!identifier || !password) {
    res.status(400).json({ message: "Email/username and password are required." });
    return;
  }

  const user = users.find(
    (candidate) =>
      candidate.email.toLowerCase() === identifier ||
      candidate.username.toLowerCase() === identifier,
  );

  if (!user || user.password !== password) {
    res.status(401).json({ message: "Invalid email/username or password." });
    return;
  }

  const publicUser = toPublicUser(user);
  const token = randomUUID();
  sessions.set(token, publicUser);

  res.json({ token, user: publicUser });
});

app.get("/api/auth/me", (req, res) => {
  const session = requireSession(req, res);

  if (!session) {
    return;
  }

  res.json({ user: session.user });
});

app.post("/api/auth/logout", (req, res) => {
  const session = requireSession(req, res);

  if (!session) {
    return;
  }

  sessions.delete(session.token);
  res.json({ message: "Logged out." });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
