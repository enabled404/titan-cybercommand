import { describe, expect, it } from "vitest";

import { useCombatFeed } from "@/stores/combat-feed";
import { angularDistance } from "@/components/map/map-instance";

describe("Tactical Map & Combat Telemetry", () => {
  it("records combat intercepts with target coordinates and status provenance", () => {
    const store = useCombatFeed.getState();
    const id = store.addIntercept({
      origin: "APT29 / MOSCOW",
      originCountry: "RU",
      target: "ACME CORP (US)",
      targetCountry: "US",
      vector: "EXPLOIT: CVE-2024-21412",
      severity: 4,
      color: "#ef4444",
      status: "ENGAGED",
      verificationStatus: "confirmed",
      targetCoords: [-77.0369, 38.9072],
    });

    const recorded = useCombatFeed.getState().intercepts.find((item) => item.id === id);
    expect(recorded).toBeDefined();
    expect(recorded?.originCountry).toBe("RU");
    expect(recorded?.targetCoords).toEqual([-77.0369, 38.9072]);
    expect(recorded?.verificationStatus).toBe("confirmed");

    // Update status to INTERCEPTED
    useCombatFeed.getState().updateStatus(id, "INTERCEPTED");
    const updated = useCombatFeed.getState().intercepts.find((item) => item.id === id);
    expect(updated?.status).toBe("INTERCEPTED");
  });

  it("calculates spherical angular distance correctly across coordinates", () => {
    // Equator 0,0 to Equator 90,0 is 90 degrees
    const d90 = angularDistance(0, 0, 90, 0);
    expect(Math.round(d90)).toBe(90);

    // North pole (lat 90) to South pole (lat -90) is 180 degrees
    const d180 = angularDistance(0, 90, 0, -90);
    expect(Math.round(d180)).toBe(180);

    // Same point is 0 degrees
    const d0 = angularDistance(-77.0369, 38.9072, -77.0369, 38.9072);
    expect(Math.round(d0)).toBe(0);
  });
});
