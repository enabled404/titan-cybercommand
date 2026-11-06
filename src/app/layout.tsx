import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { Hubot_Sans, Martian_Mono, Mona_Sans } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";

import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { OutboundLinks } from "@/components/outbound-links";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ACCOUNTS } from "@/lib/mode";
import { SITE_URL } from "@/lib/site";

import "./globals.css";

// `subsets` picks what to preload. Latin-ext (accented names) is still declared with its unicode-range,
// so it downloads only on pages that render those glyphs instead of on every first visit.
// Mona Sans for reading, Hubot Sans (condensed) for numbers and titles, Martian Mono for labels and data.
// Geist Mono stays only as the glyph source for the ASCII art canvases, whose metrics were tuned to it.
const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });
const hubot = Hubot_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-hubot", display: "swap" });
const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Titan Cyber Command: Global Cyber Warfare & Real-Time Threat Intelligence Monitor",
    template: "%s | Titan Cyber Command",
  },
  description:
    "Global Kinetic Cyber Warfare & Real-Time Threat Intelligence Monitor. Every breach, kinetic cyber assault, ransomware attack, and exploited zero-day on Earth, live on an interactive 3D globe. Powered by Valyu.",
  applicationName: "Titan Cyber Command",
  keywords: [
    "cyber warfare map",
    "threat intelligence monitor",
    "live cyber attack globe",
    "data breach tracker",
    "ransomware tracker",
    "actively exploited vulnerabilities",
    "CISA KEV",
    "am I affected",
    "CVE monitoring",
    "subsea fiber optic cables",
    "defcon cyber command",
  ],
  openGraph: {
    type: "website",
    siteName: "Titan Cyber Command",
    title: "Titan Cyber Command: Global Cyber Warfare & Real-Time Threat Intelligence Monitor",
    description: "Every breach, kinetic cyber assault, ransomware attack and exploited vulnerability on Earth, live on a 3D ballistic globe.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Titan Cyber Command: Global Cyber Warfare & Real-Time Threat Intelligence Monitor",
    description: "Every breach, kinetic cyber assault, ransomware attack and exploited vulnerability on Earth, live on a 3D ballistic globe.",
  },
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: "Titan Cyber Command: cyber incidents" }] } },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${mona.variable} ${hubot.variable} ${martian.variable} ${GeistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full bg-space text-ink">
        <NuqsAdapter>
          <TooltipProvider delay={250}>{children}</TooltipProvider>
        </NuqsAdapter>
        {ACCOUNTS ? <SignInPrompt /> : null}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            className: "!bg-surface !border-hairline-2 !text-ink !rounded-[12px] !text-[13px] !shadow-2xl",
          }}
        />
        <Analytics />
        <OutboundLinks />
      </body>
    </html>
  );
}
