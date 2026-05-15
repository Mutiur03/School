import backend from "@/lib/backend";
import { fetchGalleryImages } from "@/queries/gallery.queries";
import ImagesPage from "./Image";

export const revalidate = 60;

interface PageProps {
    params: Promise<{
        type: string;
        id: string;
    }>;
}

export default async function Page({ params }: PageProps) {
    const { type: rawType, id } = await params;
    const apiBase = backend || "";
    const type = rawType === "event" ? "event" : "campus";
    const images = await fetchGalleryImages(type, id);

    return <ImagesPage apiBase={apiBase} images={images} type={type} />;
}
