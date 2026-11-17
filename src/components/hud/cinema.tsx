"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { BrandMark } from "@/components/icons/agents";
import { DecryptText } from "@/components/kit/decrypt-text";
import { StatusMark } from "@/components/kit/status-mark";
import { useMapInstance } from "@/components/map/map-instance";
import { soundEngine } from "@/lib/audio/sound-engine";
import { countryName } from "@/lib/countries";
import { STATUS_COLOR, STATUS_LABEL, TYPE_LABEL, placeLabel, recordsLabel, relativeTime } from "@/lib/format";
import type { Incident } from "@/lib/types";
import { useSituation } from "@/stores/situation";

const FLIGHT_MS = 5000;
const DWELL_MS = 5500;

function tourOrder(incidents: Incident[]): Incident[] {
  const now = Date.now();
  const score = (incident: Incident) =>
    incident.severity * 2 +
    (incident.status === "confirmed" ? 2 : incident.status === "reported" ? 1 : 0) +
    (incident.geoBasis === "stated" || incident.geoBasis === "hq" ? 1 : 0) -
    (now - Date.parse(incident.date)) / (3 * 86_400_000);
  const ranked = [...incidents].sort((a, b) => score(b) - score(a)).slice(0, 14);
  // Alternate hemispheres so the camera sweeps the planet instead of hopping between neighbours.
  const out: Incident[] = [];
  const pool = [...ranked];
  let last: Incident | undefined;
  while (pool.length) {
    pool.sort((a, b) => (last ? Math.abs(b.lon - last.lon) - Math.abs(a.lon - last.lon) : 0));
    const next = pool.shift()!;
    out.push(next);
    last = next;
  }
  return out;
}

function Typewriter(props: { text: string; delay?: number }) {
  return <TypewriterText key={props.text} {...props} />;
}

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let i = 0;
    let timer = 0;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) window.clearInterval(timer);
      }, 18);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [text, delay, reduced]);
  if (reduced) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, count)}
      <span className="opacity-0">{text.slice(count)}</span>
    </span>
  );
}

