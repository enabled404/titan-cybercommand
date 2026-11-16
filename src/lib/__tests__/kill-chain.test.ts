import { describe, expect, it } from "vitest";
import { generateIncidentKillChain } from "@/lib/kill-chain";
import type { Incident } from "@/lib/types";

describe("Incident Kill Chain Timeline Generator", () => {
  it("generates 4 structured phases for ransomware incidents", () => {
    const inc: Incident = {
      id: "inc-ransom-1",
      victim: "Metro Health",
      actor: "Qilin",
      type: "ransomware",
      status: "confirmed",
      date: "2024-11-10T12:00:00Z",
      updated: "2024-11-10T12:00:00Z",
      summary: "Critical healthcare disruption",
      geoBasis: "stated",
      cves: ["CVE-2024-21762"],
      country: "US",
      lon: -84.3,
      lat: 33.7,
      origin: "news",
      sources: [],
      confidence: 0.95,
      severity: 4,
      title: "Metro Health hit by Qilin ransomware",
    };

    const steps = generateIncidentKillChain(inc);
    expect(steps.length).toBe(4);

    // Phase 1: Initial access via CVE
    expect(steps[0].phase).toBe(1);
    expect(steps[0].mitreId).toBe("T1190");
    expect(steps[0].detail).toContain("CVE-2024-21762");

    // Phase 2: Persistence
    expect(steps[1].phase).toBe(2);
    expect(steps[1].detail).toContain("Qilin");

    // Phase 3: Lateral movement
    expect(steps[2].phase).toBe(3);
    expect(steps[2].technicalIoC).toContain("vssadmin");

    // Phase 4: Encryption impact
    expect(steps[3].phase).toBe(4);
    expect(steps[3].mitreId).toBe("T1486");
    expect(steps[3].status).toBe("CONFIRMED");
  });

  it("handles supply chain incident kill chains", () => {
    const inc: Incident = {
      id: "inc-supply-1",
      victim: "Cloud Corp",
      type: "supply_chain",
      status: "reported",
      date: "2024-11-08T08:00:00Z",
      updated: "2024-11-08T08:00:00Z",
      summary: "Dependency breach",
      geoBasis: "stated",
      cves: [],
      country: "GB",
      lon: -0.1,
      lat: 51.5,
      origin: "news",
      sources: [],
      confidence: 0.8,
      severity: 4,
      title: "Supply chain injection affects Cloud Corp",
    };

    const steps = generateIncidentKillChain(inc);
    expect(steps[0].mitreId).toBe("T1195.002");
    expect(steps[0].mitreName).toContain("Supply Chain");
  });

  it("handles claimed leak site incidents without confirmed breach", () => {
    const inc: Incident = {
      id: "inc-claimed-1",
      victim: "Omega Logistics",
      actor: "LockBit",
      type: "extortion",
      status: "claimed",
      date: "2024-11-12T14:00:00Z",
      updated: "2024-11-12T14:00:00Z",
      summary: "Data extortion leak claim",
      geoBasis: "stated",
      cves: [],
      country: "DE",
      lon: 13.4,
      lat: 52.5,
      origin: "news",
      sources: [],
      confidence: 0.7,
      severity: 3,
      title: "LockBit claims extortion against Omega Logistics",
    };

    const steps = generateIncidentKillChain(inc);
    expect(steps[0].mitreId).toBe("T1078");
    expect(steps[3].status).toBe("ACTIVE");
  });

  it("handles missing or invalid date strings safely without throwing RangeError", () => {
    const inc: Incident = {
      id: "inc-invalid-date",
      victim: "Test Org",
      type: "cyberattack",
      status: "confirmed",
      date: "invalid-not-a-date",
      updated: "",
      summary: "",
      geoBasis: "country",
      cves: [],
      country: "US",
      lon: 0,
      lat: 0,
      origin: "news",
      sources: [],
      confidence: 0.5,
      severity: 2,
      title: "Test incident with malformed date",
    };

    expect(() => generateIncidentKillChain(inc)).not.toThrow();
    const steps = generateIncidentKillChain(inc);
    expect(steps.length).toBe(4);
    expect(steps[0].timestamp).toContain("T - ");
  });
});
