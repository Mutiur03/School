import { create } from "zustand";
import axios from "axios";
import { toast } from "react-hot-toast";
import { devtools } from "zustand/middleware";
const useNoticeStore = create()(
  devtools((set) => ({
    notices: [],
    isDeleting: false,
    isSubmitting: false,
    isLoading: false,
    addNotice: async (formData) => {
      set({ isSubmitting: true });
      try {
        const response = await axios.post("/api/notices/addNotice", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        const data = await response.data;
        set((state) => ({
          notices: [...state.notices, data],
        }));
        toast.success("Notice added successfully");
      } catch (error) {
        console.error("Error adding notice:", error);
        toast.error(error.response.data.error);
      }
      set({ isSubmitting: false });
    },
    fetchNotices: async () => {
      set({ isLoading: true });
      try {
        const response = await axios.get("/api/notices/getNotices");
        const data = await response.data;
        set({ notices: data });
      } catch (error) {
        console.error("Error fetching notices:", error);
      }
      set({ isLoading: false });
    },
    deleteNotice: async (id) => {
      set({ isDeleting: true });
      try {
        await axios.delete(`/api/notices/deleteNotice/${id}`);
        set((state) => ({
          notices: state.notices.filter((notice) => notice.id !== id),
        }));
        toast.success("Notice deleted successfully");
      } catch (error) {
        console.error("Error deleting notice:", error);
        toast.error(error.response.data.error);
      }
      set({ isDeleting: false });
    },
    updateNotice: async (id, formData) => {
      set({ isSubmitting: true });
      try {
        const response = await axios.put(
          `/api/notices/updateNotice/${id}`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        const data = await response.data;
        set((state) => ({
          notices: state.notices.map((notice) =>
            notice.id === id ? { ...notice, ...data } : notice
          ),
        }));
        toast.success("Notice updated successfully");
      } catch (error) {
        console.error("Error updating notice:", error);
        toast.error(error.response.data.error);
      }
      set({ isSubmitting: false });
    },
  }))
);

export default useNoticeStore;
