// UI.md 8장 버튼 표. 테두리와 ring 을 쓰지 않고 면 색으로만 단계를 낸다.
// primary 와 secondary 의 padding height radius font 는 완전히 같다.
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

// 글자는 절대 두 줄로 꺾지 않는다(whitespace-nowrap). 좁은 화면에서는 collapse 로 아이콘만 남긴다
const BASE = 'pressable inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed'
// 모바일 터치 타깃 44(플레이북 5.2, DESIGN.md 접근성 절). md 이상은 데스크톱 밀도를 그대로 둔다
const SIZE = {
  sm: 'h-8 min-h-11 min-w-11 md:min-h-0 md:min-w-0 px-3 type-caption',
  md: 'h-10 min-h-11 min-w-11 md:min-h-0 md:min-w-0 px-4 type-body-sm',
  lg: 'h-11 px-5 type-body-sm',
  // 도우미 화면 단계 버튼. 높이 56, 고령 사용자 기준
  xl: 'h-14 w-full px-5 rounded-md type-h3'
}
const VARIANT = {
  primary: 'bg-primary text-text-inverse hover:bg-primary-hover',
  secondary: 'bg-mute text-text-pri hover:bg-line-sub',
  ghost: 'bg-transparent text-text-sec hover:bg-mute hover:text-text-pri',
  danger: 'bg-danger text-text-inverse hover:bg-danger-strong'
}

export default function Button({
  as: As = 'button', variant = 'primary', size = 'md',
  loading = false, leftIcon, rightIcon, disabled, className, children, collapse, ...rest
}) {
  const isButton = As === 'button'
  // collapse: 'sm' | 'md' | 'lg' | 'xl' 미만 폭에서는 글자를 숨기고 아이콘만(이름은 aria-label 과 말풍선으로)
  const SHOW = { sm: 'hidden sm:inline', md: 'hidden md:inline', lg: 'hidden lg:inline', xl: 'hidden xl:inline' }
  const named = collapse && typeof children === 'string' ? { 'aria-label': rest['aria-label'] || children, title: rest.title || children } : {}
  return (
    <As
      className={clsx(BASE, SIZE[size], VARIANT[variant], collapse && leftIcon && 'max-xl:px-2', !isButton && (disabled || loading) && 'pointer-events-none opacity-40', className)}
      {...(isButton ? { type: rest.type || 'button', disabled: disabled || loading } : {})}
      {...named}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : leftIcon}
      {collapse ? <span className={SHOW[collapse]}>{children}</span> : children}
      {!loading && rightIcon}
    </As>
  )
}
