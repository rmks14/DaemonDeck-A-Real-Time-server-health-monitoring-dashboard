import * as si from "systeminformation";
import { addLog, services } from "../data";
import type { ProcessRecord } from "../types";

export async function getProcesses(): Promise<ProcessRecord[]> {
  const data = await si.processes();

  return data.list
    .filter((processRecord) => processRecord.pid > 0)
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

export function killProcess(processId: string, username: string) {
  const pid = Number(processId);

  if (!Number.isInteger(pid) || pid <= 0) {
    return { message: "Process ID must be a positive integer.", status: 400 };
  }

  if (pid === process.pid) {
    return { message: "Refusing to stop the dashboard API process.", status: 400 };
  }

  try {
    process.kill(pid, "SIGTERM");
    addLog(`${username} sent SIGTERM to process ${pid}`, "critical");

    return { message: `Process ${pid} was sent SIGTERM.`, status: 200 };
  } catch (caughtError) {
    const code =
      caughtError && typeof caughtError === "object" && "code" in caughtError
        ? String(caughtError.code)
        : "";

    if (code === "ESRCH") {
      return { message: "Process was not found.", status: 404 };
    }

    return { message: "Process could not be stopped.", status: 500 };
  }
}

function roundPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(Math.max(0, value) * 100) / 100;
}
