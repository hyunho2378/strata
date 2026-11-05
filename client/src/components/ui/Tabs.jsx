// PATTERNS.md 13번. 키보드 좌우 이동.
import { useRef } from 'react'
import clsx from 'clsx'

export default function Tabs({ items = [], value, onChange, variant = 'underline', className }) {
  const refs = useRef([])
  const idx = items.findIndex((t) => t.value === value)

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % items.length
      : (idx - 1 + items.length) % items.length
    onChange?.(items[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist" onKeyDown={onKeyDown}
      className={clsx('flex gap-1', className)}
    >
      {items.map((t, i) => {
        const active = t.value === value
        return (
          <button
            key={t.value} type="button" role="tab" aria-selected={active}
            tabIndex={active ? 0 : -1}
            ref={(el) => { refs.current[i] = el }}
            onClick={() => onChange?.(t.value)}
            className={clsx(
              'relative h-10 min-h-11 min-w-11 md:min-h-0 md:min-w-0 px-3 type-strong transition-colors duration-fast',
              variant === 'pill' && 'rounded-sm',
              variant === 'pill' && active && 'bg-text-pri text-text-inverse',
              active ? (variant === 'pill' ? null : 'text-text-pri') : 'text-text-meta hover:text-text-sec'
            )}
          >
            {t.label}
            {variant === 'underline' && active && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-sm bg-text-pri" />}
          </button>
        )
      })}
    </div>
  )
}
