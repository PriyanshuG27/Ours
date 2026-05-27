"use client";

import { useEffect, useState } from "react";
import { BoardColumn as BoardColumnEnum, BoardCard as BoardCardType } from "@/types/app.types";
import { BoardColumn } from "./BoardColumn";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { Loader2 } from "lucide-react";

type DecryptedBoardCard = BoardCardType & { decryptedText?: string };

export function ProblemBoard() {
  const [cards, setCards] = useState<DecryptedBoardCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { encrypt, decrypt, isLoaded, key } = useE2EEKey();

  useEffect(() => {
    async function loadCards() {
      try {
        const res = await fetch("/api/board");
        if (!res.ok) throw new Error("Failed to fetch cards");
        const data = await res.json();
        
        if (!key) {
          setCards(data.cards);
          return;
        }

        // Decrypt cards
        const decryptedCards = await Promise.all(
          data.cards.map(async (card: BoardCardType) => {
            try {
              const text = await decrypt(card.encrypted_text);
              return { ...card, decryptedText: text };
            } catch (err) {
              console.error("Failed to decrypt card", card.id);
              return { ...card, decryptedText: "[Decryption Failed]" };
            }
          })
        );
        
        setCards(decryptedCards);
      } catch (error) {
        console.error(error);
        alert("Failed to load problem board");
      } finally {
        setIsLoading(false);
      }
    }

    if (isLoaded) {
      loadCards();
    }
  }, [isLoaded, key, decrypt]);

  const handleCardDrop = async (cardId: string, targetColumn: BoardColumnEnum) => {
    const cardToMove = cards.find((c) => c.id === cardId);
    if (!cardToMove || cardToMove.column === targetColumn) return;

    // Find the new max position in the target column
    const targetCards = cards.filter((c) => c.column === targetColumn);
    const maxPos = targetCards.length > 0 
      ? Math.max(...targetCards.map((c) => c.position)) 
      : 0;
    const newPosition = maxPos + 1000;

    // Optimistic UI update
    const previousCards = [...cards];
    setCards((prev) => 
      prev.map((c) => 
        c.id === cardId 
          ? { ...c, column: targetColumn, position: newPosition }
          : c
      )
    );

    try {
      const res = await fetch(`/api/board/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          column: targetColumn,
          position: newPosition,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update card");
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message);
      // Revert optimistic update
      setCards(previousCards);
    }
  };

  const handleAddCard = async (text: string, column: BoardColumnEnum) => {
    if (!key) {
      alert("Encryption key not loaded");
      return;
    }

    try {
      const encryptedText = await encrypt(text);
      
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedText, column }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add card");
      }

      const { card } = await res.json();
      setCards((prev) => [...prev, { ...card, decryptedText: text }]);
    } catch (error: any) {
      console.error(error);
      alert(error.message);
      throw error;
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    const previousCards = [...cards];
    setCards((prev) => prev.filter((c) => c.id !== cardId));

    try {
      const res = await fetch(`/api/board/${cardId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete card");
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message);
      setCards(previousCards);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!key) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <p className="text-zinc-400">Please unlock your Space Key to view the board.</p>
        </div>
      </div>
    );
  }

  const columns = [
    { id: BoardColumnEnum.ON_MY_MIND, title: "On My Mind" },
    { id: BoardColumnEnum.LETS_TALK, title: "Let's Talk" },
    { id: BoardColumnEnum.RESOLVED, title: "Resolved" },
  ];

  return (
    <div className="relative h-full flex flex-col pt-8 pb-8 pl-8 overflow-hidden bg-black selection:bg-zinc-800">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-[20%] w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none opacity-50 mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none opacity-50 mix-blend-screen" />

      <div className="relative z-10 mb-8 pr-8 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 tracking-tight">
            Problem Board
          </h1>
          <p className="text-[15px] text-zinc-400 mt-2 font-medium tracking-wide">
            Drop thoughts here. Sync up later.
          </p>
        </div>
        
        {/* Simple stat counter or badge could go here if needed, keeping it minimal for now */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] shadow-inner backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold tracking-widest uppercase text-zinc-400">E2E Encrypted</span>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex overflow-x-auto overflow-y-hidden gap-8 pb-6 pr-8 snap-x scrollbar-hide">
        {columns.map((col) => (
          <div key={col.id} className="snap-center h-full">
            <BoardColumn
              column={col.id}
              title={col.title}
              cards={cards
                .filter((c) => c.column === col.id)
                .sort((a, b) => a.position - b.position)}
              onCardDrop={handleCardDrop}
              onCardDelete={handleDeleteCard}
              onAddCard={handleAddCard}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
