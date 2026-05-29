"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useSpaceStore } from "@/store/space.store";
import { EnergyLog } from "@/types/app.types";

type EnergyPickerProps = {
  period: "morning" | "night";
  onSubmit: (level: number) => void;
};

const ENERGY_LEVELS = [
  { level: 1, emoji: "😴", label: "Exhausted" },
  { level: 2, emoji: "😐", label: "Tired" },
  { level: 3, emoji: "🙂", label: "Okay" },
  { level: 4, emoji: "😊", label: "Good" },
  { level: 5, emoji: "✨", label: "Great" },
];

export function EnergyPicker({ period, onSubmit }: EnergyPickerProps) {
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const userId = useSpaceStore((state) => state.userId);

  useEffect(() => {
    let isMounted = true;
    async function loadToday() {
      if (!userId) return;
      try {
        const res = await fetch("/api/energy?days=1");
        if (!res.ok) return;
        const data = await res.json();
        const logs: EnergyLog[] = data.logs || [];
        const myLog = logs.find((l) => l.user_id === userId);
        if (myLog && isMounted) {
          const level = period === "morning" ? myLog.morning_level : myLog.night_level;
          if (level !== null && level !== undefined) {
            setCurrentLevel(level);
          }
        }
      } catch (err) {
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadToday();
    return () => {
      isMounted = false;
    };
  }, [userId, period]);

  async function handleTap(level: number) {
    if (isSubmitting || isLoading) return;
    setIsSubmitting(true);
    setCurrentLevel(level);

    try {
      const res = await fetch("/api/energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, period }),
      });

      if (res.ok) {
        onSubmit(level);
      } else {
        // Revert on fail
        setCurrentLevel(null);
      }
    } catch (error) {
      setCurrentLevel(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 bg-zinc-900/50 rounded-3xl border border-zinc-800">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-xl font-medium text-white mb-1">
          {period === "morning" ? "Good morning!" : "Good evening!"}
        </h2>
        <p className="text-sm text-zinc-400">
          {period === "morning"
            ? "How's your energy this morning?"
            : "How are you ending the day?"}
        </p>
      </div>

      <div className="flex justify-between items-center gap-2 max-w-sm mx-auto">
        {ENERGY_LEVELS.map((item) => {
          const isSelected = currentLevel === item.level;
          return (
            <button
              key={item.level}
              onClick={() => handleTap(item.level)}
              disabled={isSubmitting}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl flex-1 transition-all active:scale-95 ${
                isSelected
                  ? "bg-violet-500/20 border-violet-500 text-violet-400"
                  : "bg-zinc-800/30 border-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              } border`}
            >
              <span className={`text-3xl transition-transform ${isSelected ? "scale-110" : ""}`}>
                {item.emoji}
              </span>
              <span className={`text-xs font-medium ${isSelected ? "text-violet-300" : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
