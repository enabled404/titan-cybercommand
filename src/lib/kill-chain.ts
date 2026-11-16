import type { Incident } from "@/lib/types";

export interface KillChainStep {
  phase: number;
  phaseName: string;
  mitreId: string;
  mitreName: string;
  status: "CONFIRMED" | "DETECTED" | "EXFILTRATED" | "CONTAINED" | "ACTIVE";
  timestamp: string;
  detail: string;
  technicalIoC: string;
}

export function generateIncidentKillChain(incident: Incident): KillChainStep[] {
  const actor = incident.actor || "Unknown Threat Actor";
  const hasCves = incident.cves && incident.cves.length > 0;
  const primaryCve = hasCves ? incident.cves[0] : null;
  const isRansomware = incident.type === "ransomware" || incident.type === "extortion";
  const isEspionage = incident.type === "espionage";
  const isSupplyChain = incident.type === "supply_chain";
  const isDdos = incident.type === "ddos";

  const parsedTime = Date.parse(incident.date);
  const baseTime = Number.isNaN(parsedTime) ? 0 : parsedTime;
  const fmt = (offsetHours: number) => {
    if (baseTime === 0) return `T - ${offsetHours}h`;
    const d = new Date(baseTime - offsetHours * 3600_000);
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  };

  // Phase 1: Initial Access
  let p1MitreId = "T1190";
  let p1MitreName = "Exploit Public-Facing Application";
  let p1Detail = `Perimeter breach initiated via edge vulnerability. Threat actors scanned external IP ranges belonging to ${incident.victim}.`;
  let p1Ioc = "Port 443/8443 Ingress Scan";

  if (hasCves && primaryCve) {
    p1MitreId = "T1190";
    p1MitreName = "Exploit Public-Facing Application";
    p1Detail = `Exploitation of ${primaryCve} on exposed enterprise perimeter services of ${incident.victim}, bypassing authentication.`;
    p1Ioc = `CVE: ${primaryCve}`;
  } else if (isSupplyChain) {
    p1MitreId = "T1195.002";
    p1MitreName = "Compromise Software Supply Chain";
    p1Detail = `Upstream vendor library compromised to introduce backdoor payloads directly into ${incident.victim} deployment pipeline.`;
    p1Ioc = "Trojanized Dependency Package";
  } else if (incident.status === "claimed") {
    p1MitreId = "T1078";
    p1MitreName = "Valid Accounts";
    p1Detail = `Compromised enterprise credentials acquired via dark web stealer logs or initial access broker.`;
    p1Ioc = "Leaked VPN / SSO Session Token";
  }

  // Phase 2: Execution & Persistence
  let p2MitreId = "T1059.001";
  let p2MitreName = "PowerShell Execution";
  let p2Detail = `${actor} established persistent C2 callback beacons and executed living-off-the-land scripts to maintain covert access.`;
  let p2Ioc = "powershell.exe -Enc -NonI -W Hidden";

  if (isEspionage) {
    p2MitreId = "T1505.003";
    p2MitreName = "Server Software Component: Web Shell";
    p2Detail = `Dropping encrypted webshell in public web server root to sustain stealth administrative access across reboots.`;
    p2Ioc = "C2 Beacon via HTTPS Fast-Flux";
  } else if (isRansomware) {
    p2MitreId = "T1053.005";
    p2MitreName = "Scheduled Task / Job";
    p2Detail = `${actor} created privileged scheduled tasks to automate payload staging across domain-joined servers.`;
    p2Ioc = "schtasks /create /sc onstart /tn SecurityUpdate";
  }

  // Phase 3: Defense Evasion & Lateral Movement
  let p3MitreId = "T1021.002";
  let p3MitreName = "SMB / Windows Admin Shares";
  let p3Detail = `Pivoted across internal subnets from entry point to hypervisor clusters and domain controllers.`;
  let p3Ioc = "WMI / PsExec Execution across Subnets";

  if (isRansomware) {
    p3MitreId = "T1562.001";
    p3MitreName = "Disable or Modify Tools";
    p3Detail = `EDR and antivirus services forcefully terminated. Shadow copies and backup catalogs deleted via vssadmin.`;
    p3Ioc = "vssadmin delete shadows /all /quiet";
  } else if (isEspionage) {
    p3MitreId = "T1003.001";
    p3MitreName = "LSASS Memory Dump";
    p3Detail = `Harvested Kerberos tickets and password hashes from memory to impersonate privileged service accounts.`;
    p3Ioc = "lsass.exe Memory Coercion";
  }

  // Phase 4: Exfiltration & Impact
  let p4MitreId = "T1567.002";
  let p4MitreName = "Exfiltration to Cloud Storage";
  let p4Detail = `Terabytes of internal files, customer databases, and sensitive communications compressed and staged for exfiltration.`;
  let p4Ioc = "Rclone / Mega.nz Upload Streams";
  let p4Status: KillChainStep["status"] = "EXFILTRATED";

  if (isDdos) {
    p4MitreId = "T1498.001";
    p4MitreName = "Direct Network Flood";
    p4Detail = `Volumetric SYN-flood and UDP reflection saturated gateway bandwidth causing complete service outage.`;
    p4Ioc = "1.2 Tbps Ingress Flood";
    p4Status = "CONFIRMED";
  } else if (isRansomware) {
    p4MitreId = "T1486";
    p4MitreName = "Data Encrypted for Impact";
    p4Detail = `Deployment of high-speed multithreaded ransomware encryptor across servers, followed by extortion demand on leak portal.`;
    p4Ioc = `${actor.toUpperCase()} Ransom Note & Lock`;
    p4Status = incident.status === "confirmed" ? "CONFIRMED" : "ACTIVE";
  } else if (incident.status === "precautionary") {
    p4Status = "CONTAINED";
    p4Detail = `IT security teams severed external network connections and took systems offline as a containment precaution.`;
    p4Ioc = "Network Segment Isolation";
  }

  return [
    {
      phase: 1,
      phaseName: "Initial Access",
      mitreId: p1MitreId,
      mitreName: p1MitreName,
      status: "CONFIRMED",
      timestamp: fmt(72),
      detail: p1Detail,
      technicalIoC: p1Ioc,
    },
    {
      phase: 2,
      phaseName: "Persistence & Execution",
      mitreId: p2MitreId,
      mitreName: p2MitreName,
      status: "DETECTED",
      timestamp: fmt(48),
      detail: p2Detail,
      technicalIoC: p2Ioc,
    },
    {
      phase: 3,
      phaseName: "Lateral Movement & Evasion",
      mitreId: p3MitreId,
      mitreName: p3MitreName,
      status: "DETECTED",
      timestamp: fmt(24),
      detail: p3Detail,
      technicalIoC: p3Ioc,
    },
    {
      phase: 4,
      phaseName: isRansomware ? "Impact & Extortion" : isDdos ? "Denial of Service" : "Exfiltration & Impact",
      mitreId: p4MitreId,
      mitreName: p4MitreName,
      status: p4Status,
      timestamp: fmt(4),
      detail: p4Detail,
      technicalIoC: p4Ioc,
    },
  ];
}
