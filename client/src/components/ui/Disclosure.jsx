// 접힘 영역(details). 요약 줄 + 회전하는 화살표. 접힘 표현의 단일 출처.
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

export default function Disclosure({ summary, children, defaultOpen = false, className, summaryClassName }) {
  return (
    <details className={clsx('group', className)} open={defaultOpen || undefined}>
      <summary className={clsx('flex cursor-pointer list-none items-center gap-2 min-h-11 md:min-h-0 py-1 type-strong text-text-sec hover:text-text-pri [&::-webkit-details-marker]:hidden', summaryClassName)}>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform duration-fast group-open:rotate-180" />
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}
