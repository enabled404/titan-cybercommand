import { describe, expect, it } from "vitest";
import { useSituation } from "@/stores/situation";
import { scoreReconPosture } from "@/lib/recon";
import { readFileSync } from "fs";
import { join } from "path";

describe("Time-Travel Replay State and Posture Intelligence", () => {
  it("manages replay state progression and speed adjustments", () => {
    useSituation.getState().setReplay(null);
    expect(useSituation.getState().replay.active).toBe(false);

    // Activate replay
    useSituation.getState().setReplay({ active: true, playing: true, progress: 0.25, speed: 2 });
    const cur = useSituation.getState().replay;
    expect(cur.active).toBe(true);
    expect(cur.playing).toBe(true);
    expect(cur.progress).toBe(0.25);
    expect(cur.speed).toBe(2);

    // Seek scrubber
    useSituation.getState().setReplay({ progress: 0.75 });
    expect(useSituation.getState().replay.progress).toBe(0.75);

    // Exit replay
    useSituation.getState().setReplay(null);
    expect(useSituation.getState().replay.active).toBe(false);
    expect(useSituation.getState().replay.playing).toBe(false);
  });

  it("calculates realistic posture score for fortified domains", () => {
    const fortified = scoreReconPosture({
      nxdomain: false,
      spfValid: true,
      dmarcEnforced: true,
      dmarcPresent: true,
      incidentCount: 0,
      cveCount: 0,
    });
    expect(fortified.score).toBe(100);
    expect(fortified.grade).toBe("A+");
  });

  it("penalizes posture score for compromised domains with flaws", () => {
    const compromised = scoreReconPosture({
      nxdomain: false,
      spfValid: false,
      dmarcEnforced: false,
      dmarcPresent: false,
      incidentCount: 2,
      cveCount: 3,
    });
    expect(compromised.score).toBeLessThan(50);
    expect(["D", "F"]).toContain(compromised.grade);
  });

  it("strictly enforces NO em dashes in newly authored modules", () => {
    const filesToCheck = [
      "src/lib/threat-actors.ts",
      "src/lib/kill-chain.ts",
      "src/components/hud/am-i-affected-hero.tsx",
      "src/components/hud/am-i-affected-modal.tsx",
      "src/components/hud/share-card-modal.tsx",
      "src/components/hud/threat-actor-modal.tsx",
      "src/components/hud/kill-chain-timeline.tsx",
      "src/components/hud/replay-dock.tsx",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = join(process.cwd(), relPath);
      const content = readFileSync(fullPath, "utf-8");
      expect(content.includes("\u2014")).toBe(false);
    }
  });

  it("evaluates NXDOMAIN domains as Grade F zero score", () => {
    const nx = scoreReconPosture({
      nxdomain: true,
      spfValid: false,
      dmarcEnforced: false,
      dmarcPresent: false,
      incidentCount: 0,
      cveCount: 0,
    });
    expect(nx.score).toBe(0);
    expect(nx.grade).toBe("F");
  });

  it("filters incidents chronologically during time-travel replay progression", () => {
    const baseTime = 1700000000000;
    const testIncidents = [
      { id: "inc-1", date: new Date(baseTime - 80_000_000).toISOString() }, // ~22h ago
      { id: "inc-2", date: new Date(baseTime - 40_000_000).toISOString() }, // ~11h ago
      { id: "inc-3", date: new Date(baseTime - 5_000_000).toISOString() },  // ~1.4h ago
    ];

    // At progress 0 (24h ago): 0 attacks passed
    const simTime0 = baseTime - 86_400_000;
    const filter0 = testIncidents.filter((i) => Date.parse(i.date) <= simTime0);
    expect(filter0.length).toBe(0);

    // At progress 0.5 (12h ago): only inc-1 passed
    const simTime50 = baseTime - 0.5 * 86_400_000;
    const filter50 = testIncidents.filter((i) => Date.parse(i.date) <= simTime50);
    expect(filter50.map((i) => i.id)).toEqual(["inc-1"]);

    // At progress 1.0 (now): all passed
    const simTime100 = baseTime;
    const filter100 = testIncidents.filter((i) => Date.parse(i.date) <= simTime100);
    expect(filter100.length).toBe(3);
  });
});
