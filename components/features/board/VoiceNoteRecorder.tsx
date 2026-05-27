"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, Trash2, Send } from "lucide-react";

type VoiceNoteRecorderProps = {
  onSave: (base64Audio: string) => Promise<void>;
  onCancel: () => void;
};

export function VoiceNoteRecorder({ onSave, onCancel }: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup tracks on unmount
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioBase64(base64data);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, 30000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required to record a voice note.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSave = async () => {
    if (!audioBase64) return;
    setIsSaving(true);
    try {
      await onSave(audioBase64);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full bg-black/40 border border-white/[0.05] rounded-xl p-4 flex flex-col gap-4">
      {!audioUrl ? (
        <div className="flex flex-col items-center justify-center py-4 gap-3">
          <div className="text-xs text-zinc-400 font-medium">
            {isRecording ? "Recording... (Max 30s)" : "Record a Voice Note"}
          </div>
          
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`
              w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg
              ${isRecording 
                ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse" 
                : "bg-white/[0.05] text-zinc-300 border border-white/[0.1] hover:bg-white/[0.1]"
              }
            `}
          >
            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
          </button>
          
          {!isRecording && (
            <button 
              onClick={() => {
                if (mediaRecorderRef.current) {
                  mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
                onCancel();
              }} 
              className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)} 
            className="hidden" 
          />
          
          <div className="flex items-center justify-between bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
            <button
              onClick={togglePlayback}
              className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-zinc-200 hover:bg-white/[0.15]"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            
            <div className="flex-1 px-4 flex items-center">
              {/* Fake waveform */}
              <div className="flex items-center gap-1 w-full h-4">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className={`flex-1 rounded-full bg-zinc-600 ${isPlaying ? 'animate-pulse' : ''}`} style={{ height: `${Math.max(20, Math.random() * 100)}%` }} />
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setAudioUrl(null);
                setAudioBase64(null);
              }}
              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button 
              onClick={() => {
                if (mediaRecorderRef.current) {
                  mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
                onCancel();
              }} 
              disabled={isSaving} 
              className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold tracking-wide rounded-lg hover:bg-zinc-200 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Send Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
