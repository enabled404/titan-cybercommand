"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Crosshair, MagnifyingGlass } from "@phosphor-icons/react";

import { AuthButton } from "@/components/auth/auth-button";
import { AudioButton } from "@/components/hud/audio-button";
import { RecordDemoButton } from "@/components/hud/record-demo";
import { BrandMark, GithubIcon, ValyuMark } from "@/components/icons/agents";
import { ACCOUNTS } from "@/lib/mode";
import { REPO_URL } from "@/lib/site";
import { soundEngine } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";

/** `show` is the smallest screen an item appears on; "Am I affected?" is always there. */
const NAV = [
  { href: "/", label: "Map", show: "hidden md:flex" },
  { href: "/check", label: "Am I affected?", show: "flex" },
  { href: "/brief", label: "Daily brief", show: "hidden md:flex" },
  { href: "/agents", label: "Agents", show: "hidden lg:flex" },
  ...(ACCOUNTS ? [{ href: "/pricing", label: "Pricing", show: "hidden lg:flex" }] : []),
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
          "press h-8 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] transition-colors md:px-3.5",
          item.show,
          active ? "bg-white/[0.09] text-ink" : "text-ink-2 hover:text-ink",
        )}
      >
        {item.href === "/check" ? (
          <>
            <span className="min-[390px]:hidden">Check</span>
            <span className="hidden min-[390px]:inline">{item.label}</span>
          </>
        ) : (
          item.label
        )}
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
}: {
  ticker?: React.ReactNode;
  onOpenWargames?: () => void;
  onOpenRecon?: () => void;
}) {
  return (
    <header className="pointer-events-auto flex min-h-[68px] flex-wrap items-center gap-x-2 bg-space pb-3.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.875rem,env(safe-area-inset-top))] sm:gap-x-4 sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))]">
      <Link
        href="/"
        onClick={() => soundEngine.playClick()}
        className="flex items-center gap-2.5 rounded-full py-1.5 pl-1 pr-2 sm:pr-3"
        aria-label="Titan Cyber Command home"
      >
        <BrandMark className="size-[22px] text-ink" />
        <span className="flex flex-col font-semicondensed font-bold leading-none tracking-[-0.01em] text-ink sm:flex-row sm:gap-[0.28em] sm:text-[19px]">
          <span className="font-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-ink-3 sm:font-semicondensed sm:text-[19px] sm:font-bold sm:normal-case sm:tracking-[-0.01em] sm:text-ink">
            Titan
          </span>
          <span className="mt-[3px] text-[17px] sm:mt-0 sm:text-[19px]">Cyber Command</span>
        </span>
      </Link>

      <a
        href="https://www.valyu.ai/?utm_source=globalhackmap&utm_medium=app&utm_campaign=topbar"
        target="_blank"
        rel="noreferrer"
        className={cn("-ml-2 hidden items-center gap-1.5 text-[12px] text-ink-4 transition-colors hover:text-ink-2", ticker ? "xl:flex" : "md:flex")}
      >
        built on <ValyuMark className="size-[10px]" /> Valyu
      </a>

      {ticker ? <div className="order-last mt-2.5 w-full min-w-0 md:hidden lg:order-none lg:mx-2 lg:mt-0 lg:block lg:w-auto lg:flex-1">{ticker}</div> : null}

      <div className="ml-auto flex items-center gap-1.5">
        {/* Tactical Interactive Action Triggers */}
        {onOpenRecon && (
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenRecon();
            }}
            className="press glass-pill hidden h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-mono text-cyan-300 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 md:flex"
            title="Launch Target Recon OSINT Scanner"
          >
            <MagnifyingGlass size={13} weight="bold" />
            <span className="uppercase tracking-wider">Target Recon</span>
          </button>
        )}

        {onOpenWargames && (
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenWargames();
            }}
            className="press glass-pill hidden h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-mono text-confirmed transition-colors hover:bg-confirmed/10 hover:text-red-300 md:flex"
            title="Launch WarGames Disaster Simulator"
          >
            <Crosshair size={13} weight="bold" />
            <span className="uppercase tracking-wider">WarGames</span>
          </button>
        )}

        <RecordDemoButton />

        <AudioButton />

        <nav className="glass-pill flex items-center gap-0.5 rounded-full p-1">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden size-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-white/[0.07] hover:text-ink sm:flex"
            aria-label="Source code on GitHub"
          >
            <GithubIcon className="size-[16px]" />
          </a>
          {ACCOUNTS ? <AuthButton /> : null}
        </nav>
      </div>
    </header>
  );
}
