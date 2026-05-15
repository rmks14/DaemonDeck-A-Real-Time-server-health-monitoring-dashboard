import * as si from "systeminformation";
import { addLog, services } from "../data";
import type { ProcessRecord } from "../types";

export async function getProcesses(): Promise<ProcessRecord[]> {
  const data = await si.processes();

  return data.list
    .map((processRecord) => ({
      command: processRecord.command || processRecord.name,
      cpuUsagePercent: roundPercent(processRecord.cpu),
      id: String(processRecord.pid),
      lastRestartedAt: null,
      memoryUsagePercent: roundPercent(processRecord.mem),
      name: processRecord.name || String(processRecord.pid),
      pid: processRecord.pid,
      startTime: processRecord.started,
      status: processRecord.state || "unknown",
      user: processRecord.user || "unknown",
    }))
    .sort((a, b) => b.cpuUsagePercent - a.cpuUsagePercent)
    .slice(0, 100);
}

export async function getProcessCounts() {
  const data = await si.processes();

  return {
    all: data.all,
    running: data.running,
  };
}

export function getActiveServiceCount() {
  return services.filter((service) => service.status === "running").length;
}

export function restartProcess(processId: string, username: string) {
  const service = services.find((candidate) => candidate.id === processId);

  if (!service) {
    return null;
  }

  service.status = "running";
  service.lastRestartedAt = new Date().toISOString();
  addLog(`${username} restarted ${service.name}`, "warning");

  return service;
}

function roundPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(Math.max(0, value) * 100) / 100;
}
