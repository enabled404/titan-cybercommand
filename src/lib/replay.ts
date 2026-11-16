import type { Incident } from "@/lib/types";

export interface ReplayDataset {
  startTime: number;
  endTime: number;
  isStrict24h: boolean;
  incidents: Incident[]; // sorted chronologically (oldest to newest)
}

export function buildReplayDataset(incidents: Incident[], now: number): ReplayDataset {
  const cutoff24h = now - 86_400_000;
  const direct24h = incidents
    .filter((inc) => {
      const t = Date.parse(inc.date);
      return !Number.isNaN(t) && t >= cutoff24h && t <= now;
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  if (direct24h.length >= 4) {
    return {
      startTime: cutoff24h,
      endTime: now,
      isStrict24h: true,
      incidents: direct24h,
    };
  }

  // Gracefully span recent incidents if strict 24h count is sparse
  const valid = incidents
    .filter((inc) => !Number.isNaN(Date.parse(inc.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 20)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  if (valid.length === 0) {
    return {
      startTime: cutoff24h,
      endTime: now,
      isStrict24h: true,
      incidents: [],
    };
  }

  const oldestTime = Date.parse(valid[0].date);
  // Ensure span is at least 1 hour to prevent division by zero
  const startTime = Math.min(oldestTime, now - 3600_000);

  return {
    startTime,
    endTime: now,
    isStrict24h: false,
    incidents: valid,
  };
}

export function getSimulatedTime(dataset: ReplayDataset, progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return dataset.startTime + clamped * (dataset.endTime - dataset.startTime);
}

export function filterReplayIncidents(dataset: ReplayDataset, progress: number): Incident[] {
  if (dataset.incidents.length === 0) return [];
  const simTime = getSimulatedTime(dataset, progress);
  // Landed incidents returned newest first for standard list/table display
  return dataset.incidents
    .filter((inc) => Date.parse(inc.date) <= simTime)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function calculateIncidentTickPosition(dateStr: string, dataset: ReplayDataset): number {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t) || dataset.endTime <= dataset.startTime) return 0;
  const pct = ((t - dataset.startTime) / (dataset.endTime - dataset.startTime)) * 100;
  return Math.max(0, Math.min(100, pct));
}
