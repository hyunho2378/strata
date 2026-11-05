// 보기 전환(dah SegmentControl 구조, G-Chat 토큰). role=radiogroup, 좌우 화살표 이동. items: [{ value, label, icon? }]
import { useRef } from 'react'
import clsx from 'clsx'

export default function SegmentControl({ items = [], value, onChange, label, className }) {
  const refs = useRef([])
  const idx = items.findIndex((i) => i.value === value)
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = e.key === 'ArrowRight' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length
    onChange?.(items[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={clsx('inline-flex gap-1 rounded-sm bg-mute p-1', className)}>
      {items.map((it, i) => {
        const active = it.value === value
        return (
          <button
            key={it.value} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={active}
            tabIndex={active ? 0 : -1} onClick={() => onChange?.(it.value)}
            className={clsx('pressable h-8 min-h-11 whitespace-nowrap rounded-xs px-3 type-caption md:min-h-0',
              active ? 'bg-page text-text-pri shadow-sm' : 'text-text-sec hover:text-text-pri')}
          >
            <span className="inline-flex items-center gap-1.5">{it.icon && <it.icon size={16} aria-hidden="true" className={it.iconClass} />}{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
