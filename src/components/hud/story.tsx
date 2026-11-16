"use client";

import NumberFlow from "@number-flow/react";
import { ArrowUpRight, FilmSlate, Newspaper, SidebarSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { forwardRef, memo, useMemo, useState } from "react";

import { AllowanceHint } from "@/components/auth/allowance-hint";
import { AmIAffectedHero } from "@/components/hud/am-i-affected-hero";
import { AnswerCard } from "@/components/hud/ai-brief";
import { Omnibox, type OmniboxHandle } from "@/components/hud/omnibox";
import { PatchStrip } from "@/components/hud/patch-strip";
import { StackPicker } from "@/components/hud/stack-picker";
import { useMapInstance } from "@/components/map/map-instance";
import { OrgLogo } from "@/components/kit/org-logo";
import { Segmented } from "@/components/kit/segmented";
import { StatusMark } from "@/components/kit/status-mark";
import { soundEngine } from "@/lib/audio/sound-engine";
import { countryName } from "@/lib/countries";
import { STATUS_LABEL, epssPercent, relativeTime } from "@/lib/format";
import type { IncidentDay, IncidentSummary } from "@/lib/incident-view";
import type { BotnetC2Node, Incident, MalwarePackage, Outage, Snapshot, Vuln } from "@/lib/types";
import { useNow } from "@/lib/perf/use-now";
import { productLabel } from "@/lib/og/copy";
import { cn } from "@/lib/utils";
import { tidyVendor, vendorDomain } from "@/lib/vendors";
import { type RailTab, type TimeWindow, WINDOW_MS, useSituation } from "@/stores/situation";
import { stackMatch, useStack } from "@/stores/stack";

const WINDOW_LABEL: Record<TimeWindow, string> = { "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days" };
const STATUSES = ["confirmed", "reported", "claimed"] as const;
const DAY = 86_400_000;

interface StoryProps {
  incidents: Incident[];
  allIncidents: Incident[];
  incidentSummary: IncidentSummary;
  incidentDays: IncidentDay[];
  vulns: Vuln[];
  trending: Vuln[];
  kev: Vuln[];
  /** New critical CVEs and this week's KEV additions, newest first. */
  fresh: Vuln[];
  malware: MalwarePackage[];
  outages: Outage[];
  generatedAt: string;
  onSearchFocus?: (focused: boolean) => void;
  onClose?: () => void;
  snapshot?: Snapshot;
}

/** Small mono caps label used for every section and tile heading. */
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4", className)}>{children}</span>;
}

