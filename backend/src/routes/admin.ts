import { Router } from "express";
import { addLog, alertRules, users } from "../data";
import { isRole, publicUser, requireRole } from "../middleware/auth";

export const adminRouter = Router();

adminRouter.get("/admin/users", (req, res) => {
  if (!requireRole(req, res, ["admin"])) {
    return;
  }

  res.json({ users: users.map(publicUser) });
});

adminRouter.patch("/admin/users/:id/role", (req, res) => {
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

adminRouter.get("/admin/alerts", (req, res) => {
  if (!requireRole(req, res, ["admin"])) {
    return;
  }

  res.json({ alerts: alertRules });
});

adminRouter.patch("/admin/alerts/:id", (req, res) => {
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

adminRouter.post("/admin/system-actions", (req, res) => {
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
