import type { Incident } from "@/lib/types";

function fnvHash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generates a deterministic RFC-4122 v5-shaped UUID from an arbitrary namespace + value
 * synchronously across browser and server contexts so STIX 2.1 object IDs stay valid and repeatable.
 */
export function deterministicStixUuid(namespace: string, value: string): string {
  const input = `${namespace}:${value}`;
  const b = new Uint8Array(16);
  for (let word = 0; word < 4; word++) {
    const h = fnvHash(input, word + 1);
    b[word * 4] = (h >>> 24) & 0xff;
    b[word * 4 + 1] = (h >>> 16) & 0xff;
    b[word * 4 + 2] = (h >>> 8) & 0xff;
    b[word * 4 + 3] = h & 0xff;
  }
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return deterministicStixUuid("ephemeral", `${Date.now()}-${Math.random()}`);
}

export function buildStix21Bundle(incident: Incident, timestamp = new Date().toISOString()) {
  const cleanDomain = incident.domain?.replace(/['\\]/g, "").trim().toLowerCase() || "";
  const uniqueCves = Array.from(new Set(incident.cves.map((c) => c.trim().toUpperCase()).filter(Boolean)));
  return {
    type: "bundle",
    id: `bundle--${randomUuid()}`,
    spec_version: "2.1",
    objects: [
      {
        type: "incident",
        spec_version: "2.1",
        id: `incident--${deterministicStixUuid("incident", incident.id)}`,
        created: timestamp,
        modified: timestamp,
        name: `Cyber Incident: ${incident.victim}`,
        description: incident.title,
        labels: [incident.status, incident.type],
        confidence: incident.status === "confirmed" ? 95 : incident.status === "reported" ? 75 : 50,
      },
      ...(cleanDomain
        ? [
            {
              type: "indicator",
              spec_version: "2.1",
              id: `indicator--${deterministicStixUuid("indicator", cleanDomain)}`,
              created: timestamp,
              modified: timestamp,
              name: `Domain Indicator: ${cleanDomain}`,
              pattern: `[domain-name:value = '${cleanDomain}']`,
              pattern_type: "stix",
              valid_from: timestamp,
            },
          ]
        : []),
      ...(incident.actor?.trim()
        ? [
            {
              type: "threat-actor",
              spec_version: "2.1",
              id: `threat-actor--${deterministicStixUuid("threat-actor", incident.actor.trim())}`,
              created: timestamp,
              modified: timestamp,
              name: incident.actor.trim(),
              threat_actor_types: [
                incident.type === "espionage"
                  ? "nation-state"
                  : incident.type === "ransomware" || incident.type === "extortion"
                    ? "cybercrime-syndicate"
                    : "unknown",
              ],
            },
          ]
        : []),
      ...uniqueCves.map((cve) => ({
        type: "vulnerability",
        spec_version: "2.1",
        id: `vulnerability--${deterministicStixUuid("vulnerability", cve)}`,
        created: timestamp,
        modified: timestamp,
        name: cve,
        external_references: [
          {
            source_name: "cve",
            external_id: cve,
            url: `https://nvd.nist.gov/vuln/detail/${cve}`,
          },
        ],
      })),
    ],
  };
}
