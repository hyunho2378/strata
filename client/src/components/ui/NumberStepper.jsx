// 숫자 스테퍼. 감소 버튼 + 값 + 증가 버튼. 네이티브 number input 대신 단계 단위로만 바꾼다.
import { useId } from 'react'
import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'
import IconButton from './IconButton.jsx'

// layout inline: 라벨 왼쪽, 스테퍼 오른쪽 한 줄(긴 목록용)
export default function NumberStepper({ label, value, onChange, min = 0, max = 999, step = 1, unit = '', hint, format, layout = 'stack', className }) {
  const id = useId()
  const set = (v) => onChange?.(Math.min(max, Math.max(min, Math.round(v * 100) / 100)))
  const shown = format ? format(value) : `${value}${unit}`
  return (
    <div className={clsx('min-w-0', layout === 'inline' && 'flex items-center justify-between gap-3', className)} role="group" aria-labelledby={`${id}-l`}>
      {label && <p id={`${id}-l`} className={clsx(layout === 'inline' ? 'min-w-0 truncate type-body-sm text-text-sec' : 'mb-1.5 type-caption text-text-sec')}>{label}</p>}
      <div className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-mute p-1">
        <IconButton size="sm" radius="xs" aria-label={`${label || '값'} ${step}${unit} 감소`} disabled={value <= min} onClick={() => set(value - step)}>
          <Minus size={16} aria-hidden="true" />
        </IconButton>
        <output aria-live="polite" className="min-w-16 px-2 text-center type-strong text-text-pri tabular-nums">{shown}</output>
        <IconButton size="sm" radius="xs" aria-label={`${label || '값'} ${step}${unit} 증가`} disabled={value >= max} onClick={() => set(value + step)}>
          <Plus size={16} aria-hidden="true" />
        </IconButton>
      </div>
      {hint && <p className="mt-1 type-meta text-text-meta">{hint}</p>}
    </div>
  )
}
