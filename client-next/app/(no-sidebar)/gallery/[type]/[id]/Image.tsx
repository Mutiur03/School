"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { getFileUrl } from "@/lib/cdn";

export interface ImageItem {
    id: number | string;
    image_path: string;
    caption?: string;
}

interface ImagesPageProps {
    type: "campus" | "event";
    images: ImageItem[];
}

export default function ImagesPage({ type, images }: ImagesPageProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const activeThumbRef = useRef<HTMLButtonElement | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const [copied, setCopied] = useState(false);
    const titleId = useId();

    const closeLightbox = () => setSelectedIndex(null);

    const copyImage = async () => {
        if (selectedIndex === null) return;
        const url = getFileUrl(images[selectedIndex].image_path);
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error("Copy failed", err);
        }
    };

    useEffect(() => {
        if (selectedIndex === null) return;

        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        closeButtonRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeLightbox();
            } else if (e.key === "ArrowLeft") {
                setSelectedIndex((prev) => {
                    if (prev === null) return null;
                    return (prev - 1 + images.length) % images.length;
                });
            } else if (e.key === "ArrowRight") {
                setSelectedIndex((prev) => {
                    if (prev === null) return null;
                    return (prev + 1) % images.length;
                });
            } else if (e.key === "Tab" && dialogRef.current) {
                const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
            lastFocusedRef.current?.focus();
        };
    }, [selectedIndex, images.length]);

    useEffect(() => {
        if (selectedIndex === null) return;
        activeThumbRef.current?.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
        });
    }, [selectedIndex]);

    const goPrev = () => {
        setSelectedIndex((prev) => {
            if (prev === null) return null;
            return (prev - 1 + images.length) % images.length;
        });
    };

    const goNext = () => {
        setSelectedIndex((prev) => {
            if (prev === null) return null;
            return (prev + 1) % images.length;
        });
    };

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-pretty">
                    {type === "campus" ? "Campus Gallery" : "Event Gallery"}
                </h2>
                <Link href="/gallery" className="text-sm text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
                    Back to galleries
                </Link>
            </div>

            {images.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No images to show.</div>
            ) : (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {images.map((img, idx) => (
                        <button
                            key={img.id}
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            className="block rounded overflow-hidden bg-white border border-gray-100 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                            <Image
                                src={img.image_path ? getFileUrl(img.image_path) : "/placeholder.svg"}
                                alt={img.caption || "image"}
                                className="w-full h-36 object-cover block"
                                width={100}
                                height={100}
                            />
                        </button>
                    ))}
                </div>
            )}

            {selectedIndex !== null && images[selectedIndex] && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-1001 p-4"
                    style={{ overscrollBehavior: "contain" }}
                    onClick={closeLightbox}
                >
                    <style>{`
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
          `}</style>

                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        className="max-w-4xl w-full max-h-full rounded-sm bg-white p-4 flex flex-col overflow-y-auto"
                        style={{ overscrollBehavior: "contain" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <button
                                    ref={closeButtonRef}
                                    type="button"
                                    onClick={closeLightbox}
                                    aria-label="Close"
                                    className="text-white bg-black p-2 rounded-full hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>

                                <button
                                    type="button"
                                    onClick={copyImage}
                                    aria-label="Copy image URL"
                                    className="text-white p-2 bg-black rounded-full hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M8 16h8a2 2 0 002-2V8a2 2 0 00-2-2h-8a2 2 0 00-2 2v6a2 2 0 002 2z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M16 20H6a2 2 0 01-2-2V10"
                                        />
                                    </svg>
                                </button>

                                <span className="text-gray-700 text-sm ml-2" aria-live="polite">
                                    {copied ? "Copied!" : ""}
                                </span>
                            </div>

                            <div id={titleId} className="text-black text-sm">
                                {selectedIndex + 1}/{images.length}
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex items-center justify-center relative">
                            <Image
                                src={
                                    images[selectedIndex].image_path
                                        ? getFileUrl(images[selectedIndex].image_path)
                                        : "/placeholder.svg"
                                }
                                alt={images[selectedIndex].caption || "full image"}
                                className="w-full h-auto max-h-[70vh] object-contain rounded"
                                width={100}
                                height={100}
                            />
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goPrev();
                                }}
                                aria-label="Previous"
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2 hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </button>

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goNext();
                                }}
                                aria-label="Next"
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2 hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                        </div>

                        {images[selectedIndex].caption ? (
                            <div className="text-gray-800 mt-2 text-sm">
                                {images[selectedIndex].caption}
                            </div>
                        ) : null}

                        <div className="mt-3 overflow-x-auto py-2 no-scrollbar">
                            <div className="flex gap-2 items-center px-1">
                                {images.map((thumb, i) => {
                                    const isActive = i === selectedIndex;
                                    return (
                                        <button
                                            key={thumb.id}
                                            type="button"
                                            onClick={() => setSelectedIndex(i)}
                                            ref={isActive ? activeThumbRef : undefined}
                                            aria-label={`View image ${i + 1}`}
                                            aria-current={isActive ? "true" : undefined}
                                            className={`shrink-0 rounded overflow-hidden border-2 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isActive ? "border-blue-400 scale-105" : "border-transparent"
                                                }`}
                                            style={{ width: 80, height: 60 }}
                                        >
                                            <Image
                                                src={
                                                    thumb.image_path
                                                        ? getFileUrl(thumb.image_path)
                                                        : "/placeholder.svg"
                                                }
                                                alt={thumb.caption || `thumb-${i}`}
                                                className={`w-full h-full object-cover ${isActive ? "" : "brightness-75"
                                                    }`}
                                                width={80}
                                                height={60}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
