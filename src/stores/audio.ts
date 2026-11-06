"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { soundEngine } from "@/lib/audio/sound-engine";

interface AudioStore {
  muted: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (v: number) => void;
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set, get) => ({
      muted: true, // Default muted per browser autoplay policy
      volume: 0.4,
      toggleMute: () => {
        const next = !get().muted;
        soundEngine.setMuted(next);
        if (!next) {
          soundEngine.playAlert();
        }
        set({ muted: next });
      },
      setVolume: (v: number) => {
        soundEngine.setVolume(v);
        set({ volume: v });
      },
    }),
    {
      name: "titan_audio_pref_v1",
      onRehydrateStorage: () => (state) => {
        if (state && !state.muted) {
          // Keep muted on hard reload until user interacts to satisfy browser security
          soundEngine.setMuted(true);
        }
      },
    },
  ),
);
