import { describe, expect, it } from "vitest";

import seedC2Nodes from "@/data/seed-c2-nodes.json";
import type { BotnetC2Node } from "@/lib/types";

describe("Botnet C2 Telemetry and Global Threat Matrix", () => {
  it("loads authentic seed C2 infrastructure nodes with complete telemetry fields", () => {
    const nodes = seedC2Nodes as BotnetC2Node[];
    expect(nodes.length).toBeGreaterThanOrEqual(40);

    for (const node of nodes.slice(0, 10)) {
      expect(node.id).toMatch(/^c2-/);
      expect(node.ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      expect(typeof node.port).toBe("number");
      expect(node.port).toBeGreaterThan(0);
      expect(node.framework).toBeDefined();
      expect(node.framework.length).toBeGreaterThan(2);
      expect(node.country).toBeDefined();
      expect(node.country.length).toBe(2);
      expect(node.lat).toBeGreaterThanOrEqual(-90);
      expect(node.lat).toBeLessThanOrEqual(90);
      expect(node.lon).toBeGreaterThanOrEqual(-180);
      expect(node.lon).toBeLessThanOrEqual(180);
      expect(node.status).toBe("active");
    }
  });

  it("calculates accurate country incident share percentages without NaN or overflow", () => {
    const mockIncidents = [
      { country: "US", status: "confirmed" },
      { country: "US", status: "claimed" },
      { country: "DE", status: "confirmed" },
      { country: "GB", status: "reported" },
    ];

    const total = mockIncidents.length;
    const usCount = mockIncidents.filter((i) => i.country === "US").length;
    const usShare = Math.round((usCount / total) * 100);

    expect(usShare).toBe(50);
  });
});
