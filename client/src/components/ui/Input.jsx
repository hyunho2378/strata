// PATTERNS.md 7번 그대로.
import { useId } from 'react'
import clsx from 'clsx'

// compact: 필터 줄용. 라벨은 화면에 그리지 않고 aria-label 로만
export default function Input({ label, hint, error, leftIcon, rightSlot, id, className, compact = false, ...rest }) {
  const auto = useId()
  const inputId = id || auto
  return (
    <div className={className}>
      {label && !compact && <label htmlFor={inputId} className="block type-caption text-text-sec mb-1.5">{label}</label>}
      <div className={clsx(
        'focus-ring-within flex h-11 items-center rounded-sm px-3 transition-colors duration-fast md:h-10',
        error ? 'bg-danger-soft' : 'bg-subtle hover:bg-mute'
      )}>
        {leftIcon && <span className="mr-2 text-text-meta">{leftIcon}</span>}
        <input
          autoComplete="off" spellCheck={false}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-label={compact ? label : undefined}
          className="flex-1 h-full min-w-0 bg-transparent outline-none type-body-sm text-text-pri placeholder:text-text-ter"
          {...rest}
        />
        {rightSlot && <span className="ml-2 shrink-0">{rightSlot}</span>}
      </div>
      {error ? <p className="mt-1 type-caption text-danger-text">{error}</p>
             : hint && <p className="mt-1 type-meta text-text-meta">{hint}</p>}
    </div>
  )
}
