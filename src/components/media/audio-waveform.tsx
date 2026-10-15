"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Real retained audio; typed and expired recordings have no playable source. */
export function AudioPlayer({label, durationSeconds, src, className}: {label:string;durationSeconds:number;src?:string | null;className?:string}) {
 const [failedSource,setFailedSource]=useState<string | null>(null);
 const failed = Boolean(src && failedSource === src);
 return <div className={cn("rounded-md border border-line bg-bg p-2.5",className)}>
   {src && !failed ? <audio aria-label={`${label} audio`} controls preload="none" src={src} key={src} onError={()=>setFailedSource(src)} className="w-full" /> : <p className="m-0 text-xs text-ink-muted">{failed ? "Audio couldn't be played. Reload the review to refresh its temporary link." : durationSeconds > 0 ? "Recording is no longer retained." : "No recording for this answer."}</p>}
 </div>;
}
