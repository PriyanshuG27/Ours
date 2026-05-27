"use client";

import { BoardCard as BoardCardType } from "@/types/app.types";
import { useSpaceStore } from "@/store/space.store";
import { Trash2, GripVertical, CheckCircle2, MessageCircle, Lightbulb } from "lucide-react";

type BoardCardProps = {
  card: BoardCardType & { decryptedText?: string };
  onDelete: (id: string) => void;
};

export function BoardCard({ card, onDelete }: BoardCardProps) {
  const userId = useSpaceStore((s) => s.userId);
  const partnerName = useSpaceStore((s) => s.partnerName);
  
  const isAuthor = userId === card.author_id;
  const authorInitial = isAuthor ? "Me" : (partnerName ? partnerName.charAt(0).toUpperCase() : "P");

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("cardId", card.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const getIcon = () => {
    switch (card.column) {
      case "on_my_mind": return <Lightbulb className="w-3.5 h-3.5 text-rose-400" />;
      case "lets_talk": return <MessageCircle className="w-3.5 h-3.5 text-violet-400" />;
      case "resolved": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      default: return null;
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`
        group relative flex flex-col gap-3 p-4 rounded-2xl 
        bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]
        hover:bg-white/[0.05] hover:border-white/[0.15] 
        shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]
        transform transition-all duration-300 ease-out
        hover:-translate-y-1 active:scale-95 cursor-grab active:cursor-grabbing
        overflow-hidden
      `}
    >
      {/* Subtle top gradient glow based on column */}
      <div className={`
        absolute top-0 left-0 right-0 h-[1px] w-full opacity-50
        ${card.column === 'on_my_mind' ? 'bg-gradient-to-r from-transparent via-rose-500/50 to-transparent' : ''}
        ${card.column === 'lets_talk' ? 'bg-gradient-to-r from-transparent via-violet-500/50 to-transparent' : ''}
        ${card.column === 'resolved' ? 'bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent' : ''}
      `} />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <p className="text-[15px] leading-relaxed text-zinc-200 whitespace-pre-wrap break-words flex-1 font-medium tracking-wide">
          {card.decryptedText || "Decrypting..."}
        </p>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {isAuthor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(card.id);
              }}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-full hover:bg-red-400/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="text-zinc-600 p-1.5 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between relative z-10 mt-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
          {getIcon()}
          <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
            {card.column.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-300">
            {authorInitial}
          </span>
        </div>
      </div>
    </div>
  );
}
