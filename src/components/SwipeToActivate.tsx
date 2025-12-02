// src/components/SwipeToActivate.tsx
// VERTICAL "Swipe to Activate" control
// DO NOT REMOVE the setTimeout unless you also change the UX.

import React, { useState, useRef } from 'react'

const THUMB_SIZE = 70
const TRACK_PADDING = 5

export function SwipeToActivate({ onComplete }: { onComplete: () => void }) {
  const [offset, setOffset] = useState(0)        // vertical offset (top → bottom)
  const [complete, setComplete] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const offsetRef = useRef(0)

  function startDrag(startEvent: React.MouseEvent | React.TouchEvent) {
    if (complete) return

    const track = trackRef.current
    if (!track) return

    startEvent.preventDefault()
    const trackRect = track.getBoundingClientRect()

    function move(ev: MouseEvent | TouchEvent) {
      const clientY =
        'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY

      const rawOffset = clientY - trackRect.top - TRACK_PADDING
      const maxOffset =
        trackRect.height - THUMB_SIZE - TRACK_PADDING * 2

      const clamped = Math.min(Math.max(rawOffset, 0), maxOffset)

      offsetRef.current = clamped
      setOffset(clamped)

      if ('preventDefault' in ev) ev.preventDefault()
    }

    function end() {
      const trackNow = trackRef.current
      if (!trackNow) return

      const maxOffset =
        trackNow.getBoundingClientRect().height -
        THUMB_SIZE -
        TRACK_PADDING * 2

      const finalOffset = offsetRef.current

      if (finalOffset >= maxOffset * 0.9) {
        // SUCCESS: thumb reached bottom
        setOffset(maxOffset)
        offsetRef.current = maxOffset
        setComplete(true)

        // IMPORTANT:
        // We delay onComplete so the green "Activated" state
        // is actually visible before changing screens.
        // DO NOT REMOVE this timeout unless you really want
        // the UI to jump instantly with no green feedback.
        setTimeout(() => {
          onComplete()
        }, 1000) // ~1.0s: quick but visible
      } else {
        // Snap back to top
        setOffset(0)
        offsetRef.current = 0
      }

      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
  }

  return (
    <div
      className={`swipe-track ${complete ? 'swipe-complete' : ''}`}
      ref={trackRef}
    >
      <div
        className="swipe-thumb"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{ transform: `translate(-50%, ${offset}px)` }} // X fixed, Y moves
      >
        {complete ? '✓' : '↓'}
      </div>

      {!complete && <span className="swipe-label">Activate Simulation</span>}
      {complete && (
        <span className="swipe-label-complete">Activated</span>
      )}
    </div>
  )
}

