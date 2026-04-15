'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { BannerSlider } from './BannerSlider'
import type { StaticImport } from 'next/dist/shared/lib/get-img-props'

export type HeaderClientProps = {
  bannerImages: string[]
  headerLogo: string
  leftLogo: string
  rightLogo: string | StaticImport
  titleBn: string
  titleEn: string
}

export function HeaderClient(props: HeaderClientProps) {
  // Freeze all props on first render.
  // Even if the parent Server Component re-renders during navigation and passes
  // new prop references, this component always uses the initial values —
  // which means BannerSlider inside is never touched after first mount.
  const { bannerImages, headerLogo, leftLogo, rightLogo, titleBn, titleEn } =
    useRef(props).current

  return (
    <div className="relative shadow-lg">
      <div className="relative h-70 overflow-hidden md:h-80">
        <BannerSlider images={bannerImages}>
          {headerLogo ? (
            <Image
              src={headerLogo}
              alt="Header"
              width={1200}
              height={260}
              className="h-auto max-w-[95%]"
            />
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
        </BannerSlider>
      </div>
    </div>
  )
}
