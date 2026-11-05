import { useId } from 'react'
import clsx from 'clsx'

export default function Textarea({ label, hint, error, rows = 4, id, className, ...rest }) {
  const auto = useId()
  const inputId = id || auto
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="block type-caption text-text-sec mb-1.5">{label}</label>}
      <div className={clsx(
        'focus-ring-within rounded-sm px-3 py-2.5 transition-colors duration-fast',
        error ? 'bg-danger-soft' : 'bg-subtle hover:bg-mute'
      )}>
        <textarea
          autoComplete="off" spellCheck={false}
          id={inputId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className="w-full min-w-0 resize-none bg-transparent outline-none type-body-sm text-text-pri placeholder:text-text-ter"
          {...rest}
        />
      </div>
      {error ? <p className="mt-1 type-caption text-danger-text">{error}</p>
             : hint && <p className="mt-1 type-meta text-text-meta">{hint}</p>}
    </div>
  )
}
