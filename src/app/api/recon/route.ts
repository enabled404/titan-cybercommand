import { NextResponse } from "next/server";
import { deriveApexDomain, normalizeReconDomain } from "@/lib/recon";

export const maxDuration = 15;

interface DnsAnswer {
  type: number;
  data: string;
}

interface DnsResponse {
  Status?: number;
  Answer?: DnsAnswer[];
}

async function fetchDnsRecord(name: string, type: "A" | "TXT" | "MX"): Promise<DnsResponse | null> {
  const enc = encodeURIComponent(name);
  const urls = [
    `https://dns.google/resolve?name=${enc}&type=${type}`,
    `https://cloudflare-dns.com/dns-query?name=${enc}&type=${type}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/dns-json",
          "User-Agent": "TitanCyberCommand-Recon/1.0",
        },
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        return (await res.json()) as DnsResponse;
      }
    } catch {
      // Try next provider
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDomain = searchParams.get("domain") ?? "";
  const domain = normalizeReconDomain(rawDomain);

  if (!domain) {
    return NextResponse.json({ error: "Invalid target domain name" }, { status: 400 });
  }

  const apexDomain = deriveApexDomain(domain);
  const isSubdomain = apexDomain !== domain;

  try {
    const [aRes, txtRes, dmarcRes, mxRes, apexTxtRes, apexDmarcRes] = await Promise.all([
      fetchDnsRecord(domain, "A"),
      fetchDnsRecord(domain, "TXT"),
      fetchDnsRecord(`_dmarc.${domain}`, "TXT"),
      fetchDnsRecord(domain, "MX"),
      isSubdomain ? fetchDnsRecord(apexDomain, "TXT") : Promise.resolve(null),
      isSubdomain ? fetchDnsRecord(`_dmarc.${apexDomain}`, "TXT") : Promise.resolve(null),
    ]);

    const anyAnswer = Boolean(aRes || txtRes || dmarcRes || mxRes || apexTxtRes || apexDmarcRes);
    if (!anyAnswer) {
      return NextResponse.json(
        { error: "Unable to reach passive DNS resolvers for this domain." },
        { status: 504 },
      );
    }

    const ips: string[] = [];
    for (const ans of aRes?.Answer ?? []) {
      if (ans.type === 1 || ans.type === 28) ips.push(ans.data);
    }

    const txtStrings: string[] = [];
    for (const ans of txtRes?.Answer ?? []) {
      if (ans.type === 16) txtStrings.push(String(ans.data).replace(/^"|"$/g, "").replace(/\\"/g, '"'));
    }

    const dmarcStrings: string[] = [];
    for (const ans of dmarcRes?.Answer ?? []) {
      if (ans.type === 16) dmarcStrings.push(String(ans.data).replace(/^"|"$/g, "").replace(/\\"/g, '"'));
    }

    const mxList: string[] = [];
    for (const ans of mxRes?.Answer ?? []) {
      if (ans.type === 15) {
        const parts = ans.data.split(" ");
        const host = (parts[parts.length - 1] || ans.data).replace(/\.$/, "");
        mxList.push(host);
      }
    }

    const nxdomain =
      aRes?.Status === 3 &&
      ips.length === 0 &&
      txtStrings.length === 0 &&
      mxList.length === 0 &&
      dmarcStrings.length === 0;

    if (!nxdomain && isSubdomain) {
      for (const ans of apexTxtRes?.Answer ?? []) {
        if (ans.type === 16) txtStrings.push(String(ans.data).replace(/^"|"$/g, "").replace(/\\"/g, '"'));
      }
      for (const ans of apexDmarcRes?.Answer ?? []) {
        if (ans.type === 16) dmarcStrings.push(String(ans.data).replace(/^"|"$/g, "").replace(/\\"/g, '"'));
      }
    }

    return NextResponse.json(
      {
        domain,
        apexDomain,
        nxdomain,
        ips: ips.slice(0, 6),
        mx: mxList.slice(0, 4),
        txt: txtStrings,
        dmarc: dmarcStrings,
        partial: !aRes || !txtRes || !dmarcRes || !mxRes,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Target reconnaissance resolution failed. Verify domain and try again." },
      { status: 502 },
    );
  }
}
