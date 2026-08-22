'use client';

import Link from '@/components/Link';
import { useState } from 'react';
import type { GalleryItem } from '@/queries/gallery.queries';
import Image from 'next/image';
import { getFileUrl } from '@/lib/cdn';

interface GalleryClientProps {
  campusItems: GalleryItem[];
  eventItems: GalleryItem[];
}

export default function GalleryClient({ campusItems, eventItems }: GalleryClientProps) {
  const [active, setActive] = useState<'campus' | 'event'>('campus');
  const itemsToShow = active === 'campus' ? campusItems : eventItems;
  const hasValidId = (item: GalleryItem) =>
    Number.isFinite(typeof item.id === 'string' ? Number.parseInt(item.id, 10) : item.id) &&
    Number(item.id) > 0;

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActive('campus')}
          aria-pressed={active === 'campus'}
          className={`rounded-md border px-3 py-2 transition-[background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            active === 'campus'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
        >
          Campus Gallery
        </button>
        <button
          type="button"
          onClick={() => setActive('event')}
          aria-pressed={active === 'event'}
          className={`rounded-md border px-3 py-2 transition-[background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            active === 'event'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
        >
          Event Gallery
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {itemsToShow.filter(hasValidId).length === 0 ? (
          <div className="col-span-full py-8 text-center text-sm text-gray-500">
            No items to show.
          </div>
        ) : (
          itemsToShow.filter(hasValidId).map((item) => (
            <Link
              key={item.id}
              href={`/gallery/${active}/${item.id}`}
              className="block overflow-hidden rounded-lg border border-gray-100 bg-white transition hover:shadow-md"
            >
              <Image
                src={item.thumbnail ? getFileUrl(item.thumbnail) : '/placeholder.svg'}
                alt={item.title}
                className="block h-36 w-full object-cover"
                width={100}
                height={100}
              />
              <div className="p-3">
                <div className="font-semibold text-gray-800">
                  {item.category !== 'Event' ? item.category : item.title}
                </div>
                <div className="mt-1 text-sm text-gray-500">{active !== 'campus' && 'Event'}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
