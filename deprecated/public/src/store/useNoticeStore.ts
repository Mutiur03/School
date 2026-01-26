import { create } from "zustand";
import axios from "axios";

type Notice = {
  id: number;
  title: string;
  details?: string; // Make optional
  created_at: string;
  category: string;
  file?: string; // PDF file path/URL
  download_url?: string; // URL to download the file
};

interface NoticeState {
  notices: Notice[];
  loading: boolean;
  error: string | null;
  fetchNotices: () => Promise<void>;
  getNoticeById: (id: number) => Notice | undefined;
  getNoticesByCategory: (category: string) => Notice[];
  getSortedNotices: () => Notice[];
}

export const useNoticeStore = create<NoticeState>((set, get) => ({
  notices: [],
  loading: false,
  error: null,

  fetchNotices: async () => {
    set({ loading: true, error: null });
    try {
      const [noticesRes, eventsRes] = await Promise.all([
        axios.get("/api/notices/getNotices"),
        axios.get("/api/events/getEvents"),
      ]);
      console.log(noticesRes.data);

      const noticesData = noticesRes.data || [];
      const eventsData = eventsRes.data || [];

      set({
        notices: [...noticesData, ...eventsData],
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching notices or events:", error);
      set({
        error: "Failed to fetch notices",
        loading: false,
      });
    }
  },

  getNoticeById: (id: number) => {
    return get().notices.find((notice) => notice.id === id);
  },

  getNoticesByCategory: (category: string) => {
    return get().notices.filter((notice) => notice.category === category);
  },

  getSortedNotices: () => {
    return get().notices.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
}));
