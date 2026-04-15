import * as React from "react";

import { useSchoolConfig } from "../context/school";
import governmentLogoImage from "../assets/images/gov-logo.png";

export type HeaderProps = {
  bannerImages?: string[];
  headerLogo?: string;
  leftLogo?: string;
  rightLogo?: string;
  titleBn?: string;
  titleEn?: string;
  slideIntervalMs?: number;
};

export function Header({
  bannerImages: bannerImagesProp,
  headerLogo: headerLogoProp,
  leftLogo: leftLogoProp,
  rightLogo: rightLogoProp,
  titleBn: titleBnProp,
  titleEn: titleEnProp,
  slideIntervalMs = 4000,
}: HeaderProps) {
  const school = useSchoolConfig();
  const bannerImages = bannerImagesProp ?? (school.assets?.banners ?? []);
  const headerLogo = headerLogoProp ?? (school.assets?.headerLogo ?? "");
  const leftLogo = leftLogoProp ?? (school.assets?.logo ?? "");
  const rightLogo = rightLogoProp ??
    ((school.assets as { governmentLogo?: string } | undefined)?.governmentLogo ??
      governmentLogoImage);
  const titleBn = titleBnProp ?? String(school.name?.bn ?? "");
  const titleEn = titleEnProp ?? String(school.name?.en ?? "");

  const [currentSlide, setCurrentSlide] = React.useState(0);

  React.useEffect(() => {
    if (!bannerImages.length) return;
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerImages.length);
    }, slideIntervalMs);

    return () => clearInterval(slideInterval);
  }, [bannerImages.length, slideIntervalMs]);


  return (
    <div className="relative shadow-lg">
      <div id="banner" className="banner slider-header"></div>
      <div className="carousel slide"></div>

      <div className="relative h-[280px] overflow-hidden md:h-[320px]">
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {bannerImages.map((image, index) => (
            <div key={index} className="relative h-full min-w-full">
              <img
                src={image}
                alt={`Banner ${index + 1}`}
                className="h-full w-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-black/30"></div>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {headerLogo ? (
            <img src={headerLogo} alt="Header" className="h-auto max-w-[95%]" />
          ) : (
            <div className="flex w-full max-w-[980px] items-center justify-between gap-3 px-4 md:px-5">
              {leftLogo ? (
                <img
                  src={leftLogo}
                  alt="School logo"
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
                <img
                  src={rightLogo}
                  alt="Government logo"
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