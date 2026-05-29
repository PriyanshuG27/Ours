"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { LiveObject } from "@liveblocks/client";
import {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useBroadcastEvent,
  useEventListener,
} from "@/lib/liveblocks/config";
import { useSpaceStore } from "@/store/space.store";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { useDocumentPip } from "@/hooks/use-document-pip";
import { WatchRemote } from "@/components/features/watch/WatchRemote";
import {
  Tv,
  Play,
  Pause,
  ArrowLeft,
  Loader2,
  Square,
  Check,
  Undo2,
  PictureInPicture2,
  Popcorn,
  Clock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

// ── Constants ─────────────────────────────────────────────────────────

const COUNTDOWN_SECONDS = 8;

const SPOKEN_NUMBERS: Record<number, string> = {
  8: "Eight",
  7: "Seven",
  6: "Six",
  5: "Five",
  4: "Four",
  3: "Three",
  2: "Two",
  1: "One",
  0: "Play!",
};

type SessionPhase = "idle" | "ready-check" | "watching";

// ── Speech ────────────────────────────────────────────────────────────

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1.1;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

// ── Inner Content ─────────────────────────────────────────────────────

function WatchContent() {
  const userId = useSpaceStore((s) => s.userId);
  const partnerName = useSpaceStore((s) => s.partnerName);
  const displayName = partnerName ?? "Partner";
  const { encrypt, decrypt } = useE2EEKey();
  const [decryptedTitle, setDecryptedTitle] = useState("");

  const [titleInput, setTitleInput] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [goFlash, setGoFlash] = useState(false);

  // Pause
  const [pauseVisible, setPauseVisible] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snack break — partner's status
  const [partnerOnSnack, setPartnerOnSnack] = useState(false);
  const [snackStartedAt, setSnackStartedAt] = useState<number | null>(null);
  const [snackElapsed, setSnackElapsed] = useState(0);
  // Snack break — my status
  const [iAmOnSnack, setIAmOnSnack] = useState(false);
  // Brief "back" toast
  const [backToast, setBackToast] = useState(false);

  // Session timer
  const [sessionElapsed, setSessionElapsed] = useState(0);

  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // PiP
  const { isSupported: pipSupported, pipWindow, requestPip, closePip } =
    useDocumentPip();
  const [showRemote, setShowRemote] = useState(false);

  // Liveblocks
  const watchState = useStorage((root) => root.watchState);
  const others = useOthers();
  const partnerOnline = others.length > 0;
  const broadcast = useBroadcastEvent();

  const isHost = Boolean(userId && watchState?.hostId === userId);
  const rawTitle = watchState?.title || "";
  const sessionStartedAt = watchState?.updatedAt ?? 0;

  // Decrypt encrypted title from Liveblocks
  useEffect(() => {
    let active = true;
    if (!rawTitle) {
      setDecryptedTitle("");
      return;
    }
    decrypt(rawTitle)
      .then((dec) => { if (active) setDecryptedTitle(dec); })
      .catch(() => { if (active) setDecryptedTitle(rawTitle); });
    return () => { active = false; };
  }, [rawTitle, decrypt]);

  const phase: SessionPhase = (() => {
    if (!watchState?.hostId) return "idle";
    if (!watchState.isPlaying) return "ready-check";
    return "watching";
  })();

  const isCountdownActive = countdown !== null;

  // ── Session elapsed timer ─────────────────────────────────────────

  useEffect(() => {
    if (phase !== "watching" || sessionStartedAt === 0) {
      setSessionElapsed(0);
      return;
    }
    setSessionElapsed(
      Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000)),
    );
    const interval = setInterval(() => {
      setSessionElapsed(
        Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000)),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, sessionStartedAt]);

  // ── Mutations ─────────────────────────────────────────────────────

  const proposeSessionMutation = useMutation(
    ({ storage }, encryptedTitle: string) => {
      const ws = storage.get("watchState");
      if (!ws || !userId) return;
      ws.set("title", encryptedTitle);
      ws.set("hostId", userId);
      ws.set("isPlaying", false);
      ws.set("videoUrl", null);
      ws.set("currentTime", 0);
      ws.set("updatedAt", 0);
    },
    [userId],
  );

  const proposeSession = useCallback(async (title: string) => {
    const encrypted = await encrypt(title);
    proposeSessionMutation(encrypted);
  }, [encrypt, proposeSessionMutation]);

  const markPlaying = useMutation(({ storage }) => {
    const ws = storage.get("watchState");
    if (!ws) return;
    ws.set("isPlaying", true);
    ws.set("updatedAt", Date.now());
  }, []);

  const resetSession = useMutation(({ storage }) => {
    const ws = storage.get("watchState");
    if (!ws) return;
    ws.set("hostId", null);
    ws.set("videoUrl", null);
    ws.set("currentTime", 0);
    ws.set("isPlaying", false);
    ws.set("title", "");
    ws.set("updatedAt", 0);
  }, []);

  // ── Events ────────────────────────────────────────────────────────

  useEventListener(({ event }) => {
    if (event.type === "WATCH_PAUSED") {
      setPauseVisible(true);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => setPauseVisible(false), 8000);
    }
    if (event.type === "WATCH_COUNTDOWN") {
      setCountdown(event.count);
      const word = SPOKEN_NUMBERS[event.count];
      if (word) speak(word);
      if (event.count === 0) {
        setGoFlash(true);
        setTimeout(() => {
          setCountdown(null);
          setGoFlash(false);
        }, 1500);
      }
    }
    if (event.type === "WATCH_SNACK_BREAK") {
      setPartnerOnSnack(true);
      setSnackStartedAt(Date.now());
      setSnackElapsed(0);
    }
    if (event.type === "WATCH_SNACK_BACK") {
      setPartnerOnSnack(false);
      setSnackStartedAt(null);
      setSnackElapsed(0);
      // Show brief "back" toast
      setBackToast(true);
      setTimeout(() => setBackToast(false), 3000);
    }
  });

  // Snack elapsed
  useEffect(() => {
    if (!snackStartedAt) return;
    const i = setInterval(() => {
      setSnackElapsed(Math.floor((Date.now() - snackStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(i);
  }, [snackStartedAt]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleIPaused = useCallback(() => {
    if (!userId) return;
    broadcast({ type: "WATCH_PAUSED", userId });
  }, [userId, broadcast]);

  const handleSnackBreak = useCallback(() => {
    if (!userId) return;
    setIAmOnSnack(true);
    broadcast({ type: "WATCH_SNACK_BREAK", userId });
  }, [userId, broadcast]);

  const handleSnackBack = useCallback(() => {
    if (!userId) return;
    setIAmOnSnack(false);
    broadcast({ type: "WATCH_SNACK_BACK", userId });
  }, [userId, broadcast]);

  const openRemotePip = useCallback(async () => {
    if (pipSupported) await requestPip();
    setShowRemote(true);
  }, [pipSupported, requestPip]);

  // ── Countdown + PiP + Speech ──────────────────────────────────────

  const startCountdown = useCallback(async () => {
    if (pipSupported) await requestPip();
    setShowRemote(true);

    for (let i = COUNTDOWN_SECONDS; i >= 0; i--) {
      const delay = (COUNTDOWN_SECONDS - i) * 1000;
      const timer = setTimeout(() => {
        broadcast({ type: "WATCH_COUNTDOWN", count: i });
        setCountdown(i);
        const word = SPOKEN_NUMBERS[i];
        if (word) speak(word);
        if (i === 0) {
          setGoFlash(true);
          markPlaying();
          setTimeout(() => {
            setCountdown(null);
            setGoFlash(false);
          }, 1500);
        }
      }, delay);
      countdownTimersRef.current.push(timer);
    }
  }, [pipSupported, requestPip, broadcast, markPlaying]);

  useEffect(() => {
    return () => {
      countdownTimersRef.current.forEach(clearTimeout);
      countdownTimersRef.current = [];
    };
  }, []);

  const handleEndSession = useCallback(() => {
    closePip();
    setShowRemote(false);
    setPartnerOnSnack(false);
    setSnackStartedAt(null);
    setIAmOnSnack(false);
    setPauseVisible(false);
    resetSession();
  }, [closePip, resetSession]);

  useEffect(() => {
    if (isCountdownActive && !showRemote) setShowRemote(true);
  }, [isCountdownActive, showRemote]);

  useEffect(() => {
    return () => { closePip(); };
  }, [closePip]);

  // ── Remote element ────────────────────────────────────────────────

  const remoteStatus: "countdown" | "watching" =
    isCountdownActive ? "countdown" : "watching";

  const remoteElement = showRemote ? (
    <WatchRemote
      status={remoteStatus}
      countdown={countdown}
      goFlash={goFlash}
      onPause={handleIPaused}
      onSnackBreak={handleSnackBreak}
      onSnackBack={handleSnackBack}
      onDismissPause={() => setPauseVisible(false)}
      partnerName={displayName}
      partnerPaused={pauseVisible}
      partnerOnSnack={partnerOnSnack}
      snackElapsed={snackElapsed}
      partnerBackToast={backToast}
      iAmOnSnack={iAmOnSnack}
    />
  ) : null;

  // ── Helpers ───────────────────────────────────────────────────────

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="relative min-h-screen bg-black">
      {/* ── Ambient ────────────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-900/20 blur-[140px]" />
        {phase === "watching" && (
          <>
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-900/10 blur-[120px]" />
            <div className="absolute top-1/2 left-0 h-48 w-48 rounded-full bg-violet-800/8 blur-[100px]" />
          </>
        )}
      </div>

      {/* ── PAUSE OVERLAY ──────────────────────────────────────── */}
      {pauseVisible && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-[fade-in_0.2s_ease]" />
          <div className="relative z-10 flex flex-col items-center gap-5 animate-[scale-in_0.35s_cubic-bezier(0.34,1.56,0.64,1)]">
            {/* Concentric rings */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-40 w-40 rounded-full border border-amber-500/10 animate-ping" />
              <div className="absolute h-32 w-32 rounded-full border border-amber-500/15 animate-[ping_1.5s_ease-in-out_infinite]" />
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/15 border-2 border-amber-500/40 shadow-lg shadow-amber-500/20">
                <Pause className="h-10 w-10 text-amber-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white tracking-tight">
                {displayName} Paused
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Pause yours too — they&apos;ll be right back
              </p>
            </div>
            <button
              onClick={() => setPauseVisible(false)}
              className="mt-1 px-8 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── PARTNER BACK TOAST ─────────────────────────────────── */}
      {backToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-2.5 bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-md text-emerald-400 px-5 py-3 rounded-2xl shadow-xl animate-[bounce-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">{displayName} is back!</span>
          </div>
        </div>
      )}

      {/* ── COUNTDOWN OVERLAY (inline, no PiP) ─────────────────── */}
      {isCountdownActive && !pipWindow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
          <div className="text-center space-y-8">
            <div className="relative inline-flex items-center justify-center">
              {/* Animated rings */}
              {!goFlash && (
                <>
                  <div className="absolute h-64 w-64 rounded-full border border-violet-500/10 animate-ping" />
                  <div className="absolute h-52 w-52 rounded-full border border-violet-500/15 animate-[ping_2s_ease-in-out_infinite]" />
                </>
              )}
              <div
                className={`absolute h-44 w-44 rounded-full blur-3xl transition-all duration-500 ${
                  goFlash ? "bg-emerald-500/40 scale-150" : "bg-violet-500/20 animate-pulse"
                }`}
              />
              <p
                className={`relative font-black tabular-nums transition-all duration-300 ${
                  goFlash ? "text-8xl text-emerald-400 scale-110" : "text-[11rem] leading-none text-white"
                }`}
              >
                {goFlash ? "GO!" : countdown}
              </p>
            </div>
            <div>
              {!goFlash ? (
                <p className="text-zinc-500 text-sm">Switch to your player and get ready…</p>
              ) : (
                <p className="text-emerald-400 text-sm font-semibold">Press play now! 🎬</p>
              )}
            </div>
            {rawTitle && (
              <div className="inline-flex items-center gap-2 rounded-full bg-zinc-800/50 border border-zinc-700/40 px-4 py-2">
                <Tv className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">{decryptedTitle || '…'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PiP Portal ─────────────────────────────────────────── */}
      {pipWindow && remoteElement && createPortal(remoteElement, pipWindow.document.body)}

      {/* ── Page Content ───────────────────────────────────────── */}
      <div className="relative z-10 px-4 py-8">
        <Header />

        {/* ═══ WATCHING PHASE ══════════════════════════════════ */}
        {phase === "watching" && (
          <div className="mx-auto max-w-md space-y-6">

            {/* ── Now Playing Card ────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800/50 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl shadow-2xl">
              {/* Top decorative gradient bar */}
              <div className="h-1 w-full bg-gradient-to-r from-violet-500/60 via-emerald-500/60 to-violet-500/60" />

              <div className="p-7 space-y-6">
                {/* Title + elapsed */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                      Now Watching
                    </p>
                    <h2 className="text-xl font-bold text-white leading-tight">
                      {decryptedTitle || '…'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl bg-zinc-800/70 border border-zinc-700/40 px-3 py-1.5 tabular-nums">
                    <Clock className="h-3 w-3 text-zinc-500" />
                    <span className="text-xs font-mono text-zinc-400">
                      {fmt(sessionElapsed)}
                    </span>
                  </div>
                </div>

                {/* Presence pills */}
                <div className="flex items-center gap-3">
                  {/* You */}
                  <div className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium border ${
                    iAmOnSnack
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-400"
                      : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                  }`}>
                    <div className={`h-2 w-2 rounded-full ${
                      iAmOnSnack ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                    }`} />
                    {iAmOnSnack ? "You (snack break)" : "You"}
                  </div>
                  {/* Partner */}
                  <div className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium border ${
                    partnerOnSnack
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-400"
                      : partnerOnline
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                        : "bg-zinc-800/50 border-zinc-700/40 text-zinc-500"
                  }`}>
                    <div className={`h-2 w-2 rounded-full ${
                      partnerOnSnack
                        ? "bg-amber-400"
                        : partnerOnline
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-zinc-600"
                    }`} />
                    {partnerOnSnack
                      ? `${displayName} (snack ${fmt(snackElapsed)})`
                      : partnerOnline
                        ? displayName
                        : `${displayName} offline`}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  {/* Pause */}
                  <button
                    onClick={handleIPaused}
                    className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-500/8 border border-amber-500/20 px-5 py-4 transition-all hover:bg-amber-500/15 hover:border-amber-500/35 active:scale-[0.98]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 group-hover:bg-amber-500/25 transition-colors">
                      <Pause className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-sm font-semibold text-amber-400">
                      I Paused
                    </span>
                  </button>

                  {/* Snack Break / I'm Back */}
                  {iAmOnSnack ? (
                    <button
                      onClick={handleSnackBack}
                      className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 px-5 py-4 transition-all hover:bg-emerald-500/15 hover:border-emerald-500/35 active:scale-[0.98]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 group-hover:bg-emerald-500/25 transition-colors">
                        <Undo2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-sm font-semibold text-emerald-400">
                        I&apos;m Back!
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSnackBreak}
                      className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-zinc-800/40 border border-zinc-700/30 px-5 py-3.5 transition-all hover:bg-zinc-800/60 hover:border-zinc-600/40 active:scale-[0.98]"
                    >
                      <Popcorn className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                      <span className="text-sm font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        Snack Break
                      </span>
                    </button>
                  )}
                </div>

                {/* PiP control */}
                {pipSupported && !pipWindow && (
                  <button
                    onClick={openRemotePip}
                    className="flex w-full items-center justify-center gap-2 text-xs text-violet-400/60 hover:text-violet-400 transition-colors py-1"
                  >
                    <PictureInPicture2 className="h-3.5 w-3.5" />
                    Pop out floating remote
                  </button>
                )}
                {pipWindow && (
                  <div className="flex items-center justify-center gap-2 text-xs text-violet-400/50 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                    Floating remote active
                  </div>
                )}

                {/* Inline remote fallback */}
                {!pipWindow && showRemote && phase === "watching" && (
                  <div className="h-[170px] rounded-2xl border border-zinc-800/50 overflow-hidden">
                    {remoteElement}
                  </div>
                )}
              </div>

              {/* Bottom end session */}
              <div className="border-t border-zinc-800/40 px-7 py-4">
                <button
                  onClick={handleEndSession}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-zinc-600 transition-all hover:text-red-400 hover:bg-red-500/5 active:scale-[0.98]"
                >
                  <Square className="h-3.5 w-3.5" />
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ READY CHECK PHASE ═══════════════════════════════ */}
        {phase === "ready-check" && !isCountdownActive && (
          <div className="mx-auto max-w-md space-y-5">
            <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800/50 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl shadow-2xl">
              <div className="h-1 w-full bg-gradient-to-r from-violet-500/40 via-violet-500/60 to-violet-500/40" />
              <div className="p-7 space-y-7">
                {/* Icon + Title */}
                <div className="text-center space-y-4">
                  <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-violet-500/10 animate-pulse" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20">
                      <Tv className="h-7 w-7 text-violet-400" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white mb-2">
                      {isHost ? "Waiting for Partner" : "Ready to Watch?"}
                    </h2>
                    <div className="inline-flex items-center gap-2 rounded-full bg-zinc-800/60 border border-zinc-700/40 px-4 py-1.5">
                      <Tv className="h-3.5 w-3.5 text-violet-400" />
                      <span className="text-sm text-zinc-300">{decryptedTitle || '…'}</span>
                    </div>
                  </div>
                </div>

                {/* Partner status */}
                <div className="flex items-center justify-center gap-2.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${
                    partnerOnline
                      ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"
                      : "bg-zinc-600"
                  }`} />
                  <span className="text-sm text-zinc-400">
                    {partnerOnline ? `${displayName} is here` : `Waiting for ${displayName}…`}
                  </span>
                </div>

                {isHost ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2.5 rounded-2xl bg-violet-500/5 border border-violet-500/15 px-5 py-4 text-sm text-violet-300">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                      Waiting for {displayName} to accept…
                    </div>
                    <p className="text-xs text-zinc-600 text-center leading-relaxed">
                      Open your streaming app and get the video queued up while you wait.
                    </p>
                    <button
                      onClick={() => resetSession()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3 text-sm font-medium text-zinc-500 transition-all hover:text-zinc-300 hover:bg-zinc-700/50 active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-400 text-center leading-relaxed">
                      {displayName} wants to watch together.
                      Open your streaming app, queue up the video, and hit the button when you&apos;re set.
                    </p>

                    {pipSupported && (
                      <div className="flex items-center justify-center gap-2 text-xs text-violet-400/50">
                        <PictureInPicture2 className="h-3.5 w-3.5" />
                        A floating remote will appear so you can switch apps
                      </div>
                    )}

                    <button
                      onClick={startCountdown}
                      disabled={!partnerOnline}
                      className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition-all hover:bg-neutral-100 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                    >
                      <Check className="h-5 w-5" />
                      I&apos;m Ready — Start Countdown
                    </button>
                    <button
                      onClick={() => resetSession()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3 text-sm font-medium text-zinc-500 transition-all hover:text-zinc-300 hover:bg-zinc-700/50 active:scale-[0.98]"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ IDLE / SETUP PHASE ══════════════════════════════ */}
        {phase === "idle" && (
          <div className="mx-auto max-w-md space-y-5">
            {/* Partner status */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-colors ${
                partnerOnline
                  ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"
                  : "bg-zinc-600"
              }`} />
              <span className="text-xs text-zinc-400">
                {partnerOnline ? `${displayName} is online` : `${displayName} offline`}
              </span>
            </div>

            {/* Setup card */}
            <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800/50 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl shadow-2xl">
              <div className="h-1 w-full bg-gradient-to-r from-violet-500/30 via-violet-500/50 to-violet-500/30" />
              <div className="p-7 space-y-7">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
                    <Popcorn className="h-6 w-6 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Watch Together</h2>
                    <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
                      A synced countdown so you both press play at the exact same moment
                    </p>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {[
                    { icon: "📝", text: "Enter what you're watching" },
                    { icon: "👋", text: `${displayName} accepts & opens their player` },
                    { icon: pipSupported ? "🖥️" : "⏱️", text: pipSupported ? "Floating remote pops up — switch to your app" : "5-second countdown syncs you both" },
                    { icon: "▶️", text: "Both press play on \"GO!\"" },
                  ].map(({ icon, text }, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3.5 rounded-xl bg-zinc-800/20 border border-zinc-800/30 px-4 py-3"
                    >
                      <span className="text-base">{icon}</span>
                      <span className="text-sm text-zinc-400">{text}</span>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && titleInput.trim() && partnerOnline) {
                      void proposeSession(titleInput.trim());
                    }
                  }}
                  placeholder='e.g. "Breaking Bad S3E5"'
                  className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition-all"
                />

                <button
                  onClick={() => {
                    if (!titleInput.trim()) return;
                    void proposeSession(titleInput.trim());
                  }}
                  disabled={!titleInput.trim() || !partnerOnline}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition-all hover:bg-neutral-100 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                >
                  <Play className="h-4 w-4" />
                  Propose Watch Session
                </button>

                {!partnerOnline && (
                  <p className="text-xs text-zinc-600 text-center">
                    {displayName} needs to be online to start.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyframes */}
      <style jsx global>{`
        @keyframes bounce-in {
          0% { transform: translateX(-50%) translateY(-100%) scale(0.8); opacity: 0; }
          50% { transform: translateX(-50%) translateY(4px) scale(1.02); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="mx-auto max-w-md mb-8">
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
          <Tv className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Watch Room</h1>
          <p className="text-xs text-zinc-500">Synced countdown to press play together</p>
        </div>
      </div>
    </div>
  );
}

// ── Outer Wrapper ─────────────────────────────────────────────────────

export function WatchRoom() {
  const { spaceId, isLoaded } = useSpaceStore((s) => ({
    spaceId: s.spaceId,
    isLoaded: s.isLoaded,
  }));

  if (!isLoaded || !spaceId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <RoomProvider
      id={`${spaceId}-watch`}
      initialPresence={{ isOnline: true }}
      initialStorage={{
        watchState: new LiveObject({
          hostId: null,
          videoUrl: null,
          currentTime: 0,
          isPlaying: false,
          title: "",
          updatedAt: 0,
        }),
      }}
    >
      <WatchContent />
    </RoomProvider>
  );
}
