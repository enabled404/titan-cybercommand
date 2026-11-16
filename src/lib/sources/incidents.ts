import "server-only";
import { reserveSharedWork } from "@/lib/http/paid-budget";

import { type Fetched, beforeDeadline, settle, unwrap } from "@/lib/fetched";

import { cacheLife } from "next/cache";

import { withLastGood } from "@/lib/sources/last-good";
import type { CisaAdvisory, DarkWebStats, IncidentStatus, IncidentType, Incident, SourceRef, WireBulletin } from "@/lib/types";
import { countryCode } from "@/lib/geo";
import { ARTICLE_SCHEMA, SWEEP_MARKER, SWEEP_SCHEMA, sweepQuery, valyuServer } from "@/lib/valyu/server";

const UA = "TitanCyberCommand/1.0 (+https://github.com/enabled404/titan-cybercommand)";

/** A raw incident report from one source, before geocoding and dedupe. */
export interface Candidate {
  victim: string;
  domain?: string;
  sector?: string;
  type: IncidentType;
  status: IncidentStatus;
  actor?: string;
  records?: number;
  recordsClaimed?: number;
  cves: string[];
  country?: string;
  city?: string;
  /** Whether the city is stated in the source as the victim's location (not a dateline). */
  cityStated?: boolean;
  /** "Secaucus, NJ" style location from a filing. */
  usLocation?: string;
  headline: string;
  summary: string;
  date: string;
  sources: SourceRef[];
  origin: Incident["origin"];
  /** Text of the article, used for the dateline guard. Not stored. */
  text?: string;
}

const TYPE_MAP: Record<string, IncidentType> = {
  ransomware: "ransomware",
  data_breach: "data_breach",
  cyberattack: "cyberattack",
  ddos: "ddos",
  supply_chain: "supply_chain",
  espionage: "espionage",
  extortion: "extortion",
  extortion_leak_claim: "extortion",
  defacement: "defacement",
  service_outage_from_attack: "cyberattack",
  precautionary_shutdown: "cyberattack",
};

const STATUS_MAP: Record<string, IncidentStatus> = {
  confirmed_by_victim: "confirmed",
  confirmed_by_regulator: "confirmed",
  confirmed_by_regulator_or_filing: "confirmed",
  reported_unconfirmed: "reported",
  claimed_by_attacker: "claimed",
  precautionary: "precautionary",
  disputed: "disputed",
};

