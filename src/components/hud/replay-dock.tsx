"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowClockwise, ClockCounterClockwise, Pause, Play, X } from "@phosphor-icons/react";

import { soundEngine } from "@/lib/audio/sound-engine";
import type { Incident } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSituation } from "@/stores/situation";

const REPLAY_DURATION_MS = 30_000; // 30 seconds for 24 hours of attacks

export function ReplayDock({ incidents, now }: { incidents: Incident[]; now: number }) {
  const replay = useSituation((s) => s.replay);
  const setReplay = useSituation((s) => s.setReplay);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastIncidentIndexRef = useRef<number>(-1);

  // Incidents in the last 24 hours sorted chronologically (oldest to newest)
  const window24hIncidents = useMemo(() => {
    const cutoff = now - 86_400_000;
    return incidents
      .filter((inc) => {
        const t = Date.parse(inc.date);
        return !isNaN(t) && t >= cutoff && t <= now;
      })
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  }, [incidents, now]);

  // Animation playback loop
  useEffect(() => {
    if (!replay.active || !replay.playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (currentTime: number) => {
      const delta = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      const increment = (delta / (REPLAY_DURATION_MS / replay.speed));
      const curProgress = useSituation.getState().replay.progress;
      const nextProgress = Math.min(1, curProgress + increment);

      // Check if we passed any incidents and play audio / trigger
      const currentSimTime = now - (1 - nextProgress) * 86_400_000;
      const newIndex = window24hIncidents.findIndex((inc) => Date.parse(inc.date) > currentSimTime);
      const effectiveIndex = newIndex === -1 ? window24hIncidents.length : newIndex;

      if (effectiveIndex > lastIncidentIndexRef.current && effectiveIndex > 0) {
        lastIncidentIndexRef.current = effectiveIndex;
        soundEngine.playAttackLaunch(0);
      }

      if (nextProgress >= 1) {
        setReplay({ progress: 1, playing: false });
        soundEngine.playEmpDischarge();
      } else {
        setReplay({ progress: nextProgress });
        animRef.current = requestAnimationFrame(loop);
      }
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [replay.active, replay.playing, replay.speed, now, window24hIncidents, setReplay]);

  if (!replay.active) return null;

  const currentSimTime = now - (1 - replay.progress) * 86_400_000;
  const simDate = new Date(currentSimTime);
  const timeLabel = simDate.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const hoursAgo = ((now - currentSimTime) / 3600_000).toFixed(1);

  const attacksPassedCount = window24hIncidents.filter((i) => Date.parse(i.date) <= currentSimTime).length;

  const togglePlay = () => {
    soundEngine.playClick();
    if (replay.progress >= 1) {
      lastIncidentIndexRef.current = -1;
      setReplay({ progress: 0, playing: true });
    } else {
      setReplay({ playing: !replay.playing });
    }
  };

  const setSpeed = (spd: number) => {
    soundEngine.playClick();
    setReplay({ speed: spd });
  };

  const handleSeek = (val: number) => {
    lastIncidentIndexRef.current = -1;
    setReplay({ progress: val });
  };

  const handleRestart = () => {
    soundEngine.playClick();
    lastIncidentIndexRef.current = -1;
    setReplay({ progress: 0, playing: true });
  };

  const handleExit = () => {
    soundEngine.playClick();
    setReplay(null);
  };

  return (
    <div className="pointer-events-auto fixed bottom-5 left-1/2 z-40 w-[min(94vw,760px)] -translate-x-1/2 rounded-[22px] border border-cyan-500/40 bg-space/95 p-4 shadow-2xl backdrop-blur-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <ClockCounterClockwise size={16} className="text-cyan-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">
            TIME-TRAVEL REPLAY // 24H ATTACK RECONSTRUCTION
          </span>
          <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
            30 SEC TIMELAPSE
          </span>
        </div>

        <button
          type="button"
          onClick={handleExit}
          className="press flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] text-ink-4 hover:bg-white/10 hover:text-ink"
        >
          <span>EXIT REPLAY</span>
          <X size={14} />
        </button>
      </div>

      {/* Main Scrubber Control */}
      <div className="mt-3.5 space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-ink-4">-24h ago</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-400">{timeLabel}</span>
            <span className="text-ink-3">({hoursAgo}h ago)</span>
          </div>
          <span className="text-ink-4">LIVE NOW</span>
        </div>

        {/* Timeline Slider with Incident Ticks */}
        <div className="relative flex items-center py-1">
          {/* Timeline background track */}
          <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-75"
              style={{ width: `${replay.progress * 100}%` }}
            />
          </div>

          {/* Incident tick dots along track */}
          <div className="absolute inset-x-0 pointer-events-none h-2">
            {window24hIncidents.map((inc) => {
              const incTime = Date.parse(inc.date);
              const pct = Math.max(0, Math.min(100, ((incTime - (now - 86_400_000)) / 86_400_000) * 100));
              const passed = incTime <= currentSimTime;
              return (
                <div
                  key={inc.id}
                  title={`${inc.victim} (${inc.country})`}
                  className={cn(
                    "absolute top-1/2 size-2 -translate-y-1/2 -translate-x-1/2 rounded-full border border-space",
                    passed ? "bg-white" : "bg-cyan-500/60",
                  )}
                  style={{ left: `${pct}%` }}
                />
              );
            })}
          </div>

          {/* Draggable scrubber input */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.002}
            value={replay.progress}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="absolute inset-0 h-4 w-full cursor-pointer opacity-0"
            aria-label="Replay timeline scrubber"
          />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="press flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-1.5 font-mono text-xs font-bold text-space shadow-md hover:bg-cyan-400"
          >
            {replay.playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
            <span>{replay.playing ? "PAUSE" : replay.progress >= 1 ? "REPLAY" : "PLAY"}</span>
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="press flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 font-mono text-xs text-ink-3 hover:text-ink"
            title="Restart replay from -24h"
          >
            <ArrowClockwise size={13} />
            <span>RESET</span>
          </button>

          {/* Speed selectors */}
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-space/60 p-0.5 font-mono text-[10.5px]">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeed(spd)}
                className={cn(
                  "rounded px-2 py-0.5 font-bold transition-colors",
                  replay.speed === spd ? "bg-cyan-500 text-space" : "text-ink-4 hover:text-ink",
                )}
              >
                {spd}X
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-ink-3">
            Attacks Landed: <strong className="text-cyan-400">{attacksPassedCount}</strong> / {window24hIncidents.length}
          </span>
        </div>
      </div>
    </div>
  );
}
