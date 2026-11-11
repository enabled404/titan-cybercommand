"use client";

import { SpeakerHigh, SpeakerSimpleSlash } from "@phosphor-icons/react";
import { useAudioStore } from "@/stores/audio";
import { cn } from "@/lib/utils";

export function AudioButton() {
  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  return (
    <button
      type="button"
      onClick={() => {
        toggleMute();
      }}
      className={cn(
        "press flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-mono transition-colors md:px-2.5",
        !muted
          ? "border border-confirmed/30 bg-confirmed/10 text-confirmed shadow-[0_0_12px_rgba(255,74,61,0.2)]"
          : "text-ink-3 hover:bg-white/[0.07] hover:text-ink",
      )}
      title={muted ? "Enable Tactical Audio Engine (DEFCON Synthesizer)" : "Mute Audio Engine"}
      aria-label={muted ? "Enable Tactical Audio Engine" : "Mute Audio Engine"}
    >
      {!muted ? (
        <>
          <SpeakerHigh className="size-3.5 text-confirmed motion-safe:animate-pulse" weight="fill" />
          <span className="flex items-center gap-0.5">
            <span className="inline-block h-2 w-0.5 bg-confirmed motion-safe:animate-[bounce_0.6s_infinite_100ms]" />
            <span className="inline-block h-3 w-0.5 bg-confirmed motion-safe:animate-[bounce_0.6s_infinite_200ms]" />
            <span className="inline-block h-1.5 w-0.5 bg-confirmed motion-safe:animate-[bounce_0.6s_infinite_300ms]" />
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-wider xl:inline">AUDIO</span>
        </>
      ) : (
        <>
          <SpeakerSimpleSlash className="size-3.5 text-ink-3" />
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-ink-4 xl:inline">MUTED</span>
        </>
      )}
    </button>
  );
}
