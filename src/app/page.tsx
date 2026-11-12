import type { Metadata } from "next";
import { Suspense } from "react";
import { preconnect } from "react-dom";

import { SituationRoom } from "@/components/situation-room";
import { getSnapshot, toClientSnapshot } from "@/lib/snapshot";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  // The globe's open vector tiles/glyphs (OpenFreeMap) and night lights (NASA GIBS) are fetched
  // with CORS once the map chunk runs. Opening those connections early takes DNS and TLS off that path.
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  preconnect("https://gibs.earthdata.nasa.gov", { crossOrigin: "anonymous" });
  const snapshot = await getSnapshot();
  return (
    <Suspense fallback={null}>
      <SituationRoom snapshot={toClientSnapshot(snapshot)} />
    </Suspense>
  );
}
