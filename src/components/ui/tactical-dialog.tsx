"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TacticalDialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Native top-layer modal dialog following WAI-ARIA and modern web platform conventions:
 * uses `<dialog>` with `showModal()` for inert background, focus containment, Esc dismissal,
 * and automatic focus restoration to the invoking control, plus light-dismiss fallback for
 * browsers lacking `closedby="any"`.
 */
export function TacticalDialog({ open, onClose, labelledBy, className, children }: TacticalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);

  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.setAttribute("closedby", "any");

    if (open) {
      if (!el.open) {
        el.showModal();
        const autofocusTarget = el.querySelector<HTMLElement>("[data-autofocus]");
        autofocusTarget?.focus();
      }
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  // Progressive enhancement fallback for browsers without native `<dialog closedby="any">` (e.g. Safari)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el || !open) return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (event: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    };

    let pressedOutside = false;
    const onPointerDown = (event: PointerEvent) => {
      pressedOutside = isOutside(event);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pressedOutside && isOutside(event)) {
        el.close();
      }
      pressedOutside = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onClose={(e) => {
        e.currentTarget.returnValue = "";
        if (openRef.current) onCloseRef.current();
      }}
      className={cn(
        "tactical-dialog m-auto max-h-[90dvh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-md",
        className,
      )}
    >
      {open ? children : null}
    </dialog>
  );
}
