import { describe, expect, it } from "vitest";
import { useSituation } from "@/stores/situation";

describe("WarGames disaster simulation and countermeasure state", () => {
  it("initializes with no active wargame simulation", () => {
    useSituation.setState({ wargameSim: null });
    expect(useSituation.getState().wargameSim).toBeNull();
  });

  it("activates simulation and handles step progression", () => {
    useSituation.getState().setWargameSim({
      active: true,
      scenarioId: "cable-sever",
      code: "OP-LEVIATHAN",
      title: "Transatlantic Subsea Cable Sabotage",
      coords: [-30.0, 48.0],
      mitigated: false,
      step: 0,
    });

    let current = useSituation.getState().wargameSim;
    expect(current?.active).toBe(true);
    expect(current?.step).toBe(0);
    expect(current?.mitigated).toBe(false);

    // Simulate cascade step progression
    useSituation.getState().setWargameSim({ ...current!, step: 1 });
    expect(useSituation.getState().wargameSim?.step).toBe(1);

    // Deploy countermeasure
    current = useSituation.getState().wargameSim;
    useSituation.getState().setWargameSim({ ...current!, mitigated: true });
    const mitigatedState = useSituation.getState().wargameSim;
    expect(mitigatedState?.mitigated).toBe(true);
    expect(mitigatedState?.active).toBe(true);

    // Reset simulation
    useSituation.getState().setWargameSim(null);
    expect(useSituation.getState().wargameSim).toBeNull();
  });
});
