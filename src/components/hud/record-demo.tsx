"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StopCircle, VideoCamera } from "@phosphor-icons/react";
import { toast } from "sonner";

import { soundEngine } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";

function effectiveZIndex(el: Element): number {
  let maxZ = 0;
  let cur: Element | null = el;
  while (cur && cur.tagName !== "MAIN" && cur !== document.body) {
    const z = Number.parseFloat(getComputedStyle(cur).zIndex);
    if (Number.isFinite(z)) {
      maxZ = z;
    }
    cur = cur.parentElement;
  }
  return maxZ;
}

function collectOrderedCanvases(): HTMLCanvasElement[] {
  return Array.from(document.querySelectorAll("canvas"))
    .map((canvas, idx) => {
      const style = getComputedStyle(canvas);
      const visible =
        canvas.isConnected &&
        canvas.width > 0 &&
        canvas.height > 0 &&
        canvas.clientWidth > 0 &&
        canvas.clientHeight > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity || "1") > 0;
      return { canvas, idx, visible, z: visible ? effectiveZIndex(canvas) : 0 };
    })
    .filter((entry) => entry.visible)
    .sort((a, b) => a.z - b.z || a.idx - b.idx)
    .map((entry) => entry.canvas);
}

export function RecordDemoButton() {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const cleanupStreams = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    cleanupStreams();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [cleanupStreams]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      }
      cleanupStreams();
    };
  }, [cleanupStreams]);

  const startRecording = async () => {
    try {
      const initialCanvases = collectOrderedCanvases();
      if (initialCanvases.length === 0) {
        toast.error("No active tactical map canvas available to record.");
        return;
      }

      if (typeof MediaRecorder === "undefined") {
        toast.error("In-browser video capture is not supported by this browser.");
        return;
      }

      soundEngine.playAlert();
      chunksRef.current = [];

      const base = initialCanvases[0];
      const composite = document.createElement("canvas");
      const maxW = 1920;
      const scale = Math.min(1, maxW / Math.max(1, base.clientWidth));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      composite.width = Math.round(base.clientWidth * scale * dpr);
      composite.height = Math.round(base.clientHeight * scale * dpr);
      const ctx = composite.getContext("2d");

      const drawComposite = () => {
        if (!ctx) return;
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, composite.width, composite.height);
        for (const layer of collectOrderedCanvases()) {
          try {
            ctx.drawImage(layer, 0, 0, composite.width, composite.height);
          } catch {
            // Skip any canvas that became detached mid-capture
          }
        }
        rafRef.current = requestAnimationFrame(drawComposite);
      };
      drawComposite();

      const stream =
        typeof composite.captureStream === "function"
          ? composite.captureStream(60)
          : base.captureStream?.(60);

      if (!stream) {
        cleanupStreams();
        toast.error("Canvas video stream capture is unsupported in this browser.");
        return;
      }
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : MediaRecorder.isTypeSupported("video/mp4")
            ? "video/mp4"
            : "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanupStreams();
        soundEngine.playAlert();
        const actualMime = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: actualMime });
        if (blob.size === 0) {
          toast.error("Captured clip was empty. Ensure map layers are visible and try again.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `titan-cybercommand-${Date.now()}.${actualMime.includes("mp4") ? "mp4" : "webm"}`;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Composite situation clip exported");
      };

      recorder.start(100);
      setIsRecording(true);
      setCountdown(12);

      let timeLeft = 12;
      timerRef.current = window.setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          stopRecording();
        }
      }, 1000);
    } catch {
      cleanupStreams();
      setIsRecording(false);
      toast.error("Unable to start tactical video recording.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        soundEngine.playClick();
        if (isRecording) {
          stopRecording();
        } else {
          void startRecording();
        }
      }}
      className={cn(
        "press glass-pill hidden h-7 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] transition-colors md:flex",
        isRecording
          ? "border border-red-500/40 bg-red-500/20 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          : "text-ink-3 hover:bg-white/[0.07] hover:text-ink",
      )}
      title={isRecording ? "Stop Recording" : "Record High-Definition Demo Clip"}
      aria-label={isRecording ? "Stop Recording" : "Record Demo Clip"}
    >
      {isRecording ? (
        <>
          <StopCircle size={14} weight="fill" className="text-red-400 motion-safe:animate-pulse" />
          <span className="font-bold text-red-400">REC 00:{countdown < 10 ? `0${countdown}` : countdown}</span>
        </>
      ) : (
        <>
          <VideoCamera size={13} weight="bold" />
          <span className="uppercase tracking-wider">REC</span>
        </>
      )}
    </button>
  );
}
