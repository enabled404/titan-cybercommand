import type { Metadata } from "next";
import Link from "next/link";
import { SiteBar } from "@/components/hud/latest-cves";
import { ShieldCheck } from "@phosphor-icons/react/ssr";

export const metadata: Metadata = {
  title: "Terms of Service & Defensive Safe Harbor",
  description: "Terms of service, ethical research safe harbor, incident status rules, and legal protections for Titan Cyber Command.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-full bg-space text-ink pb-20">
      <SiteBar />
      <main className="mx-auto max-w-3xl px-6 pt-12">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <ShieldCheck size={24} weight="bold" />
          </div>
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-cyan-400">LEGAL COMPLIANCE & GOVERNANCE</span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">Terms of Service & Safe Harbor</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-3">
          Last revised: November 2026. By accessing or utilizing Titan Cyber Command, you agree to these Terms of Service. If you do not agree, do not access or use the platform.
        </p>

        <section className="mt-10 space-y-8 text-sm leading-relaxed text-ink-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">1. Defensive Security Research & Purpose</h2>
            <p className="mt-2 text-ink-3">
              Titan Cyber Command is operated strictly for defensive threat intelligence, incident response triage, vulnerability patching prioritization, and public cyber resilience education. Under no circumstances may any intelligence or tooling provided on this platform be weaponized for unauthorized penetration, exploitation, reconnaissance, or disruptive cyber actions against any third party.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink">2. Honest Reporting & Sourcing Integrity</h2>
            <p className="mt-2 text-ink-3">
              To preserve truth and journalistic integrity, incident data is strictly delineated across five operational classifications:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-ink-3 pl-2">
              <li><strong className="text-ink">Confirmed:</strong> Formally verified by victim organisations, regulators (such as SEC 8-K filings), or law enforcement.</li>
              <li><strong className="text-ink">Reported:</strong> Documented by credible investigative news agencies, national cybersecurity agencies (CISA KEV), or vendor advisories.</li>
              <li><strong className="text-ink">Claimed:</strong> Unverified extortion announcements published on dark-web ransomware leak blogs. An allegation is never presented as an established breach.</li>
              <li><strong className="text-ink">Precautionary:</strong> Temporary defensive isolations or system shutdowns executed proactively during incident containment.</li>
              <li><strong className="text-ink">Disputed:</strong> Public claims actively rebutted by the target or confirmed as mistaken identity.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink">3. Limitation of Liability &amp; &quot;As Is&quot; Warranty Waiver</h2>
            <p className="mt-2 text-ink-3">
              All intelligence, vulnerability metrics (CVSS, EPSS), kinetic simulation trajectories, and OSINT recon outputs are compiled on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. Titan Cyber Command expressly disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. In no event shall Titan Cyber Command or its operators be held liable for any damages resulting from operational decisions made based on this telemetry.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink">4. Intellectual Property & Attribution</h2>
            <p className="mt-2 text-ink-3">
              The Titan Cyber Command platform, interface architecture, ballistic kinetic engine, custom procedural audio synthesizers, and analytical models are Copyright © 2026 Titan Cyber Command. All Rights Reserved. Open-source global threat mapping concepts are acknowledged for architectural inspiration.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink">5. Contact & Incident Corrections</h2>
            <p className="mt-2 text-ink-3">
              If an organisation or security team identifies an inaccurate dark-web claim or requires an incident review, submit documentation via GitHub issues or our security contact channel for expedited reassessment.
            </p>
          </div>
        </section>

        <div className="mt-12 border-t border-white/10 pt-6 flex justify-between items-center text-xs text-ink-4">
          <span>Copyright © 2026 Titan Cyber Command. All Rights Reserved.</span>
          <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
