"use client";

import { useState, useEffect } from "react";
import { Task, SkipRequest, MoodTag, TaskCompletion } from "@/types/app.types";
import { CompletionModal } from "./CompletionModal";
import { useBroadcastEvent } from "@/lib/liveblocks/config";
import { Snowflake, BellRing } from "lucide-react";
import { useE2EEKey } from "@/hooks/use-e2ee-key";

type TaskCardProps = {
  task: Task;
  skipRequests: SkipRequest[];
  isOwner: boolean; // For personal tasks
  currentUserId: string; // Needed for co-op logic
  onActionComplete: () => void;
};

export function TaskCard({ task, skipRequests, isOwner, currentUserId, onActionComplete }: TaskCardProps) {
  const broadcast = useBroadcastEvent();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [loading, setLoading] = useState(false);

  const { encrypt, decrypt } = useE2EEKey();
  const [decryptedTitle, setDecryptedTitle] = useState(task.title);
  const [decryptedDescription, setDecryptedDescription] = useState(task.description);
  const [decryptedSkipReason, setDecryptedSkipReason] = useState<string | null>(null);

  const pendingSkip = skipRequests.find((r) => r.status === "pending" && r.task_id === task.id);

  useEffect(() => {
    let active = true;
    const loadDecrypted = async () => {
      try {
        const title = await decrypt(task.title);
        if (active) setDecryptedTitle(title);
      } catch (e) {
        if (active) setDecryptedTitle('[unable to decrypt]');
      }

      if (task.description) {
        try {
          const desc = await decrypt(task.description);
          if (active) setDecryptedDescription(desc);
        } catch (e) {
          if (active) setDecryptedDescription('[unable to decrypt]');
        }
      } else {
        if (active) setDecryptedDescription(null);
      }
      
      if (pendingSkip?.reason) {
        try {
          const reason = await decrypt(pendingSkip.reason);
          if (active) setDecryptedSkipReason(reason);
        } catch (e) {
          if (active) setDecryptedSkipReason('[unable to decrypt]');
        }
      } else {
        if (active) setDecryptedSkipReason(null);
      }
    };
    loadDecrypted();
    return () => { active = false; };
  }, [task.title, task.description, pendingSkip?.reason, decrypt]);

  // Optimistic states
  const [optimisticOwnerStreak, setOptimisticOwnerStreak] = useState(task.streak_count);
  const [optimisticPartnerStreak, setOptimisticPartnerStreak] = useState(task.partner_streak_count);
  const [optimisticSharedStreak, setOptimisticSharedStreak] = useState(task.shared_streak_count);
  const [optimisticFreezes, setOptimisticFreezes] = useState(task.streak_freezes);
  const [optimisticCompletions, setOptimisticCompletions] = useState<TaskCompletion[]>(task.completions || []);

  useEffect(() => {
    setOptimisticOwnerStreak(task.streak_count);
    setOptimisticPartnerStreak(task.partner_streak_count);
    setOptimisticSharedStreak(task.shared_streak_count);
    setOptimisticFreezes(task.streak_freezes);
    setOptimisticCompletions(task.completions || []);
  }, [task]);

  // For co-op, we check if CURRENT USER completed today
  // For personal, we check if owner completed today
  const isCompletedToday = () => {
    if (optimisticCompletions.length === 0) return false;
    const userCompletions = optimisticCompletions.filter(c => task.is_coop ? c.completed_by === currentUserId : true);
    if (userCompletions.length === 0) return false;
    
    // Sort desc by completed_at
    const latest = [...userCompletions].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];
    const lastTime = new Date(latest.completed_at).getTime();
    const now = new Date().getTime();
    return (now - lastTime) / (1000 * 60 * 60) < 20;
  };

  const partnerCompletedToday = () => {
    if (!task.is_coop || optimisticCompletions.length === 0) return false;
    const partnerCompletions = optimisticCompletions.filter(c => c.completed_by !== currentUserId);
    if (partnerCompletions.length === 0) return false;
    
    const latest = [...partnerCompletions].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];
    const lastTime = new Date(latest.completed_at).getTime();
    const now = new Date().getTime();
    return (now - lastTime) / (1000 * 60 * 60) < 20;
  };

  const completedToday = isCompletedToday();
  const canComplete = task.is_coop ? !completedToday : isOwner && !completedToday;
  const canNudge = task.is_coop ? !partnerCompletedToday() : (!isOwner && !completedToday);

  const handleComplete = async (mood: MoodTag, file: Blob | null) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("moodTag", mood);
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setIsCompleting(false);
        const data = await res.json();
        
        setOptimisticOwnerStreak(data.streakCount);
        setOptimisticPartnerStreak(data.partnerStreakCount);
        setOptimisticSharedStreak(data.sharedStreakCount);
        setOptimisticFreezes(data.streakFreezes);
        
        // Optimistically add completion
        setOptimisticCompletions([{
          id: "temp",
          task_id: task.id,
          completed_by: currentUserId,
          completed_at: new Date().toISOString(),
          mood_tag: mood,
          streak_at_completion: task.is_coop ? data.sharedStreakCount : data.streakCount
        }, ...optimisticCompletions]);

        onActionComplete();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to complete task");
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleSkipRequest = async (useFreeze: boolean = false) => {
    if (!useFreeze && !skipReason.trim()) return;
    setLoading(true);
    try {
      const encryptedReason = !useFreeze && skipReason.trim() ? await encrypt(skipReason.trim()) : null;
      const res = await fetch(`/api/tasks/${task.id}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: encryptedReason, useFreeze }),
      });
      if (res.ok) {
        setIsSkipping(false);
        setSkipReason("");
        if (useFreeze) {
          setOptimisticFreezes(f => Math.max(0, f - 1));
        }
        onActionComplete();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to request skip");
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleSkipResponse = async (skipId: string, decision: "approved" | "denied") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/skip/${skipId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        if (decision === "denied") {
          // Reset relevant streak optimistically
          setOptimisticOwnerStreak(0);
        }
        onActionComplete();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to respond");
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const sendNudge = () => {
    broadcast({ type: "NUDGE", taskId: task.id });
    // Optimistic UI for nudge sent could be added here
  };

  const renderMoodMeter = () => {
    // Show last 7 completions visually
    let relevantCompletions: TaskCompletion[] = [];
    
    if (task.is_coop) {
      // Group by local date string to find days where BOTH completed
      const byDate: Record<string, TaskCompletion[]> = {};
      optimisticCompletions.forEach(c => {
        const d = new Date(c.completed_at).toLocaleDateString();
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(c);
      });
      // Only show a bar/emoji if BOTH people completed it (length >= 2)
      // We pick the current user's completion to show their specific mood for that shared completion
      relevantCompletions = Object.values(byDate)
        .filter(arr => arr.length >= 2)
        .map(arr => arr.find(c => c.completed_by === currentUserId) || arr[0])
        // Sort descending by date
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    } else {
      relevantCompletions = optimisticCompletions;
    }

    const recent = [...relevantCompletions].slice(0, 15).reverse();
    if (recent.length === 0) return null;

    // Calculate most frequent mood
    const moodCounts: Record<string, number> = {};
    let maxMood = recent[0].mood_tag;
    let maxCount = 0;
    
    recent.forEach(c => {
      moodCounts[c.mood_tag] = (moodCounts[c.mood_tag] || 0) + 1;
      if (moodCounts[c.mood_tag] > maxCount) {
        maxCount = moodCounts[c.mood_tag];
        maxMood = c.mood_tag;
      }
    });

    const colors: Record<MoodTag, string> = {
      [MoodTag.EASY]: "bg-emerald-500",
      [MoodTag.STRUGGLED]: "bg-yellow-500",
      [MoodTag.FORCED]: "bg-orange-500",
      [MoodTag.PROUD]: "bg-purple-500",
    };

    const emojis: Record<MoodTag, string> = {
      [MoodTag.EASY]: "😌",
      [MoodTag.STRUGGLED]: "😤",
      [MoodTag.FORCED]: "😑",
      [MoodTag.PROUD]: "🌟",
    };

    return (
      <div className="flex items-center gap-3 mt-3">
        <div 
          className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700/50 shadow-sm shrink-0"
          title={`Average Mood`}
        >
          <span className="text-[14px]">{emojis[maxMood]}</span>
        </div>
        
        <div className="flex gap-1 items-center flex-wrap">
          {recent.map((c, i) => (
            <div 
              key={i} 
              className={`h-1.5 w-3 rounded-full ${c.is_flagged ? 'bg-red-500 ring-1 ring-red-500/50' : colors[c.mood_tag]} opacity-80`} 
              title={c.is_flagged ? "Flagged: Inaccurate Photo" : c.mood_tag}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-lg font-medium text-zinc-100">{decryptedTitle}</h3>
          {decryptedDescription && (
            <p className="text-sm text-zinc-400 mt-1">{decryptedDescription}</p>
          )}
          {renderMoodMeter()}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {task.is_coop ? (
             <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full whitespace-nowrap text-xs">
                  <span>Shared 🔥 {optimisticSharedStreak}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] text-zinc-500">You: {optimisticOwnerStreak}</span>
                  <span className="text-[10px] text-zinc-500">Partner: {optimisticPartnerStreak}</span>
                </div>
             </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full whitespace-nowrap">
              <span className="text-lg">🔥</span>
              <span className="font-bold">{optimisticOwnerStreak}</span>
            </div>
          )}
          
          {(canComplete || isOwner) && optimisticFreezes > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
              <Snowflake className="w-3 h-3" />
              <span>{optimisticFreezes} Freezes</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mt-2">
        {canComplete && (
          <button
            onClick={() => setIsCompleting(true)}
            disabled={!!pendingSkip || loading}
            className="flex-1 bg-zinc-100 text-zinc-900 py-2.5 rounded-xl font-medium text-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Complete
          </button>
        )}
        
        {completedToday && task.is_coop && (
          <div className="flex-1 bg-zinc-800/50 text-zinc-400 py-2.5 rounded-xl font-medium text-sm text-center border border-zinc-800">
            Done for today
          </div>
        )}

        {completedToday && !task.is_coop && isOwner && (
          <div className="flex-1 bg-zinc-800/50 text-zinc-400 py-2.5 rounded-xl font-medium text-sm text-center border border-zinc-800">
            Done for today
          </div>
        )}

        {canComplete && (
          <button
            onClick={() => setIsSkipping(true)}
            disabled={!!pendingSkip || loading}
            className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium text-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Skip
          </button>
        )}

        {canNudge && (
           <button
             onClick={sendNudge}
             className="px-4 py-2.5 rounded-xl bg-violet-600/20 text-violet-400 font-medium text-sm hover:bg-violet-600/30 transition-colors flex items-center gap-2"
           >
             <BellRing className="w-4 h-4" /> Nudge
           </button>
        )}
      </div>

      {/* Pending Skip Notification for Partner */}
      {!canComplete && !isOwner && !task.is_coop && pendingSkip && (
        <div className="mt-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 animate-in fade-in">
          <p className="text-sm text-indigo-200 mb-3">
            <span className="font-semibold">Skip requested:</span> &ldquo;{decryptedSkipReason || "No reason provided"}&rdquo;
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleSkipResponse(pendingSkip.id, "approved")}
              disabled={loading}
              className="flex-1 bg-indigo-500 text-white py-2 rounded-lg font-medium text-sm hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleSkipResponse(pendingSkip.id, "denied")}
              disabled={loading}
              className="flex-1 bg-transparent border border-indigo-500/30 text-indigo-300 py-2 rounded-lg font-medium text-sm hover:bg-indigo-500/10 disabled:opacity-50 transition-colors"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Modals/Inputs */}
      {isCompleting && (
        <CompletionModal
          onComplete={handleComplete}
          onCancel={() => setIsCompleting(false)}
          isSubmitting={loading}
        />
      )}

      {isSkipping && (
        <div className="mt-2 bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 animate-in slide-in-from-top-2">
          <p className="text-sm font-medium text-zinc-300 mb-2">Skip Task</p>
          
          {optimisticFreezes > 0 && (
            <button
              onClick={() => handleSkipRequest(true)}
              disabled={loading}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-500/20 text-blue-400 font-medium text-sm hover:bg-blue-500/30 transition-colors border border-blue-500/30"
            >
              <Snowflake className="w-4 h-4" /> Use a Streak Freeze
            </button>
          )}

          <div className="flex items-center gap-2 mb-3">
            <hr className="flex-1 border-zinc-700" />
            <span className="text-xs text-zinc-500">or ask partner</span>
            <hr className="flex-1 border-zinc-700" />
          </div>

          <input
            type="text"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Why are you skipping?"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleSkipRequest(false)}
              disabled={!skipReason.trim() || loading}
              className="flex-1 bg-zinc-100 text-zinc-900 py-2 rounded-lg font-medium text-sm hover:bg-white disabled:opacity-50 transition-colors"
            >
              Request Skip
            </button>
            <button
              onClick={() => setIsSkipping(false)}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
