import axios from "axios";
import { create } from "zustand";

interface CommonStore {
  loading: boolean;
  routinePDF: string | null;
  // return the loaded pdf url (or null) so callers can await if desired
  loadRoutinePDF: () => Promise<string | null>;
}

export const useCommonStore = create<CommonStore>((set, get) => ({
  loading: false,
  routinePDF: null,
  loadRoutinePDF: async () => {
    if (get().loading) return get().routinePDF;
    if (get().routinePDF) return get().routinePDF;
    set({ loading: true });
    try {
      const res = await axios.get("/api/class-routine/pdf");
      const url = res?.data?.[0]?.pdf_url || null;
      set({ routinePDF: url });
      return url;
    } catch {
      set({ routinePDF: null });
      return null;
    } finally {
      set({ loading: false });
    }
  },
}));
