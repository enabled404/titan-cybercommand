"use client";

import { toast } from "sonner";
import { buildStix21Bundle } from "@/lib/stix";
import type { Incident } from "@/lib/types";

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
