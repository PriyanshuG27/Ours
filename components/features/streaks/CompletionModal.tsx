"use client";

import { useState, useRef } from "react";
import { MoodTag } from "@/types/app.types";
import { Camera, X, Loader2, ArrowRight, Check } from "lucide-react";
import imageCompression from "browser-image-compression";
import { useE2EEKey } from "@/hooks/use-e2ee-key";

type CompletionModalProps = {
  onComplete: (_mood: MoodTag, _file: Blob | null) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function CompletionModal({ onComplete, onCancel, isSubmitting }: CompletionModalProps) {
  const { encryptBinary } = useE2EEKey();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedMood, setSelectedMood] = useState<MoodTag | null>(null);
  
  const [status, setStatus] = useState<"idle" | "compressing" | "error">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moods: { tag: MoodTag; emoji: string; label: string }[] = [
    { tag: MoodTag.EASY, emoji: "😌", label: "Easy" },
    { tag: MoodTag.STRUGGLED, emoji: "😤", label: "Struggled" },
    { tag: MoodTag.FORCED, emoji: "😑", label: "Forced" },
    { tag: MoodTag.PROUD, emoji: "🌟", label: "Proud" },
  ];

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("compressing");

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.4,
        fileType: "image/webp",
        useWebWorker: true,
      });

      const url = URL.createObjectURL(compressed);
      setPreview(url);
      setCompressedFile(compressed);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function handleSubmit() {
    if (!selectedMood) return;

    let finalFile: Blob | null = null;
    if (compressedFile) {
      const arrayBuffer = await compressedFile.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuffer);
      const encryptedBytes = await encryptBinary(fileBytes);
      finalFile = new Blob([new Uint8Array(encryptedBytes)], { type: "application/octet-stream" });
    }

    onComplete(selectedMood, finalFile);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col gap-6 animate-in zoom-in-95 duration-200">
        
        {step === 1 ? (
          <>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-zinc-100">How did it feel?</h2>
              <p className="text-sm text-zinc-400 mt-1">Tag your mood for this completion.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {moods.map((mood) => (
                <button
                  key={mood.tag}
                  onClick={() => setSelectedMood(mood.tag)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all active:scale-95 ${
                    selectedMood === mood.tag 
                      ? 'border-violet-500 bg-violet-500/10' 
                      : 'border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                >
                  <span className="text-3xl">{mood.emoji}</span>
                  <span className="text-sm font-medium text-zinc-300 capitalize">{mood.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedMood}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-zinc-100">Add a Photo?</h2>
              <p className="text-sm text-zinc-400 mt-1">Every 5 photos earns a Streak Freeze.</p>
            </div>

            <div className="flex flex-col gap-4">
              {!preview ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={status === "compressing"}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/30 px-4 py-8 text-zinc-400 transition-all hover:border-zinc-500 hover:bg-zinc-800/50 active:scale-[0.98]"
                >
                  {status === "compressing" ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
                  ) : (
                    <><Camera className="h-6 w-6" /> <span className="font-medium">Snap photo</span></>
                  )}
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-zinc-800">
                  <img src={preview} alt="Preview" className="w-full aspect-[4/3] object-cover" />
                  <button
                    onClick={() => {
                      setPreview(null);
                      setCompressedFile(null);
                    }}
                    className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 backdrop-blur-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-black bg-white hover:bg-zinc-200 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="w-4 h-4" /> Complete</>
                )}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        )}
      </div>
    </div>
  );
}
