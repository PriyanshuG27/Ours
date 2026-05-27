"use client";

import { useState, useEffect, useRef } from "react";
import { useSpaceStore } from "@/store/space.store";
import { useE2EEKey } from "@/hooks/use-e2ee-key";
import { supabase } from "@/lib/supabase/client";
import { BoardCardMessage } from "@/types/app.types";
import { useBroadcastEvent, useEventListener } from "@/lib/liveblocks/config";
import { Send, Image as ImageIcon, Mic, PhoneCall, CheckCircle2, X } from "lucide-react";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";
import { VoiceNotePlayer } from "./VoiceNotePlayer";
import { compressImage, blobToBase64 } from "@/lib/image-utils";

type CardChatProps = {
  cardId: string;
  onResolve: () => void;
};

type DecryptedMessage = BoardCardMessage & {
  decryptedContent: string;
  isDecrypting?: boolean;
};

export function CardChat({ cardId, onResolve }: CardChatProps) {
  const userId = useSpaceStore((s) => s.userId);
  const { encrypt, decrypt } = useE2EEKey();
  const broadcast = useBroadcastEvent();
  
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const res = await fetch(`/api/board/${cardId}/chat`);
    if (res.ok) {
      const data: BoardCardMessage[] = await res.json();
      
      const decrypted = await Promise.all(
        data.map(async (msg) => {
          let content = "Decrypting...";
          try {
            content = await decrypt(msg.encrypted_payload);
            
            // If it's an image, the content is actually a Supabase Storage path
            if (msg.message_type === "image") {
              const { data: fileData, error } = await supabase.storage.from("board-media").download(content);
              if (!error && fileData) {
                const encryptedBase64 = await fileData.text();
                content = await decrypt(encryptedBase64); // Decrypt the inner base64
              }
            }
          } catch (e) {
            content = "Failed to decrypt";
          }
          
          return { ...msg, decryptedContent: content };
        })
      );
      setMessages(decrypted);
      setTimeout(() => scrollToBottom(), 100);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [cardId]);

  useEventListener(({ event }) => {
    if (event.type === "BOARD_CHAT_MESSAGE" && event.cardId === cardId) {
      fetchMessages();
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (type: "text" | "voice" | "image" | "call_request", payload: string) => {
    if (!payload.trim()) return;
    
    let encrypted_payload = "";
    
    if (type === "image") {
      // payload is the storage path here. We encrypt the path so the metadata isn't leaked.
      encrypted_payload = await encrypt(payload);
    } else {
      encrypted_payload = await encrypt(payload);
    }

    await fetch(`/api/board/${cardId}/chat`, {
      method: "POST",
      body: JSON.stringify({ encrypted_payload, message_type: type }),
    });

    broadcast({ type: "BOARD_CHAT_MESSAGE", cardId });
    fetchMessages();
    setText("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
      const compressedBlob = await compressImage(file, 2);
      const base64 = await blobToBase64(compressedBlob);
      
      // Encrypt the base64 string
      const encryptedBase64 = await encrypt(base64);
      
      const fileName = `${cardId}/${Date.now()}.txt`;
      const { error } = await supabase.storage.from("board-media").upload(fileName, encryptedBase64);
      
      if (!error) {
        await handleSend("image", fileName);
      }
    } catch (err) {
      console.error("Image upload failed", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 overflow-hidden relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender_id === userId;
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div 
                className={`
                  max-w-[85%] rounded-2xl p-3 
                  ${msg.message_type === 'call_request' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 w-full text-center p-4' : 
                    isMe ? 'bg-white/[0.08] text-white rounded-br-sm' : 'bg-white/[0.03] border border-white/[0.05] text-zinc-300 rounded-bl-sm'}
                `}
              >
                {msg.message_type === "text" && (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.decryptedContent}</p>
                )}
                
                {msg.message_type === "voice" && (
                  <VoiceNotePlayer base64Audio={msg.decryptedContent} />
                )}
                
                {msg.message_type === "image" && (
                  msg.decryptedContent.startsWith("data:image") ? (
                    <img 
                      src={msg.decryptedContent} 
                      className="rounded-lg max-h-60 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                      alt="Attachment" 
                      onClick={() => setEnlargedImage(msg.decryptedContent)}
                    />
                  ) : (
                    <div className="text-xs text-zinc-500 italic">{msg.decryptedContent}</div>
                  )
                )}
                
                {msg.message_type === "call_request" && (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <PhoneCall className="w-6 h-6 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isMe ? "You requested a call" : "Partner wants to hop on a call"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white/[0.02] border-t border-white/[0.05]">
        {isRecording ? (
          <VoiceNoteRecorder 
            onSave={async (b64) => {
              await handleSend("voice", b64);
              setIsRecording(false);
            }}
            onCancel={() => setIsRecording(false)}
          />
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-black/40 border border-white/[0.05] rounded-xl flex items-end overflow-hidden focus-within:border-white/[0.1] focus-within:ring-1 focus-within:ring-white/[0.05] transition-all">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend("text", text);
                  }
                }}
                placeholder="Message securely..."
                className="w-full bg-transparent p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none max-h-32"
                rows={1}
                disabled={isUploading}
              />
            </div>
            
            <div className="flex items-center gap-1 mb-1">
              <button
                onClick={() => handleSend("call_request", "call_request")}
                className="p-2.5 text-zinc-500 hover:text-rose-400 hover:bg-white/[0.05] rounded-lg transition-colors"
                title="Request Call"
              >
                <PhoneCall className="w-4 h-4" />
              </button>
              
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] rounded-lg transition-colors"
                title="Send Image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setIsRecording(true)}
                className="p-2.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] rounded-lg transition-colors"
                title="Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>

              {text.trim() && (
                <button
                  onClick={() => handleSend("text", text)}
                  className="p-2.5 bg-white text-black hover:bg-zinc-200 rounded-lg transition-colors shadow-lg ml-1"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Image Modal Overlay */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setEnlargedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setEnlargedImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={enlargedImage} 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" 
            alt="Enlarged" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
