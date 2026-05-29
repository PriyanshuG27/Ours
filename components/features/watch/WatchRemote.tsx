"use client";

import { useEffect } from "react";
import { Hand, Cookie, Pause, Undo2, Sparkles, Tv } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

type WatchRemoteProps = {
  status: "waiting" | "countdown" | "watching";
  countdown: number | null;
  goFlash: boolean;
  onPause: () => void;
  onSnackBreak: () => void;
  onSnackBack: () => void;
  onDismissPause: () => void;
  partnerName: string;
  partnerPaused: boolean;
  partnerOnSnack: boolean;
  snackElapsed: number;
  partnerBackToast: boolean;
  iAmOnSnack: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────

export function WatchRemote({
  status,
  countdown,
  goFlash,
  onPause,
  onSnackBreak,
  onSnackBack,
  onDismissPause,
  partnerName,
  partnerPaused,
  partnerOnSnack,
  snackElapsed,
  partnerBackToast,
  iAmOnSnack,
}: WatchRemoteProps) {
  // ── Spacebar → Pause ──────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code === "Space" && status === "watching") {
        e.preventDefault();
        if (partnerPaused) {
          onDismissPause();
        } else {
          onPause();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [status, onPause, onDismissPause, partnerPaused]);

  // ── WAITING FOR PARTNER ───────────────────────────────────────────

  if (status === "waiting") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-950 p-4 select-none">
        <div className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20">
          <div className="absolute inset-0 rounded-full bg-violet-500/10 animate-pulse" />
          <Tv className="h-5 w-5 text-violet-400" />
        </div>
        <p className="text-center text-sm font-semibold text-white">
          Waiting for partner...
        </p>
        <p className="mt-1 text-center text-[10px] text-zinc-500">
          They will start the countdown
        </p>
      </div>
    );
  }

  // ── COUNTDOWN ─────────────────────────────────────────────────────

  if (status === "countdown" && countdown !== null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 select-none">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <div
              className={`absolute h-28 w-28 rounded-full blur-2xl ${
                goFlash
                  ? "bg-emerald-500/40"
                  : "bg-violet-500/30 animate-pulse"
              }`}
            />
            <p
              className={`relative font-black tabular-nums leading-none ${
                goFlash ? "text-7xl text-emerald-400" : "text-8xl text-white"
              }`}
            >
              {goFlash ? "GO!" : countdown}
            </p>
          </div>
          <p
            className={`mt-3 text-xs font-medium ${
              goFlash ? "text-emerald-400/80" : "text-zinc-500"
            }`}
          >
            {goFlash ? "Press play! 🎬" : "Get ready…"}
          </p>
        </div>
      </div>
    );
  }

  // ── WATCHING ──────────────────────────────────────────────────────

  return (
    <div className="relative flex h-full w-full flex-col bg-zinc-950 select-none overflow-hidden">

      {/* ── Partner Paused Overlay (blocks everything) ────────── */}
      {partnerPaused && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30">
            <Pause className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white">{partnerName} Paused</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Pause yours too</p>
          </div>
          <button
            onClick={onDismissPause}
            className="mt-1 px-5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95"
          >
            Got it
          </button>
        </div>
      )}

      {/* ── Partner Back Toast (only when pause overlay is NOT showing) */}
      {partnerBackToast && !partnerPaused && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap">
            <Sparkles className="h-3 w-3" />
            {partnerName} is back!
          </div>
        </div>
      )}

      {/* ── Partner Snack Status Bar (only when pause overlay NOT showing) */}
      {partnerOnSnack && !partnerPaused && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/8 border-b border-amber-500/15 px-3 py-1.5 shrink-0">
          <Cookie className="h-3 w-3 text-amber-400" />
          <span className="text-[10px] text-amber-400 font-medium">
            {partnerName} · snack break
          </span>
          <span className="text-[10px] text-amber-400/60 font-mono tabular-nums">
            {fmt(snackElapsed)}
          </span>
        </div>
      )}

      {/* ── Main Controls ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
        {/* Pause Button */}
        <button
          onClick={onPause}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-5 transition-all hover:bg-amber-500/15 hover:border-amber-500/30 active:scale-95 shadow-lg shadow-amber-500/5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <Pause className="h-5 w-5 text-amber-400" />
          </div>
          <span className="text-base font-bold tracking-wide text-amber-400">Pause for me</span>
        </button>

        {/* Snack Break / I'm Back */}
        {iAmOnSnack ? (
          <button
            onClick={onSnackBack}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3.5 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/15 active:scale-95 shadow-md shadow-emerald-500/5 shrink-0"
          >
            <Undo2 className="h-4 w-4" />
            I&apos;m Back!
          </button>
        ) : (
          <button
            onClick={onSnackBreak}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/30 px-4 py-3.5 text-sm font-medium text-zinc-400 transition-all hover:bg-zinc-800/60 hover:text-zinc-200 active:scale-95 shrink-0"
          >
            <Cookie className="h-4 w-4" />
            Snack Break
          </button>
        )}
      </div>

      {/* ── Hint ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center pb-1.5 shrink-0">
        <p className="text-[9px] text-zinc-700">
          <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[8px]">
            Space
          </kbd>{" "}
          to pause
        </p>
      </div>
    </div>
  );
}
