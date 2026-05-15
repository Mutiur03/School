import { api } from "@/lib/backend";
import { cache } from "react";

export interface GalleryItem {
    id: number;
    title: string;
    thumbnail: string;
    category?: string;
}

export interface GalleryImageItem {
    id: number | string;
    image_path: string;
    caption?: string;
}

const normalizeArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object" && "data" in value) {
        const nested = (value as { data?: unknown }).data;
        if (Array.isArray(nested)) return nested as T[];
    }
    return [];
};

const normalizeGalleryItem = (item: Record<string, unknown>): GalleryItem => {
    const rawId =
        (item.id as number | string | undefined) ??
        (item.category_id as number | string | undefined) ??
        (item.event_id as number | string | undefined);
    const parsedId =
        typeof rawId === "string" ? Number.parseInt(rawId, 10) : rawId;
    const id = Number.isFinite(parsedId) ? (parsedId as number) : 0;

    return {
        id,
        title: (item.title as string | undefined) ?? (item.category as string | undefined) ?? "",
        thumbnail:
            (item.thumbnail as string | undefined) ??
            (item.image as string | undefined) ??
            "",
        category: (item.category as string | undefined) ?? undefined,
    };
};

export const fetchGalleryCategories = cache(async (): Promise<GalleryItem[]> => {
    try {
        const response = await api.get<GalleryItem[]>("/api/gallery/getCategories", {
            revalidate: 60,
        });
        return normalizeArray<Record<string, unknown>>(response.data).map(normalizeGalleryItem);
    } catch (error) {
        console.error("Error fetching gallery categories:", error);
        return [];
    }
});

export const fetchGalleryEvents = cache(async (): Promise<GalleryItem[]> => {
    try {
        const response = await api.get<GalleryItem[]>("/api/events/getEvents", {
            revalidate: 60,
        });
        return normalizeArray<Record<string, unknown>>(response.data).map(normalizeGalleryItem);
    } catch (error) {
        console.error("Error fetching gallery events:", error);
        return [];
    }
});

export const fetchGalleryImages = cache(
    async (type: "campus" | "event", id: string): Promise<GalleryImageItem[]> => {
        const endpoint =
            type === "campus"
                ? `/api/gallery/getGalleries/campus/${id}`
                : `/api/gallery/getGalleries/event/${id}`;

        try {
            const response = await api.get<GalleryImageItem[]>(endpoint, {
                revalidate: 60,
            });
            return normalizeArray<GalleryImageItem>(response.data);
        } catch (error) {
            console.error("Error fetching gallery images:", error);
            return [];
        }
    },
);
