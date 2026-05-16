import os from "node:os";
import * as si from "systeminformation";
import { thresholds } from "../config/thresholds";
import { getActiveServiceCount, getProcessCounts, getProcesses } from "./processes";
import type { DiskPartition, HealthStatus, ServerOverview } from "../types";

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function roundPercent(value: number) {
  return Math.round(clampPercent(value) * 100) / 100;
}

function getMetricStatus(
  value: number,
  warningThreshold: number,
  criticalThreshold: number,
): HealthStatus {
  if (value > criticalThreshold) {
    return "Critical";
  }

  if (value > warningThreshold) {
    return "Warning";
  }

  return "Healthy";
}

function summarizeHealth(...statuses: HealthStatus[]) {
  const health: HealthStatus = statuses.includes("Critical")
    ? "Critical"
    : statuses.includes("Warning")
      ? "Warning"
      : "Healthy";

  return {
    criticalAlertCount: statuses.filter((status) => status === "Critical").length,
    health,
    warningAlertCount: statuses.filter((status) => status === "Warning").length,
  };
}

function mapDiskPartitions(disks: si.Systeminformation.FsSizeData[]) {
  return disks.map<DiskPartition>((disk) => {
    const usagePercent = roundPercent(disk.use);

    return {
      available: disk.available,
      filesystem: disk.fs,
      mount: disk.mount,
      status: getMetricStatus(
        usagePercent,
        thresholds.disk.warning,
        thresholds.disk.critical,
      ),
      total: disk.size,
      type: disk.type,
      usagePercent,
      used: disk.used,
    };
  });
}

function getHighestDiskUsage(partitions: DiskPartition[]) {
  return partitions.reduce(
    (highestUsage, partition) =>
      Math.max(highestUsage, partition.usagePercent),
    0,
  );
}

async function getSystemSnapshot() {
  const [load, memory, disks] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
  ]);
  const partitions = mapDiskPartitions(disks);
  const cpuUsagePercent = roundPercent(load.currentLoad);
  const memoryUsagePercent = roundPercent((memory.used / memory.total) * 100);
  const diskUsagePercent = getHighestDiskUsage(partitions);
  const cpuStatus = getMetricStatus(
    cpuUsagePercent,
    thresholds.cpu.warning,
    thresholds.cpu.critical,
  );
  const memoryStatus = getMetricStatus(
    memoryUsagePercent,
    thresholds.memory.warning,
    thresholds.memory.critical,
  );
  const diskStatus = getMetricStatus(
    diskUsagePercent,
    thresholds.disk.warning,
    thresholds.disk.critical,
  );

  return {
    cpu: load,
    cpuUsagePercent,
    diskUsagePercent,
    memory,
    memoryUsagePercent,
    partitions,
    ...summarizeHealth(cpuStatus, memoryStatus, diskStatus),
  };
}

export async function getServerOverview(): Promise<ServerOverview> {
  const [snapshot, osInfo, time, processCounts] = await Promise.all([
    getSystemSnapshot(),
    si.osInfo(),
    si.time(),
    getProcessCounts(),
  ]);

  return {
    activeServiceCount: getActiveServiceCount(),
    cpuUsagePercent: snapshot.cpuUsagePercent,
    criticalAlertCount: snapshot.criticalAlertCount,
    currentTime: new Date(time.current).toISOString(),
    diskUsagePercent: snapshot.diskUsagePercent,
    health: snapshot.health,
    hostname: osInfo.hostname,
    kernel: osInfo.kernel,
    memoryUsagePercent: snapshot.memoryUsagePercent,
    operatingSystem: osInfo.distro || osInfo.platform,
    platform: osInfo.platform,
    runningProcessCount: processCounts.all,
    uptimeSeconds: Math.floor(time.uptime),
    warningAlertCount: snapshot.warningAlertCount,
  };
}

export async function getCpuMetrics() {
  const [load, processList] = await Promise.all([
    si.currentLoad(),
    getProcesses(),
  ]);
  const cpuUsagePercent = roundPercent(load.currentLoad);
  const status = getMetricStatus(
    cpuUsagePercent,
    thresholds.cpu.warning,
    thresholds.cpu.critical,
  );

  return {
    cpuUsagePercent,
    loadAverage: os.loadavg(),
    perCoreUsage: load.cpus.map((core, index) => ({
      core: index,
      usagePercent: roundPercent(core.load),
    })),
    status,
    thresholds: thresholds.cpu,
    topProcesses: [...processList]
      .sort((a, b) => b.cpuUsagePercent - a.cpuUsagePercent)
      .slice(0, 5),
  };
}

export async function getMemoryMetrics() {
  const [memory, processList] = await Promise.all([si.mem(), getProcesses()]);
  const memoryUsagePercent = roundPercent((memory.used / memory.total) * 100);
  const swapUsagePercent =
    memory.swaptotal > 0
      ? roundPercent((memory.swapused / memory.swaptotal) * 100)
      : 0;
  const status = getMetricStatus(
    memoryUsagePercent,
    thresholds.memory.warning,
    thresholds.memory.critical,
  );

  return {
    availableMemory: memory.available,
    freeMemory: memory.free,
    memoryUsagePercent,
    status,
    swapFree: memory.swapfree,
    swapTotal: memory.swaptotal,
    swapUsagePercent,
    swapUsed: memory.swapused,
    thresholds: thresholds.memory,
    topProcesses: [...processList]
      .sort((a, b) => b.memoryUsagePercent - a.memoryUsagePercent)
      .slice(0, 5),
    totalMemory: memory.total,
    usedMemory: memory.used,
  };
}

export async function getMetrics() {
  const [snapshot, osInfo, processList] = await Promise.all([
    getSystemSnapshot(),
    si.osInfo(),
    getProcesses(),
  ]);
  const memory = snapshot.memory;

  return {
    cpuCoreUsage: snapshot.cpu.cpus.map((core, index) => ({
      core: index,
      usagePercent: roundPercent(core.load),
    })),
    cpuLoadAverage: os.loadavg(),
    cpuUsagePercent: snapshot.cpuUsagePercent,
    diskPartitions: snapshot.partitions,
    diskUsagePercent: snapshot.diskUsagePercent,
    freeMemory: memory.free,
    memoryAvailable: memory.available,
    memoryUsedPercent: snapshot.memoryUsagePercent,
    operatingSystem: {
      arch: osInfo.arch,
      distro: osInfo.distro,
      hostname: osInfo.hostname,
      kernel: osInfo.kernel,
      platform: osInfo.platform,
      release: osInfo.release,
    },
    processUptimeSeconds: Math.floor(process.uptime()),
    swapFree: memory.swapfree,
    swapTotal: memory.swaptotal,
    swapUsed: memory.swapused,
    systemUptimeSeconds: Math.floor(si.time().uptime),
    topCpuProcesses: [...processList]
      .sort((a, b) => b.cpuUsagePercent - a.cpuUsagePercent)
      .slice(0, 5),
    topMemoryProcesses: [...processList]
      .sort((a, b) => b.memoryUsagePercent - a.memoryUsagePercent)
      .slice(0, 5),
    totalMemory: memory.total,
    usedMemory: memory.used,
  };
}
