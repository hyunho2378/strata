import clsx from 'clsx'
import { useLang } from '../../i18n/LangContext.jsx'

// variant block(단일 블록) | text(줄 n개) | card(카드 프리셋)
// 막대는 장식이라 aria-hidden 이고, 불러오는 중이라는 사실만 role=status 로 알린다(플레이북 3.5)
export default function Skeleton({ variant = 'block', lines = 3, className }) {
  const { t } = useLang()
  const live = { role: 'status', 'aria-live': 'polite', 'aria-label': t('common.meta.loading') }
  if (variant === 'text') {
    return (
      <div className={clsx('space-y-2', className)} {...live}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={clsx('h-3 rounded-xs skeleton-bar', i === 1 && 'skeleton-bar-2', i === 2 && 'skeleton-bar-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    )
  }
  if (variant === 'card') {
    return (
      <div className={clsx('bg-page rounded-lg shadow-sm p-4 lg:p-5', className)} {...live}>
        <div className="h-4 w-1/3 rounded-xs skeleton-bar" />
        <div className="mt-3 h-3 w-full rounded-xs skeleton-bar skeleton-bar-2" />
        <div className="mt-2 h-3 w-4/5 rounded-xs skeleton-bar skeleton-bar-3" />
      </div>
    )
  }
  return <div className={clsx('rounded-md skeleton-bar', className)} {...live} />
}
