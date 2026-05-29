"use client";

import { useEffect, useState } from "react";
import { useSpaceStore } from "@/store/space.store";
import { BoardColumn as BoardColumnEnum, BoardCard as BoardCardType, BoardMoodTag } from "@/types/app.types";
import { BoardColumn } from "./BoardColumn";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { useBroadcastEvent, useEventListener } from "@/lib/liveblocks/config";

type DecryptedBoardCard = BoardCardType & { 
  decryptedText?: string;
  decryptedAuthorPerspective?: string | null;
  decryptedPartnerPerspective?: string | null;
};

export function ProblemBoard() {
  const spaceId = useSpaceStore((s) => s.spaceId);
  const [cards, setCards] = useState<DecryptedBoardCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { encrypt, decrypt } = useE2EEKey();

  useEffect(() => {
    if (spaceId) fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  const broadcast = useBroadcastEvent();

  useEventListener(({ event }) => {
    if (event.type === "BOARD_CHANGED") {
      fetchCards();
    }
  });

  const fetchCards = async () => {
    try {
      const response = await fetch("/api/board");
      if (!response.ok) throw new Error("Failed to fetch cards");
      const data = await response.json();

      const decryptedCards = await Promise.all(
        data.cards.map(async (c: any) => {
          let decryptedText = "Decryption failed";
          let decryptedAuthorPerspective = null;
          let decryptedPartnerPerspective = null;

          try {
            if (c.encrypted_text) {
              decryptedText = await decrypt(c.encrypted_text);
            }
          } catch (e) {
          }

          try {
            if (c.encrypted_author_perspective) {
              decryptedAuthorPerspective = await decrypt(c.encrypted_author_perspective);
            }
          } catch (e) {
          }

          try {
            if (c.encrypted_partner_perspective) {
              decryptedPartnerPerspective = await decrypt(c.encrypted_partner_perspective);
            }
          } catch (e) {
          }

          return {
            ...c,
            decryptedText,
            decryptedAuthorPerspective,
            decryptedPartnerPerspective,
          };
        })
      );

      setCards(decryptedCards);
    } catch (error) {
      // Removed alert to prevent annoying popups on concurrent React Strict Mode fetches
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardDrop = async (cardId: string, targetColumn: BoardColumnEnum) => {
    const cardToMove = cards.find((c) => c.id === cardId);
    if (!cardToMove || cardToMove.column === targetColumn) return;

    // Optimistic update
    const previousCards = [...cards];
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, column: targetColumn } : c
      )
    );

    try {
      const response = await fetch(`/api/board/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column: targetColumn }),
      });
      if (!response.ok) throw new Error("Failed to update card column");
      
      broadcast({ type: "BOARD_CHANGED", action: "update" });
    } catch (error) {
      setCards(previousCards); // revert
    }
  };

  const handleUpdateCard = async (cardId: string, updates: Partial<BoardCardType>) => {
    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c))
    );

    try {
      // Map frontend camelCase state variables to backend snake_case keys if necessary
      const payload: any = { ...updates };
      if (updates.partner_acknowledged !== undefined) payload.partnerAcknowledged = updates.partner_acknowledged;
      if (updates.author_ready !== undefined) payload.authorReady = updates.author_ready;
      if (updates.partner_ready !== undefined) payload.partnerReady = updates.partner_ready;
      if (updates.encrypted_author_perspective !== undefined) payload.encryptedAuthorPerspective = updates.encrypted_author_perspective;
      if (updates.encrypted_partner_perspective !== undefined) payload.encryptedPartnerPerspective = updates.encrypted_partner_perspective;
      if (updates.mood_tag !== undefined) payload.moodTag = updates.mood_tag;

      const response = await fetch(`/api/board/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update card");
      
      // If we saved perspectives, we should re-decrypt them locally so they render
      if (updates.encrypted_author_perspective || updates.encrypted_partner_perspective) {
        fetchCards();
      }
      
      broadcast({ type: "BOARD_CHANGED", action: "update" });
    } catch (error) {
      fetchCards(); // Revert on failure
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    const previousCards = [...cards];
    setCards((prev) => prev.filter((c) => c.id !== cardId));

    try {
      const response = await fetch(`/api/board/${cardId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete card");
      
      broadcast({ type: "BOARD_CHANGED", action: "delete" });
    } catch (error) {
      setCards(previousCards); // revert
    }
  };

  const handleAddCard = async (text: string, column: BoardColumnEnum, mood: BoardMoodTag | null) => {
    try {
      const encryptedText = await encrypt(text);
      const response = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedText, column, moodTag: mood }),
      });

      if (!response.ok) throw new Error("Failed to create card");
      
      const { card: newCard } = await response.json();
      setCards((prev) => [
        ...prev,
        { ...newCard, decryptedText: text, decryptedAuthorPerspective: null, decryptedPartnerPerspective: null },
      ]);
      
      broadcast({ type: "BOARD_CHANGED", action: "add", moodTag: mood || undefined });
    } catch (error) {
      alert("Failed to add card.");
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    );
  }

  const columns = [
    { id: BoardColumnEnum.ON_MY_MIND, title: "On My Mind" },
    { id: BoardColumnEnum.LETS_TALK, title: "Let's Talk" },
    { id: BoardColumnEnum.RESOLVED, title: "Resolved" },
  ];

  return (
    <div className="relative h-full flex flex-col pt-10 pb-8 pl-10 overflow-hidden bg-[#0A0A0A] selection:bg-rose-500/30">
      
      <div className="relative z-10 mb-10 pr-10 flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-white tracking-tight">
              Problem Board
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.08]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">E2E Encrypted</span>
            </div>
          </div>
          <p className="text-[14px] text-zinc-500 font-medium tracking-wide">
            A safe space to drop thoughts, align, and let go.
          </p>
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
              onUpdateCard={handleUpdateCard}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