function toInt(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function publisherOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function cleanCves(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(String)
        .map((v) => v.trim().toUpperCase())
        .filter((v) => /^CVE-\d{4}-\d{4,}$/.test(v)),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Ransomware leak-site claims (RansomLook, CC BY 4.0)
// ---------------------------------------------------------------------------

interface RansomLookPost {
  post_title: string;
  discovered: string;
  description?: string;
  group_name: string;
}

interface RansomLookStats {
  groups: number;
  groups_online: number;
  posts_total: number;
  posts_24h: number;
  posts_month: number;
  markets_online: number;
}

function titleCaseGroup(group: string): string {
  return group.replace(/(^|[\s_-])(\w)/g, (_, sep: string, ch: string) => `${sep === "_" ? " " : sep}${ch.toUpperCase()}`);
}

function flagToIso(text: string): string | undefined {
  const chars = [...text];
  for (let i = 0; i < chars.length - 1; i++) {
    const cp1 = chars[i].codePointAt(0) ?? 0;
    const cp2 = chars[i + 1].codePointAt(0) ?? 0;
    if (cp1 >= 0x1f1e6 && cp1 <= 0x1f1ff && cp2 >= 0x1f1e6 && cp2 <= 0x1f1ff) {
      return String.fromCharCode(cp1 - 0x1f1e6 + 65, cp2 - 0x1f1e6 + 65);
    }
  }
  return undefined;
}

const US_STATES_MAP: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA",
  HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA",
  KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
  MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS", MISSOURI: "MO",
  MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND",
  OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", TEXAS: "TX",
  UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV",
  WISCONSIN: "WI", WYOMING: "WY",
};

function matchUsState(name: string): { state: string; code: string } | null {
  const upper = name.toUpperCase();
  for (const [state, code] of Object.entries(US_STATES_MAP)) {
    const re = new RegExp(`\\b${state}\\b`, "i");
    if (re.test(upper)) return { state, code };
  }
  return null;
}

export async function getRansomwareClaims(): Promise<Candidate[]> {
  return unwrap(await getRansomwareClaimsFetched());
}

async function getRansomwareClaimsFetched(): Promise<Fetched<Candidate[]>> {
  "use cache: remote";
  const result = await settle(async () => {
    return withLastGood("ransomlook-claims", async () => {
      const res = await fetch("https://www.ransomlook.io/api/recent", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`RansomLook ${res.status}`);
      const posts = (await res.json()) as RansomLookPost[];
      return posts
        .filter((post) => post.post_title && post.post_title.length > 2)
        .map((post) => {
          const rawTitle = post.post_title.trim();
          const flagCountry = flagToIso(rawTitle);
          // Strip country flag emoji characters from victim display name
          const title = rawTitle.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, "").trim();
          const isDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(title);
          const group = titleCaseGroup(post.group_name);
          const date = new Date(`${post.discovered.replace(" ", "T").slice(0, 19)}Z`).toISOString();
          const victim = isDomain ? title.toLowerCase() : title;

          let country: string | undefined = flagCountry;
          let sector: string | undefined = undefined;
          let usLocation: string | undefined = undefined;

          if (post.description) {
            const parts = post.description.split(/[·•|,]/).map((s) => s.trim());
            for (const part of parts) {
              const iso = countryCode(part);
              if (iso) country = country || iso;
            }
            if (parts[0] && parts[0].length > 2 && !countryCode(parts[0])) {
              sector = parts[0].slice(0, 60);
            }
          }

          const stateHit = matchUsState(title) || (post.description ? matchUsState(post.description) : null);
          if (stateHit) {
            country = country || "US";
            usLocation = stateHit.state;
          }

          return {
            victim,
            domain: isDomain ? title.toLowerCase() : undefined,
            sector,
            country,
            usLocation,
            type: "ransomware",
            status: "claimed",
            actor: group,
            cves: [],
            headline: `${group} claims ${victim}`,
            summary: post.description
              ? `${post.description}. The ${group} group listed ${victim} on its leak site. The organisation has not confirmed an attack, so treat this as a claim.`
              : `The ${group} group listed ${victim} on its leak site. The organisation has not confirmed an attack, so treat this as a claim.`,
            date,
            sources: [
              {
                title: `${group} leak-site post (via RansomLook)`,
                url: `https://www.ransomlook.io/group/${encodeURIComponent(post.group_name)}`,
                publisher: "ransomlook.io",
                date,
                kind: "leaksite",
              },
            ],
            origin: "claims",
          } satisfies Candidate;
        });
    });
  });
  if (result.ok) cacheLife("feed");
  else cacheLife("minutes");
  return result;
}

/** Global dark web extortion telemetry: active cartels, online Tor leak sites, and victim velocity. */
export async function getDarkWebCartelStats(): Promise<DarkWebStats | null> {
  return unwrap(await getDarkWebCartelStatsFetched());
}

async function getDarkWebCartelStatsFetched(): Promise<Fetched<DarkWebStats | null>> {
  "use cache: remote";
  const result = await settle(async () => {
    return withLastGood("ransomlook-stats", async () => {
      const res = await fetch("https://www.ransomlook.io/api/stats", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`RansomLook stats ${res.status}`);
      const data = (await res.json()) as RansomLookStats;
      return {
        groups: data.groups ?? 0,
        groupsOnline: data.groups_online ?? 0,
        posts24h: data.posts_24h ?? 0,
        postsMonth: data.posts_month ?? 0,
        postsTotal: data.posts_total ?? 0,
        marketsOnline: data.markets_online ?? 0,
      } satisfies DarkWebStats;
    });
  });
  if (result.ok) cacheLife("feed");
  else cacheLife("minutes");
  return result;
}

// ---------------------------------------------------------------------------
// Breaking Threat Wire (The Record, The Hacker News, Dark Reading, CyberScoop)
// ---------------------------------------------------------------------------

