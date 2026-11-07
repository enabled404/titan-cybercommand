import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!path || !path.length) {
    return new NextResponse(null, { status: 400 });
  }

  const pathStr = path.join("/");
  const url = new URL(request.url);
  if (!url.searchParams.has("access_token") && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    url.searchParams.set("access_token", process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  }
  const search = url.search;
  const target = `https://api.mapbox.com/${pathStr}${search}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        Referer: "https://globalhackmap.vercel.app/",
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
    console.error("[Mapbox Proxy Error]", err);
    return new NextResponse(null, { status: 502 });
  }
}
