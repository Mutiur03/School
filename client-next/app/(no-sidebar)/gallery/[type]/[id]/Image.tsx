'use client';

import Image from 'next/image';
import Link from '@/components/Link';
import { useEffect, useId, useRef, useState } from 'react';
import { getFileUrl } from '@/lib/cdn';

export interface ImageItem {
  id: number | string;
  image_path: string;
  caption?: string;
}

interface ImagesPageProps {
  type: 'campus' | 'event';
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
      console.error('Copy failed', err);
    }
  };

  useEffect(() => {
    if (selectedIndex === null) return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) => {
          if (prev === null) return null;
          return (prev - 1 + images.length) % images.length;
        });
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) => {
          if (prev === null) return null;
          return (prev + 1) % images.length;
        });
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      lastFocusedRef.current?.focus();
    };
  }, [selectedIndex, images.length]);

  useEffect(() => {
    if (selectedIndex === null) return;
    activeThumbRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pretty">
          {type === 'campus' ? 'Campus Gallery' : 'Event Gallery'}
        </h2>
        <Link
          href="/gallery"
          className="text-sm text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Back to galleries
        </Link>
      </div>

      {images.length === 0 ? (
        <div className="py-8 text-center text-gray-500">No images to show.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className="block overflow-hidden rounded border border-gray-100 bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Image
                src={img.image_path ? getFileUrl(img.image_path) : '/placeholder.svg'}
                alt={img.caption || 'image'}
                className="block h-36 w-full object-cover"
                width={100}
                height={100}
              />
            </button>
          ))}
        </div>
      )}

      {selectedIndex !== null && images[selectedIndex] && (
        <div
          className="fixed inset-0 z-1001 flex items-center justify-center bg-black/60 p-4"
          style={{ overscrollBehavior: 'contain' }}
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
            className="flex max-h-full w-full max-w-4xl flex-col overflow-y-auto rounded-sm bg-white p-4"
            style={{ overscrollBehavior: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeLightbox}
                  aria-label="Close"
                  className="rounded-full bg-black p-2 text-white hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
                  className="rounded-full bg-black p-2 text-white hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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

                <span className="ml-2 text-sm text-gray-700" aria-live="polite">
                  {copied ? 'Copied!' : ''}
                </span>
              </div>

              <div id={titleId} className="text-sm text-black">
                {selectedIndex + 1}/{images.length}
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              <Image
                src={
                  images[selectedIndex].image_path
                    ? getFileUrl(images[selectedIndex].image_path)
                    : '/placeholder.svg'
                }
                alt={images[selectedIndex].caption || 'full image'}
                className="h-auto max-h-[70vh] w-full rounded object-contain"
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
                className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
              <div className="mt-2 text-sm text-gray-800">{images[selectedIndex].caption}</div>
            ) : null}

            <div className="no-scrollbar mt-3 overflow-x-auto py-2">
              <div className="flex items-center gap-2 px-1">
                {images.map((thumb, i) => {
                  const isActive = i === selectedIndex;
                  return (
                    <button
                      key={thumb.id}
                      type="button"
                      onClick={() => setSelectedIndex(i)}
                      ref={isActive ? activeThumbRef : undefined}
                      aria-label={`View image ${i + 1}`}
                      aria-current={isActive ? 'true' : undefined}
                      className={`shrink-0 overflow-hidden rounded border-2 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isActive ? 'scale-105 border-blue-400' : 'border-transparent'
                      }`}
                      style={{ width: 80, height: 60 }}
                    >
                      <Image
                        src={thumb.image_path ? getFileUrl(thumb.image_path) : '/placeholder.svg'}
                        alt={thumb.caption || `thumb-${i}`}
                        className={`h-full w-full object-cover ${isActive ? '' : 'brightness-75'}`}
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