function cleanXmlText(s?: string): string {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssDate(raw?: string): string {
  if (!raw) return new Date().toISOString();
  try {
    const fixed = raw.replace(/(\b\d{1,2}\s+[A-Za-z]{3}\s+)(\d{2})(\s+)/, "$120$2$3");
    const d = new Date(fixed);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const NON_VICTIM_REPORTERS = /^(?:FBI|CISA|NSA|Europol|Interpol|GCHQ|NCSC|DOJ|FTC|SEC|CERT|Google|Microsoft|Mandiant|CrowdStrike|Kaspersky|Sophos|Palo Alto Networks|SentinelOne|Check Point|Fortinet|Cisco|Recorded Future|ESET|Symantec|Trend Micro|Citizen Lab|Qualys|Rapid7|Zscaler|Darktrace)\b/i;
const ADVISORY_FLAW_PREDICATE = /\b(?:flaw|flaws|vulnerability|vulnerabilities|bug|bugs|zero-day|0-day|bypass|sandbox escape|patch|patches|exploit|exploits|warning|risk|threat|tool|campaign|scam|botnet|deepfake)\b/i;

function extractWireVictim(title: string): string | null {
  const clean = cleanXmlText(title);
  if (/^FBI flash alert\b/i.test(clean)) return null;
  const m1 = clean.match(/^([A-Z][A-Za-z0-9\s&.-]{2,40}?)\s+(?:warns(?:\s+of)?|discloses|hit by|targeted (?:by|in)|confirms|investigating|suffers|reports|says|reveals|faces|reels(?:\s+following)?)\b/i);
  if (m1) {
    const candidate = m1[1].trim();
    if (/\b(?:warns|says|reports|alerts)\b/i.test(candidate)) return null;
    if (NON_VICTIM_REPORTERS.test(candidate)) {
      if (!/confirms?\s+(?:breach|compromise|hack|cyberattack|intrusion)|hit by|suffers/i.test(clean)) {
        return null;
      }
    }
    const remainder = clean.slice(m1[0].length);
    if (/^(?:warns|reports|says|reveals)\b/i.test(clean.slice(candidate.length).trim())) {
      if (ADVISORY_FLAW_PREDICATE.test(remainder) && !/\b(?:data breach|ransomware|stolen data|personal information|records|network breach)\b/i.test(remainder)) {
        return null;
      }
    }
    return candidate.replace(/\s+(?:employee|customer|patient|staff|user|network|system)s?$/i, "");
  }
  const m2 = clean.match(/^([A-Z][A-Za-z0-9\s&.-]{2,40}?)\s+(?:Data Breach|Cyberattack|Ransomware Attack|Security Incident)\b/i);
  if (m2) return m2[1].trim().replace(/\s+(?:employee|customer|patient|staff|user|network|system)s?$/i, "");
  const m3 = clean.match(/(?:Attackers in|Attack on|Hackers breach|Breach at|Hackers target)\s+([A-Z][A-Za-z0-9\s&.-]{2,40}?)\s+(?:Breach|Incident|Attack|Network|Systems)/i);
  if (m3) return m3[1].trim().replace(/\s+(?:employee|customer|patient|staff|user|network|system)s?$/i, "");
  const m4 = clean.match(/(?:fines|penalizes|penalised)\s+([A-Z][A-Za-z0-9\s&.-]{2,30}?)\s+(?:over|for|€|\$)/i);
  if (m4) return m4[1].trim();
  const m5 = clean.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Hospital|Health|Medical Center|Clinic|School District|University|College|County|Police|Airways?|Airlines?|Bank))\b/);
  if (m5) return m5[1].trim();
  return null;
}

const WIRE_INCIDENT_SIG = /data\s*breach|ransomware|cyberattack|hacked|stolen\s*(?:data|keys?|credentials|information)|leak|unauthorized\s*access|compromis|zero-day|cve-\d{4}|malware|trojan|backdoor|ddos|extortion|threat\s*actor|espionage/i;

function classifyWire(title: string, desc = ""): { type: IncidentType; cves: string[]; records?: number; actor?: string } {
  const text = `${title} ${desc}`.toLowerCase();
  let type: IncidentType = "cyberattack";
  if (/ransomware|lockbit|qilin|play\b|black\s*basta|encrypt(or|ion)/i.test(text)) type = "ransomware";
  else if (/data\s*breach|leak|stolen\s*data|exposed\s*records|personal\s*information/i.test(text)) type = "data_breach";
  else if (/supply\s*chain|trojanized|backdoor(ed)?\s*package|malicious\s*npm/i.test(text)) type = "supply_chain";
  else if (/espionage|nation-state|apt\d+|salt\s*typhoon|volt\s*typhoon/i.test(text)) type = "espionage";
  else if (/ddos|denial\s*of\s*service/i.test(text)) type = "ddos";

  const cves = [...new Set(text.toUpperCase().match(/CVE-\d{4}-\d{4,7}/g) ?? [])];

  let records: number | undefined = undefined;
  const recMatch = text.match(/impacting\s*([0-9,]+(?:\.[0-9]+)?)\s*(million|k|thousand)?/i) || text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(million|k|thousand)?\s*(records|users|accounts|people|victims)/i);
  if (recMatch) {
    let num = parseFloat(recMatch[1].replace(/,/g, ""));
    const unit = recMatch[2]?.toLowerCase();
    if (unit === "million") num *= 1_000_000;
    else if (unit === "k" || unit === "thousand") num *= 1_000;
    records = Math.round(num);
  }

  let actor: string | undefined = undefined;
  const actorMatch = text.match(/(volt\s*typhoon|salt\s*typhoon|scattered\s*spider|lazarus|apt\d+|lockbit|blackcat|alphv|qilin|play\s*ransomware|cl0p|darkside|rhysida|akira|fancy\s*bear|cozy\s*bear)/i);
  if (actorMatch) {
    actor = actorMatch[1].replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return { type, cves, records, actor };
}

