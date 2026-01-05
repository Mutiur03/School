import { create } from "zustand";
import axios from "axios";
import { toast } from "react-hot-toast";
import { devtools } from "zustand/middleware";

interface Notice {
  id: string;
  title?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NoticeStore {
  notices: Notice[];
  isDeleting: boolean;
  isSubmitting: boolean;
  isLoading: boolean;
  addNotice: (formData: FormData) => Promise<void>;
  fetchNotices: () => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  updateNotice: (id: string, formData: FormData) => Promise<void>;
}

const useNoticeStore = create<NoticeStore>()(
  devtools((set) => ({
    notices: [],
    isDeleting: false,
    isSubmitting: false,
    isLoading: false,
    addNotice: async (formData: FormData) => {
      set({ isSubmitting: true });
      try {
        const response = await axios.post("/api/notices/addNotice", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        set((state) => ({ notices: [...state.notices, response.data] }));
        toast.success("Notice added successfully");
      } catch (error) {
        toast.error(
          (error instanceof Error &&
            axios.isAxiosError(error) &&
            error.response?.data?.error) ||
            "Error adding notice"
        );
      } finally {
        set({ isSubmitting: false });
      }
    },
    fetchNotices: async () => {
      set({ isLoading: true });
      try {
        const response = await axios.get("/api/notices/getNotices");
        set({ notices: response.data });
      } catch {
        toast.error("Error fetching notices");
      } finally {
        set({ isLoading: false });
      }
    },
    deleteNotice: async (id: string) => {
      set({ isDeleting: true });
      try {
        await axios.delete(`/api/notices/deleteNotice/${id}`);
        set((state) => ({
          notices: state.notices.filter((notice) => notice.id !== id),
        }));
        toast.success("Notice deleted successfully");
      } catch (error) {
        toast.error(
          (error instanceof Error &&
            axios.isAxiosError(error) &&
            error.response?.data?.error) ||
            "Error deleting notice"
        );
      } finally {
        set({ isDeleting: false });
      }
    },
    updateNotice: async (id: string, formData: FormData) => {
      set({ isSubmitting: true });
      try {
        const response = await axios.put(
          `/api/notices/updateNotice/${id}`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        set((state) => ({
          notices: state.notices.map((notice) =>
            notice.id === id ? { ...notice, ...response.data } : notice
          ),
        }));
        toast.success("Notice updated successfully");
      } catch (error) {
        toast.error(
          (error instanceof Error &&
            axios.isAxiosError(error) &&
            error.response?.data?.error) ||
            "Error updating notice"
        );
      } finally {
        set({ isSubmitting: false });
      }
    },
  }))
);

export default useNoticeStore;
