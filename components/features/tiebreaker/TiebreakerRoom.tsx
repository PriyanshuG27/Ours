"use client";

import { useState, useEffect, useCallback } from "react";
import { LiveObject } from "@liveblocks/client";
import {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
} from "@/lib/liveblocks/config";
import { useSpaceStore } from "@/store/space.store";
import {
  findBestMatch,
  warmupModel,
  onProgress,
  type MatchResult,
} from "@/lib/ai/embeddings";
import {
  Sparkles,
  RotateCcw,
  Send,
  ArrowLeft,
  Loader2,
  Check,
  Users,
} from "lucide-react";
import Link from "next/link";

// ── Inner Content (must be inside RoomProvider) ───────────────────────

function TiebreakerContent() {
  const userId = useSpaceStore((s) => s.userId);
  const partnerId = useSpaceStore((s) => s.partnerId);
  const partnerName = useSpaceStore((s) => s.partnerName);

  // Deterministic user mapping: userA = min(userId, partnerId)
  const isUserA = Boolean(userId && partnerId && userId < partnerId);

  // Local input state (not sent to Liveblocks until submit)
  const [inputs, setInputs] = useState(["", "", ""]);
  const [isComputing, setIsComputing] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [error, setError] = useState("");

  // Liveblocks storage
  const tiebreakerState = useStorage((root) => root.tiebreakerState);
  const others = useOthers();
  const partnerOnline = others.length > 0;

  // Warmup AI model on mount
  useEffect(() => {
    warmupModel();
    const cleanup = onProgress((status) => setAiProgress(status));
    return cleanup;
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────

  const submitInputs = useMutation(
    ({ storage }, userInputs: string[]) => {
      const tb = storage.get("tiebreakerState");
      if (!tb) return;

      if (isUserA) {
        tb.set("userAInputs", userInputs);
        tb.set("userASubmitted", true);
      } else {
        tb.set("userBInputs", userInputs);
        tb.set("userBSubmitted", true);
      }
    },
    [isUserA],
  );

  const setResult = useMutation(
    ({ storage }, result: MatchResult | null) => {
      const tb = storage.get("tiebreakerState");
      if (!tb) return;
      tb.set("result", result);
    },
    [],
  );

  const resetState = useMutation(({ storage }) => {
    const tb = storage.get("tiebreakerState");
    if (!tb) return;
    tb.set("userAInputs", null);
    tb.set("userBInputs", null);
    tb.set("userASubmitted", false);
    tb.set("userBSubmitted", false);
    tb.set("result", null);
  }, []);

  // ── Submit Handler ────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const trimmed = inputs.map((s) => s.trim()).filter(Boolean);
    if (trimmed.length < 3) {
      setError("Enter all 3 options");
      return;
    }
    setError("");
    submitInputs(trimmed);
  }, [inputs, submitInputs]);

  // ── AI Matching (triggered when both submit) ──────────────────────

  const mySubmitted = isUserA
    ? tiebreakerState?.userASubmitted
    : tiebreakerState?.userBSubmitted;
  const partnerSubmitted = isUserA
    ? tiebreakerState?.userBSubmitted
    : tiebreakerState?.userASubmitted;
  const bothSubmitted = mySubmitted && partnerSubmitted;

  useEffect(() => {
    if (
      !bothSubmitted ||
      tiebreakerState?.result !== null ||
      isComputing
    )
      return;
    if (!tiebreakerState?.userAInputs || !tiebreakerState?.userBInputs)
      return;

    let cancelled = false;
    setIsComputing(true);

    findBestMatch(tiebreakerState.userAInputs, tiebreakerState.userBInputs)
      .then(({ match }) => {
        if (cancelled) return;
        setResult(match);
      })
      .catch((err) => {
        console.error("findBestMatch error:", err);
        if (!cancelled) setError("AI matching failed. Try again.");
      })
      .finally(() => {
        if (!cancelled) setIsComputing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bothSubmitted, tiebreakerState, isComputing, setResult]);

  // ── Render Helpers ────────────────────────────────────────────────

  const updateInput = (index: number, value: string) => {
    setInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const formatSimilarity = (sim: number) =>
    `${Math.round(sim * 100)}%`;

  // ── RESULT VIEW ───────────────────────────────────────────────────

  if (tiebreakerState?.result !== null && tiebreakerState?.result !== undefined) {
    const result = tiebreakerState.result;
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <Header />
        <div className="mx-auto max-w-md space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/20">
              <Sparkles className="h-8 w-8 text-violet-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                It&apos;s a Match!
              </h2>
              <p className="text-sm text-zinc-400">
                Your closest choices aligned
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4">
                <p className="text-xs text-violet-400 mb-1">You said</p>
                <p className="text-lg font-medium text-white">
                  {isUserA ? result.optionA : result.optionB}
                </p>
              </div>
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4">
                <p className="text-xs text-violet-400 mb-1">
                  {partnerName ?? "Partner"} said
                </p>
                <p className="text-lg font-medium text-white">
                  {isUserA ? result.optionB : result.optionA}
                </p>
              </div>
            </div>
            <div className="text-sm text-zinc-400">
              Similarity:{" "}
              <span className="text-violet-400 font-medium">
                {formatSimilarity(result.similarity)}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              setInputs(["", "", ""]);
              setError("");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ── NO MATCH RESULT (both submitted but result is null and not computing) ─
  if (bothSubmitted && !isComputing && tiebreakerState?.result === null) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <Header />
        <div className="mx-auto max-w-md space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
              <Sparkles className="h-8 w-8 text-zinc-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">
                No Strong Match
              </h2>
              <p className="text-sm text-zinc-400">
                Your choices were too different this time. Try again with
                more similar options!
              </p>
            </div>
            {/* Show what both entered */}
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-xs text-zinc-500 mb-2">Your options</p>
                {(isUserA
                  ? tiebreakerState?.userAInputs
                  : tiebreakerState?.userBInputs
                )?.map((opt, i) => (
                  <p key={i} className="text-sm text-zinc-300 mb-1">
                    {opt}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-2">
                  {partnerName ?? "Partner"}&apos;s options
                </p>
                {(isUserA
                  ? tiebreakerState?.userBInputs
                  : tiebreakerState?.userAInputs
                )?.map((opt, i) => (
                  <p key={i} className="text-sm text-zinc-300 mb-1">
                    {opt}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              setInputs(["", "", ""]);
              setError("");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── COMPUTING VIEW ────────────────────────────────────────────────

  if (isComputing || (bothSubmitted && tiebreakerState?.result === undefined)) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <Header />
        <div className="mx-auto max-w-md">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10">
              <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-white mb-2">
                Finding Your Match…
              </h2>
              <p className="text-sm text-zinc-400">
                {aiProgress || "Analyzing your choices with AI"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── INPUT VIEW ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <Header />
      <div className="mx-auto max-w-md space-y-6">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                partnerOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
              }`}
            />
            <span className="text-xs text-zinc-400">
              {partnerOnline
                ? `${partnerName ?? "Partner"} is here`
                : `Waiting for ${partnerName ?? "partner"}…`}
            </span>
          </div>
          {partnerSubmitted && (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="h-3 w-3" />
              <span>{partnerName ?? "Partner"} submitted</span>
            </div>
          )}
        </div>

        {/* Input card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-medium text-white mb-1">
              Enter 3 Options
            </h2>
            <p className="text-sm text-zinc-400">
              e.g. restaurant names, movie picks, date ideas
            </p>
          </div>

          <div className="space-y-3">
            {inputs.map((val, idx) => (
              <input
                key={idx}
                type="text"
                value={mySubmitted ? "•••••" : val}
                disabled={Boolean(mySubmitted)}
                onChange={(e) => updateInput(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          {!mySubmitted ? (
            <button
              onClick={handleSubmit}
              disabled={inputs.some((s) => !s.trim())}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              Submit
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
              <Check className="h-4 w-4 text-emerald-400" />
              Submitted — waiting for {partnerName ?? "partner"}
            </div>
          )}
        </div>

        {/* Partner's masked inputs */}
        {partnerSubmitted && !bothSubmitted && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-3">
            <p className="text-xs text-zinc-500 text-center">
              {partnerName ?? "Partner"}&apos;s options (hidden)
            </p>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-700 bg-zinc-800/30 px-4 py-3 text-sm text-zinc-600 tracking-widest"
              >
                • • • • •
              </div>
            ))}
          </div>
        )}
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
          <Sparkles className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Tiebreaker</h1>
          <p className="text-xs text-zinc-500">AI-powered decision maker</p>
        </div>
      </div>
    </div>
  );
}

// ── Outer Wrapper (RoomProvider) ──────────────────────────────────────

export function TiebreakerRoom() {
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
      id={`${spaceId}-tiebreaker`}
      initialPresence={{ isOnline: true }}
      initialStorage={{
        tiebreakerState: new LiveObject({
          userAInputs: null,
          userBInputs: null,
          userASubmitted: false,
          userBSubmitted: false,
          result: null,
        }),
      }}
    >
      <TiebreakerContent />
    </RoomProvider>
  );
}
