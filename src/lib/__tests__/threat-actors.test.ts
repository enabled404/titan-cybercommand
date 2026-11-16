import { describe, expect, it } from "vitest";
import { getThreatActorProfile, CURATED_THREAT_ACTORS } from "@/lib/threat-actors";
import type { Snapshot } from "@/lib/types";

describe("Threat Actor Intelligence Dossiers", () => {
  it("retrieves curated profile for Volt Typhoon", () => {
    const actor = getThreatActorProfile("Volt Typhoon");
    expect(actor.id).toBe("volt-typhoon");
    expect(actor.origin).toContain("China");
    expect(actor.nexus).toBe("State-Sponsored APT");
    expect(actor.threatLevel).toBe("DEFCON 1");
    expect(actor.mitreAttack.some((m) => m.id === "T1190")).toBe(true);
    expect(actor.knownCves.some((c) => c.cve === "CVE-2024-21887")).toBe(true);
  });

  it("retrieves profile by alias", () => {
    const actor = getThreatActorProfile("Fancy Bear");
    expect(actor.id).toBe("apt28");
    expect(actor.name).toBe("APT28");
    expect(actor.origin).toContain("Russia");
  });

  it("retrieves profile for Lazarus Group", () => {
    const actor = getThreatActorProfile("Lazarus Group");
    expect(actor.id).toBe("lazarus-group");
    expect(actor.countryCode).toBe("KP");
    expect(actor.knownCampaigns.length).toBeGreaterThan(0);
  });

  it("retrieves profile for LockBit ransomware syndicate", () => {
    const actor = getThreatActorProfile("LockBit");
    expect(actor.id).toBe("lockbit");
    expect(actor.nexus).toBe("Ransomware Syndicate");
    expect(actor.knownCves.some((c) => c.cve === "CVE-2023-4966")).toBe(true);
  });

  it("generates authentic dynamic profile for uncurated threat actor", () => {
    const mockSnapshot = {
      incidents: [
        {
          id: "inc-1",
          victim: "Acme Corp",
          actor: "CyberPhantom",
          country: "US",
          sector: "Financial",
          type: "ransomware",
          date: "2024-11-01T00:00:00Z",
          status: "confirmed",
          cves: ["CVE-2024-1234"],
          sources: [],
          title: "Acme Corp breached by CyberPhantom",
          severity: 4,
          lon: -74.0,
          lat: 40.7,
          origin: "news",
          confidence: 0.9,
          records: 100000,
        },
      ],
      outages: [],
      kev: [],
      trending: [],
      fresh: [],
      malware: [],
      feeds: [],
      generatedAt: "2024-11-15T00:00:00Z",
    } as unknown as Snapshot;

    const dynamicActor = getThreatActorProfile("CyberPhantom", mockSnapshot);
    expect(dynamicActor.name).toBe("CyberPhantom");
    expect(dynamicActor.nexus).toBe("Ransomware Syndicate");
    expect(dynamicActor.targetSectors).toContain("Financial");
    expect(dynamicActor.targetCountries).toContain("US");
    expect(dynamicActor.knownCves.some((c) => c.cve === "CVE-2024-1234")).toBe(true);
    expect(dynamicActor.relatedIncidents?.length).toBe(1);
  });

  it("ensures all curated threat actors have valid MITRE techniques and CVEs", () => {
    for (const actor of CURATED_THREAT_ACTORS) {
      expect(actor.id).toBeTruthy();
      expect(actor.name).toBeTruthy();
      expect(actor.mitreAttack.length).toBeGreaterThan(0);
      for (const m of actor.mitreAttack) {
        expect(m.id).toMatch(/^T\d+(\.\d+)?$/);
        expect(m.tactic).toBeTruthy();
        expect(m.technique).toBeTruthy();
      }
    }
  });
});
