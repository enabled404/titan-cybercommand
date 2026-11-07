"use client";

import { create } from "zustand";

export interface CombatIntercept {
  id: string;
  timestamp: string;
  origin: string;
  originCountry: string;
  target: string;
  targetCountry: string;
  vector: string;
  severity: 1 | 2 | 3 | 4;
  color: string;
  status: "ENGAGED" | "INTERCEPTED" | "SINKHOLED" | "CONTAINED";
}

interface CombatFeedState {
  intercepts: CombatIntercept[];
  totalIntercepted: number;
  attacksPerSec: number;
  isOpen: boolean;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  addIntercept: (item: Omit<CombatIntercept, "id" | "timestamp">) => string;
  updateStatus: (id: string, status: CombatIntercept["status"]) => void;
}

export const useCombatFeed = create<CombatFeedState>((set) => ({
  intercepts: [],
  totalIntercepted: 14820,
  attacksPerSec: 18.4,
  isOpen: false,
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  addIntercept: (item) => {
    const id = `cb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(Math.floor(now.getMilliseconds() / 10)).padStart(2, "0")}`;

    const newIntercept: CombatIntercept = {
      ...item,
      id,
      timestamp,
    };

    set((state) => ({
      intercepts: [newIntercept, ...state.intercepts.slice(0, 49)],
      totalIntercepted: state.totalIntercepted + 1,
      attacksPerSec: Number((16 + Math.random() * 8).toFixed(1)),
    }));

    return id;
  },
  updateStatus: (id, status) => {
    set((state) => ({
      intercepts: state.intercepts.map((i) => (i.id === id ? { ...i, status } : i)),
    }));
  },
}));
