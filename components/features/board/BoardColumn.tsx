"use client";

import { useState } from "react";
import { BoardColumn as BoardColumnEnum, BoardCard as BoardCardType } from "@/types/app.types";
import { BoardCard } from "./BoardCard";
import { Plus, X, Sparkles } from "lucide-react";

type BoardColumnProps = {
  column: BoardColumnEnum;
  title: string;
  cards: (BoardCardType & { decryptedText?: string })[];
  onCardDrop: (cardId: string, targetColumn: BoardColumnEnum) => void;
  onCardDelete: (cardId: string) => void;
  onAddCard: (text: string, column: BoardColumnEnum) => Promise<void>;
};

export function BoardColumn({
  column,
  title,
  cards,
  onCardDrop,
  onCardDelete,
  onAddCard,
}: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newCardText, setNewCardText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MAX_CHARS = 200;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId) {
      onCardDrop(cardId, column);
    }
  };

  const handleAddSubmit = async () => {
    if (!newCardText.trim() || newCardText.length > MAX_CHARS || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddCard(newCardText.trim(), column);
      setNewCardText("");
      setIsAdding(false);
    } catch (error) {
      console.error("Failed to add card:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddSubmit();
    }
  };

  // Determine theme colors based on column type
  const getTheme = () => {
    switch (column) {
      case "on_my_mind": return {
        bg: "bg-gradient-to-b from-rose-500/[0.03] to-transparent",
        border: "border-rose-500/10",
        text: "text-rose-100",
        accent: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        dragZone: "bg-rose-500/10 border-rose-500/30",
        btnHover: "hover:bg-rose-500/10 hover:text-rose-300"
      };
      case "lets_talk": return {
        bg: "bg-gradient-to-b from-violet-500/[0.03] to-transparent",
        border: "border-violet-500/10",
        text: "text-violet-100",
        accent: "bg-violet-500/20 text-violet-300 border-violet-500/30",
        dragZone: "bg-violet-500/10 border-violet-500/30",
        btnHover: "hover:bg-violet-500/10 hover:text-violet-300"
      };
      case "resolved": return {
        bg: "bg-gradient-to-b from-emerald-500/[0.03] to-transparent",
        border: "border-emerald-500/10",
        text: "text-emerald-100",
        accent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        dragZone: "bg-emerald-500/10 border-emerald-500/30",
        btnHover: "hover:bg-emerald-500/10 hover:text-emerald-300"
      };
      default: return {
        bg: "bg-zinc-900/30", border: "border-zinc-800", text: "text-zinc-100",
        accent: "bg-zinc-800 text-zinc-400 border-zinc-700",
        dragZone: "bg-zinc-800/30 border-zinc-700",
        btnHover: "hover:bg-zinc-800 hover:text-zinc-200"
      };
    }
  };

  const theme = getTheme();

  return (
    <div className={`
      relative flex flex-col flex-shrink-0 w-[340px] h-full
      rounded-[32px] border ${theme.border} ${theme.bg}
      shadow-2xl shadow-black/20 overflow-hidden
      transition-colors duration-500
    `}>
      {/* Glossy top highlight */}
      <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 z-10 backdrop-blur-md border-b border-white/[0.02]">
        <h3 className={`text-lg font-bold tracking-wide ${theme.text}`}>
          {title}
        </h3>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${theme.accent} shadow-inner`}>
          {cards.length}
        </span>
      </div>

      {/* Cards Area */}
      <div
        className={`
          flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 p-5 pb-6
          transition-all duration-300 ease-out scrollbar-hide
          ${isDragOver ? `${theme.dragZone} scale-[0.99] rounded-2xl mx-2 my-2 shadow-inner` : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {cards.map((card) => (
          <BoardCard key={card.id} card={card} onDelete={onCardDelete} />
        ))}

        {isDragOver && (
          <div className={`
            h-28 rounded-2xl border-2 border-dashed ${theme.border} 
            bg-black/20 shrink-0 pointer-events-none
            flex items-center justify-center
          `}>
            <span className="text-sm font-medium text-white/30 tracking-wider uppercase">
              Drop Here
            </span>
          </div>
        )}

        {!isDragOver && cards.length === 0 && !isAdding && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl m-2 opacity-40">
            <Sparkles className="w-6 h-6 mb-3 text-white/20" />
            <span className="text-sm font-medium text-white/40 tracking-wide">Empty Space</span>
          </div>
        )}
      </div>

      {/* Footer / Add Card */}
      <div className="p-4 pt-0 z-10">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className={`
              flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl
              bg-white/[0.02] border border-white/[0.05]
              text-sm font-medium text-white/40
              transition-all duration-300
              hover:border-white/[0.1] hover:text-white/70 hover:shadow-lg
              ${theme.btnHover}
            `}
          >
            <Plus className="w-4 h-4" />
            <span>Add to {title}</span>
          </button>
        ) : (
          <div className="bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <textarea
              autoFocus
              value={newCardText}
              onChange={(e) => setNewCardText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? (Enter to save)"
              className="w-full bg-transparent text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none min-h-[90px]"
              maxLength={MAX_CHARS}
              disabled={isSubmitting}
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              <span
                className={`text-[11px] font-semibold tracking-wider ${
                  newCardText.length >= MAX_CHARS ? "text-rose-400" : "text-zinc-500"
                }`}
              >
                {newCardText.length} / {MAX_CHARS}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewCardText("");
                  }}
                  disabled={isSubmitting}
                  className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleAddSubmit}
                  disabled={!newCardText.trim() || isSubmitting}
                  className={`
                    px-5 py-2 text-[13px] font-bold tracking-wide rounded-xl transition-all duration-300
                    ${!newCardText.trim() || isSubmitting 
                      ? 'bg-white/10 text-white/30 cursor-not-allowed' 
                      : 'bg-white text-black hover:bg-zinc-200 hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]'}
                  `}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
