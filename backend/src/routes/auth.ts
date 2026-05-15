import { Router } from "express";
import { addLog, users } from "../data";
import {
  createJwt,
  getBearerToken,
  publicUser,
  requireSession,
  revokeToken,
  sessionExpiresAt,
  verifyJwt,
} from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
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

authRouter.get("/me", (req, res) => {
  const session = requireSession(req, res);

  if (!session) {
    return;
  }

  res.json({
    user: publicUser(session.user),
    sessionExpiresAt: sessionExpiresAt(session.payload),
  });
});

authRouter.post("/logout", (req, res) => {
  const token = getBearerToken(req);
  const payload = token ? verifyJwt(token) : null;

  if (payload) {
    revokeToken(payload);
  }

  res.json({ message: "Logged out." });
});
