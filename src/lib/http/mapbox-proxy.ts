const ALLOWED_MAPBOX_PREFIXES = new Set([
  "styles",
  "v4",
  "fonts",
  "sprites",
  "models",
  "tilesets",
  "raster",
  "rasterarrays",
  "mapbox-terrain",
  "map-sessions",
]);

// Mapbox GL decodes font stacks containing spaces ("DIN Offc Pro Medium,Arial Unicode MS Regular")
// and retina suffixes ("sprite@2x.png"), while never needing traversal, %, \, ?, #, or host-style @.
const SAFE_SEGMENT = /^[A-Za-z0-9._~!,= +-]{1,256}(?:@[1-9]x(?:\.[A-Za-z0-9]{1,8})?)?$/;

/**
 * Validates and builds an `api.mapbox.com` target URL from `[...path]` route segments.
 * Prevents path traversal, credential-endpoint proxying, and SSRF host confusion.
 */
export function buildMapboxProxyUrl(segments: readonly string[] | undefined, rawSearch: string, serverToken?: string): URL | null {
  if (!segments || segments.length === 0 || segments.length > 16) return null;

  const decoded: string[] = [];
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed || trimmed === "." || trimmed === ".." || seg.includes("..") || seg.includes("%") || !SAFE_SEGMENT.test(seg)) {
      return null;
    }
    decoded.push(seg);
  }

  if (!ALLOWED_MAPBOX_PREFIXES.has(decoded[0])) return null;

  const joined = decoded.join("/");
  if (joined.length > 1024) return null;

  if (rawSearch && !rawSearch.startsWith("?")) return null;

  let target: URL;
  try {
    target = new URL(`https://api.mapbox.com/${joined}${rawSearch}`);
  } catch {
    return null;
  }

  let normalizedPath = "";
  try {
    normalizedPath = decodeURIComponent(target.pathname);
  } catch {
    return null;
  }

  if (
    target.origin !== "https://api.mapbox.com" ||
    target.username !== "" ||
    target.password !== "" ||
    target.hash !== "" ||
    normalizedPath !== `/${joined}`
  ) {
    return null;
  }

  if (!target.searchParams.get("access_token")?.trim() && serverToken) {
    target.searchParams.set("access_token", serverToken);
  }

  return target;
}
