import { describe, expect, it } from "vitest";

import { useCombatFeed } from "@/stores/combat-feed";
import { angularDistance } from "@/components/map/map-instance";
import {
  SATELLITE_CONSTELLATION,
  calculateSatellitePosition,
} from "@/components/map/orbital-surveillance";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useSituation } from "@/stores/situation";

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

  it("calculates orbital positions and velocities across satellite constellations", () => {
    expect(SATELLITE_CONSTELLATION.length).toBeGreaterThanOrEqual(10);

    for (const sat of SATELLITE_CONSTELLATION) {
      expect(sat.noradId).toBeGreaterThan(0);
      expect(sat.altitudeKm).toBeGreaterThan(100);
      expect(sat.inclinationDeg).toBeGreaterThanOrEqual(0);
      expect(sat.inclinationDeg).toBeLessThanOrEqual(180);

      // Check ground track at t = 0
      const pos0 = calculateSatellitePosition(sat, 0);
      expect(pos0.lat).toBeGreaterThanOrEqual(-90);
      expect(pos0.lat).toBeLessThanOrEqual(90);
      expect(pos0.lon).toBeGreaterThanOrEqual(-180);
      expect(pos0.lon).toBeLessThanOrEqual(180);

      // Check Keplerian orbital velocity physics
      if (sat.type === "LEO") {
        expect(pos0.velocityKms).toBeGreaterThan(7.0);
        expect(pos0.velocityKms).toBeLessThan(8.0);
      } else if (sat.type === "GEO") {
        expect(pos0.velocityKms).toBeGreaterThan(3.0);
        expect(pos0.velocityKms).toBeLessThan(3.2);
      }

      // Check position advancement at t = 1800 seconds (30 minutes)
      const posFuture = calculateSatellitePosition(sat, 1800);
      expect(posFuture.lat).toBeGreaterThanOrEqual(-90);
      expect(posFuture.lat).toBeLessThanOrEqual(90);
      expect(posFuture.lon).toBeGreaterThanOrEqual(-180);
      expect(posFuture.lon).toBeLessThanOrEqual(180);
    }
  });

  it("handles tactical procedural audio calls safely", () => {
    soundEngine.setMuted(true);
    expect(soundEngine.getMuted()).toBe(true);

    // None of these should throw even without browser AudioContext gesture
    expect(() => soundEngine.playOrbitalScan()).not.toThrow();
    expect(() => soundEngine.playInterception()).not.toThrow();
    expect(() => soundEngine.playSubseaPacketPulse()).not.toThrow();
    expect(() => soundEngine.playThreatDetection()).not.toThrow();
    expect(() => soundEngine.playKineticDetonation(4)).not.toThrow();
  });

  it("toggles the orbital satellite layer in situation store", () => {
    const initial = useSituation.getState().layers.satellites;
    useSituation.getState().toggleLayer("satellites");
    expect(useSituation.getState().layers.satellites).toBe(!initial);
    useSituation.getState().toggleLayer("satellites");
    expect(useSituation.getState().layers.satellites).toBe(initial);
  });

  it("enforces mutual exclusivity between satellite selection and incident selection", () => {
    // Selecting a satellite clears incident and CVE selection
    useSituation.getState().selectSatellite("usa-326");
    expect(useSituation.getState().selectedSatellite).toBe("usa-326");
    expect(useSituation.getState().selectedId).toBeNull();
    expect(useSituation.getState().selectedCve).toBeNull();

    // Deselecting satellite
    useSituation.getState().selectSatellite(null);
    expect(useSituation.getState().selectedSatellite).toBeNull();
  });

  it("verifies continuous orbital propagation over time steps", () => {
    const sat = SATELLITE_CONSTELLATION[0];
    const pos0 = calculateSatellitePosition(sat, 0);
    const pos100 = calculateSatellitePosition(sat, 100);
    const pos500 = calculateSatellitePosition(sat, 500);

    // Positions should advance over time
    expect(pos100.lat !== pos0.lat || pos100.lon !== pos0.lon).toBe(true);
    expect(pos500.lat !== pos100.lat || pos500.lon !== pos100.lon).toBe(true);

    // Velocities should remain constant for circular orbits
    expect(pos0.velocityKms).toBeCloseTo(pos100.velocityKms, 4);
  });
});
