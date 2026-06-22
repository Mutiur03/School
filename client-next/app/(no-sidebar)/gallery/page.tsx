import { getBackendBaseUrl } from "@/lib/backend";
import { fetchGalleryCategories, fetchGalleryEvents } from "@/queries/gallery.queries";
import GalleryClient from "./GalleryClient";

export const revalidate = 60;

export default async function GalleryPage() {
    const apiBase = await getBackendBaseUrl();
    const [categories, events] = await Promise.all([
        fetchGalleryCategories(),
        fetchGalleryEvents(),
    ]);
    const campusItems = Array.isArray(categories) ? categories.slice(1) : [];
    const eventItems = Array.isArray(events) ? events : [];

    return (
        <GalleryClient
            apiBase={apiBase}
            campusItems={campusItems}
            eventItems={eventItems}
        />
    );
}
