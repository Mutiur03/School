import { create } from "zustand";
import { devtools } from "zustand/middleware";
import axios, { AxiosError } from "axios";
import { toast } from "react-toastify";

export interface Holiday {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

export interface HolidayFormData {
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

interface HolidayState {
  holidays: Holiday[];
  isDeleting: boolean;
  isSubmitting: boolean;
  isLoading: boolean;
  addHoliday: (formData: HolidayFormData) => Promise<void>;
  fetchHolidays: () => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  updateHoliday: (id: string, formData: HolidayFormData) => Promise<void>;
}

const useHolidayStore = create<HolidayState>()(
  devtools((set) => ({
    holidays: [],
    isDeleting: false,
    isSubmitting: false,
    isLoading: false,
    addHoliday: async (formData) => {
      set({ isSubmitting: true });
      try {
        const response = await axios.post<Holiday>(
          "/api/holidays/addHoliday",
          formData
        );
        set((state) => ({
          holidays: [...state.holidays, response.data],
        }));
        toast.success("Holiday added successfully");
      } catch (error) {
        const err = error as AxiosError<{ error: string }>;
        toast.error(err.response?.data?.error || "Error adding holiday");
      } finally {
        set({ isSubmitting: false });
      }
    },
    fetchHolidays: async () => {
      set({ isLoading: true });
      try {
        const res = await axios.get<Holiday[]>("/api/holidays/getHolidays");
        set({ holidays: res.data });
      } catch {
        toast.error("Error fetching holidays");
      } finally {
        set({ isLoading: false });
      }
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
        const err = error as AxiosError<{ error: string }>;
        toast.error(err.response?.data?.error || "Error deleting holiday");
      } finally {
        set({ isDeleting: false });
      }
    },
    updateHoliday: async (id, formData) => {
      set({ isSubmitting: true });
      try {
        const response = await axios.put<Holiday>(
          `/api/holidays/updateHoliday/${id}`,
          formData
        );
        set((state) => ({
          holidays: state.holidays.map((holiday) =>
            holiday.id === id ? response.data : holiday
          ),
        }));
        toast.success("Holiday updated successfully");
      } catch (error) {
        const err = error as AxiosError<{ error: string }>;
        toast.error(err.response?.data?.error || "Error updating holiday");
      } finally {
        set({ isSubmitting: false });
      }
    },
  }))
);

export default useHolidayStore;