export function CinemaMode({ incidents }: { incidents: Incident[] }) {
  const cinema = useSituation((s) => s.cinema);
  const setCinema = useSituation((s) => s.setCinema);
  const select = useSituation((s) => s.select);
  const map = useMapInstance((s) => s.map);
  const [current, setCurrent] = useState<Incident | null>(null);
  const [phase, setPhase] = useState<"flying" | "dwell">("flying");
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const tour = useMemo(() => tourOrder(incidents), [incidents]);
  const timerRef = useRef<number | null>(null);
  const visitRef = useRef<(i: number) => void>(() => {});

  const visit = useCallback(
    (i: number) => {
      if (!map || !tour.length) return;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const curIndex = (i + tour.length) % tour.length;
      const incident = tour[curIndex];
      setIndex(curIndex);
      setCurrent(incident);
      setPhase("flying");
      const precise = incident.geoBasis === "stated" || incident.geoBasis === "hq";
      map.stop();
      map.flyTo({
        center: [incident.lon, incident.lat],
        zoom: precise ? 5.2 : 4.4,
        pitch: precise ? 42 : 32,
        bearing: (Math.random() - 0.5) * 36,
        duration: FLIGHT_MS,
        curve: 1.4,
        essential: true,
      });
      timerRef.current = window.setTimeout(() => {
        setPhase("dwell");
        map.easeTo({ bearing: map.getBearing() + 10, duration: DWELL_MS, easing: (t) => t });
        timerRef.current = window.setTimeout(() => {
          visitRef.current(curIndex + 1);
        }, DWELL_MS);
      }, FLIGHT_MS);
    },
    [map, tour],
  );

  useEffect(() => {
    visitRef.current = visit;
  }, [visit]);

  useEffect(() => {
    if (!cinema || !map || !tour.length) return;
    select(null);
    if (!isPaused) {
      timerRef.current = window.setTimeout(() => visit(index), 0);
    } else {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      map.stop();
    };
  }, [cinema, isPaused, map, tour, select, visit, index]);

  const handleTogglePause = useCallback(() => {
    soundEngine.playClick();
    setIsPaused((p) => !p);
  }, []);

  const handleNext = useCallback(() => {
    soundEngine.playClick();
    visit(index + 1);
  }, [visit, index]);

  const handlePrev = useCallback(() => {
    soundEngine.playClick();
    visit(index - 1);
  }, [visit, index]);

  useEffect(() => {
    if (!cinema) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cinema, handleTogglePause, handleNext, handlePrev]);

  if (!cinema) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-space/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[46vh] bg-gradient-to-t from-space via-space/70 to-transparent" />
      <div className="absolute left-6 top-6 flex items-center gap-3 sm:left-10">
        <BrandMark className="size-6 text-cyan-400" />
        <span className="font-semicondensed text-[20px] font-bold text-ink">
          Titan <span className="text-cyan-400">Cyber Command</span>
        </span>
        <span className="ml-1 flex items-center gap-2 rounded-full bg-confirmed/15 px-2.5 py-1 text-[12px] font-medium text-confirmed">
          <span className="live-dot size-1.5 rounded-full bg-confirmed" /> Live
        </span>
      </div>
      <div className="absolute right-6 top-7 text-[13px] tabular text-ink-3 sm:right-10">
        {index + 1} of {tour.length}
      </div>

      {current ? (
        <div key={current.id} className="absolute bottom-12 left-6 right-6 max-w-[880px] sm:bottom-14 sm:left-10">
          <div className="flex items-center gap-2.5 text-[14px] text-ink-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
            <StatusMark status={current.status} size={12} />
            <span style={{ color: STATUS_COLOR[current.status] }} className="font-medium">
              {STATUS_LABEL[current.status]}
            </span>
            <span className="text-ink-4">·</span>
            <span>{TYPE_LABEL[current.type]}</span>
            <span className="text-ink-4">·</span>
            <span>{relativeTime(current.date)}</span>
          </div>
          <h2 className="mt-3 font-condensed text-[clamp(44px,7vw,104px)] font-[780] leading-[0.9] tracking-[-0.02em] text-ink">
            <DecryptText text={current.victim} duration={900} />
          </h2>
          <p className="mt-4 max-w-[680px] text-[clamp(16px,1.6vw,22px)] leading-snug text-ink-2">
            <Typewriter text={current.title} delay={phase === "flying" ? 700 : 0} />
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 text-[14px] text-ink-3">
            <span>{placeLabel(current, countryName)}</span>
            {recordsLabel(current) ? <span className="text-ink">{recordsLabel(current)}</span> : null}
            {current.actor ? <span>{current.actor}</span> : null}
          </div>
          <div className="mt-6 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
            <div
              key={`${current.id}-${phase}-${isPaused}`}
              className="h-full bg-ink motion-reduce:hidden"
              style={{
                width: "100%",
                transformOrigin: "left",
                animation: isPaused ? "none" : `cinema-progress ${phase === "flying" ? FLIGHT_MS : DWELL_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="pointer-events-auto absolute bottom-5 right-6 flex items-center gap-3 text-[12.5px] text-ink-4 sm:right-10">
        <div className="glass-pill flex items-center divide-x divide-white/[0.08] rounded-full p-0.5 shadow-xl">
          <button
            type="button"
            onClick={handlePrev}
            className="press flex size-7 items-center justify-center rounded-l-full text-ink-2 hover:bg-white/10 hover:text-ink transition-colors"
            title="Previous incident (Left arrow / K)"
            aria-label="Previous incident"
          >
            <CaretLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleTogglePause}
            className="press flex size-7 items-center justify-center text-ink-2 hover:bg-white/10 hover:text-ink transition-colors"
            title={isPaused ? "Resume Patrol (Space)" : "Pause Patrol (Space)"}
            aria-label={isPaused ? "Resume Patrol" : "Pause Patrol"}
          >
            {isPaused ? <Play className="size-3.5 text-cyan-400" weight="fill" /> : <Pause className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="press flex size-7 items-center justify-center rounded-r-full text-ink-2 hover:bg-white/10 hover:text-ink transition-colors"
            title="Next incident (Right arrow / J)"
            aria-label="Next incident"
          >
            <CaretRight className="size-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setCinema(false);
          }}
          className="press glass-pill rounded-full px-3 py-1.5 font-mono text-[11px] text-ink-2 hover:text-ink shadow-xl"
        >
          ESC TO EXIT
        </button>
      </div>
      <style>{`@keyframes cinema-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
    </div>
  );
}
