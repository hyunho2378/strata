import { useId } from 'react'
import clsx from 'clsx'

export default function Toggle({ checked = false, onChange, label, disabled, id, className }) {
  const auto = useId()
  const switchId = id || auto
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <button
        id={switchId} type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={clsx(
          // 트랙은 44x24 지만 hit area 는 모바일 44x44 다(플레이북 5.2)
          'group inline-flex w-11 min-h-11 md:min-h-0 shrink-0 items-center',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'relative block h-6 w-11 rounded-xs transition-colors duration-fast',
            checked ? 'bg-text-pri' : 'bg-line-strong'
          )}
        >
          <span
            className={clsx(
              'absolute left-0.5 top-0.5 w-5 h-5 rounded-xs bg-page transition-transform duration-fast ease-out',
              checked && 'translate-x-5'
            )}
          />
        </span>
      </button>
      <label htmlFor={switchId} className="type-body-sm text-text-sec cursor-pointer">{label}</label>
    </div>
  )
}