/** The left column: the picture at a glance, the way in (search), then the live lists. */
const StoryPanel = forwardRef<OmniboxHandle, StoryProps>(function Story(props, ref) {
  const { incidents, allIncidents, incidentSummary, incidentDays, vulns, trending, kev, fresh, malware, outages, generatedAt, onSearchFocus, onClose, snapshot } = props;
  // One clock for every "time ago" label: the snapshot time on the server and during hydration.
  const now = useNow(Date.parse(generatedAt));
  const [question, setQuestion] = useState<string | null>(null);
  const tab = useSituation((s) => s.tab);
  const setTab = useSituation((s) => s.setTab);
  const exploited = useMemo(() => trending.filter((vuln) => vuln.kev || vuln.newsCount), [trending]);
  const newCritical = useMemo(() => fresh.filter((vuln) => !vuln.kev), [fresh]);
  // Vendors in today's exploited and new lists, offered as one-tap additions to the visitor's stack.
  const stackSuggestions = useMemo(
    () => [...new Set([...kev, ...exploited, ...newCritical].map((vuln) => tidyVendor(vuln.vendor)).filter((name) => name && name.length < 28))].slice(0, 24),
    [kev, exploited, newCritical],
  );
  const cveCount = useMemo(() => new Set([...newCritical, ...exploited, ...kev.slice(0, 25)].map((vuln) => vuln.cve)).size, [newCritical, exploited, kev]);

  return (
    <section className="pointer-events-auto flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain scrollbar-thin md:overflow-hidden">
      <div className="shrink-0 px-3 pt-3">
        {/* What Titan Cyber Command is for, in one line, before any number. */}
        <div className="px-2 pb-3 pt-1">
          <div className="flex items-start gap-2">
            <h1 className="min-w-0 flex-1 font-semicondensed text-[21px] font-bold leading-[1.15] tracking-[-0.015em] text-ink text-balance">
              Live vulnerabilities, exploits and breaches
            </h1>
            {onClose ? (
              <button
                type="button"
                data-sidebar-close
                aria-label="Close sidebar"
                aria-controls="map-sidebar"
                aria-expanded={true}
                title="Close sidebar"
                onClick={onClose}
                className="press -mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-white/[0.06] hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
              >
                <SidebarSimple className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink-3 text-pretty">
            What attackers are using right now, who it hits, and how to lock down what you use.
          </p>
        </div>
        <Header generatedAt={generatedAt} now={now} />
        <Pulse summary={incidentSummary} days={incidentDays} />

        {snapshot && (
          <div className="mt-3">
            <AmIAffectedHero snapshot={snapshot} />
          </div>
        )}

        <div className="mt-3">
          <Omnibox ref={ref} incidents={allIncidents} vulns={vulns} onAsk={setQuestion} onFocusChange={onSearchFocus} size="md" />
        </div>
        <Actions vendors={stackSuggestions} />

        {question ? (
          <div className="mt-3">
            <AnswerCard key={question} question={question} onClose={() => setQuestion(null)} />
          </div>
        ) : null}
      </div>

      <div className="mt-5 md:hidden">
        <PatchStrip variant="rail" />
      </div>

      <div className="sticky top-0 z-10 mt-4 shrink-0 bg-surface px-3 py-2 md:static">
        <Segmented<RailTab>
          kind="tab"
          label="Live lists"
          className="[&>button]:gap-1 [&>button]:px-1.5"
          value={tab}
          onChange={setTab}
          options={[
            { value: "exploited", label: "CVEs", count: cveCount },
            { value: "incidents", label: "Breaches", count: incidents.length },
            {
              value: "wire",
              label: "Wire",
              count: (snapshot?.stats?.breakingWireCount ?? 0) + (snapshot?.stats?.cisaAdvisoriesActive ?? 0),
            },
            { value: "c2", label: "C2", count: snapshot?.botnetC2s?.length ?? 50 },
            { value: "malware", label: "Malware", count: malware.length },
            { value: "outages", label: "Outages", count: outages.length },
          ]}
        />
      </div>

      <div className="relative px-1.5 pb-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:scrollbar-thin" role="tabpanel">
        {tab === "incidents" ? <IncidentFeed incidents={incidents} now={now} /> : null}
        {tab === "exploited" ? <VulnRows fresh={newCritical} trending={exploited} kev={kev} now={now} /> : null}
        {tab === "wire" ? <WireRows snapshot={snapshot} now={now} /> : null}
        {tab === "c2" ? <C2Rows botnets={snapshot?.botnetC2s ?? []} now={now} /> : null}
        {tab === "malware" ? <MalwareRows malware={malware} now={now} /> : null}
        {tab === "outages" ? <OutageRows outages={outages} now={now} /> : null}
      </div>

      <div className="hidden shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-[11.5px] text-ink-4 md:flex">
        <span>Open source. Every pin is sourced.</span>
        <AllowanceHint />
      </div>
    </section>
  );
});

// Memoised: hovering a dot on the globe re-renders the room on every pointer move; the list need not follow.
export const Story = memo(StoryPanel);

function Header({ generatedAt, now }: { generatedAt: string; now: number }) {
  const window_ = useSituation((s) => s.window);
  const setWindow = useSituation((s) => s.setWindow);
  return (
    <div className="flex items-center justify-between gap-3 pl-2">
      <span className="flex items-center gap-2 text-[12px] text-ink-3">
        <span className="relative flex size-2 items-center justify-center" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-safe/40 [animation-duration:2.4s] motion-safe:animate-ping" />
          <span className="size-1.5 rounded-full bg-safe" />
        </span>
        Live
        <span suppressHydrationWarning className="text-ink-4">updated {relativeTime(generatedAt, now)}</span>
      </span>
      <Segmented<TimeWindow>
        mono
        label="Time window"
        value={window_}
        onChange={setWindow}
        className="w-[138px]"
        options={[
          { value: "24h", label: "24h" },
          { value: "7d", label: "7d" },
          { value: "30d", label: "30d" },
        ]}
      />
    </div>
  );
}

/** Status counts describe the available scope, while the headline and bars follow visible results. */
function Pulse({ summary, days }: { summary: IncidentSummary; days: IncidentDay[] }) {
  const window_ = useSituation((s) => s.window);
  const statuses = useSituation((s) => s.statuses);
  const toggleStatus = useSituation((s) => s.toggleStatus);
  const setTab = useSituation((s) => s.setTab);
  const counts = summary.statusCounts;
  const toggle = (status: (typeof STATUSES)[number] | "precautionary" | "disputed") => {
    toggleStatus(status);
    setTab("incidents");
  };

  return (
    <section aria-label="Organisation summary" className="mt-3 overflow-hidden rounded-[18px] bg-surface-2">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <Eyebrow>{summary.filtered ? "Organisations shown" : "Organisations tracked"}</Eyebrow>
        <Eyebrow>{WINDOW_LABEL[window_]}</Eyebrow>
      </div>
      <div className="flex items-end justify-between gap-5 px-4 pb-4 pt-1.5">
        <div className="min-w-0">
          <NumberFlow
            value={summary.organisations}
            aria-label={`${summary.organisations} distinct organisations shown`}
            className="font-condensed text-[68px] font-bold leading-[0.86] tracking-[-0.035em] text-ink"
            willChange
          />
          <p className="mt-2 text-[11px] leading-snug text-ink-4">
            {summary.filtered ? `of ${summary.availableOrganisations} tracked · ` : ""}
            {summary.incidentCount} sourced {summary.incidentCount === 1 ? "incident" : "incidents"}
          </p>
        </div>
        <DayBars days={days} windowDays={Math.round(WINDOW_MS[window_] / DAY)} />
      </div>
      <div className="grid grid-cols-3 border-t border-white/[0.06]">
        {STATUSES.map((status, index) => {
          const on = statuses.has(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggle(status)}
              aria-pressed={on}
              title={`${on ? "Hide" : "Show"} ${counts[status]} ${STATUS_LABEL[status].toLowerCase()} ${counts[status] === 1 ? "organisation" : "organisations"}`}
              className={cn(
                "px-4 py-3 text-left transition-[background-color,opacity] duration-200 hover:bg-white/[0.03]",
                index > 0 && "border-l border-white/[0.06]",
                !on && "bg-space",
              )}
            >
              <span className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
                <StatusMark status={status} size={8} />
                {STATUS_LABEL[status]}
              </span>
              <span className={cn("mt-1 block text-[18px] font-semibold leading-none tracking-[-0.01em] tabular", on ? "text-ink" : "text-ink-4")}>
                {counts[status]}
              </span>
            </button>
          );
        })}
      </div>
      {(["precautionary", "disputed"] as const).some((status) => counts[status] > 0) ? (
        <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-2">
          {(["precautionary", "disputed"] as const)
            .filter((status) => counts[status] > 0)
            .map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statuses.has(status)}
                title={`${statuses.has(status) ? "Hide" : "Show"} ${counts[status]} ${STATUS_LABEL[status].toLowerCase()} ${counts[status] === 1 ? "organisation" : "organisations"}`}
                onClick={() => toggle(status)}
                className={cn(
                  "press flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px]",
                  statuses.has(status) ? "bg-white/[0.06] text-ink-2" : "text-ink-4",
                )}
              >
                <StatusMark status={status} size={7} />
                {STATUS_LABEL[status]} {counts[status]}
              </button>
            ))}
        </div>
      ) : null}
      <p className="border-t border-white/[0.06] px-4 py-2 text-[10.5px] leading-snug text-ink-4">
        Toggle statuses to filter the map and breach list. Counts are distinct organisations; an organisation can appear under multiple statuses.
      </p>
    </section>
  );
}

