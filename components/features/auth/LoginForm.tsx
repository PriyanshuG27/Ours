"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "idle" | "email";
type AuthStatus = "idle" | "loading" | "magic_link_sent" | "error";

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>("idle");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  // If the browser restores a cached /login page from the back button, 
  // push them forward if they are actually still logged in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/home");
      }
    });
  }, [router]);

  async function handleGoogleLogin() {
    setStatus("loading");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("magic_link_sent");
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="w-full max-w-sm space-y-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">Ours</h1>
        <p className="mt-2 text-sm text-neutral-400">
          A private space for just us two.
        </p>
      </div>

      {status === "magic_link_sent" ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <p className="text-sm text-emerald-400">
            Magic link sent to{" "}
            <span className="font-medium text-emerald-300">{email}</span>.
          </p>
          <p className="mt-1 text-xs text-emerald-500">
            Check your inbox and click the link to sign in.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-black px-2 text-neutral-500">or</span>
            </div>
          </div>

          {mode === "email" ? (
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleMagicLink();
                  }
                }}
                disabled={isLoading}
                autoFocus
              />
              <button
                onClick={handleMagicLink}
                disabled={isLoading || !email.trim()}
                className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Send magic link"}
              </button>
              <button
                onClick={() => {
                  setMode("idle");
                  setErrorMessage("");
                }}
                className="w-full text-xs text-neutral-500 transition-colors hover:text-neutral-300"
              >
                Back
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMode("email")}
              disabled={isLoading}
              className="w-full rounded-lg border border-neutral-800 bg-transparent px-4 py-3 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue with Email
            </button>
          )}
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
