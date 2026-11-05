import clsx from 'clsx'

const SIZE = { sm: 'w-6 h-6 type-meta', md: 'w-8 h-8 type-caption', lg: 'w-10 h-10 type-body-sm' }

// 8단계. primary-soft 배경 + primary-text 글자는 둘 다 연해 이니셜이 안 보였다.
// primary 정색 배경 + 흰 글자로 바꿨다(대비 5.17:1)
export default function Avatar({ name = '', size = 'md', className }) {
  const initial = name.trim().slice(0, 1) || '?'
  return (
    <span
      aria-hidden="true"
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-sm bg-primary text-text-inverse type-strong', SIZE[size], className)}
    >
      {initial}
    </span>
  )
}
