import { create } from "zustand";

interface CommonStore {
  // Add any common UI state here if needed
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useCommonStore = create<CommonStore>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
