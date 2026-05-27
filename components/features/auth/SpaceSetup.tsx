"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Copy, Check, Loader2 } from "lucide-react";
import { generateSpaceKey, encryptPayload, initSodium } from "@/lib/crypto/e2ee";
import { saveKey } from "@/hooks/use-e2ee-key";
import { supabase } from "@/lib/supabase/client";

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

const E2EE_TEST_PLAINTEXT = "ours-e2ee-verification-token";

export function SpaceSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mode, setMode] = useState<Mode>("choose");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Create mode state
  const [spaceName, setSpaceName] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Join mode state
  const [joinCode, setJoinCode] = useState("");

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/space/status");
        if (!res.ok) return;

        const data: SpaceStatusResult = await res.json();

        if (data.hasPartner) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          router.refresh();
          router.push("/home");
        }
      } catch {
        // Silently retry on next interval
      }
    }, 3000);
  }, [router]);

  // Handle Magic Link Auto-Join on mount
  useEffect(() => {
    const codeParam = searchParams.get("code");
    const hashStr = typeof window !== "undefined" ? window.location.hash : "";
    
    // Check if it's a magic link: ?code=ABC123#key=xyz
    if (codeParam && hashStr.startsWith("#key=")) {
      const e2eeKey = hashStr.replace("#key=", "");
      if (codeParam.length === 6 && e2eeKey) {
        setMode("join");
        setJoinCode(codeParam);
        // Auto-trigger join
        handleJoinSubmit(codeParam, e2eeKey);
      }
    }
  }, [searchParams]);

  async function handleCreate() {
    setStatus("loading");
    setErrorMessage("");

    try {
      // 1. Create space on server
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
      if (!res.ok) throw new Error("Failed to create space");

      const data: CreateResult = await res.json();
      const { spaceId, inviteCode } = data;

      // 2. Generate E2EE Key
      await initSodium();
      const key = await generateSpaceKey();

      // 3. Encrypt test payload & update space
      const testPayload = await encryptPayload(E2EE_TEST_PLAINTEXT, key);
      const { error: updateError } = await supabase
        .from("spaces")
        .update({ encrypted_test_payload: testPayload })
        .eq("id", spaceId);

      if (updateError) throw new Error("Failed to secure space");

      // 4. Save key locally
      await saveKey(spaceId, key);

      // 5. Update UI
      setInviteCode(inviteCode);
      setGeneratedKey(key);
      setStatus("idle");
      startPolling();
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Network error. Please try again.");
    }
  }

  // Used for both manual join and auto-join
  async function handleJoinSubmit(code: string, e2eeKeyToSave?: string) {
    if (code.length !== 6) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      // 1. Join space on server
      const res = await fetch("/api/space/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      if (res.status === 404) throw new Error("Invite code not found.");
      if (res.status === 409) throw new Error("This space is already full.");
      if (res.status === 400) throw new Error("You are already a member of this space.");
      if (!res.ok) throw new Error("Failed to join space.");

      // If we joined via Magic Link, save the key
      if (e2eeKeyToSave) {
        // Fetch the space id to save the key against
        const { data: spaces } = await supabase
          .from("spaces")
          .select("id")
          .eq("is_active", true)
          .limit(1);
        
        const spaceId = spaces?.[0]?.id;
        if (spaceId) {
          await saveKey(spaceId, e2eeKeyToSave);
        }
      }

      router.refresh();
      router.push("/home");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Network error. Please try again.");
    }
  }

  const handleCopyMagicLink = useCallback(async () => {
    if (!inviteCode || !generatedKey) return;
    
    // Construct the Magic Link
    const magicLink = `${window.location.origin}/setup?code=${inviteCode}#key=${generatedKey}`;
    
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed
    }
  }, [inviteCode, generatedKey]);

  const isLoading = status === "loading";

  // ---- CREATOR: WAITING FOR PARTNER ----
  if (inviteCode && generatedKey) {
    return (
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
            <Shield className="h-7 w-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Space Secured</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Your space is end-to-end encrypted. Share this Magic Link with your partner to invite them.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80">
          <div className="flex flex-col items-center justify-center p-6 space-y-2">
             <span className="font-mono text-3xl font-bold tracking-[0.2em] text-white">
               {inviteCode}
             </span>
             <span className="text-xs text-neutral-500 font-mono">
               + Encryption Key
             </span>
          </div>

          <button
            onClick={handleCopyMagicLink}
            className="flex w-full items-center justify-center gap-2 border-t border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800/50 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">Copied Magic Link</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Magic Link
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Waiting for your partner to join...
        </div>
      </div>
    );
  }

  // ---- MAIN MENU ----
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
            Join with Magic Link
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
            className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 flex justify-center items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Creating & Securing..." : "Create Space"}
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
              Magic Link
            </label>
            <input
              id="invite-code"
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.trim());
                setErrorMessage("");
              }}
              placeholder="Paste Magic Link here"
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              disabled={isLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = joinCode.trim();
                  if (val.includes("code=") && val.includes("#key=")) {
                    const codeMatch = val.match(/code=([A-Za-z0-9]{6})/);
                    const keyMatch = val.match(/#key=([^&]+)/);
                    if (codeMatch && keyMatch) {
                      handleJoinSubmit(codeMatch[1].toUpperCase(), keyMatch[1]);
                      return;
                    }
                  }
                  setErrorMessage("Invalid Magic Link. Please paste the full link.");
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              const val = joinCode.trim();
              if (val.includes("code=") && val.includes("#key=")) {
                const codeMatch = val.match(/code=([A-Za-z0-9]{6})/);
                const keyMatch = val.match(/#key=([^&]+)/);
                if (codeMatch && keyMatch) {
                  handleJoinSubmit(codeMatch[1].toUpperCase(), keyMatch[1]);
                  return;
                }
              }
              setErrorMessage("Invalid Magic Link. Please paste the full link.");
            }}
            disabled={isLoading || !joinCode.trim()}
            className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 flex justify-center items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Joining..." : "Join Space"}
          </button>
          <button
            onClick={() => {
              setMode("choose");
              setErrorMessage("");
            }}
            className="w-full text-xs text-neutral-500 transition-colors hover:text-neutral-300"
            disabled={isLoading}
          >
            Back
          </button>
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center mt-4">
          <p className="text-xs text-red-400">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
