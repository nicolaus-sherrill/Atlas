const API_URL = "/api";

export interface CrowdStatus {
  level: number;
  label: string;
  lastReportedAt: string;
  reportCount: number;
}

export interface HourlyAverage {
  dayOfWeek: number;
  hourOfDay: number;
  avgLevel: number;
  count: number;
}

export interface SpotCrowdData {
  spotId: string;
  current: CrowdStatus | null;
  hourlyAverages: HourlyAverage[];
}

export const BUSYNESS_LEVELS = [
  { level: 1, label: "Not busy", color: "#8A9E8C" },
  { level: 2, label: "A little busy", color: "#C8B89A" },
  { level: 3, label: "Busy", color: "#D4915E" },
  { level: 4, label: "Very busy", color: "#C25E4A" },
] as const;

export function getBusynessInfo(level: number) {
  return BUSYNESS_LEVELS.find((b) => b.level === level) || BUSYNESS_LEVELS[0];
}

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export async function submitCrowdReport(spotId: string, level: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/crowd-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotId, level }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchCrowdStatus(spotId: string): Promise<SpotCrowdData | null> {
  try {
    const res = await fetch(`${API_URL}/crowd-status/${spotId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAllCrowdStatuses(): Promise<Record<string, CrowdStatus>> {
  try {
    const res = await fetch(`${API_URL}/crowd-status`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.statuses || {};
  } catch {
    return {};
  }
}
