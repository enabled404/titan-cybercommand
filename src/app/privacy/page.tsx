import type { Metadata } from "next";
import Link from "next/link";
import { SiteBar } from "@/components/hud/latest-cves";
import { LockKey } from "@phosphor-icons/react/ssr";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy and data governance practices for Titan Cyber Command.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-full bg-space text-ink pb-20">
      <SiteBar />
      <main className="mx-auto max-w-3xl px-6 pt-12">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <LockKey size={24} weight="bold" />
          </div>
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">DATA PRIVACY & ANONYMITY</span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Privacy Policy</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-3">
          Last revised: November 2026. Titan Cyber Command is engineered with privacy-by-design principles to protect threat intelligence analysts and visiting security teams.
        </p>

        <section className="mt-10 space-y-8 text-sm leading-relaxed text-ink-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">1. Zero-Log Target Inquiries</h2>
            <p className="mt-2 text-ink-3">
              When querying targets using the &quot;Am I affected?&quot; checker or Target Recon OSINT tool, inquiries are executed ephemerally. Titan Cyber Command does not store or log your proprietary technology stack, package dependencies, or inspected company domains on any persistent server.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink">2. Local Browser Storage</h2>
            <p className="mt-2 text-ink-3">
              We utilize local client storage (such as browser localStorage) solely to preserve your non-sensitive interface preferences across sessions:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-ink-3 pl-2">
              <li>DEFCON audio volume and mute state (`titan_audio_pref_v1`).</li>
              <li>Your saved local technology stack for live vulnerability highlighting.</li>
              <li>Preferred sidebar layout and map layer visibility toggles.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink">3. Upstream Telemetry Sources</h2>
            <p className="mt-2 text-ink-3">
              The platform connects to authoritative public feeds including CISA KEV, SEC EDGAR 8-K filings, IODA internet traffic monitors, NASA GIBS satellite raster layers, and public vulnerability registries. Data fetched from these services is cached globally via edge serverless instances to minimize network footprints and prevent tracking.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink">4. No Ad Trackers or Third-Party Brokers</h2>
            <p className="mt-2 text-ink-3">
              Titan Cyber Command contains zero commercial advertising tracking pixels, zero behavioural profiling scripts, and never sells or transmits intelligence data to third-party data brokers.
            </p>
          </div>
        </section>

        <div className="mt-12 border-t border-white/10 pt-6 flex justify-between items-center text-xs text-ink-4">
          <span>Copyright © 2026 Titan Cyber Command. All Rights Reserved.</span>
          <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
        </div>
      </main>
    </div>
  );
}
