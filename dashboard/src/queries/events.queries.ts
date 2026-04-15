import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-hot-toast";

export interface Event {
  id: string | number;
  title: string;
  details: string;
  location: string;
  file: string;
  image: string;
  date: string;
  download_url?: string;
}

export const useEvents = () => {
  return useQuery<Event[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await axios.get("/api/events/getEvents");
      return response.data;
    },
  });
};

export const useAddEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      details?: string;
      location?: string;
      date: string;
      image?: File;
      file?: File;
    }) => {
      let imageKey = undefined;
      let fileKey = undefined;

      // 1. Handle image upload
      if (data.image) {
        const {
          data: { uploadUrl, key },
        } = await axios.get("/api/events/presigned-url", {
          params: {
            filename: data.image.name,
            contentType: data.image.type,
            type: "image",
          },
        });
        await axios.put(uploadUrl, data.image, {
          headers: { "Content-Type": data.image.type },
        });
        imageKey = key;
      }

      // 2. Handle file upload
      if (data.file) {
        const {
          data: { uploadUrl, key },
        } = await axios.get("/api/events/presigned-url", {
          params: {
            filename: data.file.name,
            contentType: data.file.type,
            type: "file",
          },
        });
        await axios.put(uploadUrl, data.file, {
          headers: { "Content-Type": data.file.type },
        });
        fileKey = key;
      }

      // 3. Save event record to database
      const response = await axios.post("/api/events/addEvent", {
        title: data.title,
        details: data.details,
        location: data.location,
        date: data.date,
        imageKey,
        fileKey,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created successfully");
    },
    onError: (error: any) => {
      console.error("Error adding event:", error);
      toast.error(error.response?.data?.error || "Error adding event");
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string | number;
      data: {
        title?: string;
        details?: string;
        location?: string;
        date?: string;
        image?: File | null;
        file?: File | null;
      };
    }) => {
      let imageKey = undefined;
      let fileKey = undefined;

      if (data.image instanceof File) {
        const {
          data: { uploadUrl, key },
        } = await axios.get("/api/events/presigned-url", {
          params: {
            filename: data.image.name,
            contentType: data.image.type,
            type: "image",
          },
        });
        await axios.put(uploadUrl, data.image, {
          headers: { "Content-Type": data.image.type },
        });
        imageKey = key;
      }

      if (data.file instanceof File) {
        const {
          data: { uploadUrl, key },
        } = await axios.get("/api/events/presigned-url", {
          params: {
            filename: data.file.name,
            contentType: data.file.type,
            type: "file",
          },
        });
        await axios.put(uploadUrl, data.file, {
          headers: { "Content-Type": data.file.type },
        });
        fileKey = key;
      }

      const response = await axios.put(`/api/events/updateEvent/${id}`, {
        ...data,
        imageKey,
        fileKey,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating event:", error);
      toast.error(error.response?.data?.error || "Error updating event");
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const response = await axios.delete(`/api/events/deleteEvent/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event deleted successfully");
    },
    onError: (error: any) => {
      console.error("Error deleting event:", error);
      toast.error(error.response?.data?.error || "Error deleting event");
    },
  });
};
