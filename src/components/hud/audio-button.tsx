"use client";

import { SpeakerHigh, SpeakerSimpleSlash } from "@phosphor-icons/react";
import { useAudioStore } from "@/stores/audio";
import { cn } from "@/lib/utils";

export function AudioButton() {
  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  return (
    <button
      onClick={() => {
        toggleMute();
      }}
      className={cn(
        "press flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-mono transition-colors md:px-3",
        !muted
          ? "border border-confirmed/30 bg-confirmed/10 text-confirmed shadow-[0_0_12px_rgba(255,74,61,0.2)]"
          : "text-ink-3 hover:bg-white/[0.07] hover:text-ink",
      )}
      title={muted ? "Enable Tactical Audio Engine (DEFCON Synthesizer)" : "Mute Audio Engine"}
      aria-label={muted ? "Enable Tactical Audio Engine" : "Mute Audio Engine"}
    >
      {!muted ? (
        <>
          <SpeakerHigh className="size-4 animate-pulse text-confirmed" weight="fill" />
          <span className="hidden items-center gap-0.5 sm:flex">
            <span className="inline-block h-2 w-0.5 animate-[bounce_0.6s_infinite_100ms] bg-confirmed" />
            <span className="inline-block h-3.5 w-0.5 animate-[bounce_0.6s_infinite_200ms] bg-confirmed" />
            <span className="inline-block h-1.5 w-0.5 animate-[bounce_0.6s_infinite_300ms] bg-confirmed" />
          </span>
          <span className="hidden font-mono text-[10.5px] uppercase tracking-wider min-[980px]:inline">AUDIO ON</span>
        </>
      ) : (
        <>
          <SpeakerSimpleSlash className="size-4 text-ink-3" />
          <span className="hidden font-mono text-[10.5px] uppercase tracking-wider text-ink-4 min-[980px]:inline">AUDIO OFF</span>
        </>
      )}
    </button>
  );
}
