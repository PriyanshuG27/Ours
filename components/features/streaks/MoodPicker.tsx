"use client";

import { MoodTag } from "@/types/app.types";

type MoodPickerProps = {
  onSelect: (mood: MoodTag) => void;
  onCancel: () => void;
};

export function MoodPicker({ onSelect, onCancel }: MoodPickerProps) {
  const moods: { tag: MoodTag; emoji: string; label: string }[] = [
    { tag: MoodTag.EASY, emoji: "😌", label: "Easy" },
    { tag: MoodTag.STRUGGLED, emoji: "😤", label: "Struggled" },
    { tag: MoodTag.FORCED, emoji: "😑", label: "Forced" },
    { tag: MoodTag.PROUD, emoji: "🌟", label: "Proud" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-xl m-4 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-100">How did it feel?</h2>
          <p className="text-sm text-zinc-400 mt-1">Tag your mood for this completion.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {moods.map((mood) => (
            <button
              key={mood.tag}
              onClick={() => onSelect(mood.tag)}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
            >
              <span className="text-3xl">{mood.emoji}</span>
              <span className="text-sm font-medium text-zinc-300 capitalize">{mood.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
