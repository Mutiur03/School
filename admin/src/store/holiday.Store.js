import { create } from "zustand";
import { devtools } from "zustand/middleware";

import axios from "axios";
import { toast } from "react-toastify";

const useHolidayStore = create()(
  devtools((set) => ({
    holidays: [],
    isDeleting: false,
    isSubmitting: false,
    isLoading: false,
    addHoliday: async (formData) => {
      set({ isSubmitting: true });
      console.log("formData", formData);

      try {
        const response = await axios.post("/api/holidays/addHoliday", formData);
        set((state) => ({
          holidays: [...state.holidays, response.data],
        }));
        toast.success("Holiday added successfully");
      } catch (error) {
        console.error("Error adding holiday:", error);
        toast.error(error.response.data.error);
      }
      set({ isSubmitting: false });
    },
    fetchHolidays: async () => {
      set({ isLoading: true });
      try {
        const res = await axios.get("/api/holidays/getHolidays");
        set({ holidays: res.data });
      } catch (error) {
        console.error("Error fetching holidays:", error);
      }
      set({ isLoading: false });
    },
    deleteHoliday: async (id) => {
      set({ isDeleting: true });
      try {
        await axios.delete(`/api/holidays/deleteHoliday/${id}`);
        set((state) => ({
          holidays: state.holidays.filter((holiday) => holiday.id !== id),
        }));
        toast.success("Holiday deleted successfully");
      } catch (error) {
        console.error("Error deleting holiday:", error);
        toast.error(error.response.data.error);
      }
      set({ isDeleting: false });
    },
    updateHoliday: async (id, formData) => {
      set({ isSubmitting: true });
      try {
        const response = await axios.put(
          `/api/holidays/updateHoliday/${id}`,
          formData
        );
        const data = await response.data;
        set((state) => ({
          holidays: state.holidays.map((holiday) =>
            holiday.id === id ? data : holiday
          ),
        }));
        toast.success("Holiday updated successfully");
      } catch (error) {
        console.error("Error updating holiday:", error);
        toast.error(error.response.data.error);
      }
      set({ isSubmitting: false });
    },
  }))
);
export default useHolidayStore;
