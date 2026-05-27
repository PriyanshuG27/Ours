import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

export const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

type Presence = {
  isOnline: boolean;
};

type Storage = {
  // stub, will grow
};

type UserMeta = {
  id: string;
  name: string;
};

type RoomEvent = {
  type: "NUDGE";
  taskId: string;
};

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
