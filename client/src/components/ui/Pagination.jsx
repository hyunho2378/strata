import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '../../i18n/LangContext.jsx'

// 현재 페이지 주변 5개만 노출한다
function pages(page, last) {
  const start = Math.max(1, Math.min(page - 2, last - 4))
  return Array.from({ length: Math.min(5, last) }, (_, i) => start + i).filter((p) => p >= 1 && p <= last)
}

export default function Pagination({ page = 1, total = 0, pageSize = 20, onChange, className }) {
  const { t } = useLang()
  const last = Math.max(1, Math.ceil(total / pageSize))
  if (last <= 1) return null
  const btn = 'inline-flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-sm type-body-sm tabular-nums transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:min-w-0'

  return (
    <nav className={clsx('flex flex-wrap items-center justify-center gap-1', className)} aria-label={t('common.a11y.pagination')}>
      <button type="button" className={clsx(btn, 'text-text-sec hover:bg-mute')} disabled={page <= 1} onClick={() => onChange?.(page - 1)} aria-label={t('common.a11y.prevPage')}>
        <ChevronLeft size={16} />
      </button>
      {pages(page, last).map((p) => (
        <button
          key={p} type="button" aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange?.(p)}
          className={clsx(btn, p === page ? 'bg-primary-soft text-primary-text type-strong' : 'text-text-sec hover:bg-mute')}
        >
          {p}
        </button>
      ))}
      <button type="button" className={clsx(btn, 'text-text-sec hover:bg-mute')} disabled={page >= last} onClick={() => onChange?.(page + 1)} aria-label={t('common.a11y.nextPage')}>
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
