import "server-only";

import { cacheLife } from "next/cache";

import seedC2Nodes from "@/data/seed-c2-nodes.json";
import { type Fetched, settle, unwrap } from "@/lib/fetched";
import { countryPoint } from "@/lib/geo";
import { withLastGood } from "@/lib/sources/last-good";
import type { BotnetC2Node } from "@/lib/types";

const C2_FEED_URL = "https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/C2_configs/cobaltstrike-30day.json";
const FEODO_FEED_URL = "https://feodotracker.abuse.ch/downloads/ipblocklist.json";
const UA = "TitanCyberCommand/1.0 (+https://github.com/enabled404/titan-cybercommand)";

interface CobaltStrikeRaw {
  preview?: boolean;
  offset?: number;
  result?: {
    ip?: string;
    Port?: string | number;
    BeaconType?: string;
    ASN?: string | string[];
    SleepTime?: string | number;
    Jitter?: string | number;
    FirstSeen?: string;
    LastSeen?: string;
    HttpPostUri?: string;
    C2Server?: string;
  };
}

interface FeodoRaw {
  ip_address: string;
  port: number;
  status: string;
  as_name?: string;
  country?: string;
  malware?: string;
  first_seen?: string;
  last_online?: string;
}

/**
 * Fetch and return active botnet command and control (C2) server infrastructure.
 * Aggregates live Cobalt Strike beacons and Feodo Tracker botnet nodes.
 */
export async function getBotnetC2s(): Promise<BotnetC2Node[]> {
  return unwrap(await getBotnetC2sFetched());
}

export async function getBotnetC2sFetched(): Promise<Fetched<BotnetC2Node[]>> {
  "use cache: remote";
  const result = await settle(async () => {
    return withLastGood("botnet-c2", async () => {
      const nodes: BotnetC2Node[] = [];

      try {
        const csRes = await fetch(C2_FEED_URL, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(8_000),
        });

        if (csRes.ok) {
          const text = await csRes.text();
          const lines = text.split("\n").filter((line) => line.trim().length > 0);
          const parsed: CobaltStrikeRaw[] = [];

          for (const line of lines) {
            try {
              parsed.push(JSON.parse(line));
            } catch {
              // Ignore malformed JSON lines
            }
          }

          // Sort by LastSeen descending
          parsed.sort((a, b) => (b.result?.LastSeen ?? "").localeCompare(a.result?.LastSeen ?? ""));

          // Map the top recent Cobalt Strike beacons
          const seedMap = new Map((seedC2Nodes as BotnetC2Node[]).map((node) => [node.ip, node]));

          for (const item of parsed.slice(0, 45)) {
            const r = item.result;
            if (!r?.ip) continue;

            const existing = seedMap.get(r.ip);
            const port = typeof r.Port === "number" ? r.Port : Number.parseInt(String(r.Port || "443"), 10) || 443;
            const sleepTime = typeof r.SleepTime === "number" ? r.SleepTime : Number.parseInt(String(r.SleepTime || "5000"), 10) || 5000;
            const jitter = typeof r.Jitter === "number" ? r.Jitter : Number.parseInt(String(r.Jitter || "25"), 10) || 25;
            const asnRaw = Array.isArray(r.ASN) ? r.ASN[0] : r.ASN;

            const country = existing?.country || "US";
            const point = countryPoint(country);

            nodes.push({
              id: `c2-cs-${r.ip.replace(/\./g, "-")}-${port}`,
              ip: r.ip,
              port,
              framework: "Cobalt Strike Beacon",
              beaconType: r.BeaconType || existing?.beaconType || "HTTPS",
              asn: existing?.asn || asnRaw || "Unknown Autonomous System",
              country,
              city: existing?.city || "Transit Node",
              lat: existing?.lat ?? point?.lat ?? 38.9,
              lon: existing?.lon ?? point?.lon ?? -77.0,
              sleepTime,
              jitter,
              lastSeen: r.LastSeen || new Date().toISOString(),
              status: "active",
              uriPath: r.HttpPostUri || existing?.uriPath || "/submit.php",
            });
          }
        }
      } catch {
        // Fall back gracefully to seed nodes if upstream fails
      }

      // Add Feodo tracker live botnet nodes (QakBot, Emotet, Dridex)
      try {
        const feodoRes = await fetch(FEODO_FEED_URL, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(6_000),
        });

        if (feodoRes.ok) {
          const list = (await feodoRes.json()) as FeodoRaw[];
          for (const item of list.slice(0, 15)) {
            const country = item.country || "US";
            const point = countryPoint(country);
            if (!point) continue;

            nodes.push({
              id: `c2-feodo-${item.ip_address.replace(/\./g, "-")}-${item.port}`,
              ip: item.ip_address,
              port: item.port,
              framework: item.malware || "QakBot C2",
              beaconType: "HTTPS",
              asn: item.as_name || "Enterprise Autonomous System",
              country,
              city: "Relay Node",
              lat: point.lat,
              lon: point.lon,
              sleepTime: 30000,
              jitter: 15,
              lastSeen: item.last_online || item.first_seen || new Date().toISOString(),
              status: item.status === "online" ? "active" : "dormant",
              uriPath: "/gate.php",
            });
          }
        }
      } catch {
        // Feodo is optional; continue if down
      }

      // If network failed completely or returned nothing, return verified seed nodes
      if (nodes.length === 0) {
        return seedC2Nodes as BotnetC2Node[];
      }

      return nodes;
    });
  });

  if (result.ok) cacheLife("feed");
  else cacheLife("minutes");
  return result;
}
