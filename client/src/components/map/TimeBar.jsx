// 아래 시간축. 커스텀 슬라이더(네이티브 range 금지), 재생, 특보 고르기.
import { useCallback, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Pause, Play } from 'lucide-react'
import SegmentControl from '../ui/SegmentControl.jsx'

export const HAZARDS = [
  { value: 'none', label: '평시' },
  { value: 'cold', label: '한파' },
  { value: 'rain', label: '호우' },
  { value: 'tsunami', label: '해일' }
]

const fmt = (ms) => {
  const d = new Date(ms)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

export default function TimeBar({ min, max, value, onChange, playing, onPlay, hazard, onHazard, marks = [] }) {
  const trackRef = useRef(null)
  const span = Math.max(1, max - min)
  const ratio = Math.min(1, Math.max(0, (value - min) / span))

  const setFromClientX = useCallback((x) => {
    const el = trackRef.current
    if (!el) return
    const b = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (x - b.left) / b.width))
    onChange(Math.round(min + t * span))
  }, [min, span, onChange])

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }
  const onPointerMove = (e) => { if (e.buttons === 1) setFromClientX(e.clientX) }

  const onKeyDown = (e) => {
    const day = 86400000
    const step = e.shiftKey ? day * 7 : day
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(max, value + step)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(min, value - step)) }
    if (e.key === 'Home') { e.preventDefault(); onChange(min) }
    if (e.key === 'End') { e.preventDefault(); onChange(max) }
  }

  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      onChange(value + 86400000 >= max ? min : value + 86400000)
    }, 220)
    return () => clearInterval(id)
  }, [playing, value, min, max, onChange])

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg bg-page px-3 py-2 shadow-md md:flex-row md:items-center md:gap-3">
      <button
        type="button" onClick={onPlay} aria-label={playing ? '시간 재생 멈춤' : '시간 재생'}
        className="pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-text-inverse hover:bg-primary-hover"
      >
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="type-meta text-text-meta">{fmt(min)}</span>
          <span className="type-strong tabular-nums text-text-pri">{fmt(value)}</span>
          <span className="type-meta text-text-meta">{fmt(max)}</span>
        </div>
        <div
          ref={trackRef}
          role="slider" tabIndex={0}
          aria-label="보는 날짜" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={fmt(value)}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onKeyDown={onKeyDown}
          className="relative mt-1 h-6 cursor-pointer touch-none select-none"
        >
          <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-xs bg-mute" />
          <span aria-hidden="true" className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-xs bg-primary" style={{ width: `${ratio * 100}%` }} />
          {marks.map((m) => (
            <span
              key={m.at} aria-hidden="true" title={m.label}
              className={clsx('absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-xs', m.tone === 'danger' ? 'bg-danger' : 'bg-text-ter')}
              style={{ left: `${((m.at - min) / span) * 100}%` }}
            />
          ))}
          <span aria-hidden="true" className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-primary shadow-sm" style={{ left: `${ratio * 100}%` }} />
        </div>
      </div>

      <SegmentControl label="특보" value={hazard} onChange={onHazard} items={HAZARDS} className="shrink-0" />
    </div>
  )
}