export interface WireData {
  candidates: Candidate[];
  bulletins: WireBulletin[];
}

export async function getWireData(): Promise<WireData> {
  return unwrap(await getWireDataFetched());
}

async function getWireDataFetched(): Promise<Fetched<WireData>> {
  "use cache: remote";
  const result = await settle(async () => {
    return withLastGood("breaking-wire-data", async () => {
      const wireSources = [
        { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", publisher: "bleepingcomputer.com" },
        { name: "The Record", url: "https://therecord.media/feed", publisher: "therecord.media" },
        { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", publisher: "thehackernews.com" },
        { name: "Dark Reading", url: "https://darkreading.com/rss.xml", publisher: "darkreading.com" },
        { name: "SecurityWeek", url: "https://www.securityweek.com/feed/", publisher: "securityweek.com" },
        { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", publisher: "krebsonsecurity.com" },
        { name: "CyberScoop", url: "https://cyberscoop.com/feed/", publisher: "cyberscoop.com" },
      ];

      const settled = await Promise.allSettled(
        wireSources.map(async (src) => {
          const res = await fetch(src.url, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) throw new Error(`${src.name} ${res.status}`);
          const xml = await res.text();
          return { src, xml };
        }),
      );

      const candidates: Candidate[] = [];
      const bulletins: WireBulletin[] = [];
      const seenUrls = new Set<string>();

      for (const item of settled) {
        if (item.status !== "fulfilled") continue;
        const { src, xml } = item.value;
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

        for (const m of items) {
          const raw = m[1];
          const title = cleanXmlText(raw.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
          const link = cleanXmlText(raw.match(/<link>([\s\S]*?)<\/link>/)?.[1]);
          const pubDate = cleanXmlText(raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]);
          const desc = cleanXmlText(raw.match(/<description>([\s\S]*?)<\/description>/)?.[1]);

          if (!title || !link || seenUrls.has(link)) continue;
          seenUrls.add(link);

          const isSecurityNews = WIRE_INCIDENT_SIG.test(`${title} ${desc}`);
          if (!isSecurityNews) continue;

          const date = parseRssDate(pubDate);
          const classified = classifyWire(title, desc);
          const victim = extractWireVictim(title);

          let country: string | undefined = undefined;
          const countryHints = ["Japan", "Italy", "Germany", "France", "United Kingdom", "Australia", "Canada", "United States"];
          for (const ch of countryHints) {
            if (new RegExp(`\\b${ch}\\b`, "i").test(`${title} ${desc}`)) {
              country = countryCode(ch);
              break;
            }
          }

          const bulletin: WireBulletin = {
            id: `wb-${Date.parse(date)}-${Math.abs(link.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0))}`,
            title,
            url: link,
            publisher: src.publisher,
            date,
            summary: desc.slice(0, 320),
            victim: victim ?? undefined,
            actor: classified.actor,
            type: classified.type,
            records: classified.records,
            cves: classified.cves,
            country,
          };
          bulletins.push(bulletin);

          if (victim && victim.length > 2 && victim.length < 50) {
            const isConfirmed = /warns(?:\s+of)?|confirms|discloses|fined|fines|reveals/i.test(title);
            candidates.push({
              victim,
              type: classified.type,
              status: isConfirmed ? "confirmed" : "reported",
              actor: classified.actor,
              records: classified.records,
              cves: classified.cves,
              country,
              headline: title,
              summary: desc ? desc.slice(0, 400) : `${victim} affected by ${classified.type.replace("_", " ")} as reported by ${src.publisher}.`,
              date,
              sources: [
                {
                  title: `${title} (${src.publisher})`,
                  url: link,
                  publisher: src.publisher,
                  date,
                  kind: "news",
                },
              ],
              origin: "news",
            });
          }
        }
      }

      return { candidates, bulletins: bulletins.slice(0, 40) };
    });
  });
  if (result.ok) cacheLife("feed");
  else cacheLife("minutes");
  return result;
}

// ---------------------------------------------------------------------------
// CISA Emergency Cybersecurity Advisories (CISA CSA, Alerts & Directives)
// ---------------------------------------------------------------------------

export interface CisaData {
  advisories: CisaAdvisory[];
  candidates: Candidate[];
}

export async function getCisaAdvisories(): Promise<CisaData> {
  return unwrap(await getCisaAdvisoriesFetched());
}

async function getCisaAdvisoriesFetched(): Promise<Fetched<CisaData>> {
  "use cache: remote";
  const result = await settle(async () => {
    return withLastGood("cisa-advisories-rss", async () => {
      const res = await fetch("https://www.cisa.gov/cybersecurity-advisories/all.xml", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`CISA XML ${res.status}`);
      const xml = await res.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

      const advisories: CisaAdvisory[] = [];

      for (const m of items) {
        const raw = m[1];
        const title = cleanXmlText(raw.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
        const link = cleanXmlText(raw.match(/<link>([\s\S]*?)<\/link>/)?.[1]);
        const pubDate = cleanXmlText(raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]);
        const desc = cleanXmlText(raw.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.slice(0, 1500));

        if (!title || !link) continue;
        const date = parseRssDate(pubDate);
        const cves = [...new Set(`${title} ${desc}`.toUpperCase().match(/CVE-\d{4}-\d{4,7}/g) ?? [])];

        let category: CisaAdvisory["category"] = "alert";
        if (link.includes("/ics-advisories/")) category = "ics";
        else if (link.includes("/cybersecurity-advisories/")) category = "csa";
        else if (link.includes("/directives/")) category = "directive";

        const advisory: CisaAdvisory = {
          id: `cisa-${Date.parse(date)}-${Math.abs(link.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0))}`,
          title,
          link,
          published: date,
          cves,
          category,
          summary: desc.slice(0, 360),
        };
        advisories.push(advisory);
      }

      return { advisories: advisories.slice(0, 35), candidates: [] };
    });
  });
  if (result.ok) cacheLife("feed");
  else cacheLife("minutes");
  return result;
}

// ---------------------------------------------------------------------------
// SEC 8-K cybersecurity disclosures (EDGAR full-text search)
// ---------------------------------------------------------------------------

interface EftsHit {
  _id: string;
  _source: {
    ciks: string[];
    display_names: string[];
    file_date: string;
    biz_locations?: string[];
    items?: string[];
    adsh: string;
  };
}

function secCompanyName(display: string): { name: string; ticker?: string } {
  const match = /^(.*?)\s+\(([^)]*)\)\s+\(CIK/.exec(display);
  const raw = (match?.[1] ?? display.split("(CIK")[0]).trim();
  const name = raw
    .toLowerCase()
    .replace(/\b(inc|corp|co|ltd|plc|llc)\b\.?/g, (m) => m.charAt(0).toUpperCase() + m.slice(1))
    .replace(/(^|\s|-|&)([a-z])/g, (_, s: string, c: string) => s + c.toUpperCase());
  return { name, ticker: match?.[2]?.split(",")[0]?.trim() };
}

export async function getSecDisclosures(): Promise<Candidate[]> {
  return unwrap(await getSecDisclosuresFetched());
}

async function getSecDisclosuresFetched(): Promise<Fetched<Candidate[]>> {
  "use cache: remote";
  const result = await settle(async () => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86_400_000);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent('"cybersecurity incident"')}&forms=8-K&dateRange=custom&startdt=${day(start)}&enddt=${day(end)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Valyu Titan Cyber Command contact@valyu.ai", Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`SEC ${res.status}`);
    const json = (await res.json()) as { hits: { hits: EftsHit[] } };
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const hit of json.hits.hits) {
      const src = hit._source;
      const items = src.items ?? [];
      // Item 1.05 is the material cybersecurity incident item. Some companies use 8.01 instead.
      if (!items.includes("1.05") && !items.includes("8.01")) continue;
      const cik = src.ciks[0]?.replace(/^0+/, "");
      if (!cik || seen.has(cik)) continue;
      seen.add(cik);
      const { name, ticker } = secCompanyName(src.display_names[0] ?? "");
      const file = hit._id.split(":")[1] ?? "";
      const filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${src.adsh.replace(/-/g, "")}/${file}`;
      const date = new Date(`${src.file_date}T16:00:00Z`).toISOString();
      out.push({
        victim: name,
        type: "cyberattack",
        status: "confirmed",
        cves: [],
        usLocation: src.biz_locations?.[0],
        headline: `${name}${ticker ? ` (${ticker})` : ""} discloses a cybersecurity incident in an 8-K`,
        summary: `${name} filed a Form 8-K with the SEC on ${src.file_date} that discusses a cybersecurity incident${items.includes("1.05") ? " under Item 1.05 (material cybersecurity incidents)" : ""}. Read the filing for scope and impact.`,
        date,
        sources: [{ title: `Form 8-K, ${src.file_date}`, url: filingUrl, publisher: "sec.gov", date, kind: "filing" }],
        origin: "sec",
      });
    }
    return out;
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("minutes");
  return result;
}

// ---------------------------------------------------------------------------
// News discovery (Valyu search) + per-article extraction (Valyu contents)
// ---------------------------------------------------------------------------

export const NEWS_QUERIES = [
  "data breach",
  "ransomware attack",
  "cyberattack",
  "hackers claim stolen data",
  "customer data leaked",
  "cyber incident systems offline",
  "DDoS attack",
  "unauthorized access personal information",
  "supply chain attack compromised",
  "hospital cyberattack",
  "school district cyberattack",
  "city council cyber attack",
  "bank data breach customers",
  "retailer data breach",
  "university data breach",
  "不正アクセス 情報漏えい",
  "Cyberangriff",
  "ciberataque",
  "cyberattaque",
  "attacco hacker",
];

interface Discovered {
  url: string;
  title: string;
  date?: string;
  publisher: string;
}

function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|cmp$|ocid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.replace(/^(www|amp|m)\./, "");
    url.pathname = url.pathname.replace(/\/amp\/?$/, "/");
    return url.toString();
  } catch {
    return raw;
  }
}

const SKIP_PUBLISHERS =
  /(inkl\.com|yahoo\.com|msn\.com|news\.google\.com|ground\.news|newsbreak\.com|hookphish|ransomware\.live|redpacketsecurity|dexpose|hackmanac)/i;

/** Newest news articles about incidents, deduped by canonical URL. Refreshed every 30 minutes. */
export async function discoverNews(): Promise<Discovered[]> {
  return unwrap(await discoverNewsFetched());
}

async function discoverNewsFetched(): Promise<Fetched<Discovered[]>> {
  "use cache: remote";
  const result = await settle(async () => {
    return withLastGood("valyu-news-discovery", async () => {
      const valyu = valyuServer();
      if (!valyu) return [];
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 86_400_000);
      const day = (d: Date) => d.toISOString().slice(0, 10);
      const results = await Promise.allSettled(
        NEWS_QUERIES.map(async (query) => {
          await reserveSharedWork("search");
          return valyu.search(query, {
            searchType: "news",
            maxNumResults: 10,
            startDate: day(start),
            endDate: day(end),
            responseLength: "short",
          });
        }),
      );
      // Every query failing is an outage, not a quiet news week: throw so the feed shows as down.
      if (!results.some((result) => result.status === "fulfilled" && result.value.success)) throw new Error("Valyu news search failed");
      const seen = new Map<string, Discovered>();
      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value.success) continue;
        for (const item of result.value.results) {
          const url = canonicalUrl(item.url);
          if (seen.has(url) || SKIP_PUBLISHERS.test(url)) continue;
          seen.set(url, {
            url,
            title: item.title,
            date: item.publication_date ?? item.date,
            publisher: publisherOf(url),
          });
        }
      }
      return [...seen.values()];
    });
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("minutes");
  return result;
}

interface ArticleExtraction {
  is_incident?: boolean;
  victim?: string;
  victim_domain?: string;
  sector?: string;
  incident_type?: string;
  status?: string;
  threat_actor?: string;
  records_affected?: number;
  records_claimed?: number;
  cve_ids?: string[];
  country_code?: string;
  city?: string;
  city_in_body?: boolean;
  headline?: string;
  summary?: string;
  incident_date?: string;
  is_follow_up?: boolean;
}

type Extraction = { data: ArticleExtraction; text?: string; title?: string; date?: string };

/**
 * Bump when ARTICLE_SCHEMA changes meaning, so cached extractions are read again under the new schema.
 * 2: incident_date is the original disclosure, and is_follow_up flags coverage of older incidents.
 */
const EXTRACTION_VERSION = 2;

/**
 * Structured extraction for one article, paid for once: shared by every instance and reused inside the
 * snapshot's cache. A failure is kept for minutes so the article is retried, not pinned for a week.
 * `version` keys the cache, so a schema change reads every article again.
 */
export async function extractArticle(url: string, version: number): Promise<Extraction | null> {
  "use cache: remote";
  // Only the current schema is fetched; an older version could only be a stale caller.
  if (version !== EXTRACTION_VERSION) {
    cacheLife("minutes");
    return null;
  }
  try {
    const extraction = await requestExtraction(url);
    cacheLife("paid");
    return extraction;
  } catch {
    cacheLife("minutes");
    return null;
  }
}

async function requestExtraction(url: string): Promise<Extraction> {
  const valyu = valyuServer();
  if (!valyu) throw new Error("no Valyu key");
  await reserveSharedWork("contents");
  const res = await valyu.contents([url], { summary: ARTICLE_SCHEMA, responseLength: "medium" });
  const first = "results" in res ? res.results?.[0] : undefined;
  if (!first || first.status !== "success") throw new Error(`extraction failed for ${url}`);
  const data = typeof first.summary === "string" ? safeJson(first.summary) : (first.summary as ArticleExtraction | undefined);
  if (!data) throw new Error(`no structured summary for ${url}`);
  return {
    data,
    text: typeof first.content === "string" ? first.content.slice(0, 1500) : undefined,
    title: first.title,
    date: first.publication_date,
  };
}

function safeJson(value: string): ArticleExtraction | undefined {
  try {
    return JSON.parse(value) as ArticleExtraction;
  } catch {
    return undefined;
  }
}

function extractionToCandidate(data: ArticleExtraction, source: SourceRef, fallbackDate: string, text?: string): Candidate | null {
  // Follow-up coverage of an older incident is not a new one; dating it to the article put 2024 attacks on this week's map.
  if (!data.is_incident || data.is_follow_up || !data.victim?.trim()) return null;
  const type = TYPE_MAP[data.incident_type ?? ""] ?? "cyberattack";
  const status = STATUS_MAP[data.status ?? ""] ?? "reported";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(data.incident_date ?? "") ? new Date(`${data.incident_date}T12:00:00Z`).toISOString() : fallbackDate;
  return {
    victim: data.victim.trim(),
    domain: data.victim_domain?.trim().toLowerCase() || undefined,
    sector: data.sector,
    type,
    status,
    actor: data.threat_actor?.trim() || undefined,
    records: toInt(data.records_affected),
    recordsClaimed: toInt(data.records_claimed),
    cves: cleanCves(data.cve_ids),
    country: data.country_code?.trim().toUpperCase() || undefined,
    city: data.city?.trim() || undefined,
    cityStated: data.city_in_body !== false,
    headline: data.headline?.trim() || `${data.victim} hit by ${type.replace("_", " ")}`,
    summary: data.summary?.trim() || "",
    date,
    sources: [source],
    origin: "news",
    text,
  };
}

/** Incidents from the news pipeline. New articles per refresh are capped to bound cost. */
export async function getNewsIncidents(maxNew = 200, budgetMs = 35_000): Promise<Candidate[]> {
  // Bounded concurrency and a hard time budget: a cold cache must never block a page for minutes.
  // Articles still extracting at the deadline land on a later refresh.
  const deadline = Date.now() + budgetMs;
  const discovered = await discoverNews();
  const batch = discovered.slice(0, maxNew);
  const out: Candidate[] = [];
  for (let i = 0; i < batch.length; i += 12) {
    const left = deadline - Date.now();
    if (left <= 0) break;
    const slice = batch.slice(i, i + 12);
    const settled = await Promise.allSettled(slice.map((item) => beforeDeadline(extractArticle(item.url, EXTRACTION_VERSION), left, null)));
    settled.forEach((result, idx) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const item = slice[idx];
      const date = item.date ? new Date(item.date).toISOString() : new Date().toISOString();
      const candidate = extractionToCandidate(
        result.value.data,
        { title: result.value.title ?? item.title, url: item.url, publisher: item.publisher, date, kind: "news" },
        date,
        result.value.text,
      );
      if (candidate) out.push(candidate);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// DeepResearch sweep: a recall net run a few times a day by the cron route
// ---------------------------------------------------------------------------

interface SweepIncident extends ArticleExtraction {
  location_basis?: string;
  source_urls?: string[];
  // Older schema field names, kept so seed sweeps still parse.
  victim_name?: string;
  country_iso2?: string;
  date_disclosed?: string;
  source_url?: string;
  victim_sector?: string;
}

export function sweepToCandidates(incidents: SweepIncident[], completedAt: string): Candidate[] {
  const out: Candidate[] = [];
  for (const item of incidents) {
    const victim = (item.victim ?? item.victim_name ?? "").trim();
    if (!victim) continue;
    const urls = (item.source_urls ?? (item.source_url ? [item.source_url] : [])).filter((u) => /^https?:\/\//.test(u));
    if (!urls.length) continue;
    const dateRaw = item.incident_date ?? item.date_disclosed;
    const date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw ?? "") ? new Date(`${dateRaw!.slice(0, 10)}T12:00:00Z`).toISOString() : completedAt;
    const type = TYPE_MAP[item.incident_type ?? ""] ?? "cyberattack";
    const status = STATUS_MAP[item.status ?? ""] ?? "reported";
    const basis = item.location_basis ?? "";
    out.push({
      victim,
      domain: item.victim_domain?.toLowerCase() || undefined,
      sector: item.sector ?? item.victim_sector,
      type,
      status,
      actor: item.threat_actor?.trim() || undefined,
      records: toInt(item.records_affected),
      recordsClaimed: toInt(item.records_claimed),
      cves: cleanCves(item.cve_ids),
      country: (item.country_code ?? item.country_iso2)?.toUpperCase(),
      city: item.city?.trim() || undefined,
      cityStated: basis !== "country_only" && basis !== "unknown",
      headline:
        item.headline?.trim() ||
        (status === "claimed" && item.threat_actor ? `${item.threat_actor} claims ${victim}` : `${victim}: ${type.replace("_", " ")} reported`),
      summary: item.summary?.trim() || "",
      date,
      sources: urls.slice(0, 3).map((url) => ({ title: publisherOf(url), url, publisher: publisherOf(url), date, kind: "news" })),
      origin: "sweep",
    });
  }
  return out;
}

type SweepResult = { incidents: SweepIncident[]; completedAt: string };

/** A finished sweep never changes, so it is kept for a week; a miss is kept for minutes. */
async function getSweepResult(taskId: string): Promise<SweepResult | null> {
  "use cache: remote";
  try {
    const result = await requestSweepResult(taskId);
    cacheLife("paid");
    return result;
  } catch {
    cacheLife("minutes");
    return null;
  }
}

async function requestSweepResult(taskId: string): Promise<SweepResult> {
  const valyu = valyuServer();
  if (!valyu) throw new Error("no Valyu key");
  const status = await valyu.deepresearch.status(taskId);
  if (status.status !== "completed" || !status.output) throw new Error(`sweep ${taskId} is not complete`);
  const output = typeof status.output === "string" ? JSON.parse(status.output) : status.output;
  return { incidents: (output.incidents ?? []) as SweepIncident[], completedAt: status.completed_at ?? new Date().toISOString() };
}

/** Incidents from the latest completed sweeps (last 48 hours). */
export async function getSweepIncidents(): Promise<Candidate[]> {
  return unwrap(await getSweepIncidentsFetched());
}

async function getSweepIncidentsFetched(): Promise<Fetched<Candidate[]>> {
  "use cache: remote";
  const result = await settle(async () => {
    return withLastGood("valyu-sweeps", async () => {
      const valyu = valyuServer();
      if (!valyu) return [];
      const list = await valyu.deepresearch.list({ limit: 50 });
      // The SDK resolves failures as { success: false } rather than throwing. Throw, so the feed shows as
      // down and the last good sweeps stay on the map instead of 200 incidents silently disappearing.
      if (!list.success || !list.data) throw new Error(list.error ?? "deepresearch.list failed");
      const cutoff = Date.now() - 30 * 86_400_000;
      const tasks = (list.data ?? [])
        .filter((task) => task.status === "completed" && task.query?.startsWith(SWEEP_MARKER))
        .filter((task) => toMillis(task.created_at) > cutoff)
        .slice(0, 12);
      const out: Candidate[] = [];
      for (const task of tasks) {
        const result = await getSweepResult(task.deepresearch_id).catch(() => null);
        if (result) out.push(...sweepToCandidates(result.incidents, result.completedAt));
      }
      return out;
    });
  });
  if (result.ok) cacheLife("feed");
  else cacheLife("minutes");
  return result;
}

function toMillis(value: number | string): number {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  return Date.parse(value);
}

/** Start a sweep (called by the cron route). Returns the task id. */
export async function startSweep(fromDaysAgo = 3, toDaysAgo = 0): Promise<string | null> {
  const valyu = valyuServer();
  if (!valyu) return null;
  const end = new Date(Date.now() - toDaysAgo * 86_400_000);
  const start = new Date(Date.now() - fromDaysAgo * 86_400_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  await reserveSharedWork("research");
  const res = await valyu.deepresearch.create({
    query: sweepQuery(day(start), day(end), end.toISOString().slice(0, 13) + ":00Z"),
    mode: "fast",
    outputFormats: [SWEEP_SCHEMA],
    search: { startDate: day(start), endDate: day(end) },
    metadata: { app: "titan-cybercommand", kind: "sweep" },
  });
  return res.deepresearch_id ?? null;
}
