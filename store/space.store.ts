import { create } from "zustand";

interface SpaceState {
  spaceId: string | null;
  userId: string | null;
  partnerId: string | null;
  partnerName: string | null;
  isLoaded: boolean;
  setSpace: (
    spaceId: string,
    userId: string,
    partnerId: string,
    partnerName: string,
  ) => void;
  clearSpace: () => void;
  setLoaded: () => void;
}

export const useSpaceStore = create<SpaceState>((set) => ({
  spaceId: null,
  userId: null,
  partnerId: null,
  partnerName: null,
  isLoaded: false,
  setSpace: (spaceId, userId, partnerId, partnerName) =>
    set({ spaceId, userId, partnerId, partnerName, isLoaded: true }),
  clearSpace: () =>
    set({
      spaceId: null,
      userId: null,
      partnerId: null,
      partnerName: null,
      isLoaded: false,
    }),
  setLoaded: () => set({ isLoaded: true }),
}));
