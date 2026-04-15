'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

type Props = {
  images: string[]
  slideIntervalMs?: number
  children?: React.ReactNode
}

// Module-level: initialized once per browser session, survives remounts
let _startTime: number | null = null

function getStartTime(): number {
  if (!_startTime) _startTime = Date.now()
  return _startTime
}

function getCurrentSlide(n: number, intervalMs: number): number {
  return Math.floor((Date.now() - getStartTime()) / intervalMs) % n
}

export function BannerSlider({ images, slideIntervalMs = 4000, children }: Props) {
  const N = images.length

  const [current, setCurrent] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return getCurrentSlide(N, slideIntervalMs)
  })

  // False on first render — prevents the active slide fading in from opacity-0
  // on mount/remount. Becomes true after paint so future slide changes transition.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Sync slide (handles any drift) and enable transitions in one flush
    setCurrent(getCurrentSlide(N, slideIntervalMs))
    setReady(true)

    if (N <= 1) return

    const elapsed = Date.now() - getStartTime()
    const msUntilNext = slideIntervalMs - (elapsed % slideIntervalMs)

    let intervalId: ReturnType<typeof setInterval>

    const timeoutId = setTimeout(() => {
      setCurrent(getCurrentSlide(N, slideIntervalMs))
      intervalId = setInterval(
        () => setCurrent(getCurrentSlide(N, slideIntervalMs)),
        slideIntervalMs,
      )
    }, msUntilNext)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [N, slideIntervalMs])

  if (!N) return null

  return (
    <div className="relative h-full w-full overflow-hidden" suppressHydrationWarning>
      {images.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 ${ready ? 'transition-opacity duration-1000' : ''} ${
            i === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={src}
            alt={`Banner ${i + 1}`}
            fill
            priority={i === 0}
            sizes="100vw"
            className="h-full w-full object-cover object-top"
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {children && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {children}
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {images.map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${ready ? 'transition-colors duration-500' : ''} ${
              i === current ? 'bg-white' : 'bg-white/50'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
