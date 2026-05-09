import cors from "cors";
import dotenv from "dotenv";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { z } from "zod";

dotenv.config();

const app = express();

const port = Number(process.env.PORT) || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const jwtSecret = getJwtSecret();
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ||
  "1h") as SignOptions["expiresIn"];

type Role = "viewer" | "operator" | "admin";

type PublicUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
};

type UserRecord = PublicUser & {
  passwordHash: string;
};

const users: UserRecord[] = [
  {
    id: "user-1",
    name: "Demo User",
    username: "demo",
    email: "demo@example.com",
    role: "admin",
    passwordHash:
      "$2b$10$sljSmG25ckhDziY/3Xa3J.4z8rbSKfBI1bOFc4htA.XVZFJKhPMgi",
  },
  {
    id: "user-2",
    name: "Viewer User",
    username: "viewer",
    email: "viewer@example.com",
    role: "viewer",
    passwordHash:
      "$2b$10$P3CDb.ckoS6jJa1KFn.izelNh2SpXjilCdWxomndsDgsJOyamN9jm",
  },
  {
    id: "user-3",
    name: "Operator User",
    username: "operator",
    email: "operator@example.com",
    role: "operator",
    passwordHash:
      "$2b$10$eIPFXBCKhD3h0SaE09C4KOUkr3lkqBQ/uGx.hfYV4Hibp2hfJANJO",
  },
];

type AuthContext = {
  token: string;
  user: PublicUser;
};

type AuthTokenPayload = JwtPayload & {
  sub: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

app.use(cors({ origin: clientUrl }));
app.use(express.json());

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production.");
  }

  console.warn("JWT_SECRET is not set. Using an insecure development secret.");
  return "dev-only-change-me";
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

function getBearerToken(req: Request) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function signAuthToken(user: PublicUser) {
  return jwt.sign(
    {
      role: user.role,
      username: user.username,
    },
    jwtSecret,
    {
      expiresIn: jwtExpiresIn,
      subject: user.id,
    },
  );
}

function isAuthTokenPayload(payload: string | JwtPayload): payload is AuthTokenPayload {
  return (
    typeof payload !== "string" &&
    typeof payload.sub === "string" &&
    (payload.role === "viewer" ||
      payload.role === "operator" ||
      payload.role === "admin")
  );
}

const requireAuth: RequestHandler = (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({ message: "Missing auth token." });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);

    if (!isAuthTokenPayload(payload)) {
      res.status(401).json({ message: "Invalid auth token." });
      return;
    }

    const user = users.find((candidate) => candidate.id === payload.sub);

    if (!user) {
      res.status(401).json({ message: "Invalid auth token." });
      return;
    }

    req.auth = {
      token,
      user: toPublicUser(user),
    };

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired auth token." });
  }
};

function requireRole(...allowedRoles: Role[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ message: "Authentication is required." });
      return;
    }

    if (!allowedRoles.includes(req.auth.user.role)) {
      res.status(403).json({ message: "You do not have permission to do that." });
      return;
    }

    next();
  };
}

app.get("/", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", async (req, res) => {
  const parsedBody = loginSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ message: "Email/username and password are required." });
    return;
  }

  const identifier = parsedBody.data.identifier.toLowerCase();
  const password = parsedBody.data.password;

  const user = users.find(
    (candidate) =>
      candidate.email.toLowerCase() === identifier ||
      candidate.username.toLowerCase() === identifier,
  );

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: "Invalid email/username or password." });
    return;
  }

  const publicUser = toPublicUser(user);
  const token = signAuthToken(publicUser);

  res.json({ token, user: publicUser });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.auth?.user });
});

app.post("/api/auth/logout", (_req, res) => {
  res.json({ message: "Logged out." });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
