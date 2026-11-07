"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Compass, Crosshair, FilmSlate, MagnifyingGlass } from "@phosphor-icons/react";

import { AuthButton } from "@/components/auth/auth-button";
import { AudioButton } from "@/components/hud/audio-button";
import { DefconBadge } from "@/components/hud/defcon-badge";
import { RecordDemoButton } from "@/components/hud/record-demo";
import { BrandMark, GithubIcon } from "@/components/icons/agents";
import { ACCOUNTS } from "@/lib/mode";
import { REPO_URL } from "@/lib/site";
import { soundEngine } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";

/** `show` is the smallest screen an item appears on; "Am I affected?" is always there. */
const NAV = [
  { href: "/", label: "Map", show: "hidden md:flex" },
  { href: "/check", label: "Check", show: "flex" },
  { href: "/brief", label: "Brief", show: "hidden lg:flex" },
  { href: "/agents", label: "Agents", show: "hidden 2xl:flex" },
  ...(ACCOUNTS ? [{ href: "/pricing", label: "Pricing", show: "hidden 2xl:flex" }] : []),
];

function NavLinks({ pathname }: { pathname: string | null }) {
  return NAV.map((item) => {
    const active = pathname !== null && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={item.href === "/check" ? item.label : undefined}
        onClick={() => soundEngine.playClick()}
        className={cn(
          "press h-7 items-center whitespace-nowrap rounded-full px-2 text-[12px] transition-colors md:px-2.5",
          item.show,
          active ? "bg-white/[0.09] text-ink" : "text-ink-2 hover:text-ink",
        )}
      >
        {item.label}
      </Link>
    );
  });
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function TopBar({
  ticker,
  onOpenWargames,
  onOpenRecon,
  onOpenShortcuts,
  onOpenDemo,
  onTogglePatrol,
  isPatrolActive,
}: {
  ticker?: React.ReactNode;
  onOpenWargames?: () => void;
  onOpenRecon?: () => void;
  onOpenShortcuts?: () => void;
  onOpenDemo?: () => void;
  onTogglePatrol?: () => void;
  isPatrolActive?: boolean;
}) {
  return (
    <header className="pointer-events-auto flex h-14 items-center justify-between gap-3 bg-space/90 px-3 backdrop-blur-md border-b border-white/[0.06] sm:px-4">
      {/* Brand & Readiness Posture */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link
          href="/"
          onClick={() => soundEngine.playClick()}
          className="flex items-center gap-2 rounded-full py-1 pl-0.5 pr-2 transition-opacity hover:opacity-90"
          aria-label="Titan Cyber Command home"
        >
          <BrandMark className="size-[20px] text-cyan-400" />
          <span className="font-semicondensed text-[16px] font-bold tracking-tight text-ink sm:text-[18px]">
            Titan <span className="text-cyan-400">Cyber Command</span>
          </span>
        </Link>
        <DefconBadge />
      </div>

      {/* Center: Live CVE Ticker (Controlled width, never wraps) */}
      {ticker ? (
        <div className="hidden min-w-0 max-w-sm flex-1 xl:block 2xl:max-w-md">
          {ticker}
        </div>
      ) : null}

      {/* Right: Tactical Command Operations & Navigation */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Tactical Operations Segmented Dock */}
        <div className="glass-pill hidden items-center gap-0.5 rounded-full p-0.5 md:flex">
          {onOpenRecon && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenRecon();
              }}
              className="press flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] text-cyan-300 transition-colors hover:bg-cyan-500/15 hover:text-cyan-200"
              title="Launch Target Recon OSINT Scanner (R)"
              aria-label="Launch Target Recon OSINT Scanner"
            >
              <MagnifyingGlass size={12} weight="bold" />
              <span>RECON</span>
            </button>
          )}

          {onOpenWargames && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenWargames();
              }}
              className="press flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] text-confirmed transition-colors hover:bg-confirmed/15 hover:text-red-300"
              title="Launch WarGames Simulation (W)"
              aria-label="Launch WarGames Simulation"
            >
              <Crosshair size={12} weight="bold" />
              <span>WARGAMES</span>
            </button>
          )}

          {onTogglePatrol && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onTogglePatrol();
              }}
              className={cn(
                "press flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] transition-colors",
                isPatrolActive
                  ? "bg-cyan-500/25 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                  : "text-ink-3 hover:bg-white/10 hover:text-ink",
              )}
              title="Toggle Cinematic Auto-Patrol (P)"
              aria-label={isPatrolActive ? "Pause Cinematic Auto-Patrol" : "Start Cinematic Auto-Patrol"}
            >
              <Compass size={12} weight="bold" className={cn(isPatrolActive && "animate-spin [animation-duration:12s]")} />
              <span>{isPatrolActive ? "PATROLLING" : "PATROL"}</span>
            </button>
          )}

          {onOpenDemo && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenDemo();
              }}
              className="press flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] text-ink-2 transition-colors hover:bg-white/10 hover:text-ink"
              title="Watch Master 1080p Demo Video (V)"
              aria-label="Watch Master Demo Video"
            >
              <FilmSlate size={12} weight="bold" />
              <span>DEMO</span>
            </button>
          )}
        </div>

        <RecordDemoButton />

        <AudioButton />

        {onOpenShortcuts && (
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenShortcuts();
            }}
            className="press glass-pill hidden size-7 items-center justify-center rounded-full font-mono text-[12px] font-bold text-ink-3 transition-colors hover:bg-white/10 hover:text-ink md:flex"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
        )}

        <nav className="glass-pill flex items-center gap-0.5 rounded-full p-0.5">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden size-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-ink sm:flex"
            aria-label="Source code on GitHub"
          >
            <GithubIcon className="size-[15px]" />
          </a>
          {ACCOUNTS ? <AuthButton /> : null}
        </nav>
      </div>
    </header>
  );
}
