"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Lock, Send, Sparkles } from "lucide-react";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { useSpaceStore } from "@/store/space.store";
import { Question } from "@/types/app.types";

type AnswersState = {
  mine: string | null;
  theirs: string | null;
};

export function QuestionOfDay() {
  const { encrypt, decrypt, isLoaded: keyLoaded } = useE2EEKey();
  const partnerName = useSpaceStore((state) => state.partnerName);

  const [question, setQuestion] = useState<Question | null>(null);
  const [status, setStatus] = useState<"loading" | "unanswered" | "waiting" | "revealing" | "revealed">("loading");
  const [answers, setAnswers] = useState<AnswersState | null>(null);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const loadData = async (isPolling = false) => {
    try {
      const res = await fetch("/api/questions/today");
      if (!res.ok) return;
      const data = await res.json();
      
      setQuestion(data.question);

      if (data.answers && data.answers.mine && data.answers.theirs) {
        clearPolling(); // Stop polling if both have answered
        
        // Decrypt answers
        const decMine = await decrypt(data.answers.mine);
        const decTheirs = await decrypt(data.answers.theirs);
        setAnswers({ mine: decMine, theirs: decTheirs });
        
        if (isPolling) {
          // If we were polling and just got it, do reveal animation
          setStatus("revealing");
          setTimeout(() => {
            setStatus("revealed");
          }, 2000);
        } else {
          setStatus("revealed");
        }
      } else if (data.hasUserAnswered) {
        setStatus("waiting");
      } else {
        setStatus("unanswered");
      }
    } catch (err) {
    }
  };

  useEffect(() => {
    if (keyLoaded) {
      loadData();
    }
    return () => {
      clearPolling(); // Clean up on unmount
    };
  }, [keyLoaded]);

  // Handle polling when waiting
  useEffect(() => {
    if (status === "waiting") {
      pollIntervalRef.current = setInterval(() => {
        loadData(true);
      }, 30000);
    } else {
      clearPolling(); // Clean up if status changes away from waiting
    }

    return () => {
      clearPolling();
    };
  }, [status]);

  const handleSubmit = async () => {
    if (!draft.trim() || !question) return;
    setIsSubmitting(true);
    try {
      const encryptedAnswer = await encrypt(draft.trim());
      const res = await fetch("/api/questions/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, encryptedAnswer }),
      });
      if (res.ok) {
        setDraft("");
        setStatus("waiting"); // This will trigger the polling useEffect
      }
    } catch (err) {
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center p-8 bg-zinc-900/50 rounded-3xl border border-zinc-800">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h3 className="text-xs font-semibold tracking-wider text-violet-300 uppercase">Question of the Day</h3>
      </div>
      
      <p className="text-lg font-medium text-white mb-6 leading-snug">
        {question.question_text}
      </p>

      {status === "unanswered" && (
        <div className="flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your answer..."
            className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none min-h-[100px]"
          />
          <button
            onClick={handleSubmit}
            disabled={!draft.trim() || isSubmitting}
            className="flex items-center justify-center gap-2 w-full bg-white hover:bg-zinc-200 text-black font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitting ? "Locking..." : "Lock Answer"}
          </button>
          <p className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1 mt-1">
            <Lock className="w-3 h-3" /> Blind reveal — {partnerName || "your partner"} can&apos;t see this until they answer.
          </p>
        </div>
      )}

      {status === "waiting" && (
        <div className="bg-black/20 border border-zinc-800/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-10 h-10 bg-violet-500/10 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300">Answer locked.</p>
            <p className="text-xs text-zinc-500 mt-1">Waiting for {partnerName || "partner"} to submit theirs...</p>
          </div>
        </div>
      )}

      {status === "revealing" && (
        <div className="bg-violet-900/20 border border-violet-500/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 animate-pulse">
          <Sparkles className="w-8 h-8 text-violet-400" />
          <p className="text-sm font-medium text-violet-200">{partnerName || "Partner"} answered! Revealing...</p>
        </div>
      )}

      {status === "revealed" && answers && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase mb-2">You</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{answers.mine}</p>
          </div>
          <div className="bg-violet-900/10 border border-violet-500/20 rounded-2xl p-4">
            <p className="text-[10px] font-semibold tracking-wider text-violet-400/80 uppercase mb-2">{partnerName || "Partner"}</p>
            <p className="text-sm text-zinc-200 leading-relaxed">{answers.theirs}</p>
          </div>
        </div>
      )}
    </div>
  );
}