/** Distinct organisations per rolling 24-hour period, using the same country and status filters. */
function DayBars({ days, windowDays }: { days: IncidentDay[]; windowDays: number }) {
  const max = Math.max(1, ...days.map((day) => day.total));
  const HEIGHT = 46;

  return (
    <div
      className="w-[min(40%,168px)] shrink-0"
      role="img"
      aria-label={`Organisations per 24-hour period over the last 14 days: ${days.map((day) => day.total).join(", ")}`}
    >
      <div className="flex items-end gap-[4px]" style={{ height: HEIGHT }}>
        {days.map((day, index) => {
          const inWindow = index >= 14 - Math.min(14, windowDays);
          const label = new Date(day.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
          return (
            <span
              key={day.date}
              title={`24 hours ending ${label}: ${day.total} ${day.total === 1 ? "organisation" : "organisations"}`}
              className={cn(
                "flex-1 rounded-[2px] transition-[background-color,height] duration-500 ease-out-expo",
                index === 13 ? "bg-ink" : inWindow ? "bg-white/45" : "bg-white/[0.13]",
              )}
              style={{ height: Math.max(2, (day.total / max) * HEIGHT) }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-4">
        <span>14d ago</span>
        <span>last 24h</span>
      </div>
    </div>
  );
}

function Actions({ vendors }: { vendors: string[] }) {
  const setCinema = useSituation((s) => s.setCinema);
  const cls = "press flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-ink-3 transition-colors hover:bg-white/[0.05] hover:text-ink";
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-0.5">
      {/* The most useful thing a visitor can do: say what they run, so every list can say what touches them. */}
      <span className="mr-1.5">
        <StackPicker suggestions={vendors} side="bottom" />
      </span>
      <Link href="/brief" className={cls}>
        <Newspaper className="size-3.5" /> Today&apos;s brief
      </Link>
      <button type="button" onClick={() => setCinema(true)} className={cls} title="An automatic tour of the latest incidents (C)">
        <FilmSlate className="size-3.5" /> Tour
      </button>
    </div>
  );
}

/** "Boston Scientific cyberattack disrupts manufacturing" reads "Cyberattack disrupts manufacturing" under the name. */
function whatHappened(incident: Incident): string {
  const title = incident.title.trim();
  const name = incident.victim.trim();
  if (title.toLowerCase().startsWith(name.toLowerCase())) {
    const rest = title
      .slice(name.length)
      .replace(/^['’]s\b/, "")
      .replace(/^[\s:,.-]+/, "");
    if (rest.length > 8) return rest[0].toUpperCase() + rest.slice(1);
  }
  return title;
}

function dayLabel(date: number, now: number): string {
  const day = (value: number) => Math.floor(value / DAY);
  const diff = day(now) - day(date);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(date).toLocaleDateString("en-GB", { weekday: diff < 7 ? "long" : undefined, day: "numeric", month: "short", timeZone: "UTC" });
}

/** Marks a row that touches the visitor's stack. */
function Mine({ label }: { label: string }) {
  return <span className="shrink-0 rounded-full bg-ink px-1.5 py-px text-[10px] font-semibold text-space">{label}</span>;
}

function IncidentFeed({ incidents, now }: { incidents: Incident[]; now: number }) {
  const stack = useStack((s) => s.items);
  const select = useSituation((s) => s.select);
  const hover = useSituation((s) => s.hover);
  const selectedId = useSituation((s) => s.selectedId);

  const groups = useMemo(() => {
    const out: { label: string; items: Incident[] }[] = [];
    for (const incident of incidents) {
      const label = dayLabel(Date.parse(incident.date), now);
      const last = out.at(-1);
      if (last?.label === label) last.items.push(incident);
      else out.push({ label, items: [incident] });
    }
    return out;
  }, [incidents, now]);

  if (!incidents.length) return <EmptyNote>Nothing in this window yet. Try the last 7 days, or switch a status back on.</EmptyNote>;

  return (
    <div>
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="sticky top-0 z-[1] flex items-baseline justify-between bg-surface px-3 pb-1.5 pt-3">
            <Eyebrow className="text-ink-3">{group.label}</Eyebrow>
            <Eyebrow>{group.items.length}</Eyebrow>
          </h3>
          <ul>
            {group.items.map((incident) => (
              <li key={incident.id} className="[contain-intrinsic-size:auto_58px] [content-visibility:auto]">
                <button
                  type="button"
                  onClick={() => select(incident.id)}
                  onMouseEnter={() => hover(incident.id)}
                  onMouseLeave={() => hover(null)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.04]",
                    selectedId === incident.id && "bg-surface-3 ring-1 ring-inset ring-hairline-2",
                  )}
                >
                  <OrgLogo name={incident.victim} domain={incident.domain} size={32} className="rounded-[9px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-3">
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-[14px] font-medium tracking-[-0.005em] text-ink">{incident.victim}</span>
                        {stackMatch(stack, incident.victim, incident.domain?.split(".")[0]) ? <Mine label="Your vendor" /> : null}
                      </span>
                      <span suppressHydrationWarning className="shrink-0 font-mono text-[10.5px] tabular text-ink-4">{relativeTime(incident.date, now).replace(" ago", "")}</span>
                    </span>
                    <span className="mt-[3px] flex items-center gap-1.5">
                      <StatusMark status={incident.status} size={7} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-3">{whatHappened(incident)}</span>
                      <span className="shrink-0 font-mono text-[11px] font-medium text-ink-3">{countryName(incident.country) || incident.country}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mx-1.5 mt-2 px-4 py-8 text-center text-[13px] text-ink-3">{children}</p>;
}

/** A quiet explanatory note at the top of a list. */
function ListNote({ children }: { children: React.ReactNode }) {
  return <p className="mx-1.5 mb-1 mt-2 rounded-[12px] bg-white/[0.025] px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-3">{children}</p>;
}

export function VulnTags({ vuln }: { vuln: Vuln }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
      {vuln.kev ? <span className="text-confirmed">Exploited in the wild</span> : null}
      {vuln.ransomware ? <span className="text-confirmed">Used by ransomware</span> : null}
      {!vuln.kev && vuln.newsCount ? <span className="text-reported">In the news</span> : null}
      {vuln.cvss ? <span className="tabular text-ink-3">CVSS {vuln.cvss.toFixed(1)}</span> : null}
      {/* EPSS forecasts exploitation; once CISA confirms it, a low forecast only confuses. */}
      {vuln.epss !== undefined && !vuln.kev ? <span className="tabular text-ink-3">{epssPercent(vuln.epss)} chance of exploit</span> : null}
    </span>
  );
}

/** "Arista VeloCloud SQL Injection" reads as "SQL Injection" under its product; "PHP has a flaw…" stays whole rather than "has a flaw…". */
function subtitle(name: string, label: string): string {
  const rest = name
    .replace(label, "")
    .replace(/^[\s:,-]+/, "")
    .trim();
  return rest && /^[A-Z0-9]/.test(rest) ? rest : name;
}

function VulnStatus({ vuln, now }: { vuln: Vuln; now: number }) {
  if (vuln.kev || vuln.newsCount) {
    return (
      <>
        <span className={cn("size-[6px] shrink-0 rounded-full", vuln.kev ? "bg-confirmed" : "bg-reported")} />
        <span className={cn("shrink-0", vuln.kev ? "text-confirmed" : "text-reported")}>
          {vuln.ransomware ? "Ransomware" : vuln.kev ? "Exploited" : "In the news"}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="size-[6px] shrink-0 rounded-full bg-reported" />
      <span className="tabular shrink-0 text-reported">Critical{vuln.cvss ? ` ${vuln.cvss.toFixed(1)}` : ""}</span>
      {vuln.published ? <span suppressHydrationWarning className="shrink-0 text-ink-4">· {relativeTime(vuln.published, now)}</span> : null}
    </>
  );
}

function VulnRows({ fresh, trending, kev, now }: { fresh: Vuln[]; trending: Vuln[]; kev: Vuln[]; now: number }) {
  const stack = useStack((s) => s.items);
  const selectCve = useSituation((s) => s.selectCve);
  const seen = new Set([...fresh, ...trending].map((vuln) => vuln.cve));
  const sections = [
    { title: "New critical, last 72 hours", items: fresh.slice(0, 25) },
    { title: "Exploited or in the news", items: trending.slice(0, 25) },
    { title: "Newly confirmed exploited", items: kev.filter((vuln) => !seen.has(vuln.cve)).slice(0, 25) },
  ].filter((section) => section.items.length);
  return (
    <div>
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h3 className="sticky top-0 z-[1] bg-surface px-3 pb-1.5 pt-3">
            <Eyebrow className="text-ink-3">{section.title}</Eyebrow>
          </h3>
          <ul>
            {section.items.map((vuln) => {
              const vendor = tidyVendor(vuln.vendor);
              const product = tidyVendor(vuln.product);
              const label = productLabel({ vendor, product });
              return (
                <li key={`${section.title}-${vuln.cve}`}>
                  <button
                    type="button"
                    onClick={() => selectCve(vuln.cve)}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.04]"
                  >
                    <OrgLogo name={vendor || vuln.cve.slice(4)} domain={vendorDomain(vuln.vendor)} size={32} className="rounded-[9px]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-3">
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate text-[14px] font-medium tracking-[-0.005em] text-ink">{label || vuln.cve}</span>
                          {stackMatch(stack, vendor, product) ? <Mine label="You run this" /> : null}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-ink-4">{vuln.cve}</span>
                      </span>
                      <span className="mt-[3px] flex items-center gap-1.5 text-[12.5px]">
                        <VulnStatus vuln={vuln} now={now} />
                        <span className="min-w-0 flex-1 truncate text-ink-3">{subtitle(vuln.name, label)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MalwareRows({ malware, now }: { malware: MalwarePackage[]; now: number }) {
  return (
    <div>
      <ListNote>Packages published with malicious code. If one is in your lockfile, treat that machine as compromised and rotate its secrets.</ListNote>
      <ul>
        {malware.map((item) => (
          <li key={item.id}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors duration-150 hover:bg-white/[0.04]"
            >
              <span className="w-[52px] shrink-0 rounded-[6px] bg-reported/10 py-0.5 text-center font-mono text-[10.5px] text-reported">{item.ecosystem}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{item.name}</span>
              <span suppressHydrationWarning className="shrink-0 font-mono text-[10.5px] text-ink-4">{relativeTime(item.published, now).replace(" ago", "")}</span>
              <ArrowUpRight className="size-3 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutageRows({ outages, now }: { outages: Outage[]; now: number }) {
  return (
    <div>
      <ListNote>
        Country-wide drops in internet connectivity in the last 24 hours, measured by IODA at Georgia Tech. The cause is unknown unless a source says otherwise.
      </ListNote>
      {outages.length === 0 ? <EmptyNote>No significant connectivity drops right now.</EmptyNote> : null}
      <ul>
        {outages.map((outage) => (
          <li key={outage.id}>
            <a
              href={outage.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors duration-150 hover:bg-white/[0.04]"
            >
              <span className="size-2 shrink-0 rounded-full ring-[1.5px] ring-outage" />
              <span className="truncate text-[13.5px] text-ink">{countryName(outage.country)}</span>
              <span suppressHydrationWarning className="ml-auto shrink-0 text-[11.5px] text-ink-4">
                {outage.end ? "Recovered" : <span className="text-outage">Ongoing</span>} · {relativeTime(outage.start, now)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WireRows({ snapshot, now }: { snapshot?: Snapshot; now: number }) {
  const bulletins = snapshot?.wireBulletins ?? [];
  const cisa = snapshot?.cisaAdvisories ?? [];
  const darkWeb = snapshot?.darkWebStats;
  const selectCve = useSituation((s) => s.selectCve);

  return (
    <div>
      <ListNote>
        Live dispatches from primary threat intelligence wires and federal emergency cyber directives: The Record, The Hacker News, Dark Reading, CyberScoop, and CISA.
      </ListNote>

      {/* Dark Web Radar Quick Banner */}
      <div className="mx-1.5 mb-2 rounded-[14px] border border-cyan-500/20 bg-surface-2/80 p-3">
        <div className="flex items-center justify-between font-mono text-[10.5px]">
          <span className="flex items-center gap-1.5 font-bold text-cyan-300">
            <span className="size-1.5 rounded-full bg-cyan-400 motion-safe:animate-ping" />
            DARK WEB CARTEL RADAR
          </span>
          <span className="text-confirmed font-bold">
            {darkWeb?.groupsOnline ?? snapshot?.stats?.activeTorLeakSites ?? 0} ONION SITES ONLINE
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-ink-4">
          <span>{darkWeb?.posts24h ?? snapshot?.stats?.darkWebClaims24h ?? 0} victims claimed / 24h</span>
          <span>{darkWeb?.marketsOnline ? `${darkWeb.marketsOnline} dark markets monitored` : "Tor markets monitored"}</span>
        </div>
      </div>

      {bulletins.length === 0 && cisa.length === 0 ? (
        <EmptyNote>Connecting to breaking threat wire feeds...</EmptyNote>
      ) : null}

      {/* Breaking Wire Bulletins */}
      {bulletins.length > 0 && (
        <section aria-label="Breaking wire bulletins">
          <h3 className="sticky top-0 z-[1] flex items-baseline justify-between bg-surface px-3 pb-1.5 pt-2">
            <Eyebrow className="text-cyan-300">Breaking Wire Bulletins</Eyebrow>
            <Eyebrow>{bulletins.length}</Eyebrow>
          </h3>
          <ul className="space-y-1">
            {bulletins.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-1 rounded-[14px] px-3 py-2 transition-colors duration-150 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="shrink-0 rounded bg-cyan-500/15 px-1.5 py-0.2 font-mono text-[9.5px] font-bold uppercase text-cyan-300">
                        {item.publisher.replace(".com", "").replace(".media", "")}
                      </span>
                      {item.records && (
                        <span className="shrink-0 rounded bg-confirmed/15 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-confirmed">
                          {item.records.toLocaleString()} records
                        </span>
                      )}
                    </div>
                    <span suppressHydrationWarning className="shrink-0 font-mono text-[10px] text-ink-4">
                      {relativeTime(item.date, now).replace(" ago", "")}
                    </span>
                  </div>
                  <span className="text-[13px] font-medium leading-snug text-ink group-hover:text-cyan-200">
                    {item.title}
                  </span>
                  {item.summary && (
                    <span className="line-clamp-2 text-[11.5px] text-ink-3">
                      {item.summary}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CISA Advisories */}
      {cisa.length > 0 && (
        <section aria-label="CISA emergency alerts" className="mt-4">
          <h3 className="sticky top-0 z-[1] flex items-baseline justify-between bg-surface px-3 pb-1.5 pt-2">
            <Eyebrow className="text-emerald-400">CISA Directives & Advisories</Eyebrow>
            <Eyebrow>{cisa.length}</Eyebrow>
          </h3>
          <ul className="space-y-1">
            {cisa.map((item) => (
              <li key={item.id}>
                <div className="group flex flex-col gap-1 rounded-[14px] px-3 py-2 transition-colors duration-150 hover:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.2 font-mono text-[9.5px] font-bold uppercase text-emerald-300">
                      {item.category.toUpperCase()}
                    </span>
                    <span suppressHydrationWarning className="shrink-0 font-mono text-[10px] text-ink-4">
                      {relativeTime(item.published, now).replace(" ago", "")}
                    </span>
                  </div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-medium leading-snug text-ink hover:text-emerald-300"
                  >
                    {item.title}
                  </a>
                  {item.cves.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {item.cves.map((cve) => (
                        <button
                          key={cve}
                          type="button"
                          onClick={() => selectCve(cve)}
                          className="press rounded bg-white/[0.06] px-1.5 py-0.2 font-mono text-[10px] text-cyan-300 hover:bg-white/10"
                        >
                          {cve}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function C2Rows({ botnets, now }: { botnets: BotnetC2Node[]; now: number }) {
  const map = useMapInstance((s) => s.map);
  const selectC2 = useSituation((s) => s.selectC2);

  const handleFly = (node: BotnetC2Node) => {
    soundEngine.playClick();
    selectC2(node.id);
    if (map) {
      map.flyTo({
        center: [node.lon, node.lat],
        zoom: 5.2,
        duration: 1800,
        essential: true,
      });
    }
  };

  return (
    <div className="space-y-3">
      <section aria-label="Botnet C2 infrastructure">
        <h3 className="sticky top-0 z-[1] flex items-baseline justify-between bg-surface px-3 pb-1.5 pt-2">
          <Eyebrow className="text-fuchsia-400">Active C2 Beacons & Relays</Eyebrow>
          <Eyebrow>{botnets.length}</Eyebrow>
        </h3>
        <ul className="space-y-1">
          {botnets.map((node) => (
            <li key={node.id}>
              <div className="group flex flex-col gap-1 rounded-[14px] px-3 py-2 transition-colors duration-150 hover:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-fuchsia-400" />
                    <span className="font-mono text-[10px] font-bold text-fuchsia-300">
                      {node.framework}
                    </span>
                  </div>
                  <span suppressHydrationWarning className="font-mono text-[10px] text-ink-4">
                    {relativeTime(node.lastSeen, now).replace(" ago", "")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12.5px] font-bold text-ink">
                    {node.ip}:{node.port}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFly(node)}
                    className="press rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-fuchsia-300 hover:bg-fuchsia-500 hover:text-space transition-colors"
                  >
                    TRACK
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-3">
                  <span className="truncate max-w-[200px]">{node.asn}</span>
                  <span className="text-ink-4">{node.country}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
