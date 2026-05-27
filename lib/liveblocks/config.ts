import { createClient, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

export const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

// ── Presence ──────────────────────────────────────────────────────────

type Presence = {
  isOnline: boolean;
  pressingTearCardId?: string | null;
};

// ── Feature Storage Types ─────────────────────────────────────────────

export type TiebreakerResult = {
  optionA: string;
  optionB: string;
  similarity: number;
};

export type TiebreakerState = {
  userAInputs: string[] | null;
  userBInputs: string[] | null;
  userASubmitted: boolean;
  userBSubmitted: boolean;
  result: TiebreakerResult | null;
};

export type FocusState = {
  sessionId: string | null;
  sessionStartTime: number | null;
  taskLabel: string;
  isActive: boolean;
  participants: string[];
};

export type WatchState = {
  hostId: string | null;
  videoUrl: string | null;
  currentTime: number;
  isPlaying: boolean;
  title: string;
  /** Timestamp when host last broadcasted currentTime — used for drift correction */
  updatedAt: number;
};

/**
 * Storage keys use LiveObject wrappers so that storage.get() in useMutation
 * returns a mutable LiveObject with .set() / .get() methods.
 * Keys are optional because each feature uses its own Liveblocks room.
 */
type Storage = {
  tiebreakerState?: LiveObject<TiebreakerState>;
  focusState?: LiveObject<FocusState>;
  watchState?: LiveObject<WatchState>;
};

// ── User Meta ─────────────────────────────────────────────────────────

type UserMeta = {
  id: string;
  name: string;
};

// ── Room Events ───────────────────────────────────────────────────────

type RoomEvent =
  | { type: "NUDGE"; taskId: string }
  | { type: "WATCH_PAUSED"; userId: string }
  | { type: "WATCH_COUNTDOWN"; count: number }
  | { type: "WATCH_SNACK_BREAK"; userId: string }
  | { type: "WATCH_SNACK_BACK"; userId: string }
  | { type: "BOARD_HUG"; cardId: string; userId: string }
  | { type: "BOARD_TEAR_SYNC"; cardId: string; userId: string; isPressing: boolean }
  | { type: "BOARD_CHANGED"; action: "add" | "update" | "delete"; moodTag?: string }
  | { type: "BOARD_CHAT_MESSAGE"; cardId: string };

// ── Room Context ──────────────────────────────────────────────────────

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useStorage,
  useMutation,
  useEventListener,
  useBroadcastEvent,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client);
