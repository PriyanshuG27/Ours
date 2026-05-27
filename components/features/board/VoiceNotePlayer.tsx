"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

export function VoiceNotePlayer({ base64Audio }: { base64Audio: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // If the component unmounts, pause the audio
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center gap-3 bg-black/40 border border-white/[0.05] rounded-xl p-2 pr-4 w-full">
      <audio 
        ref={audioRef} 
        src={base64Audio} 
        onEnded={() => setIsPlaying(false)} 
        className="hidden" 
      />
      
      <button
        onClick={togglePlayback}
        className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-zinc-200 hover:bg-white/[0.15] shrink-0 transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      
      <div className="flex-1 flex items-center">
        {/* Fake waveform */}
        <div className="flex items-center gap-1 w-full h-4">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className={`flex-1 rounded-full ${isPlaying ? 'bg-emerald-400/80 animate-pulse' : 'bg-zinc-600'}`} 
              style={{ 
                height: `${Math.max(20, Math.random() * 100)}%`,
                animationDelay: `${i * 0.05}s`
              }} 
            />
          ))}
        </div>
      </div>
      
      <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
        Audio Note
      </div>
    </div>
  );
}
