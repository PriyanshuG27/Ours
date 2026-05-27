"use client";

import { useState } from "react";
import { BoardColumn as BoardColumnEnum, BoardCard as BoardCardType, BoardMoodTag } from "@/types/app.types";
import { BoardCard } from "./BoardCard";
import { Plus, Hash } from "lucide-react";
import { BoardAddCardForm } from "./BoardAddCardForm";

type BoardColumnProps = {
  column: BoardColumnEnum;
  title: string;
  cards: any[]; // Using any to pass down to BoardCard since it expects DecryptedBoardCard
  onCardDrop: (cardId: string, targetColumn: BoardColumnEnum) => void;
  onCardDelete: (cardId: string) => void;
  onAddCard: (text: string, column: BoardColumnEnum, mood: BoardMoodTag | null) => Promise<void>;
  onUpdateCard: (cardId: string, updates: Partial<BoardCardType>) => void;
};

export function BoardColumn({
  column,
  title,
  cards,
  onCardDrop,
  onCardDelete,
  onAddCard,
  onUpdateCard,
}: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

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

  return (
    <div className={`
      relative flex flex-col flex-shrink-0 w-[340px] h-full
      rounded-[24px] border border-white/[0.04] bg-white/[0.01]
      shadow-2xl overflow-hidden backdrop-blur-xl
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 z-10 border-b border-white/[0.04] bg-white/[0.02]">
        <h3 className="text-[15px] font-medium tracking-wide text-zinc-300">
          {title}
        </h3>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.04]">
          {cards.length}
        </span>
      </div>

      {/* Cards Area */}
      <div
        className={`
          flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-3 p-4 pb-6
          transition-all duration-200 ease-out scrollbar-hide
          ${isDragOver ? "bg-zinc-900/30 scale-[0.99] rounded-xl mx-2 my-2" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {cards.map((card) => (
          <BoardCard key={card.id} card={card} onDelete={onCardDelete} onUpdate={onUpdateCard} />
        ))}

        {isDragOver && (
          <div className="h-24 rounded-2xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] shrink-0 pointer-events-none flex items-center justify-center">
            <span className="text-xs font-medium text-zinc-500 tracking-widest uppercase">
              Drop Here
            </span>
          </div>
        )}

        {!isDragOver && cards.length === 0 && !isAdding && (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/[0.05] rounded-2xl m-2 opacity-60">
            <Hash className="w-5 h-5 mb-2 text-zinc-600" />
            <span className="text-xs font-medium text-zinc-500 tracking-wide">Empty Column</span>
          </div>
        )}
      </div>

      {/* Footer / Add Card */}
      <div className="p-4 pt-0 z-10">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/[0.05] text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Card</span>
          </button>
        ) : (
          <BoardAddCardForm 
            column={column} 
            onAddCard={onAddCard} 
            onCancel={() => setIsAdding(false)} 
          />
        )}
      </div>
    </div>
  );
}
