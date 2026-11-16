"use client";

import { toast } from "sonner";
import { buildStix21Bundle } from "@/lib/stix";
import type { Incident } from "@/lib/types";
import type { ThreatActorProfile } from "@/lib/threat-actors";

export function triggerBlobDownload(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

export function buildDossierMarkdown(incident: Incident): string {
  return `# TITAN CYBER COMMAND: THREAT INTEL DOSSIER
CONFIDENTIALITY: PUBLIC DEFENSIVE INTELLIGENCE
INCIDENT ID: ${incident.id}

## TARGET PROFILE
- Target: ${incident.victim}
- Domain: ${incident.domain || "N/A"}
- Country: ${incident.country}
- Location: ${incident.city ? `${incident.city}, ` : ""}${incident.country}
- Status: ${incident.status.toUpperCase()}
- Classification: ${incident.type.toUpperCase()}
- Threat Actor: ${incident.actor || "Unidentified / Unknown"}
- Date Reported: ${incident.date}

## EXECUTIVE SUMMARY
${incident.title}
${incident.summary ? `\n${incident.summary}\n` : ""}

## LINKED CVE EXPLOITS
${incident.cves.length > 0 ? incident.cves.map((c) => `- ${c}`).join("\n") : "- None directly confirmed"}

## PRIMARY SOURCED CITATIONS
${incident.sources.map((s) => `- [${s.publisher || "Source"}] ${s.title}: ${s.url}`).join("\n")}

---
SAFE HARBOR & DISCLAIMER: This threat dossier was compiled by Titan Cyber Command for defensive vulnerability research, patch prioritization, and threat intelligence. Unverified dark-web claims are treated as unconfirmed allegations under safe harbor guidelines.
`;
}

export function exportIntelDossier(incident: Incident) {
  const content = buildDossierMarkdown(incident);
  const safeId = incident.id.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  triggerBlobDownload(blob, `titan-dossier-${safeId}.md`);
  toast("Threat Intel Dossier exported (.md)");
}

export function exportStix21(incident: Incident) {
  const safeId = incident.id.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const stixBundle = buildStix21Bundle(incident);
  const blob = new Blob([JSON.stringify(stixBundle, null, 2)], { type: "application/json;charset=utf-8" });
  triggerBlobDownload(blob, `titan-stix-${safeId}.json`);
  toast("STIX 2.1 Threat Intel exported (.json)");
}

export function buildThreatActorMarkdown(actor: ThreatActorProfile): string {
  return `# TITAN CYBER COMMAND: THREAT ACTOR PROFILE
ADVERSARY: ${actor.name.toUpperCase()}
ORIGIN: ${actor.origin} (${actor.countryCode})
NEXUS: ${actor.nexus} | THREAT LEVEL: ${actor.threatLevel}
FIRST OBSERVED: ${actor.firstSeen}

## ALIASES
${actor.aliases.map((a) => `- ${a}`).join("\n")}

## INTELLIGENCE OVERVIEW
${actor.overview}

## TARGETED SECTORS & NATIONS
- Sectors: ${actor.targetSectors.join(", ")}
- Target Countries: ${actor.targetCountries.join(", ")}

## MITRE ATT&CK TECHNIQUES
${actor.mitreAttack.map((m) => `- [${m.id}] ${m.technique} (${m.tactic}): ${m.description}`).join("\n")}

## WEAPONIZED CVES
${actor.knownCves.length > 0 ? actor.knownCves.map((c) => `- ${c.cve} (CVSS ${c.cvss.toFixed(1)}): ${c.product} - ${c.description}`).join("\n") : "- None directly attributed"}

## HISTORICAL & ACTIVE CAMPAIGNS
${actor.knownCampaigns.map((camp) => `- [${camp.year}] ${camp.title}: ${camp.description}`).join("\n")}

---
SAFE HARBOR & DISCLAIMER: Profile synthesized by Titan Cyber Command from live global telemetry, CISA alerts, and MITRE ATT&CK defensive mappings.
`;
}

export function buildThreatActorStix21(actor: ThreatActorProfile) {
  const actorId = `threat-actor--${actor.id}`;
  const now = "2026-11-16T00:00:00.000Z";
  const objects: unknown[] = [
    {
      type: "threat-actor",
      spec_version: "2.1",
      id: actorId,
      created: now,
      modified: now,
      name: actor.name,
      description: actor.overview,
      threat_actor_types: [actor.nexus.toLowerCase().replace(/\s+/g, "-")],
      aliases: actor.aliases,
      first_seen: `${actor.firstSeen}-01-01T00:00:00.000Z`,
      country: actor.countryCode,
    },
  ];

  for (const tech of actor.mitreAttack) {
    const techId = `attack-pattern--${tech.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    objects.push({
      type: "attack-pattern",
      spec_version: "2.1",
      id: techId,
      created: now,
      modified: now,
      name: tech.technique,
      description: tech.description,
      external_references: [{ source_name: "mitre-attack", external_id: tech.id }],
    });
    objects.push({
      type: "relationship",
      spec_version: "2.1",
      id: `relationship--${actor.id}-${tech.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      created: now,
      modified: now,
      relationship_type: "uses",
      source_ref: actorId,
      target_ref: techId,
    });
  }

  for (const cve of actor.knownCves) {
    const vulnId = `vulnerability--${cve.cve.toLowerCase()}`;
    objects.push({
      type: "vulnerability",
      spec_version: "2.1",
      id: vulnId,
      created: now,
      modified: now,
      name: cve.cve,
      description: `${cve.product}: ${cve.description}`,
      external_references: [{ source_name: "cve", external_id: cve.cve }],
    });
    objects.push({
      type: "relationship",
      spec_version: "2.1",
      id: `relationship--${actor.id}-${cve.cve.toLowerCase()}`,
      created: now,
      modified: now,
      relationship_type: "targets",
      source_ref: actorId,
      target_ref: vulnId,
    });
  }

  return {
    type: "bundle",
    id: `bundle--threat-actor-${actor.id}`,
    objects,
  };
}

export function exportThreatActorMarkdown(actor: ThreatActorProfile) {
  const content = buildThreatActorMarkdown(actor);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  triggerBlobDownload(blob, `titan-actor-${actor.id}.md`);
  toast(`Exported ${actor.name} dossier (.md)`);
}

export function exportThreatActorStix21(actor: ThreatActorProfile) {
  const bundle = buildThreatActorStix21(actor);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" });
  triggerBlobDownload(blob, `titan-actor-${actor.id}-stix21.json`);
  toast(`Exported ${actor.name} STIX 2.1 JSON`);
}
