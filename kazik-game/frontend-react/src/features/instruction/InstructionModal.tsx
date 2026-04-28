import { useCallback, useEffect, useRef, useState } from 'react'
import './instruction-modal.css'

export type InstructionSlide = { src: string; caption: string }

export type InstructionConfig = {
  title: string
  steps: string[]
  note: string
  slides: InstructionSlide[]
}

function instructionOneStep(from: number, to: number, len: number) {
  if (len <= 1) return true
  const forward = (to - from + len) % len
  const backward = (from - to + len) % len
  return forward === 1 || backward === 1
}

type Props = {
  open: boolean
  onClose: () => void
  config: InstructionConfig
}

export function InstructionModal({ open, onClose, config }: Props) {
  const { title, steps, note, slides } = config
  const [index, setIndex] = useState(0)
  const [slideInstant, setSlideInstant] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    if (open) {
      setSlideInstant(true)
      setIndex(0)
      indexRef.current = 0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideInstant(false))
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const goToSlide = useCallback((next: number) => {
    const from = indexRef.current
    const len = slides.length
    const one = instructionOneStep(from, next, len)
    if (!one) setSlideInstant(true)
    setIndex(next)
    indexRef.current = next
    if (!one) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideInstant(false))
      })
    }
  }, [slides.length])

  useEffect(() => {
    if (!open) return undefined
    const len = slides.length
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goToSlide((indexRef.current - 1 + len) % len)
      if (e.key === 'ArrowRight') goToSlide((indexRef.current + 1) % len)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, slides.length, goToSlide])

  if (!open) return null

  const n = slides.length
  const trackPct = n > 0 ? (index / n) * 100 : 0

  return (
    <div className="instruction-modal-root" role="presentation">
      <button
        type="button"
        className="instruction-modal-backdrop"
        aria-label="Закрыть инструкцию"
        onClick={onClose}
      />
      <div
        className="instruction-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instruction-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="instruction-modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="instruction-modal-title" className="instruction-modal-title">
          {title}
        </h2>
        <div className="instruction-modal-intro">
          <ol>
            {steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p className="instruction-modal-note">{note}</p>
        </div>
        <div className="instruction-modal-slider">
          <button
            type="button"
            className="instruction-modal-nav"
            onClick={() => goToSlide((index - 1 + slides.length) % slides.length)}
            aria-label="Предыдущий слайд"
          >
            ‹
          </button>
          <div
            className="instruction-modal-slide-viewport"
            style={{ ['--instruction-slide-count' as never]: String(n) }}
          >
            <div
              className={`instruction-modal-slide-track${slideInstant ? ' is-instant' : ''}`}
              style={{ transform: `translate3d(-${trackPct}%, 0, 0)` }}
            >
              {slides.map((s) => (
                <div key={s.src} className="instruction-modal-slide-page">
                  <img src={s.src} alt="" className="instruction-modal-img" loading="lazy" />
                  <p className="instruction-modal-caption">{s.caption}</p>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="instruction-modal-nav"
            onClick={() => goToSlide((index + 1) % slides.length)}
            aria-label="Следующий слайд"
          >
            ›
          </button>
        </div>
        <div className="instruction-modal-dots" role="tablist" aria-label="Шаги инструкции">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? 'active' : ''}
              onClick={() => goToSlide(i)}
              aria-label={`Шаг ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
