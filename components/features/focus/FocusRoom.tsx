"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { LiveObject } from "@liveblocks/client";
import {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
} from "@/lib/liveblocks/config";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { useSpaceStore } from "@/store/space.store";
import {
  Target,
  Play,
  Square,
  Clock,
  ArrowLeft,
  Loader2,
  Check,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// ── Time Formatting ───────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");

  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

// ── Inner Content (must be inside RoomProvider) ───────────────────────

function FocusContent() {
  const userId = useSpaceStore((s) => s.userId);
  const partnerName = useSpaceStore((s) => s.partnerName);

  const { encrypt, decrypt } = useE2EEKey();
  const [taskLabel, setTaskLabel] = useState("");
  const [decryptedTaskLabel, setDecryptedTaskLabel] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [finalDuration, setFinalDuration] = useState(0);
  const hasPostedRef = useRef(false);

  // Liveblocks storage
  const focusState = useStorage((root) => root.focusState);
  const others = useOthers();
  const partnerOnline = others.length > 0;

  const isActive = focusState?.isActive ?? false;
  const sessionStartTime = focusState?.sessionStartTime ?? null;
  const participants = focusState?.participants ?? [];
  const iAmParticipant = Boolean(userId && participants.includes(userId));
  const partnerStartedWithoutMe = isActive && !iAmParticipant;

  useEffect(() => {
    let active = true;
    const loadDecrypted = async () => {
      if (focusState?.taskLabel) {
        try {
          const dec = await decrypt(focusState.taskLabel);
          if (active) setDecryptedTaskLabel(dec);
        } catch (e) {
          if (active) setDecryptedTaskLabel(focusState.taskLabel); // fallback
        }
      } else {
        if (active) setDecryptedTaskLabel("");
      }
    };
    loadDecrypted();
    return () => { active = false; };
  }, [focusState?.taskLabel, decrypt]);

  // ── Timer ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || !sessionStartTime) {
      setElapsed(0);
      return;
    }

    // Immediate update
    setElapsed(
      Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000)),
    );

    const interval = setInterval(() => {
      setElapsed(
        Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000)),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, sessionStartTime]);

  // Reset posted ref when session changes
  useEffect(() => {
    if (!isActive) {
      hasPostedRef.current = false;
    }
  }, [isActive]);

  // ── Mutations ─────────────────────────────────────────────────────

  const startSession = useMutation(
    ({ storage }, label: string) => {
      const fs = storage.get("focusState");
      if (!fs || !userId) return;

      fs.set("sessionId", crypto.randomUUID());
      fs.set("sessionStartTime", Date.now());
      fs.set("taskLabel", label);
      fs.set("isActive", true);
      fs.set("participants", [userId]);
    },
    [userId],
  );

  const joinSession = useMutation(
    ({ storage }) => {
      const fs = storage.get("focusState");
      if (!fs || !userId) return;

      const current = fs.get("participants") as string[];
      if (!current.includes(userId)) {
        fs.set("participants", [...current, userId]);
      }
    },
    [userId],
  );

  const endSession = useMutation(({ storage }) => {
    const fs = storage.get("focusState");
    if (!fs) return;
    fs.set("isActive", false);
  }, []);

  const resetSession = useMutation(({ storage }) => {
    const fs = storage.get("focusState");
    if (!fs) return;
    fs.set("sessionId", null);
    fs.set("sessionStartTime", null);
    fs.set("taskLabel", "");
    fs.set("isActive", false);
    fs.set("participants", []);
  }, []);

  // ── Done Handler ──────────────────────────────────────────────────

  const handleDone = useCallback(async () => {
    if (hasPostedRef.current) return;
    hasPostedRef.current = true;

    const duration = sessionStartTime
      ? Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000))
      : 0;
    const label = focusState?.taskLabel ?? "";
    const sessionIdValue = focusState?.sessionId ?? "";

    setFinalDuration(duration);
    endSession();
    setShowComplete(true);

    // Log to feed (idempotent via sessionId)
    try {
      await fetch("/api/focus/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskLabel: label,
          durationSeconds: duration,
          sessionId: sessionIdValue,
        }),
      });
    } catch (err) {
      console.error("Failed to log focus session:", err);
    }
  }, [sessionStartTime, focusState, endSession]);

  // ── COMPLETE VIEW ─────────────────────────────────────────────────

  if (showComplete) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <Header />
        <div className="mx-auto max-w-md">
          <div className="flex flex-col items-center justify-center pt-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center mb-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Focus Session Complete!</h2>
            <p className="text-zinc-400 max-w-md mb-8">
              You focused on <span className="text-white font-medium">{decryptedTaskLabel}</span> for {formatElapsed(finalDuration)}. Great work!
            </p>
            <button
              onClick={() => {
                resetSession();
                setShowComplete(false);
                setTaskLabel("");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:scale-[0.98]"
            >
              <Play className="h-4 w-4" />
              New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE VIEW ───────────────────────────────────────────────────

  if (isActive && iAmParticipant) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <Header />
        <div className="mx-auto max-w-md space-y-6">
          <div className="bg-zinc-900/50 border border-violet-500/30 rounded-3xl p-8 text-center space-y-8">
            {/* Task label */}
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-2">
              <Target className="h-4 w-4 text-violet-400" />
              <span className="text-sm text-violet-300 font-medium">
                {decryptedTaskLabel}
              </span>
            </div>

            {/* Timer */}
            <div>
              <p className="text-7xl font-bold text-white tabular-nums tracking-tight">
                {formatElapsed(elapsed)}
              </p>
              <p className="text-xs text-zinc-500 mt-2">elapsed</p>
            </div>

            {/* Partner status */}
            <div className="flex items-center justify-center gap-2">
              {partnerOnline ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-zinc-400">
                    {partnerName ?? "Partner"} is focusing
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="text-sm text-zinc-500">
                    {partnerName ?? "Partner"} away
                  </span>
                </>
              )}
            </div>

            {/* Done button */}
            <button
              onClick={handleDone}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 active:scale-[0.98]"
            >
              <Square className="h-4 w-4" />
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── JOIN VIEW (partner started, I haven't joined) ─────────────────

  if (partnerStartedWithoutMe) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <Header />
        <div className="mx-auto max-w-md">
          <div className="bg-zinc-900/50 border border-violet-500/30 rounded-3xl p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10">
              <UserCheck className="h-8 w-8 text-violet-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-white mb-2">
                {partnerName ?? "Partner"} is focusing
              </h2>
              <p className="text-sm text-zinc-400">
                Task:{" "}
                <span className="text-white">
                  {decryptedTaskLabel}
                </span>
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                Running for{" "}
                <span className="text-white tabular-nums">
                  {formatElapsed(elapsed)}
                </span>
              </p>
            </div>
            <button
              onClick={() => joinSession()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 active:scale-[0.98]"
            >
              <Play className="h-4 w-4" />
              Join Focus Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SETUP VIEW ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <Header />
      <div className="mx-auto max-w-md space-y-6">
        {/* Partner status */}
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              partnerOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <span className="text-xs text-zinc-400">
            {partnerOnline
              ? `${partnerName ?? "Partner"} is online`
              : `${partnerName ?? "Partner"} offline`}
          </span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-medium text-white mb-1">
              Start a Focus Session
            </h2>
            <p className="text-sm text-zinc-400">
              Focus together on a task — your partner can join in.
            </p>
          </div>

          <input
            type="text"
            value={taskLabel}
            onChange={(e) => setTaskLabel(e.target.value)}
            placeholder="What are you focusing on?"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
          />

          <button
            onClick={async () => {
              if (!taskLabel.trim()) return;
              const encrypted = await encrypt(taskLabel.trim());
              startSession(encrypted);
            }}
            disabled={!taskLabel.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" />
            Start Focus
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="mx-auto max-w-md mb-8">
      <Link
        href="/home"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
          <Clock className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Focus Mode</h1>
          <p className="text-xs text-zinc-500">Focus together</p>
        </div>
      </div>
    </div>
  );
}

// ── Outer Wrapper (RoomProvider) ──────────────────────────────────────

export function FocusRoom() {
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
      id={`${spaceId}-focus`}
      initialPresence={{ isOnline: true }}
      initialStorage={{
        focusState: new LiveObject({
          sessionId: null,
          sessionStartTime: null,
          taskLabel: "",
          isActive: false,
          participants: [],
        }),
      }}
    >
      <FocusContent />
    </RoomProvider>
  );
}
