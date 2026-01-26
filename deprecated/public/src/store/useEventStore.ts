import { create } from "zustand";
import axios from "axios";

interface Event {
  id: number;
  title: string;
  details: string;
  date: string;
  location: string;
  image: string;
  file: string;
}

interface EventState {
  events: Event[];
  loading: boolean;
  error: string | null;
  fetchEvents: () => Promise<void>;
  getEventById: (id: number) => Event | undefined;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  error: null,

  fetchEvents: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get("/api/events/getEvents");
      set({ events: response.data || [], loading: false });
    } catch (error) {
      console.error("Error fetching events:", error);
      set({ error: "Failed to fetch events", loading: false });
    }
  },

  getEventById: (id: number) => {
    const { events } = get();
    return events.find((event) => event.id === id);
  },
}));
