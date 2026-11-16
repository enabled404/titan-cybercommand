"use client";

import { ShieldCheck, X } from "@phosphor-icons/react";

import { AmIAffectedHero } from "@/components/hud/am-i-affected-hero";
import { TacticalDialog } from "@/components/ui/tactical-dialog";
import { soundEngine } from "@/lib/audio/sound-engine";
import type { Snapshot } from "@/lib/types";

export function AmIAffectedModal({
  open,
  onClose,
  snapshot,
}: {
  open: boolean;
  onClose: () => void;
  snapshot: Snapshot;
}) {
  const handleClose = () => {
    soundEngine.playClick();
    onClose();
  };

  if (!open) return null;

  return (
    <TacticalDialog
      open={open}
      onClose={handleClose}
      labelledBy="am-i-affected-modal-title"
      className="max-w-2xl overflow-hidden rounded-[24px] border border-cyan-500/40 bg-space p-5 text-ink shadow-2xl backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} weight="bold" className="text-cyan-400" />
          <h2 id="am-i-affected-modal-title" className="font-mono text-sm font-bold uppercase tracking-wider text-ink">
            AM I AFFECTED? // DOMAIN EXPOSURE SCANNER
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full p-1 text-ink-4 hover:bg-white/10 hover:text-ink"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 max-h-[75vh] overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
        <AmIAffectedHero snapshot={snapshot} isModal onClose={handleClose} />
      </div>
    </TacticalDialog>
  );
}
