"use client";

import { useState } from "react";
import { X, Sparkles, AlertCircle, Frown, Meh } from "lucide-react";
import { BoardMoodTag, BoardColumn as BoardColumnEnum } from "@/types/app.types";

type BoardAddCardFormProps = {
  column: BoardColumnEnum;
  onAddCard: (text: string, column: BoardColumnEnum, mood: BoardMoodTag | null) => Promise<void>;
  onCancel: () => void;
};

export function BoardAddCardForm({ column, onAddCard, onCancel }: BoardAddCardFormProps) {
  const [situation, setSituation] = useState("");
  const [feeling, setFeeling] = useState("");
  const [need, setNeed] = useState("");
  const [selectedMood, setSelectedMood] = useState<BoardMoodTag | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubmit = async () => {
    if (!situation.trim() || !feeling.trim() || !need.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const combinedText = JSON.stringify({ situation: situation.trim(), feeling: feeling.trim(), need: need.trim() });
      await onAddCard(combinedText, column, selectedMood);
      setSituation("");
      setFeeling("");
      setNeed("");
      setSelectedMood(null);
      // Wait, onCancel closes the form. We should call onCancel to close it after success.
      onCancel();
    } catch {} finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111111] p-4 rounded-xl border border-white/[0.08] shadow-2xl flex flex-col gap-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">When this happened...</label>
        <textarea
          autoFocus
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="Stick to the objective facts"
          className="w-full bg-black/50 border border-white/[0.05] rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.1] resize-none focus:ring-1 focus:ring-white/[0.05] transition-all"
          rows={2}
          disabled={isSubmitting}
        />
      </div>
      
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">I felt...</label>
        <textarea
          value={feeling}
          onChange={(e) => setFeeling(e.target.value)}
          placeholder="Your specific emotion"
          className="w-full bg-black/50 border border-white/[0.05] rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.1] resize-none focus:ring-1 focus:ring-white/[0.05] transition-all"
          rows={1}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">I need...</label>
        <textarea
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          placeholder="What actionable thing you need"
          className="w-full bg-black/50 border border-white/[0.05] rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.1] resize-none focus:ring-1 focus:ring-white/[0.05] transition-all"
          rows={2}
          disabled={isSubmitting}
        />
      </div>
      
      {/* Mood Picker */}
      <div className="flex items-center gap-2 mb-2 mt-2 overflow-x-auto scrollbar-hide py-1">
        {[
          { tag: BoardMoodTag.URGENT, icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20 hover:bg-red-400/20" },
          { tag: BoardMoodTag.SAD, icon: Frown, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20 hover:bg-blue-400/20" },
          { tag: BoardMoodTag.CONFUSED, icon: Meh, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20 hover:bg-orange-400/20" },
          { tag: BoardMoodTag.NEUTRAL, icon: Sparkles, color: "text-zinc-400", bg: "bg-zinc-400/10 border-zinc-400/20 hover:bg-zinc-800" },
        ].map((mood) => {
          const Icon = mood.icon;
          const isSelected = selectedMood === mood.tag;
          return (
            <button
              key={mood.tag}
              onClick={() => setSelectedMood(isSelected ? null : mood.tag)}
              className={`
                flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all shrink-0
                ${isSelected ? mood.bg + ' ring-1 ring-current shadow-lg ' + mood.color : 'border-zinc-800/50 bg-black/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'}
              `}
            >
              <Icon className="w-4 h-4" />
              {mood.tag}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end pt-3 border-t border-zinc-800/50">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-2 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors bg-white/[0.02] border border-transparent hover:border-white/[0.05]"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={handleAddSubmit}
            disabled={!situation.trim() || !feeling.trim() || !need.trim() || isSubmitting}
            className={`
              px-6 py-2.5 text-sm font-bold tracking-wide rounded-lg transition-all
              ${(!situation.trim() || !feeling.trim() || !need.trim() || isSubmitting)
                ? 'bg-white/[0.05] text-zinc-600 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.15)]'}
            `}
          >
            {isSubmitting ? "Encrypting..." : "Save Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
