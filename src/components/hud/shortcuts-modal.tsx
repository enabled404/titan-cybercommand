"use client";

import { Command, Keyboard, X } from "@phosphor-icons/react";
import { soundEngine } from "@/lib/audio/sound-engine";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "W", desc: "Launch WarGames cascading disaster simulator" },
  { key: "R", desc: "Launch Target Recon passive OSINT scanner" },
  { key: "V", desc: "Watch master demo briefing video & export artifacts" },
  { key: "P / C", desc: "Toggle Cinematic Auto-Patrol / Panoramic view" },
  { key: "T", desc: "Toggle Live Combat Intercept Telemetry drawer" },
  { key: "M", desc: "Toggle procedural DEFCON sound engine" },
  { key: "J / K", desc: "Step forward / backward through live incidents" },
  { key: "Space", desc: "Center on next active threat blip" },
  { key: "Esc", desc: "Clear active dossier or dismiss open modal" },
  { key: "?", desc: "Display this tactical keybindings guide" },
];

export function ShortcutsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-surface-2 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-ink">
              <Keyboard size={20} weight="bold" />
            </div>
            <div>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-4">TACTICAL OPERATOR HOTKEYS</span>
              <h2 id="shortcuts-modal-title" className="font-display text-lg font-bold text-ink">Keyboard Shortcuts</h2>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="rounded-full p-1 text-ink-3 transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6">
          <div className="space-y-2.5">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5"
              >
                <span className="text-xs text-ink-2 font-sans">{s.desc}</span>
                <kbd className="flex h-6 min-w-6 items-center justify-center rounded border border-white/20 bg-surface-2 px-2 font-mono text-[11px] font-bold text-ink shadow-inner">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4 font-mono text-[11px] text-ink-4">
            <span className="flex items-center gap-1.5">
              <Command size={14} /> Titan Cyber Command Terminal v2.6
            </span>
            <button
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="text-cyan-400 hover:underline"
            >
              Dismiss (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
