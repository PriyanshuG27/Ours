"use client";

import { useState, useEffect, useRef } from "react";
import { BoardCard as BoardCardType, BoardMoodTag, BoardColumn as BoardColumnEnum } from "@/types/app.types";
import { useSpaceStore } from "@/store/space.store";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { Trash2, GripVertical, CheckCircle2, MessageCircle, Lightbulb, Heart, Handshake, Flame, ShieldAlert, Sparkles, Meh, Frown, Mic, X } from "lucide-react";
import { useUpdateMyPresence, useOthers, useBroadcastEvent, useEventListener } from "@/lib/liveblocks/config";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";
import { VoiceNotePlayer } from "./VoiceNotePlayer";
import { CardChat } from "./CardChat";
import { createPortal } from "react-dom";

type DecryptedBoardCard = BoardCardType & { 
  decryptedText?: string;
  decryptedAuthorPerspective?: string | null;
  decryptedPartnerPerspective?: string | null;
};

type BoardCardProps = {
  card: DecryptedBoardCard;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<BoardCardType>) => void;
};

export function BoardCard({ card, onDelete, onUpdate }: BoardCardProps) {
  const userId = useSpaceStore((s) => s.userId);
  const partnerName = useSpaceStore((s) => s.partnerName);
  const { encrypt } = useE2EEKey();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [authorPerspective, setAuthorPerspective] = useState(card.decryptedAuthorPerspective || "");
  const [partnerPerspective, setPartnerPerspective] = useState(card.decryptedPartnerPerspective || "");
  const [isSavingPerspective, setIsSavingPerspective] = useState(false);
  const [showHugAnimation, setShowHugAnimation] = useState(false);
  const [isRecordingAuthor, setIsRecordingAuthor] = useState(false);
  const [isRecordingPartner, setIsRecordingPartner] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only update if we aren't currently editing (to avoid overwriting active typing)
    if (card.decryptedAuthorPerspective !== authorPerspective && !isSavingPerspective) {
      setAuthorPerspective(card.decryptedAuthorPerspective || "");
    }
  }, [card.decryptedAuthorPerspective]);

  useEffect(() => {
    if (card.decryptedPartnerPerspective !== partnerPerspective && !isSavingPerspective) {
      setPartnerPerspective(card.decryptedPartnerPerspective || "");
    }
  }, [card.decryptedPartnerPerspective]);

  const isAuthor = userId === card.author_id;
  const authorInitial = isAuthor ? "Me" : (partnerName ? partnerName.charAt(0).toUpperCase() : "P");

  // Attempt to parse NVC data
  let nvcData: { situation: string; feeling: string; need: string } | null = null;
  let displayText = card.decryptedText || "Decrypting...";
  try {
    const parsed = JSON.parse(card.decryptedText || "");
    if (parsed.situation && parsed.feeling && parsed.need) {
      nvcData = parsed;
      displayText = parsed.situation;
    }
  } catch (e) {
    // Not JSON, use plain text
  }

  // Liveblocks features
  const updatePresence = useUpdateMyPresence();
  const others = useOthers();
  const broadcast = useBroadcastEvent();

  const partnerPresence = others[0]; // Assuming exactly one partner in room
  const partnerPressingTear = partnerPresence?.presence?.pressingTearCardId === card.id;

  const [isPressingTear, setIsPressingTear] = useState(false);
  const [tearProgress, setTearProgress] = useState(0);
  const tearIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEventListener(({ event }) => {
    if (event.type === "BOARD_HUG" && event.cardId === card.id) {
      if (isAuthor) {
        setShowHugAnimation(true);
        setTimeout(() => setShowHugAnimation(false), 3000);
      }
    }
  });

  const handleDragStart = (e: React.DragEvent) => {
    if (isExpanded) return; // Don't drag if expanded
    e.dataTransfer.setData("cardId", card.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const getIcon = () => {
    switch (card.column) {
      case "on_my_mind": return <Lightbulb className="w-3.5 h-3.5 text-zinc-400" />;
      case "lets_talk": return <MessageCircle className="w-3.5 h-3.5 text-zinc-400" />;
      case "resolved": return <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />;
      default: return null;
    }
  };

  const getMoodIcon = () => {
    switch (card.mood_tag) {
      case BoardMoodTag.URGENT: return <ShieldAlert className="w-3 h-3 text-red-400" />;
      case BoardMoodTag.SAD: return <Frown className="w-3 h-3 text-blue-400" />;
      case BoardMoodTag.CONFUSED: return <Meh className="w-3 h-3 text-orange-400" />;
      case BoardMoodTag.NEUTRAL: return <Sparkles className="w-3 h-3 text-zinc-400" />;
      default: return null;
    }
  };

  const handleSendHug = () => {
    if (isAuthor || card.partner_acknowledged) return;
    broadcast({ type: "BOARD_HUG", cardId: card.id, userId: userId! });
    onUpdate(card.id, { partner_acknowledged: true });
  };

  const handleSavePerspective = async (type: 'author' | 'partner', text: string) => {
    setIsSavingPerspective(true);
    try {
      const ciphertext = await encrypt(text);
      if (type === 'author') {
        onUpdate(card.id, { encrypted_author_perspective: ciphertext });
      } else {
        onUpdate(card.id, { encrypted_partner_perspective: ciphertext });
      }
    } catch {} finally {
      setIsSavingPerspective(false);
    }
  };

  const handleToggleReady = () => {
    const isCurrentlyReady = isAuthor ? card.author_ready : card.partner_ready;
    const partnerIsReady = isAuthor ? card.partner_ready : card.author_ready;
    
    if (!isCurrentlyReady && partnerIsReady && card.column === BoardColumnEnum.ON_MY_MIND) {
      // Advance to Let's Talk
      onUpdate(card.id, { 
        author_ready: false, 
        partner_ready: false, 
        column: BoardColumnEnum.LETS_TALK 
      });
      return;
    }
    
    // Otherwise just toggle the ready state (in Let's Talk this opens chat)
    if (isAuthor) {
      onUpdate(card.id, { author_ready: !card.author_ready });
    } else {
      onUpdate(card.id, { partner_ready: !card.partner_ready });
    }
  };

  const isNegotiating = card.column === BoardColumnEnum.LETS_TALK && card.author_ready && card.partner_ready;

  // Auto-open chat if negotiation just started
  useEffect(() => {
    if (isNegotiating && !isChatOpen) {
      setIsChatOpen(true);
    }
  }, [isNegotiating]);

  const handleResolve = () => {
    setIsChatOpen(false);
    onUpdate(card.id, { 
      column: BoardColumnEnum.RESOLVED, 
      author_ready: false, 
      partner_ready: false 
    });
  };

  // Tear It Up Ritual logic
  const handleTearPointerDown = () => {
    setIsPressingTear(true);
    updatePresence({ pressingTearCardId: card.id });
  };

  const handleTearPointerUp = () => {
    setIsPressingTear(false);
    updatePresence({ pressingTearCardId: null });
    setTearProgress(0);
    if (tearIntervalRef.current) clearInterval(tearIntervalRef.current);
  };

  useEffect(() => {
    if (isPressingTear && partnerPressingTear && card.column === 'resolved') {
      // Both are pressing!
      tearIntervalRef.current = setInterval(() => {
        setTearProgress((prev) => {
          if (prev >= 100) {
            clearInterval(tearIntervalRef.current!);
            onDelete(card.id);
            return 100;
          }
          return prev + 2; // 50 ticks = 2 seconds total hold time
        });
      }, 40);
    } else {
      setTearProgress(0);
      if (tearIntervalRef.current) clearInterval(tearIntervalRef.current);
    }
    return () => {
      if (tearIntervalRef.current) clearInterval(tearIntervalRef.current);
    };
  }, [isPressingTear, partnerPressingTear, card.column, onDelete, card.id]);

  return (
    <div
      draggable={!isExpanded}
      onDragStart={handleDragStart}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('textarea')) return;
        setIsExpanded(!isExpanded);
      }}
      className={`
        group relative flex flex-col gap-3 p-4 rounded-[16px] 
        bg-white/[0.02] border border-white/[0.04] shadow-sm
        hover:border-white/[0.1] transition-all duration-300
        ${isExpanded ? 'bg-white/[0.04] ring-1 ring-white/[0.05] shadow-2xl' : 'hover:-translate-y-0.5 cursor-pointer hover:shadow-lg active:scale-[0.98]'}
        overflow-hidden
      `}
    >
      {/* Hug Particle Animation Overlay */}
      {showHugAnimation && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50 animate-in fade-in zoom-in duration-500">
          <Heart className="w-16 h-16 text-rose-500 animate-pulse fill-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.6)]" />
        </div>
      )}

      {/* Header Row: Mood, Title, Drag handle */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex-1">
          {card.mood_tag && (
            <div className="flex items-center gap-1.5 mb-1.5">
              {getMoodIcon()}
              <span className="text-[10px] font-medium tracking-widest uppercase text-zinc-500">
                {card.mood_tag}
              </span>
            </div>
          )}
          {(!isExpanded || !nvcData) && (
            <p className={`text-[15px] leading-relaxed text-zinc-200 whitespace-pre-wrap break-words font-medium ${!isExpanded ? 'line-clamp-3' : ''}`}>
              {displayText}
            </p>
          )}
        </div>
        
        <div className={`flex flex-col items-center gap-2 ${!isExpanded ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
          {(isAuthor || card.decryptedText === "Decryption failed") && (
            <button
              onClick={() => onDelete(card.id)}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              title="Delete Card"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {!isExpanded && (
            <div className="text-zinc-600 p-1.5 cursor-grab active:cursor-grabbing hover:bg-white/[0.05] rounded-lg transition-colors">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Collapsed Footer */}
      {!isExpanded && (
        <div className="flex items-center justify-between relative z-10 mt-1 pt-3 border-t border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-zinc-500">
              {getIcon()}
              <span className="text-[11px] font-medium tracking-wide">
                {card.column.replace(/_/g, ' ')}
              </span>
            </div>
            {(card.author_ready || card.partner_ready) && card.column === 'lets_talk' && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <Handshake className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">
                  {card.author_ready && card.partner_ready ? 'Sync' : '1 Ready'}
                </span>
              </div>
            )}
            {card.partner_acknowledged && (
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500 ml-1" />
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isAuthor && !card.partner_acknowledged && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendHug();
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors text-xs font-medium border border-zinc-700"
              >
                <Heart className="w-3 h-3 text-rose-400" />
                Hug
              </button>
            )}
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700">
              <span className="text-[9px] font-bold text-zinc-400">{authorInitial}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="mt-4 flex flex-col gap-5 pt-4 border-t border-zinc-800 cursor-default" onClick={e => e.stopPropagation()}>
          {/* Parse NVC format if available */}
          {nvcData && (
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">When this happened</span>
                <p className="text-[13px] font-medium text-zinc-200 leading-snug">{nvcData.situation}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">I felt</span>
                <p className="text-[13px] font-medium text-blue-300 leading-snug">{nvcData.feeling}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">I need</span>
                <p className="text-[13px] font-medium text-emerald-300 leading-snug">{nvcData.need}</p>
              </div>
            </div>
          )}
          
          {/* Active Negotiation State */}
          {isNegotiating ? (
            <div className="flex flex-col items-center justify-center p-6 gap-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <MessageCircle className="w-8 h-8 text-emerald-400 animate-pulse" />
              <div className="text-center space-y-1">
                <div className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Active Negotiation</div>
                <div className="text-[11px] text-zinc-400">Both partners are ready to resolve this.</div>
              </div>
              <button 
                onClick={() => setIsChatOpen(true)}
                className="mt-2 w-full py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-emerald-500/30"
              >
                Open Live Chat
              </button>
            </div>
          ) : (
            /* Perspectives Section */
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Perspectives</h4>
            
            {/* Author Perspective */}
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                <span>{isAuthor ? 'My Thoughts' : 'Their Thoughts'}</span>
                {isAuthor && !authorPerspective && !isRecordingAuthor && (
                  <button onClick={() => setIsRecordingAuthor(true)} className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Mic className="w-3 h-3" /> Voice Note
                  </button>
                )}
                {isSavingPerspective && <span className="text-zinc-600 animate-pulse">Saving...</span>}
              </label>
              
              {isRecordingAuthor ? (
                <VoiceNoteRecorder 
                  onSave={async (b64) => {
                    await handleSavePerspective('author', b64);
                    setAuthorPerspective(b64);
                    setIsRecordingAuthor(false);
                  }} 
                  onCancel={() => setIsRecordingAuthor(false)} 
                />
              ) : authorPerspective.startsWith("data:audio/") ? (
                <VoiceNotePlayer base64Audio={authorPerspective} />
              ) : isAuthor ? (
                <textarea
                  value={authorPerspective}
                  onChange={(e) => setAuthorPerspective(e.target.value)}
                  onBlur={() => handleSavePerspective('author', authorPerspective)}
                  placeholder="Add your perspective here..."
                  className="w-full bg-black/40 border border-white/[0.05] rounded-xl p-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.1] focus:ring-1 focus:ring-white/[0.05] min-h-[80px] resize-y transition-all"
                />
              ) : (
                <div className="w-full bg-white/[0.02] border border-white/[0.03] rounded-xl p-3 text-sm text-zinc-400 min-h-[80px] italic">
                  {authorPerspective || "No perspective added yet."}
                </div>
              )}
            </div>

            {/* Partner Perspective */}
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                <span>{!isAuthor ? 'My Thoughts' : 'Their Thoughts'}</span>
                {!isAuthor && !partnerPerspective && !isRecordingPartner && (
                  <button onClick={() => setIsRecordingPartner(true)} className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Mic className="w-3 h-3" /> Voice Note
                  </button>
                )}
              </label>
              
              {isRecordingPartner ? (
                <VoiceNoteRecorder 
                  onSave={async (b64) => {
                    await handleSavePerspective('partner', b64);
                    setPartnerPerspective(b64);
                    setIsRecordingPartner(false);
                  }} 
                  onCancel={() => setIsRecordingPartner(false)} 
                />
              ) : partnerPerspective.startsWith("data:audio/") ? (
                <VoiceNotePlayer base64Audio={partnerPerspective} />
              ) : !isAuthor ? (
                <textarea
                  value={partnerPerspective}
                  onChange={(e) => setPartnerPerspective(e.target.value)}
                  onBlur={() => handleSavePerspective('partner', partnerPerspective)}
                  placeholder="Add your perspective here..."
                  className="w-full bg-black/40 border border-white/[0.05] rounded-xl p-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.1] focus:ring-1 focus:ring-white/[0.05] min-h-[80px] resize-y transition-all"
                />
              ) : (
                <div className="w-full bg-white/[0.02] border border-white/[0.03] rounded-xl p-3 text-sm text-zinc-400 min-h-[80px] italic">
                  {partnerPerspective || "No perspective added yet."}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            {/* Ready to Talk Toggle (Only relevant in Let's Talk or On My Mind, and NOT during negotiation) */}
            {card.column !== 'resolved' && !isNegotiating && (
              <button
                onClick={handleToggleReady}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold tracking-wide transition-all
                  ${(isAuthor ? card.author_ready : card.partner_ready) 
                    ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.2)]' 
                    : 'bg-white/[0.03] border-white/[0.05] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200'}
                `}
              >
                <Handshake className="w-3.5 h-3.5" />
                {isAuthor ? (card.author_ready ? "I'm Ready" : "Mark Ready") : (card.partner_ready ? "I'm Ready" : "Mark Ready")}
              </button>
            )}

            {/* Partner Ready Status Indicator */}
            {card.column !== 'resolved' && !isNegotiating && (
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                Partner: 
                <span className={(!isAuthor ? card.author_ready : card.partner_ready) ? 'text-emerald-400' : 'text-zinc-600'}>
                  {(!isAuthor ? card.author_ready : card.partner_ready) ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            )}

            {/* Tear It Up Ritual (Only in Resolved) */}
            {card.column === 'resolved' && (
              <div className="w-full flex flex-col items-center gap-2 mt-2">
                <p className="text-xs text-zinc-500 text-center px-4">
                  Ready to let this go? Both of you long-press the button below together to tear this card up forever.
                </p>
                <div className="relative w-full overflow-hidden rounded-[14px] border border-red-500/20 bg-black/40">
                  {/* Progress Fill */}
                  <div 
                    className="absolute top-0 left-0 bottom-0 bg-red-500/20 transition-all duration-75 ease-linear"
                    style={{ width: `${tearProgress}%` }}
                  />
                  <button
                    onPointerDown={handleTearPointerDown}
                    onPointerUp={handleTearPointerUp}
                    onPointerLeave={handleTearPointerUp}
                    className={`
                      relative z-10 w-full flex items-center justify-center gap-2 py-4 text-xs font-bold tracking-[0.2em] uppercase transition-colors
                      ${isPressingTear ? 'text-red-400' : 'text-zinc-400 hover:bg-white/[0.02]'}
                    `}
                  >
                    <Flame className={`w-4 h-4 ${isPressingTear ? 'animate-pulse' : ''}`} />
                    {tearProgress > 0 ? (tearProgress >= 100 ? 'Burning...' : 'Hold...') : 'Tear It Up'}
                  </button>
                </div>
                {/* Partner Status */}
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest">
                  <span className={partnerPressingTear ? "text-red-400" : "text-zinc-600"}>
                    {partnerPressingTear ? "Partner is holding..." : "Waiting for partner"}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => setIsExpanded(false)}
            className="w-full py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors mt-2 uppercase tracking-widest"
          >
            Collapse
          </button>
        </div>
      )}

      {/* Chat Modal via Portal */}
      {isChatOpen && isNegotiating && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 cursor-default" onClick={e => e.stopPropagation()}>
          <div className="bg-[#111111] border border-white/[0.1] shadow-2xl rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-100">Live Negotiation</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest">End-to-End Encrypted</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResolve}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve Conflict
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Context Banner */}
            <div className="p-3 bg-zinc-900 border-b border-white/[0.05] flex items-start gap-2 shadow-inner">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap mt-0.5">Topic:</span>
              <p className="text-sm font-medium text-zinc-300 line-clamp-2">{displayText}</p>
            </div>

            {/* Chat Area */}
            <div className="flex-1 min-h-0 relative">
              <CardChat cardId={card.id} onResolve={handleResolve} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
