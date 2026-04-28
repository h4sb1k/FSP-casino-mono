import { useCallback, useRef } from 'react'
import { gsap } from 'gsap'

type SpinArgs = {
  laneEl: HTMLDivElement
  containerEl: HTMLDivElement
  pointerEl?: HTMLDivElement | null
  winIndex: number
  itemWidth: number
  durationMs: number
  visiblePadding?: number
  onStart?: () => void
  onComplete: () => void
}

export function useRouletteTimeline() {
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  const reset = useCallback((laneEl?: HTMLDivElement | null) => {
    timelineRef.current?.kill()
    timelineRef.current = null
    if (laneEl) gsap.set(laneEl, { x: 0 })
  }, [])

  const spin = useCallback((args: SpinArgs) => {
    const {
      laneEl,
      containerEl,
      pointerEl,
      winIndex,
      itemWidth,
      durationMs,
      visiblePadding = 5,
      onStart,
      onComplete,
    } = args
    reset(laneEl)

    const containerWidth = containerEl.clientWidth
    const centerOffset = (containerWidth / 2) - (itemWidth / 2)
    const startX = centerOffset - (visiblePadding * itemWidth)
    const jitter = (Math.random() * 16) - 8
    const targetX = centerOffset - (winIndex * itemWidth) + jitter
    const totalDuration = Math.max(6.2, durationMs / 1000)
    const stopAt = 0.08 + totalDuration - 0.28

    const tl = gsap.timeline({ onStart, onComplete })
    tl.set(laneEl, { x: startX })
      .to(containerEl, {
        scale: 1.02,
        boxShadow: '0 15px 50px rgba(245, 158, 11, 0.45)',
        duration: 0.2,
        ease: 'power2.out',
      })
      .to(laneEl, {
        x: targetX,
        duration: totalDuration,
        ease: 'power4.out',
        onUpdate: function onLaneUpdate() {
          if (!pointerEl) return
          const progress = this.progress()
          const wobble = progress < 0.86 ? Math.sin(progress * 85) * 3.5 : 0
          gsap.set(pointerEl, { y: wobble })
        },
      }, 0.08)
      .to(containerEl, {
        scale: 1,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
        duration: 1.2,
        ease: 'power2.out',
      }, 0.5)
      .to(containerEl, {
        y: '+=5',
        duration: 0.045,
        repeat: 6,
        yoyo: true,
        ease: 'steps(1)',
        onComplete: () => gsap.set(containerEl, { y: 0 }),
      }, stopAt)

    if (pointerEl) {
      tl.set(pointerEl, { y: 0, scale: 1 }, 0)
        .to(pointerEl, {
          scale: 1.15,
          boxShadow: '0 0 34px rgba(245, 158, 11, 0.8)',
          duration: 0.1,
          yoyo: true,
          repeat: 2,
          ease: 'power2.inOut',
          onComplete: () => gsap.set(pointerEl, { boxShadow: '', scale: 1, y: 0 }),
        }, stopAt + 0.08)
    }

    timelineRef.current = tl
  }, [reset])

  return { spin, reset }
}
