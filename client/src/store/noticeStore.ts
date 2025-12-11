import axios from "axios";
import { create } from "zustand";

interface NoticeState {
  notices: Notice[];
  AllNotices: NoticeItem[];
  isLoading: boolean;
  loading: boolean;
  loadNotices: () => void;
  loadAllNotices: () => void;
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

const useNoticeStore = create<NoticeState>((set) => ({
  notices: [],
  AllNotices: [],
  isLoading: true,
  loading: true,
  loadNotices: async () => {
    set({ isLoading: true });
    axios
      .get("/api/notices/getNotices?limit=5")
      .then((response) => {
        set({ notices: response.data });
        set({ isLoading: false });
      })
      .catch((error) => {
        console.error("Error fetching notices:", error);
        set({ isLoading: false });
      });
  },
  loadAllNotices: async () => {
    set({ loading: true });
    axios
      .get("/api/notices/getNotices")
      .then((response) => {
        set({ AllNotices: response.data });
        set({ loading: false });
      })
      .catch((error) => {
        console.error("Error fetching all notices:", error);
        set({ loading: false });
      });
  },
}));
export default useNoticeStore;
