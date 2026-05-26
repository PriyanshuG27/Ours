"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type Mode = "choose" | "create" | "join";
type Status = "idle" | "loading" | "error";

interface CreateResult {
  spaceId: string;
  inviteCode: string;
}

interface SpaceStatusResult {
  hasPartner: boolean;
  spaceId: string | null;
}

export function SpaceSetup() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Create mode state
  const [spaceName, setSpaceName] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Join mode state
  const [joinCode, setJoinCode] = useState("");

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/space/status");
        if (!res.ok) return;

        const data: SpaceStatusResult = await res.json();

        if (data.hasPartner) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          router.refresh();
          router.push("/home");
        }
      } catch {
        // Silently retry on next interval
      }
    }, 3000);
  }, [router]);

  async function handleCreate() {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/space/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceName: spaceName.trim() || null }),
      });

      if (res.status === 409) {
        setStatus("error");
        setErrorMessage("You already have an active space.");
        return;
      }

      if (!res.ok) {
        setStatus("error");
        setErrorMessage("Failed to create space. Please try again.");
        return;
      }

      const data: CreateResult = await res.json();
      setInviteCode(data.inviteCode);
      setStatus("idle");
      startPolling();
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/space/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      if (res.status === 404) {
        setStatus("error");
        setErrorMessage("Invite code not found.");
        return;
      }

      if (res.status === 409) {
        setStatus("error");
        setErrorMessage("This space is already full.");
        return;
      }

      if (res.status === 400) {
        setStatus("error");
        setErrorMessage("You are already a member of this space.");
        return;
      }

      if (!res.ok) {
        setStatus("error");
        setErrorMessage("Failed to join space. Please try again.");
        return;
      }

      router.refresh();
      router.push("/home");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }

  const isLoading = status === "loading";

  // After space is created — show invite code and waiting state
  if (inviteCode) {
    return (
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Your Space is Ready</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Share this code with your partner
          </p>
        </div>

        <div className="flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <span className="font-mono text-4xl font-bold tracking-[0.3em] text-white">
            {inviteCode}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Waiting for your partner to join...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Set Up Your Space</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Create a new space or join your partner&apos;s.
        </p>
      </div>

      {mode === "choose" && (
        <div className="space-y-3">
          <button
            onClick={() => setMode("create")}
            className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Create a Space
          </button>
          <button
            onClick={() => setMode("join")}
            className="w-full rounded-lg border border-neutral-800 bg-transparent px-4 py-3 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white"
          >
            Join a Space
          </button>
        </div>
      )}

      {mode === "create" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="space-name"
              className="block text-xs font-medium text-neutral-400"
            >
              Space name <span className="text-neutral-600">(optional)</span>
            </label>
            <input
              id="space-name"
              type="text"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder='e.g. "us" or "the smiths"'
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Space"}
          </button>
          <button
            onClick={() => {
              setMode("choose");
              setErrorMessage("");
            }}
            className="w-full text-xs text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Back
          </button>
        </div>
      )}

      {mode === "join" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="invite-code"
              className="block text-xs font-medium text-neutral-400"
            >
              Invite code
            </label>
            <input
              id="invite-code"
              type="text"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.toUpperCase().slice(0, 6))
              }
              placeholder="ABC123"
              maxLength={6}
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-center font-mono text-lg tracking-[0.2em] text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              disabled={isLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleJoin();
                }
              }}
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={isLoading || joinCode.trim().length !== 6}
            className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Joining..." : "Join Space"}
          </button>
          <button
            onClick={() => {
              setMode("choose");
              setErrorMessage("");
            }}
            className="w-full text-xs text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Back
          </button>
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
          <p className="text-xs text-red-400">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
