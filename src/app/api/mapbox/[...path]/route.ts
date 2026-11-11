import { NextResponse } from "next/server";

import { buildMapboxProxyUrl } from "@/lib/http/mapbox-proxy";
import { SITE_URL } from "@/lib/site";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const url = new URL(request.url);
  const serverToken = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const target = buildMapboxProxyUrl(path, url.search, serverToken);
  if (!target) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Referer: process.env.MAPBOX_PROXY_REFERER || `${SITE_URL.replace(/\/$/, "")}/`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
        Accept: request.headers.get("accept") ?? "*/*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.replace(/access_token=[^&\s]+/gi, "access_token=[redacted]") : "upstream error";
    console.error("[Mapbox Proxy Error]", message);
    return new NextResponse(null, { status: 502 });
  }
}
