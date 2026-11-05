// 워드마크. 제품명 Strata. 기관명은 설정값에서 오므로 여기 박지 않는다.
import { Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

export default function Logo({ to = '/', className, compact = false, linked = true }) {
  const Root = linked ? Link : 'span'
  const props = linked ? { to, 'aria-label': 'Strata 홈' } : {}
  return (
    <Root {...props} className={clsx('inline-flex items-center gap-2 min-h-11 md:min-h-0 text-text-pri', className)}>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-text-inverse">
        <Layers size={20} aria-hidden="true" />
      </span>
      {!compact && <span className="type-h3">Strata</span>}
    </Root>
  )
}
