"use client";

import Link from "next/link";
import { useState } from "react";
import type { GalleryItem } from "@/queries/gallery.queries";
import Image from "next/image";

interface GalleryClientProps {
    apiBase: string;
    campusItems: GalleryItem[];
    eventItems: GalleryItem[];
}

export default function GalleryClient({
    apiBase,
    campusItems,
    eventItems,
}: GalleryClientProps) {
    const [active, setActive] = useState<"campus" | "event">("campus");
    const itemsToShow = active === "campus" ? campusItems : eventItems;
    const hasValidId = (item: GalleryItem) =>
        Number.isFinite(typeof item.id === "string" ? Number.parseInt(item.id, 10) : item.id) &&
        Number(item.id) > 0;

    return (
        <div className="p-4">
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActive("campus")}
                    aria-pressed={active === "campus"}
                    className={`px-3 py-2 rounded-md border transition focus:outline-none ${active === "campus"
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                            : "border-gray-300 bg-white hover:bg-gray-50"
                        }`}
                >
                    Campus Gallery
                </button>
                <button
                    onClick={() => setActive("event")}
                    aria-pressed={active === "event"}
                    className={`px-3 py-2 rounded-md border transition focus:outline-none ${active === "event"
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                            : "border-gray-300 bg-white hover:bg-gray-50"
                        }`}
                >
                    Event Gallery
                </button>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {itemsToShow.filter(hasValidId).length === 0 ? (
                    <div className="col-span-full text-center text-sm text-gray-500 py-8">
                        No items to show.
                    </div>
                ) : (
                    itemsToShow
                        .filter(hasValidId)
                        .map((item) => (
                            <Link
                                key={item.id}
                                href={`/gallery/${active}/${item.id}`}
                                className="block rounded-lg overflow-hidden bg-white border border-gray-100 hover:shadow-md transition"
                            >
                                <Image
                                    src={item.thumbnail ? `${apiBase}/${item.thumbnail}` : "/placeholder.svg"}
                                    alt={item.title}
                                    className="w-full h-36 object-cover block"
                                    width={100}
                                    height={100}
                                />
                                <div className="p-3">
                                    <div className="font-semibold text-gray-800">
                                        {item.category !== "Event" ? item.category : item.title}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {active !== "campus" && "Event"}
                                    </div>
                                </div>
                            </Link>
                        ))
                )}
            </div>
        </div>
    );
}
