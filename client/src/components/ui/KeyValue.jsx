// 라벨과 값 목록(dl). md: 라벨 caption 600 / 값 body-sm 400. lg(도우미 화면): 라벨 body-sm / 값 body.
// 값 강조는 strong 항목만.
import clsx from 'clsx'

const SIZE = {
  md: { dt: 'type-caption text-text-meta pt-0.5', dd: 'type-body-sm text-text-sec', strong: 'type-strong text-text-pri' },
  lg: { dt: 'type-body-sm text-text-meta', dd: 'type-body text-text-pri', strong: 'type-body-strong text-text-pri' }
}

export default function KeyValue({ items = [], className, dense = false, size = 'md' }) {
  const s = SIZE[size]
  return (
    <dl className={clsx('grid grid-cols-[auto_1fr] gap-x-4', dense ? 'gap-y-1' : 'gap-y-2', className)}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className="contents">
          <dt className={s.dt}>{it.label}</dt>
          <dd className={clsx('min-w-0 break-words tabular-nums', it.strong ? s.strong : s.dd)}>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}
