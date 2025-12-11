import axios from "axios";
import { create } from "zustand";

interface NoticeState {
  notices: Notice[];
  AllNotices: NoticeItem[];
  isLoading: boolean;
  loading: boolean;
  loadNotices: () => Promise<void>;
  loadAllNotices: () => Promise<void>;
}
interface Notice {
  id?: string;
  title?: string;
  file?: string;
}
type NoticeItem = {
  id: number;
  title: string;
  created_at: string;
  download_url: string;
  file?: string;
};

const useNoticeStore = create<NoticeState>((set, get) => ({
  notices: [],
  AllNotices: [],
  isLoading: false,
  loading: false,
  loadNotices: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const response = await axios.get("/api/notices/getNotices?limit=5");
      set({ notices: response.data });
    } catch (error) {
      console.error("Error fetching notices:", error);
    } finally {
      set({ isLoading: false });
    }
  },
  loadAllNotices: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const response = await axios.get("/api/notices/getNotices");
      set({ AllNotices: response.data });
    } catch (error) {
      console.error("Error fetching all notices:", error);
    } finally {
      set({ loading: false });
    }
  },
}));
export default useNoticeStore;
