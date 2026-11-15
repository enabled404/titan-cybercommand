"use client";

import { Export, FileCode, FileText, LinkSimple, LinkedinLogo, XLogo } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { CHIP } from "@/components/pages/styles";
import { exportIntelDossier, exportStix21 } from "@/lib/export-intel";
import type { Incident } from "@/lib/types";
import { cn } from "@/lib/utils";

const noop = () => () => undefined;

/** Copy, X, LinkedIn, STIX 2.1 export, Dossier export, and the native share sheet. */
export function ShareRow({
  url,
  text,
  title,
  grid = false,
  className,
  incident,
}: {
  url: string;
  text: string;
  title: string;
  grid?: boolean;
  className?: string;
  incident?: Incident;
}) {
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
  const enc = encodeURIComponent;
  const button = cn(CHIP, grid && "h-8 justify-center");
  return (
    <div className={cn(grid ? "grid grid-cols-2 gap-1.5" : "flex flex-wrap gap-1.5", className)}>
      <button
        type="button"
        className={button}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          toast("Link copied");
        }}
      >
        <LinkSimple className="size-3.5" /> Copy link
      </button>
      {incident && (
        <>
          <button
            type="button"
            className={button}
            onClick={() => exportIntelDossier(incident)}
            title="Export formatted Markdown intel dossier"
          >
            <FileText className="size-3.5 text-cyan-400" /> Dossier (.md)
          </button>
          <button
            type="button"
            className={button}
            onClick={() => exportStix21(incident)}
            title="Export machine-readable STIX 2.1 Threat Intelligence JSON"
          >
            <FileCode className="size-3.5 text-emerald-400" /> STIX 2.1 (.json)
          </button>
        </>
      )}
      <a href={`https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noreferrer" aria-label="Post on X" className={button}>
        <XLogo className="size-3.5" /> Post
      </a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noreferrer" className={button}>
        <LinkedinLogo className="size-3.5" /> LinkedIn
      </a>
      {canShare ? (
        <button type="button" className={button} onClick={() => void navigator.share({ title, text, url }).catch(() => undefined)}>
          <Export className="size-3.5" /> More
        </button>
      ) : null}
    </div>
  );
}
