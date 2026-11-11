"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[GlobeErrorBoundary] Caught Mapbox GL runtime exception:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-space p-6 text-center select-none pointer-events-none">
          <div className="relative flex items-center justify-center">
            {/* Holographic Radar Ring */}
            <div className="h-64 w-64 rounded-full border border-cyan-500/30 motion-safe:animate-spin [animation-duration:14s] flex items-center justify-center">
              <div className="h-48 w-48 rounded-full border border-dashed border-red-500/30 motion-safe:animate-spin [animation-duration:8s] [animation-direction:reverse]" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-mono text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 motion-safe:animate-pulse" />
                TACTICAL RADAR TELEMETRY ACTIVE
              </div>
              <p className="mt-2 text-xs font-mono text-neutral-400 max-w-sm">
                Mapbox GL satellite mesh initializing or fell back to telemetry radar feed. Threat streams and missile interception engines remain fully operational.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
