// 숫자 카드. 라벨은 위, 값은 아래에 둔다. 위험 값은 글자만 danger 로 바꾼다.
import clsx from 'clsx'
import { Link } from 'react-router-dom'

export default function MetricCard({ label, value, unit, sub, tone = 'neutral', to, badge, size = 'md' }) {
  const sm = size === 'sm'
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="type-caption text-text-sec">{label}</p>
        {badge}
      </div>
      <p className={clsx(sm ? 'mt-1 type-h2 tabular-nums' : 'mt-2 type-kpi', tone === 'danger' ? 'text-danger-text' : 'text-text-pri')}>
        {value}
        {unit && <span className={clsx('ml-1 text-text-meta', sm ? 'type-caption' : 'type-h3')}>{unit}</span>}
      </p>
      {sub && <div className="mt-2 type-meta text-text-meta">{sub}</div>}
    </>
  )
  const cls = clsx('block min-w-0 rounded-md bg-subtle', sm ? 'p-3 lg:p-4' : 'p-5 lg:p-6')
  return to
    ? <Link to={to} className={clsx(cls, 'transition-colors duration-fast hover:bg-mute')}>{body}</Link>
    : <div className={cls}>{body}</div>
}
