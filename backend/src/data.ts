import crypto from "node:crypto";
import type { AlertRule, LogEntry, LogLevel, ServiceRecord, User } from "./types";

export const users: User[] = [
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

export const services: ServiceRecord[] = [
  { id: "api", name: "API server", status: "running", lastRestartedAt: null },
  { id: "worker", name: "Background worker", status: "running", lastRestartedAt: null },
  { id: "scheduler", name: "Task scheduler", status: "running", lastRestartedAt: null },
];

export const alertRules: AlertRule[] = [
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

export const activityLogs: LogEntry[] = [
  {
    id: crypto.randomUUID(),
    level: "info",
    message: "Dashboard API started",
    createdAt: new Date().toISOString(),
  },
];

export function addLog(message: string, level: LogLevel = "info") {
  activityLogs.unshift({
    id: crypto.randomUUID(),
    level,
    message,
    createdAt: new Date().toISOString(),
  });

  activityLogs.splice(25);
}
