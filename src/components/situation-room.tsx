"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MapControls } from "@/components/hud/controls";
import { MapSidebar } from "@/components/hud/map-sidebar";
import { SIDEBAR_DEFAULT, clampSidebarWidth, sidebarMaximum } from "@/components/hud/sidebar-layout";
import { type Cluster, ClusterMenu } from "@/components/hud/cluster-menu";
import { HoverCard } from "@/components/hud/hover-card";
import type { OmniboxHandle } from "@/components/hud/omnibox";
import { CveTicker } from "@/components/hud/cve-ticker";
import { PATCH_DOCK_MIN_WIDTH, PatchStrip } from "@/components/hud/patch-strip";
import { Story } from "@/components/hud/story";
import { TopBar } from "@/components/hud/top-bar";
import { AsciiAtlas } from "@/components/map/ascii-atlas";
import { DataTags } from "@/components/map/data-tags";
import { BallisticEngine } from "@/components/map/ballistic-engine";
import { OrbitalHud } from "@/components/map/orbital-hud";
import { CombatFeedDrawer } from "@/components/hud/combat-feed";
import { GlobeErrorBoundary } from "@/components/map/globe-error-boundary";
import { useCombatFeed } from "@/stores/combat-feed";
import { WargamesModal } from "@/components/hud/wargames-modal";
import { ReconScannerModal } from "@/components/hud/recon-scanner";
import { ShortcutsModal } from "@/components/hud/shortcuts-modal";
import { DemoModal } from "@/components/hud/demo-modal";
import { CinemaMode } from "@/components/hud/cinema";
import { useAudioStore } from "@/stores/audio";
import { soundEngine } from "@/lib/audio/sound-engine";
import { ShieldCheck, X } from "@phosphor-icons/react";
import type { Incident, Snapshot, Vuln } from "@/lib/types";
import { incidentView } from "@/lib/incident-view";
import { cn } from "@/lib/utils";
import { WINDOW_MS, useSituation } from "@/stores/situation";
import { useStack } from "@/stores/stack";

const Globe = dynamic(() => import("@/components/map/globe").then((mod) => mod.Globe), {
  ssr: false,
  loading: () => <GlobePlaceholder />,
});
// Only needed once something is selected, so they stay out of the first load.
const IncidentPanel = dynamic(() => import("@/components/hud/detail-panel").then((mod) => mod.IncidentPanel));
const CvePanel = dynamic(() => import("@/components/hud/detail-panel").then((mod) => mod.CvePanel));
const ThreatActorModal = dynamic(() => import("@/components/hud/threat-actor-modal").then((mod) => mod.ThreatActorModal));
const ReplayDock = dynamic(() => import("@/components/hud/replay-dock").then((mod) => mod.ReplayDock));
const AmIAffectedModal = dynamic(() => import("@/components/hud/am-i-affected-modal").then((mod) => mod.AmIAffectedModal));

const PANEL = 460;
/** Space the patch dock takes from the bottom edge on desktop. */
const DOCK = 216;

function GlobePlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center md:pl-[var(--map-inset-left)]">
      <div className="aspect-square w-[min(62vh,62vw)] rounded-full bg-surface ring-1 ring-hairline" />
    </div>
  );
}

/**
 * True once the browser is first idle after hydration. WebGL MapLibre startup involves shader compilation and tile initialization; mounting it after the panel hydrates lets search and the lists respond first.
 */
function useIdle(timeout = 1200) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      const id = window.setTimeout(() => setIdle(true), 1);
      return () => window.clearTimeout(id);
    }
    const id = window.requestIdleCallback(() => setIdle(true), { timeout });
    return () => window.cancelIdleCallback(id);
  }, [timeout]);
  return idle;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

/**
 * Keeps one query param and one selection in sync both ways. Opening a dossier adds a history entry, so
 * Back closes it instead of leaving the site; moving between dossiers replaces it.
 */
