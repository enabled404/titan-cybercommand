"use client";

import { useState, useRef } from "react";
import { VideoCamera, StopCircle } from "@phosphor-icons/react";
import { soundEngine } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";

export function RecordDemoButton() {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      soundEngine.playAlert();
      chunksRef.current = [];

      // Find the main canvas (Mapbox or Ballistic canvas)
      const canvases = document.querySelectorAll("canvas");
      if (canvases.length === 0) return;

      // Use the map canvas or composite
      const targetCanvas = canvases[0];
      const stream = targetCanvas.captureStream(60);

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        soundEngine.playAlert();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `titan-cybercommand-${Date.now()}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      recorder.start(100);
      setIsRecording(true);
      setCountdown(12);

      let timeLeft = 12;
      timerRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          stopRecording();
        }
      }, 1000);
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <button
      onClick={() => {
        soundEngine.playClick();
        if (isRecording) {
          stopRecording();
        } else {
          void startRecording();
        }
      }}
      className={cn(
        "press glass-pill hidden h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-mono transition-colors md:flex",
        isRecording
          ? "border border-red-500/40 bg-red-500/20 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          : "text-ink-3 hover:bg-white/[0.07] hover:text-ink",
      )}
      title={isRecording ? "Stop Recording" : "Record High-Definition Demo Clip"}
      aria-label={isRecording ? "Stop Recording" : "Record Demo Clip"}
    >
      {isRecording ? (
        <>
          <StopCircle size={15} weight="fill" className="animate-pulse text-red-400" />
          <span className="font-bold text-red-400">REC 00:{countdown < 10 ? `0${countdown}` : countdown}</span>
        </>
      ) : (
        <>
          <VideoCamera size={14} weight="bold" />
          <span className="uppercase tracking-wider">Record Clip</span>
        </>
      )}
    </button>
  );
}
