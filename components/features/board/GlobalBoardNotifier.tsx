"use client";

import { useEffect, useState } from "react";
import { useEventListener } from "@/lib/liveblocks/config";
import { AlertCircle, FileText, CheckCircle, MessageSquare, Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function GlobalBoardNotifier() {
  const [toast, setToast] = useState<{ action: string; moodTag?: string; title?: string; message?: string } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEventListener(({ event }) => {
    // If the user is ALREADY on the problem board, don't show the toast.
    if (pathname === "/board") return;

    if (event.type === "BOARD_CHAT_MESSAGE") {
      setToast({ 
        action: "message", 
        title: "Active Negotiation", 
        message: "Partner just sent a message." 
      });
      setTimeout(() => setToast(null), 5000);
    }

    if (event.type === "BOARD_CHANGED" && event.action) {
      setToast({ action: event.action, moodTag: event.moodTag });
      setTimeout(() => setToast(null), 5000); // Auto dismiss
    }
  });

  if (!toast) return null;

  const isUrgent = toast.moodTag === "URGENT";

  return (
    <>
      {/* Urgent Screen Glow */}
      {isUrgent && toast.action === "add" && (
        <div className="fixed inset-0 pointer-events-none z-[100] border-4 border-red-500/30 animate-pulse shadow-[inset_0_0_100px_rgba(239,68,68,0.2)] transition-opacity duration-1000" />
      )}

      {/* Slide-down Toast */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[110] animate-in slide-in-from-top-4 fade-in duration-300">
        <button
          onClick={() => {
            setToast(null);
            router.push("/board");
          }}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border
            ${isUrgent 
              ? "bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20" 
              : "bg-[#111111]/80 border-white/[0.08] text-zinc-200 hover:bg-[#1A1A1A]/90"}
            transition-colors text-sm font-medium
          `}
        >
          {toast.action === "add" ? (
            isUrgent ? <AlertCircle className="w-5 h-5 text-red-400" /> : <FileText className="w-5 h-5 text-zinc-400" />
          ) : toast.action === "message" ? (
            <MessageSquare className="w-5 h-5 text-emerald-400" />
          ) : toast.action === "update" ? (
            <FileText className="w-5 h-5 text-emerald-400" />
          ) : toast.action === "hug" ? (
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          ) : (
            <CheckCircle className="w-5 h-5 text-zinc-500" />
          )}

          <div className="flex flex-col items-start text-left">
            {toast.title && <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{toast.title}</span>}
            <span>
              {toast.message || (
                <>
                  {toast.action === "add" && "Partner dropped a new card on the board."}
                  {toast.action === "update" && "Partner updated a board card."}
                  {toast.action === "delete" && "Partner tore up a card."}
                </>
              )}
            </span>
            {isUrgent && toast.action === "add" && (
              <span className="text-[10px] uppercase tracking-widest font-bold text-red-400/80 mt-0.5">
                Urgent attention requested
              </span>
            )}
          </div>
        </button>
      </div>
    </>
  );
}