function useParamSync(name: "i" | "cve" | "actor" | "affected", value: string | null, apply: (next: string | null) => void) {
  const [param, setParam] = useQueryState(name);
  const lastValue = useRef(value);
  const lastParam = useRef<string | null | undefined>(undefined);

  // URL to state: first load, Back and Forward.
  useEffect(() => {
    if (lastParam.current === param) return;
    lastParam.current = param;
    if (param !== value) apply(name === "cve" && param ? param.toUpperCase() : param);
    // Only when the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  // State to URL.
  useEffect(() => {
    if (lastValue.current === value) return;
    const opening = lastValue.current === null;
    lastValue.current = value;
    if (value !== param) void setParam(value, { history: opening ? "push" : "replace" });
  }, [value, param, setParam]);
}

/**
 * Deep links: ?i=<incident> and ?cve=<id> open the dossier on load and follow the selection. Reading the
 * query string opts out of static rendering, so this lives in its own Suspense boundary and the rest of
 * the room still prerenders.
 */
function DeepLinks() {
  const selectedId = useSituation((s) => s.selectedId);
  const selectedCve = useSituation((s) => s.selectedCve);
  const selectedActor = useSituation((s) => s.selectedActor);
  const amIAffectedOpen = useSituation((s) => s.amIAffectedOpen);
  const select = useSituation((s) => s.select);
  const selectCve = useSituation((s) => s.selectCve);
  const selectActor = useSituation((s) => s.selectActor);
  const setAmIAffectedOpen = useSituation((s) => s.setAmIAffectedOpen);
  useParamSync("i", selectedId, select);
  useParamSync("cve", selectedCve, selectCve);
  useParamSync("actor", selectedActor, selectActor);
  useParamSync("affected", amIAffectedOpen ? "1" : null, (val) => setAmIAffectedOpen(Boolean(val)));
  return null;
}

export function SituationRoom({ snapshot }: { snapshot: Snapshot }) {
  const router = useRouter();
  const omnibox = useRef<OmniboxHandle>(null);
  const topBar = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(112);
  const mobile = useIsMobile();
  const mapReady = useIdle();
  const [hovered, setHovered] = useState<{ incident: Incident; x: number; y: number } | null>(null);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [now] = useState(() => Date.parse(snapshot.generatedAt));
  const [viewport, setViewport] = useState({ h: 800, w: 1280 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [preferredSidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [patchDockOpen, setPatchDockOpen] = useState(true);
  const [wargamesOpen, setWargamesOpen] = useState(false);
  const [reconOpen, setReconOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  const window_ = useSituation((s) => s.window);
  const statuses = useSituation((s) => s.statuses);
  const country = useSituation((s) => s.country);
  const selectedId = useSituation((s) => s.selectedId);
  const selectedCve = useSituation((s) => s.selectedCve);
  const selectedActor = useSituation((s) => s.selectedActor);
  const select = useSituation((s) => s.select);
  const selectCve = useSituation((s) => s.selectCve);
  const selectActor = useSituation((s) => s.selectActor);
  const cinema = useSituation((s) => s.cinema);
  const setCinema = useSituation((s) => s.setCinema);
  const tacticalCrt = useSituation((s) => s.tacticalCrt);
  const wargameSim = useSituation((s) => s.wargameSim);
  const setWargameSim = useSituation((s) => s.setWargameSim);
  const replay = useSituation((s) => s.replay);
  const setReplay = useSituation((s) => s.setReplay);
  const amIAffectedOpen = useSituation((s) => s.amIAffectedOpen);
  const setAmIAffectedOpen = useSituation((s) => s.setAmIAffectedOpen);
  const [heroDomain, setHeroDomain] = useState("");
  const [amIAffectedTarget, setAmIAffectedTarget] = useState<string | undefined>(undefined);
  const heroInputRef = useRef<HTMLInputElement | null>(null);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = heroDomain.trim();
    if (clean) {
      soundEngine.playClick();
      setAmIAffectedTarget(clean);
      setAmIAffectedOpen(true);
    } else {
      setAmIAffectedTarget(undefined);
      setAmIAffectedOpen(true);
    }
  };

  // WarGames autonomous cascade progression and automated countermeasure defense
  useEffect(() => {
    if (!wargameSim?.active || wargameSim.mitigated) return;
    let autoMitigateTimer: number | null = null;
    const interval = window.setInterval(() => {
      const cur = useSituation.getState().wargameSim;
      if (!cur?.active || cur.mitigated) return;
      if (cur.step < 3) {
        soundEngine.playAlert();
        setWargameSim({ ...cur, step: cur.step + 1 });
      } else if (autoMitigateTimer === null) {
        autoMitigateTimer = window.setTimeout(() => {
          const latest = useSituation.getState().wargameSim;
          if (latest?.active && !latest.mitigated) {
            soundEngine.playEmpDischarge();
            soundEngine.playImpact(4);
            setWargameSim({ ...latest, mitigated: true });
          }
        }, 2500);
      }
    }, 2800);

    return () => {
      window.clearInterval(interval);
      if (autoMitigateTimer !== null) window.clearTimeout(autoMitigateTimer);
    };
  }, [wargameSim?.active, wargameSim?.mitigated, setWargameSim]);

  // Synchronize authentic threat intelligence baseline count
  useEffect(() => {
    const totalThreats = snapshot.incidents.length + (snapshot.stats?.kevAdded30d ?? 0) + snapshot.outages.length;
    useCombatFeed.getState().setBaseline(totalThreats);
  }, [snapshot.incidents.length, snapshot.stats?.kevAdded30d, snapshot.outages.length]);

  // The visitor's stack lives in localStorage; load it after hydration so server and client HTML agree.
  useEffect(() => {
    void useStack.persist.rehydrate();
  }, []);

  useEffect(() => {
    const update = () => setViewport({ h: window.innerHeight, w: window.innerWidth });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const element = topBar.current;
    if (!element) return;
    const update = () => setNavHeight(element.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const incidentData = useMemo(
    () => incidentView(snapshot.incidents, { now, windowMs: WINDOW_MS[window_], country, statuses }),
    [snapshot.incidents, statuses, window_, now, country],
  );
  const baseFiltered = incidentData.incidents;

  // Time-travel replay: filter incidents chronologically based on scrubber progress
  const filtered = useMemo(() => {
    if (!replay.active) return baseFiltered;
    const windowStart = now - 86_400_000;
    const simTime = now - (1 - Math.max(0, Math.min(1, replay.progress))) * 86_400_000;
    const pool24h = baseFiltered.filter((inc) => {
      const t = Date.parse(inc.date);
      return !isNaN(t) && t >= windowStart && t <= now;
    });

    if (pool24h.length > 0) {
      const landed = pool24h.filter((inc) => Date.parse(inc.date) <= simTime);
      return landed.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    }

    // Fallback if no incidents fall strictly in 24h window: reveal chronologically
    const chronological = [...baseFiltered].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const sliceCount = Math.round(chronological.length * replay.progress);
    return chronological.slice(0, sliceCount).reverse();
  }, [baseFiltered, replay.active, replay.progress, now]);

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const incident of filtered) counts[incident.country] = (counts[incident.country] ?? 0) + 1;
    return counts;
  }, [filtered]);

  const selected = useMemo(
    () => (selectedId ? snapshot.incidents.find((incident) => incident.id === selectedId) : undefined),
    [selectedId, snapshot.incidents],
  );
  const related = useMemo(() => {
    if (!selected) return [];
    return snapshot.incidents.filter(
      (other) =>
        other.id !== selected.id &&
        ((selected.actor && other.actor?.toLowerCase() === selected.actor.toLowerCase()) || other.cves.some((cve) => selected.cves.includes(cve))),
    );
  }, [selected, snapshot.incidents]);

  const vulnIndex = useMemo(() => {
    const map = new Map<string, Vuln>();
    for (const vuln of [...snapshot.fresh, ...snapshot.kev, ...snapshot.trending]) map.set(vuln.cve, vuln);
    return map;
  }, [snapshot.fresh, snapshot.kev, snapshot.trending]);
  const vulns = useMemo(() => [...vulnIndex.values()], [vulnIndex]);
  const selectedVuln = selectedCve ? vulnIndex.get(selectedCve) : undefined;

  useEffect(() => {
    // A CVE that is not in the live snapshot gets its own page.
    if (selectedCve && !selectedVuln) router.push(`/cve/${selectedCve}`);
  }, [selectedCve, selectedVuln, router]);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!filtered.length) return;
      const index = filtered.findIndex((incident) => incident.id === selectedId);
      const next = filtered[(index + dir + filtered.length) % filtered.length];
      select(next.id);
    },
    [filtered, selectedId, select],
  );

  useEffect(() => {
    const focusSearch = () => {
      setSidebarOpen(true);
      if (window.matchMedia("(max-width: 767px)").matches) setSheetOpen(true);
      requestAnimationFrame(() => omnibox.current?.focus());
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const modalOpen = shortcutsOpen || demoOpen || wargamesOpen || reconOpen;
      if (modalOpen) {
        // Native `<dialog>` handles Escape directly; prevent map hotkeys from firing behind modals.
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        focusSearch();
      } else if (event.key === "Escape") {
        if (cinema) setCinema(false);
        else {
          select(null);
          selectCve(null);
        }
      } else if (event.key.toLowerCase() === "c" || event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCinema(!cinema);
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        useCombatFeed.getState().toggleOpen();
      } else if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        setDemoOpen((prev) => !prev);
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        setWargamesOpen((prev) => !prev);
      } else if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (heroInputRef.current) {
          heroInputRef.current.focus();
        } else {
          setAmIAffectedOpen(!amIAffectedOpen);
        }
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setReconOpen((prev) => !prev);
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        setReplay({ active: !replay.active, playing: !replay.active, progress: 0 });
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMute();
      } else if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (event.key.toLowerCase() === "j") {
        step(1);
      } else if (event.key === " ") {
        if (
          target?.closest(
            "button, a[href], select, summary, input, textarea, [role='button'], [role='switch'], [role='checkbox'], [role='radio'], [role='menuitem'], [role='option'], [role='tab'], [role='slider'], [role='combobox'], [contenteditable='true']",
          )
        ) {
          return;
        }
        event.preventDefault();
        step(1);
      } else if (event.key.toLowerCase() === "k") {
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cinema, setCinema, select, selectCve, step, shortcutsOpen, demoOpen, wargamesOpen, reconOpen, toggleMute, replay.active, setReplay, amIAffectedOpen, setAmIAffectedOpen]);

  const onHover = useCallback((incident: Incident | null, point: { x: number; y: number } | null) => {
    setHovered(incident && point ? { incident, x: point.x, y: point.y } : null);
  }, []);
  const onCluster = useCallback((incidents: Incident[], point: { x: number; y: number; lng: number; lat: number }) => {
    setHovered(null);
    setCluster({ incidents, ...point });
  }, []);
  const closeCluster = useCallback(() => setCluster(null), []);

  const panelOpen = Boolean(selected || selectedVuln);
  const sidebarMax = sidebarMaximum(viewport.w - (panelOpen ? PANEL : 0));
  const sidebarWidth = clampSidebarWidth(preferredSidebarWidth, sidebarMax);
  const sidebarInset = sidebarOpen ? sidebarWidth + 32 : 0;
  const patchInsetLeft = sidebarOpen ? sidebarInset : 16;
  const patchInsetRight = panelOpen ? PANEL : 0;
  const patchAvailableWidth = viewport.w - patchInsetLeft - patchInsetRight - 16;
  const patchDockFits = !mobile && !cinema && patchAvailableWidth >= PATCH_DOCK_MIN_WIDTH;
  // Keep the existing camera framing stable. Only tags reclaim the lower area when the dock folds.
  // A folded dock needs 40px for its restore pill, the 16px outer gutter and 16px breathing room.
  const tagBottom = patchDockFits ? (patchDockOpen ? DOCK : 72) : 16;
  // Space the panels cover, so the globe is framed in what is left (below the 68px nav).
  const padding = mobile
    ? {
        left: 0,
        right: 0,
        top: navHeight,
        bottom:
          panelOpen || sidebarOpen ? Math.max(0, Math.min(viewport.h - navHeight - 8, Math.round(viewport.h * (panelOpen || sheetOpen ? 0.8 : 0.52)))) : 0,
      }
    : {
        left: cinema ? 0 : sidebarInset,
        right: panelOpen && !cinema ? Math.min(PANEL, Math.max(0, viewport.w - sidebarInset - 160)) : 0,
        top: cinema ? 0 : navHeight,
        bottom: cinema ? 0 : 96,
      };

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-space"
      style={{ "--map-inset-left": `${sidebarInset}px`, "--map-top": `${navHeight + 8}px` } as React.CSSProperties}
    >
      <Suspense fallback={null}>
        <DeepLinks />
      </Suspense>
      {mapReady ? (
        <GlobeErrorBoundary fallback={<GlobePlaceholder />}>
          <Globe incidents={filtered} outages={snapshot.outages} countryCounts={countryCounts} padding={padding} onHover={onHover} onCluster={onCluster} />
          <OrbitalHud />
          <BallisticEngine
            incidents={filtered}
            hudLeft={patchInsetLeft}
            hudBottom={patchDockOpen && patchDockFits ? 236 : patchDockFits ? 56 : 16}
            showHud={!mobile && !cinema && patchAvailableWidth >= 620}
          />
        </GlobeErrorBoundary>
      ) : (
        <GlobePlaceholder />
      )}
      <AsciiAtlas />
      {/* Tags are desktop-only; on phones they were still laid out on every frame while hidden. */}
      {!mobile ? (
        <DataTags incidents={filtered} now={now} insetLeft={sidebarInset} insetRight={selectedId || selectedCve ? PANEL + 16 : 0} insetBottom={tagBottom} />
      ) : null}

      <div className={cn("pointer-events-none transition-opacity duration-500", cinema && "opacity-0")}>
        <div ref={topBar} className="absolute inset-x-0 top-0 z-30">
          <TopBar
            ticker={<CveTicker items={snapshot.fresh} generatedAt={snapshot.generatedAt} onSelect={selectCve} />}
            stats={snapshot.stats}
            onOpenAmIAffected={() => setAmIAffectedOpen(true)}
            isAmIAffectedActive={amIAffectedOpen}
            onOpenWargames={() => setWargamesOpen(true)}
            onOpenRecon={() => setReconOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenDemo={() => setDemoOpen(true)}
            onTogglePatrol={() => setCinema(!cinema)}
            isPatrolActive={cinema}
            onToggleReplay={() => setReplay({ active: !replay.active, playing: !replay.active, progress: 0 })}
            isReplayActive={replay.active}
          />
        </div>

        <MapSidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          width={sidebarWidth}
          maximum={sidebarMax}
          onWidthChange={setSidebarWidth}
          sheetOpen={sheetOpen}
          onSheetToggle={() => setSheetOpen((open) => !open)}
          cinema={cinema}
        >
          <Story
            ref={omnibox}
            incidents={filtered}
            allIncidents={snapshot.incidents}
            incidentSummary={incidentData.summary}
            incidentDays={incidentData.days}
            vulns={vulns}
            trending={snapshot.trending}
            kev={snapshot.kev}
            fresh={snapshot.fresh}
            malware={snapshot.malware}
            outages={snapshot.outages}
            generatedAt={snapshot.generatedAt}
            snapshot={snapshot}
            onClose={() => setSidebarOpen(false)}
            onSearchFocus={(focused) => {
              if (focused && mobile) setSheetOpen(true);
            }}
          />
        </MapSidebar>

        {selected ? <IncidentPanel incident={selected} related={related} /> : null}
        {!selected && selectedVuln ? <CvePanel vuln={selectedVuln} /> : null}
        <PatchStrip
          insetLeft={patchInsetLeft}
          insetRight={patchInsetRight}
          availableWidth={patchAvailableWidth}
          onShowSidebar={() => setSidebarOpen(true)}
          open={patchDockOpen}
          onOpenChange={setPatchDockOpen}
          inactive={mobile || cinema}
          now={now}
        />
        <MapControls generatedAt={snapshot.generatedAt} feeds={snapshot.feeds} shiftForPanel={panelOpen} />
      </div>

      {hovered && !cinema && !cluster ? <HoverCard incident={hovered.incident} x={hovered.x} y={hovered.y} /> : null}
      {cluster && !cinema ? <ClusterMenu cluster={cluster} now={now} onClose={closeCluster} /> : null}
      {cinema ? <CinemaMode incidents={filtered} /> : null}

      <WargamesModal open={wargamesOpen} onClose={() => setWargamesOpen(false)} />
      <ReconScannerModal open={reconOpen} onClose={() => setReconOpen(false)} snapshot={snapshot} />
      <AmIAffectedModal
        open={amIAffectedOpen}
        onClose={() => {
          setAmIAffectedOpen(false);
          setAmIAffectedTarget(undefined);
        }}
        snapshot={snapshot}
        initialDomain={amIAffectedTarget}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <ThreatActorModal actorName={selectedActor} open={Boolean(selectedActor)} onClose={() => selectActor(null)} snapshot={snapshot} />
      <ReplayDock incidents={baseFiltered} now={now} />
      {!cinema && <CombatFeedDrawer incidents={filtered} shiftUp={patchDockOpen && patchDockFits} shiftLeft={panelOpen} />}

      {!cinema && !wargameSim?.active && (
        <div className="pointer-events-auto fixed top-[66px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-cyan-500/40 bg-space/95 p-1 font-mono shadow-2xl backdrop-blur-xl transition-all hover:border-cyan-400">
          <div className="flex items-center gap-1.5 pl-3 pr-1">
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-cyan-400/50 motion-safe:animate-ping" />
              <span className="size-1.5 rounded-full bg-cyan-400" />
            </span>
            <span className="hidden text-[11px] font-bold uppercase tracking-wider text-cyan-400 sm:inline">
              AM I AFFECTED?
            </span>
          </div>

          <form onSubmit={handleHeroSubmit} className="flex items-center gap-1.5">
            <input
              ref={heroInputRef}
              type="text"
              value={heroDomain}
              onChange={(e) => setHeroDomain(e.target.value)}
              placeholder="Paste domain (e.g. apple.com)..."
              className="w-44 sm:w-60 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs text-ink placeholder:text-ink-4 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <button
              type="submit"
              className="press flex items-center gap-1 rounded-full bg-cyan-500 px-3 py-1 text-xs font-bold text-space shadow-md hover:bg-cyan-400"
            >
              <ShieldCheck size={13} weight="bold" />
              <span>SCAN</span>
              <kbd className="hidden sm:inline rounded bg-cyan-900/40 px-1 py-0.2 text-[9px] text-cyan-200">A</kbd>
            </button>
          </form>
        </div>
      )}

      {wargameSim?.active && !wargamesOpen && !cinema && (
        <div className="pointer-events-auto fixed top-[76px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-confirmed/40 bg-space/95 px-4 py-2 font-mono text-xs shadow-2xl backdrop-blur-md">
          <span className="flex items-center gap-1.5 font-bold text-confirmed">
            <span className={cn("size-2 rounded-full", wargameSim.mitigated ? "bg-emerald-400" : "bg-confirmed motion-safe:animate-ping")} />
            {wargameSim.code}: {wargameSim.mitigated ? "DEFENSE ACTIVE" : "CASCADE IN PROGRESS"}
          </span>
          {!wargameSim.mitigated ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.playEmpDischarge();
                soundEngine.playImpact(4);
                setWargameSim({ ...wargameSim, mitigated: true });
              }}
              className="press flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 font-bold text-space shadow-md hover:bg-emerald-400 active:scale-95 transition-transform"
            >
              <ShieldCheck size={14} weight="bold" />
              DEPLOY COUNTERMEASURE
            </button>
          ) : (
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <ShieldCheck size={14} weight="fill" />
              COUNTERMEASURE ENGAGED
            </span>
          )}
          <button
            type="button"
            onClick={() => setWargamesOpen(true)}
            className="text-ink-4 hover:text-ink underline decoration-dotted text-[11px]"
          >
            DETAILS
          </button>
          <button
            type="button"
            onClick={() => setWargameSim(null)}
            className="text-ink-4 hover:text-ink p-0.5"
            aria-label="Stop simulation"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {tacticalCrt && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.32)_50%),linear-gradient(90deg,rgba(6,182,212,0.03),rgba(0,255,100,0.01),rgba(6,182,212,0.03))] bg-[length:100%_4px,8px_100%] shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]"
        />
      )}
    </main>
  );
}
