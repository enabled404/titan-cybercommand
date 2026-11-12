"use client";

import { DownloadSimple, FilmSlate, Lightning, ShieldCheck, VideoCamera, X } from "@phosphor-icons/react";

import { TacticalDialog } from "@/components/ui/tactical-dialog";
import { soundEngine } from "@/lib/audio/sound-engine";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DemoModal({ open, onClose }: Props) {
  const handleClose = () => {
    soundEngine.playClick();
    onClose();
  };

  return (
    <TacticalDialog open={open} onClose={handleClose} labelledBy="demo-modal-title" className="max-w-4xl max-h-[92dvh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <FilmSlate size={22} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400">MISSION BRIEFING & DEMO</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-ink-3">1080p 60FPS</span>
            </div>
            <h2 id="demo-modal-title" className="font-display text-lg font-bold text-ink">
              Titan Cyber Command Briefing
            </h2>
          </div>
        </div>
        <button
          type="button"
          data-autofocus
          onClick={handleClose}
          className="flex min-h-9 min-w-9 items-center justify-center rounded-full p-1 text-ink-3 transition-colors hover:bg-white/10 hover:text-ink"
          aria-label="Close Mission Briefing"
        >
          <X size={20} />
        </button>
      </div>

      {/* Modal Body */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-6 scrollbar-thin">
        {/* Video Player (muted enables reliable native autoplay across modern browsers; light PNG poster avoids fetching 12 MB GIF upfront) */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/15 bg-black shadow-[0_0_40px_rgba(0,0,0,0.9)]">
          <video
            poster="/docs/screenshot.png"
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Titan Cyber Command 1080p walkthrough preview"
            className="h-full w-full object-contain"
          >
            <source src="/docs/demo.mp4" type="video/mp4" />
            <source src="/docs/demo.webm" type="video/webm" />
            Your browser does not support high-definition HTML5 video playback.
          </video>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-4">
          Silent mission walkthrough showcasing live 3D threat telemetry, geodesic ballistic arcs, WarGames contagion cascade modeling, and passive OSINT domain profiling.
        </p>

        {/* Quick Download Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <VideoCamera size={18} className="text-cyan-400" />
            <span className="font-mono text-xs text-ink-2">Export Master Artifacts for Briefings & Presentations</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/docs/demo.mp4"
              download="titan-cybercommand-demo-1080p.mp4"
              onClick={() => soundEngine.playClick()}
              className="press flex min-h-8 items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 font-mono text-[11.5px] font-bold text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              <DownloadSimple size={14} weight="bold" /> Download MP4 (4.1 MB)
            </a>
            <a
              href="/docs/demo.gif"
              download="titan-cybercommand-preview.gif"
              onClick={() => soundEngine.playClick()}
              className="press flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 font-mono text-[11.5px] text-ink-2 transition-colors hover:bg-white/10 hover:text-ink"
            >
              <DownloadSimple size={14} weight="bold" /> Animated GIF (9.4 MB)
            </a>
            <a
              href="/docs/demo.webm"
              download="titan-cybercommand-master.webm"
              onClick={() => soundEngine.playClick()}
              className="press flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 font-mono text-[11.5px] text-ink-2 transition-colors hover:bg-white/10 hover:text-ink"
            >
              <DownloadSimple size={14} weight="bold" /> WebM Master (7.8 MB)
            </a>
          </div>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-surface-2 p-3.5">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-confirmed">
              <Lightning size={14} weight="bold" />
              <span>3D Ballistic Kinetic Arcs</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              Calculates real-time geodesic ballistic laser trajectories across Earth coordinates with stereo spatial audio and ground impact shockwaves.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-2 p-3.5">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400">
              <ShieldCheck size={14} weight="bold" />
              <span>WarGames Contagion Simulator</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              Models cascading systemic failures across global power grids, submarine fiber routes, satellite constellations, and banking clearing systems.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-2 p-3.5">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400">
              <FilmSlate size={14} weight="bold" />
              <span>Target Recon OSINT Profiler</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              Queries passive public DNS records, SPF/DMARC enforcement, and live snapshot incident and CVE correlations with one-click presets.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-2 p-3.5">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-400">
              <ShieldCheck size={14} weight="bold" />
              <span>Multi-Stream Threat Ingestion</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              Aggregates live incident streams from CISA KEV, SEC 8-K filings, IODA global internet outages, GitHub malicious packages, and NVD.
            </p>
          </div>
        </div>

        {/* Legal Protection & Safe Harbor */}
        <div className="rounded-xl border border-white/10 bg-white/[0.015] p-3.5 text-[11px] leading-relaxed text-ink-4">
          <span className="font-mono uppercase tracking-wider text-ink-3">DEFENSIVE SAFE HARBOR & LEGAL RIGHTS: </span>
          Titan Cyber Command is engineered strictly for authorized cybersecurity research, defensive threat intelligence, and vulnerability prioritization. All telemetry is aggregated from public OSINT, regulatory disclosures, and authoritative registries. All rights reserved © 2026 Titan Cyber Command.
        </div>
      </div>
    </TacticalDialog>
  );
}
