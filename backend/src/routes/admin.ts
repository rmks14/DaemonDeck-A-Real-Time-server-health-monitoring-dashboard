import { Router } from "express";
import {
  addLog,
  getAlertRuleById,
  getAlertRules,
  getUserById,
  getUsers,
  updateAlertRuleEnabled,
  updateUserRole,
} from "../data";
import { isRole, publicUser, requireRole } from "../middleware/auth";

export const adminRouter = Router();

adminRouter.get("/admin/users", (req, res) => {
  if (!requireRole(req, res, ["admin"])) {
    return;
  }

  res.json({ users: getUsers().map(publicUser) });
});

adminRouter.patch("/admin/users/:id/role", (req, res) => {
  const session = requireRole(req, res, ["admin"]);

  if (!session) {
    return;
  }

  const role = req.body?.role;
  const user = getUserById(req.params.id);

  if (!user) {
    res.status(404).json({ message: "User was not found." });
    return;
  }

  if (!isRole(role)) {
    res.status(400).json({ message: "Role must be viewer, operator, or admin." });
    return;
  }

  const updatedUser = updateUserRole(user.id, role);

  if (!updatedUser) {
    res.status(404).json({ message: "User was not found." });
    return;
  }

  addLog(`${session.user.username} changed ${updatedUser.username} to ${role}`, "warning");

  res.json({ user: publicUser(updatedUser) });
});

adminRouter.get("/admin/alerts", (req, res) => {
  if (!requireRole(req, res, ["admin"])) {
    return;
  }

  res.json({ alerts: getAlertRules() });
});

adminRouter.patch("/admin/alerts/:id", (req, res) => {
  const session = requireRole(req, res, ["admin"]);

  if (!session) {
    return;
  }

  const alert = getAlertRuleById(req.params.id);

  if (!alert) {
    res.status(404).json({ message: "Alert rule was not found." });
    return;
  }

  const updatedAlert = updateAlertRuleEnabled(alert.id, Boolean(req.body?.enabled));

  if (!updatedAlert) {
    res.status(404).json({ message: "Alert rule was not found." });
    return;
  }

  addLog(
    `${session.user.username} ${
      updatedAlert.enabled ? "enabled" : "disabled"
    } ${updatedAlert.name}`,
    "warning",
  );

  res.json({ alert: updatedAlert });
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
