import crypto from "node:crypto";
import dotenv from "dotenv";
import type { Request, Response } from "express";
import { users } from "../data";
import type { CurrentSession, JwtPayload, PublicUser, Role, User } from "../types";

dotenv.config();

const configuredSessionTtlMinutes = Number(process.env.SESSION_TTL_MINUTES);
const sessionTtlMinutes =
  Number.isFinite(configuredSessionTtlMinutes) &&
  configuredSessionTtlMinutes > 0
    ? configuredSessionTtlMinutes
    : 60;
const sessionTtlSeconds = Math.floor(sessionTtlMinutes * 60);
const authTokenSecret = getAuthTokenSecret();
const revokedTokens = new Map<string, number>();

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

export function publicUser(user: User): PublicUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function getBearerToken(req: Request) {
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

export function isRole(value: unknown): value is Role {
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

export function createJwt(user: User) {
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

export function verifyJwt(token: string): JwtPayload | null {
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

export function getCurrentSession(req: Request): CurrentSession | null {
  const token = getBearerToken(req);
  const payload = token ? verifyJwt(token) : null;

  if (!payload) {
    return null;
  }

  const user = users.find((candidate) => candidate.id === payload.sub);

  return user ? { user, payload } : null;
}

export function requireSession(req: Request, res: Response) {
  const session = getCurrentSession(req);

  if (!session) {
    res.status(401).json({ message: "Invalid or expired session." });
    return null;
  }

  return session;
}

export function requireRole(req: Request, res: Response, allowedRoles: Role[]) {
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

export function revokeToken(payload: JwtPayload) {
  revokedTokens.set(payload.jti, payload.exp);
}

export function sessionExpiresAt(payload: JwtPayload) {
  return new Date(payload.exp * 1000).toISOString();
}
