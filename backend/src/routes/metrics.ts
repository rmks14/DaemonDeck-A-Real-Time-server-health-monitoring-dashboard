import { Router } from "express";
import { activityLogs } from "../data";
import { requireRole } from "../middleware/auth";
import {
  getCpuMetrics,
  getDiskMetrics,
  getMemoryMetrics,
  getMetrics,
  getServerOverview,
} from "../services/systemMetrics";

export const metricsRouter = Router();

metricsRouter.get("/server/overview", async (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json(await getServerOverview());
});

metricsRouter.get("/metrics", async (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json(await getMetrics());
});

metricsRouter.get("/metrics/cpu", async (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json(await getCpuMetrics());
});

metricsRouter.get("/metrics/memory", async (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json(await getMemoryMetrics());
});

metricsRouter.get("/metrics/disk", async (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json(await getDiskMetrics());
});

metricsRouter.get("/logs", (req, res) => {
  if (!requireRole(req, res, ["viewer", "operator", "admin"])) {
    return;
  }

  res.json({ logs: activityLogs });
});
