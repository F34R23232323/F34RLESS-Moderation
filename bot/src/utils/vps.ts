import * as os from 'os';
import * as fs from 'fs';

export interface VpsStats {
  platform: string;
  arch: string;
  release: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsage: number;
  totalMem: number;
  freeMem: number;
  usedMem: number;
  memUsagePct: number;
  sysUptime: number;
  loadavg: number[] | null;
  disk: { total: number; free: number; used: number; usedPct: number } | null;
}

function cpuTimes(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function sampleDisk(): VpsStats['disk'] {
  try {
    const target = process.platform === 'win32' ? process.cwd().slice(0, 3) : '/';
    const stat = fs.statfsSync(target) as unknown as { bsize: number; blocks: number; bfree: number; bavail: number };
    const total = stat.bsize * stat.blocks;
    const free = stat.bsize * stat.bavail;
    const used = total - free;
    return { total, free, used, usedPct: Math.round((used / total) * 100) };
  } catch {
    return null;
  }
}

export async function getVpsStats(): Promise<VpsStats> {
  const start = cpuTimes();
  await new Promise((r) => setTimeout(r, 500));
  const end = cpuTimes();

  const idleDiff = end.idle - start.idle;
  const totalDiff = end.total - start.total;
  const cpuUsage = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    cpuModel: os.cpus()[0]?.model.trim() ?? 'unknown',
    cpuCores: os.cpus().length,
    cpuUsage,
    totalMem,
    freeMem,
    usedMem,
    memUsagePct: Math.round((usedMem / totalMem) * 100),
    sysUptime: os.uptime(),
    loadavg: process.platform === 'win32' ? null : os.loadavg().map((n) => Math.round(n * 100) / 100),
    disk: sampleDisk(),
  };
}

export function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

export function vpsLines(v: VpsStats): string[] {
  const lines = [
    `**OS:** ${v.platform} ${v.release} (${v.arch})`,
    `**CPU:** ${v.cpuModel} × ${v.cpuCores} cores`,
    `**CPU usage:** ${v.cpuUsage}%`,
    `**RAM:** ${formatBytes(v.usedMem)} / ${formatBytes(v.totalMem)} (${v.memUsagePct}% used)`,
    `**System uptime:** ${formatUptime(v.sysUptime * 1000)}`,
  ];
  if (v.loadavg) lines.push(`**Load avg:** ${v.loadavg.join(' / ')}`);
  if (v.disk) lines.push(`**Disk:** ${formatBytes(v.disk.used)} / ${formatBytes(v.disk.total)} (${v.disk.usedPct}% used)`);
  return lines;
}
