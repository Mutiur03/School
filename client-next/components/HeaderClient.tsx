'use client'
import * as React from "react";

import governmentLogoImage from "../assets/images/gov-logo.png";
import Image from "next/image";
import type { StaticImageData } from "next/image";

export type HeaderProps = {
  bannerImages?: string[];
  headerLogo?: string;
  leftLogo?: string;
  rightLogo?: string | StaticImageData;
  titleBn?: string;
  titleEn?: string;
  slideIntervalMs?: number;
  school: {
    assets?: {
      banners?: string[];
      headerLogo?: string;
      logo?: string;
      governmentLogo?: string;
    };
    name?: {
      bn?: string;
      en?: string;
    };
  };
};

export function Header({
  bannerImages: bannerImagesProp,
  headerLogo: headerLogoProp,
  leftLogo: leftLogoProp,
  rightLogo: rightLogoProp,
  titleBn: titleBnProp,
  titleEn: titleEnProp,
  slideIntervalMs = 4000,
  school
}: HeaderProps) {

  const bannerImages = bannerImagesProp ?? (school.assets?.banners ?? []);
  const headerLogo = headerLogoProp ?? (school.assets?.headerLogo ?? "");
  const leftLogo = leftLogoProp ?? (school.assets?.logo ?? "");
  const rightLogo = rightLogoProp ??
    ((school.assets as { governmentLogo?: string } | undefined)?.governmentLogo ??
      governmentLogoImage);
  const titleBn = titleBnProp ?? String(school.name?.bn ?? "");
  const titleEn = titleEnProp ?? String(school.name?.en ?? "");

  const [currentSlide, setCurrentSlide] = React.useState(0);
  // Only mount images for slides that have been reached (plus the next one),
  // so slides 2..n do not download during initial page load.
  const [loadedSlides, setLoadedSlides] = React.useState<Set<number>>(
    () => new Set([0, bannerImages.length > 1 ? 1 : 0])
  );

  const markLoaded = React.useCallback(
    (index: number) => {
      setLoadedSlides((prev) => {
        const next = (index + 1) % bannerImages.length;
        if (prev.has(index) && prev.has(next)) return prev;
        const updated = new Set(prev);
        updated.add(index);
        updated.add(next); // preload the upcoming slide so transitions are not blank
        return updated;
      });
    },
    [bannerImages.length]
  );

  React.useEffect(() => {
    if (!bannerImages.length) return;
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % bannerImages.length;
        markLoaded(next);
        return next;
      });
    }, slideIntervalMs);

    return () => clearInterval(slideInterval);
  }, [bannerImages.length, slideIntervalMs, markLoaded]);


  return (
    <div className="relative shadow-lg">
      <div id="banner" className="banner slider-header"></div>
      <div className="carousel slide"></div>

      <div className="relative h-70 overflow-hidden md:h-80">
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {bannerImages.map((image, index) => (
            <div key={index} className="relative h-full min-w-full">
              {loadedSlides.has(index) ? (
                <Image
                  src={image}
                  alt={`Banner ${index + 1}`}
                  width={1920}
                  height={480}
                  sizes="(max-width: 1140px) 100vw, 1140px"
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  className="h-full w-full object-cover object-top"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/30"></div>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {headerLogo ? (
            <div className="relative h-32 w-[95%] max-w-245 md:h-40">
              <Image
                src={headerLogo}
                alt="Header"
                fill
                sizes="(min-width: 768px) 980px, 95vw"
                className="object-contain"
              />
            </div>
          ) : (
            <div className="flex w-full max-w-245 items-center justify-between gap-3 px-4 md:px-5">
              {leftLogo ? (
                <Image
                  src={leftLogo}
                  alt="School logo"
                  width={96}
                  height={96}
                  className="h-20 w-20 shrink-0 object-contain md:h-24 md:w-24"
                />
              ) : null}
              <div className="text-center text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.65)]">
                {titleBn ? (
                  <h2 className="m-0 text-2xl font-medium leading-tight md:text-4xl">
                    {titleBn}
                  </h2>
                ) : null}
                {titleEn ? (
                  <h3 className="mt-2 text-3xl font-normal leading-tight md:text-5xl">
                    {titleEn}
                  </h3>
                ) : null}
              </div>
              {rightLogo ? (
                <Image
                  src={rightLogo}
                  alt="Government logo"
                  width={96}
                  height={96}
                  className="h-20 w-20 shrink-0 object-contain md:h-24 md:w-24"
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="absolute bottom-3 left-1/2 z-15 flex -translate-x-1/2 gap-2">
          {bannerImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-3 w-3 rounded-full border-0 ${currentSlide === index ? "bg-white" : "bg-white/50"
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Header;
