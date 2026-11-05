// 단일 선택 칩(radiogroup). 선택 상태는 채움 + 체크 아이콘(색 하나로만 표시하지 않음). size: sm(32) | md(44, md 이상 36) | lg(48)
import clsx from 'clsx'
import { Check } from 'lucide-react'

export default function ChoiceChips({ options = [], value, onChange, label, size = 'md', className }) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange?.(o.value)}
            className={clsx('pressable inline-flex items-center gap-1.5 rounded-sm whitespace-nowrap',
              size === 'lg' ? 'h-12 px-4 type-strong' : size === 'sm' ? 'h-8 px-3 type-meta' : 'h-11 px-4 type-strong md:h-9',
              on ? 'bg-primary-soft text-primary-text' : 'bg-mute text-text-sec hover:bg-line-sub hover:text-text-pri')}
          >
            {on && <Check size={size === 'sm' ? 14 : 16} aria-hidden="true" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
