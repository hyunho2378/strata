import clsx from 'clsx'

// UI.md 8장. 경계선을 쓰지 않는다. 기본과 선택을 면 색으로만 가른다
const VARIANT = {
  outline: 'bg-mute text-text-sec hover:bg-line-sub hover:text-text-pri',
  filled: 'bg-mute text-text-sec hover:bg-line-sub hover:text-text-pri',
  selected: 'bg-primary-soft text-primary-text'
}

export default function Chip({ as: As = 'button', variant = 'outline', size = 'sm', className, children, ...rest }) {
  return (
    <As
      className={clsx(
        'pressable inline-flex items-center gap-2 rounded-sm px-4 type-strong whitespace-nowrap',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'md' ? 'h-10' : 'h-8',
        'min-h-11 min-w-11 md:min-h-0 md:min-w-0',   // 모바일 터치 타깃 44
        VARIANT[variant], className
      )}
      {...(As === 'button' ? { type: 'button' } : {})}
      {...rest}
    >
      {children}
    </As>
  )
}
