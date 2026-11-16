"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, DownloadSimple, ShareNetwork, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { TacticalDialog } from "@/components/ui/tactical-dialog";
import { soundEngine } from "@/lib/audio/sound-engine";
import { countryName } from "@/lib/countries";
import { recordsLabel, shortDate, TYPE_LABEL } from "@/lib/format";
import type { Incident } from "@/lib/types";

export function ShareCardModal({
  incident,
  open,
  onClose,
}: {
  incident: Incident | null;
  open: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !incident) return;

    let mounted = true;
    const renderCard = async () => {
      setGenerating(true);
      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }
        if (!mounted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 2x Retina resolution: 2400 x 1260
        const w = 2400;
        const h = 1260;
        canvas.width = w;
        canvas.height = h;

        // 1. Deep Obsidian Space Background
        ctx.fillStyle = "#07090e";
        ctx.fillRect(0, 0, w, h);

        // 2. Cyber Command Tactical Grid & Hex/Dot Texture
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1.5;
        const gridSize = 60;
        for (let x = 0; x <= w; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // Ambient cyber radial vignette
        const grad = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w / 1.3);
        grad.addColorStop(0, "rgba(6, 182, 212, 0.08)");
        grad.addColorStop(0.5, "rgba(15, 23, 42, 0.4)");
        grad.addColorStop(1, "rgba(7, 9, 14, 0.95)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 3. Cyber Corner Brackets & Crosshairs
        const drawCross = (cx: number, cy: number) => {
          ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx - 16, cy);
          ctx.lineTo(cx + 16, cy);
          ctx.moveTo(cx, cy - 16);
          ctx.lineTo(cx, cy + 16);
          ctx.stroke();
        };
        drawCross(80, 80);
        drawCross(w - 80, 80);
        drawCross(80, h - 80);
        drawCross(w - 80, h - 80);

        // 4. Header Banner
        // Radar Dot & Brand
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(120, 120, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 28px 'Martian Mono', monospace";
        ctx.fillStyle = "#22d3ee";
        ctx.fillText("TITAN CYBER COMMAND", 150, 128);

        ctx.font = "22px 'Martian Mono', monospace";
        ctx.fillStyle = "#64748b";
        ctx.fillText("// THREAT INTELLIGENCE DOSSIER", 640, 128);

        // Status pill on top right
        const statusText =
          incident.status === "confirmed"
            ? "[CONFIRMED BREACH]"
            : incident.status === "reported"
              ? "[PRESS REPORTED]"
              : "[THREAT ACTOR CLAIM]";
        const statusColor =
          incident.status === "confirmed"
            ? "#ef4444"
            : incident.status === "reported"
              ? "#f59e0b"
              : "#94a3b8";

        ctx.font = "bold 26px 'Martian Mono', monospace";
        ctx.fillStyle = statusColor;
        ctx.textAlign = "right";
        ctx.fillText(statusText, w - 120, 128);
        ctx.textAlign = "left";

        // Divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(120, 160);
        ctx.lineTo(w - 120, 160);
        ctx.stroke();

        // 5. Main Target / Victim Details
        ctx.font = "bold 26px 'Martian Mono', monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("TARGET / VICTIM ORGANISATION", 120, 240);

        // Victim Name (Huge, responsive scaling)
        const victimName = incident.victim.toUpperCase();
        let fontSize = 76;
        ctx.font = `bold ${fontSize}px sans-serif`;
        while (ctx.measureText(victimName).width > w - 240 && fontSize > 36) {
          fontSize -= 4;
          ctx.font = `bold ${fontSize}px sans-serif`;
        }
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(victimName, 120, 330);

        // Sector & Geographic Location
        const country = incident.country ? countryName(incident.country) : "GLOBAL";
        const sector = incident.sector ? incident.sector.toUpperCase() : "COMMERCIAL ENTERPRISE";
        ctx.font = "32px sans-serif";
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(`${sector} · ${country.toUpperCase()} (${incident.country || "INTL"})`, 120, 390);

        // 6. Threat Actor & Vector Box
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fillRect(120, 440, w - 240, 220);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 2;
        ctx.strokeRect(120, 440, w - 240, 220);

        // Threat Actor
        const actorName = incident.actor ? incident.actor.toUpperCase() : "UNKNOWN THREAT ACTOR";
        ctx.font = "bold 24px 'Martian Mono', monospace";
        ctx.fillStyle = "#d946ef";
        ctx.fillText("THREAT ACTOR / ADVERSARY", 160, 495);

        ctx.font = "bold 44px sans-serif";
        ctx.fillStyle = "#fdf4ff";
        ctx.fillText(actorName, 160, 555);

        ctx.font = "26px sans-serif";
        ctx.fillStyle = "#c084fc";
        ctx.fillText(`Attack Vector: ${TYPE_LABEL[incident.type]}`, 160, 605);

        // 7. Key Metric Callout (Right side of Box)
        const metricColX = w - 680;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(metricColX - 40, 460);
        ctx.lineTo(metricColX - 40, 640);
        ctx.stroke();

        ctx.font = "bold 24px 'Martian Mono', monospace";
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("KEY IMPACT METRIC", metricColX, 495);

        const recLabel = recordsLabel(incident);
        const metricText =
          incident.cves && incident.cves.length > 0
            ? incident.cves[0]
            : recLabel && recLabel !== "Records unstated"
              ? recLabel.toUpperCase()
              : incident.status === "confirmed"
                ? "DEFCON 1 CRITICAL"
                : "ACTIVE EXPLOITATION";

        ctx.font = "bold 44px 'Martian Mono', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(metricText, metricColX, 555);

        ctx.font = "24px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(incident.cves?.[0] ? "Exploited Vulnerability" : "Verified Impact Assessment", metricColX, 605);

        // 8. Incident Summary Narrative
        ctx.font = "bold 24px 'Martian Mono', monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("TACTICAL INTELLIGENCE BRIEF", 120, 725);

        ctx.font = "34px sans-serif";
        ctx.fillStyle = "#e2e8f0";
        const briefText = incident.summary ? incident.summary : incident.title;
        // Clean markdown links or formatting if present
        const cleanText = briefText.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#]/g, "");
        const words = cleanText.split(" ");
        let line = "";
        let lineY = 780;
        for (const word of words) {
          const testLine = line + word + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > w - 240 && line !== "") {
            ctx.fillText(line, 120, lineY);
            line = word + " ";
            lineY += 50;
            if (lineY > 980) break;
          } else {
            line = testLine;
          }
        }
        if (line && lineY <= 980) {
          ctx.fillText(line, 120, lineY);
        }

        // 9. Footer Security Metadata Bar
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(120, 1080);
        ctx.lineTo(w - 120, 1080);
        ctx.stroke();

        ctx.font = "bold 24px 'Martian Mono', monospace";
        ctx.fillStyle = "#64748b";
        ctx.fillText(`INCIDENT DATE: ${shortDate(incident.date).toUpperCase()}`, 120, 1135);

        const sourceCount = incident.sources.length;
        ctx.fillText(`VERIFIED SOURCES: ${sourceCount} REPUTABLE OUTLETS`, 580, 1135);

        // URL Watermark
        ctx.textAlign = "right";
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("TITAN-CYBERCOMMAND.VERCEL.APP", w - 120, 1135);
        ctx.textAlign = "left";

        // Convert canvas to image data URL for instant preview
        if (mounted) {
          setImageUrl(canvas.toDataURL("image/png"));
        }
      } catch {
        toast.error("Failed to generate social incident card");
      } finally {
        if (mounted) setGenerating(false);
      }
    };

    void renderCard();

    return () => {
      mounted = false;
    };
  }, [open, incident]);

  const handleClose = () => {
    setImageUrl(null);
    onClose();
  };

  if (!open || !incident) return null;

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    soundEngine.playClick();
    const slug = incident.victim.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const link = document.createElement("a");
    link.download = `titan-${slug}-incident-card.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Card downloaded successfully");
  };

  const copyCardImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    soundEngine.playClick();
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          "image/png": new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to create PNG blob"));
            }, "image/png");
          }),
        });
        await navigator.clipboard.write([item]);
        setCopied(true);
        toast.success("Image copied to clipboard! Ready to paste into X, Slack, or Discord.");
        window.setTimeout(() => setCopied(false), 2500);
      } else {
        downloadCard();
      }
    } catch {
      toast("Direct clipboard copy restricted by browser permissions. Downloading PNG instead.");
      downloadCard();
    }
  };

  const xPostUrl = `https://x.com/intent/post?text=${encodeURIComponent(
    `Cyber incident alert: ${incident.victim} (${incident.actor ? `claimed by ${incident.actor}` : "breach confirmed"}).\n\nFull intel & live attack arcs via Titan Cyber Command:`,
  )}&url=${encodeURIComponent(`https://titan-cybercommand.vercel.app/incident/${incident.id}`)}`;

  return (
    <TacticalDialog
      open={open}
      onClose={handleClose}
      labelledBy="share-card-title"
      className="max-w-3xl overflow-hidden rounded-[22px] border border-white/10 bg-space p-5 text-ink shadow-2xl backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <ShareNetwork size={18} className="text-cyan-400" />
          <h2 id="share-card-title" className="font-mono text-sm font-bold uppercase tracking-wider text-ink">
            EXPORT SOCIAL INCIDENT CARD
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full p-1 text-ink-4 hover:bg-white/10 hover:text-ink"
          aria-label="Close modal"
        >
          <X size={16} />
        </button>
      </div>

      {/* Card Preview */}
      <div className="mt-4 flex flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/60 p-2 shadow-inner">
        <canvas ref={canvasRef} className="hidden" />
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Titan Threat Intel Card for ${incident.victim}`}
            className="w-full max-h-[380px] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center font-mono text-xs text-ink-4">
            {generating ? "Rendering high-DPI cyber social card..." : "Preparing dossier..."}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadCard}
            className="press flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 font-mono text-xs font-bold text-space shadow-md hover:bg-cyan-400"
          >
            <DownloadSimple size={15} weight="bold" />
            <span>DOWNLOAD PNG (1200x630)</span>
          </button>
          <button
            type="button"
            onClick={copyCardImage}
            className="press flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 font-mono text-xs font-semibold text-ink transition-colors hover:bg-white/10"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? "COPIED IMAGE" : "COPY IMAGE"}</span>
          </button>
        </div>

        <a
          href={xPostUrl}
          target="_blank"
          rel="noreferrer"
          className="press flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-mono text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
        >
          <span>POST ON X</span>
        </a>
      </div>
    </TacticalDialog>
  );
}
