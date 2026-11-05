// 담당자 메뉴. 1열 아이콘 레일과 2열 메뉴 칸으로 나눈다.
// 레일에는 로고와 묶음 아이콘만 둔다. 문서함은 메뉴 칸 없이 바로 연다.
import clsx from 'clsx'
import { Layers3 } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Tooltip from '../ui/Tooltip.jsx'
import { RAIL_GROUPS, sectionOf } from './navConfig.js'
import { useReviewCount } from '../../lib/strataStats.js'

const firstLink = (g) => g.items.find((m) => m.to)

export function Rail({ group, onGroup }) {
  return (
    <div className="flex h-full w-14 flex-col items-center pb-3 pt-2.5">
      <Link to="/" aria-label="현황판으로 가기" className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-text-inverse">
        <Layers3 size={18} aria-hidden="true" />
      </Link>
      <nav aria-label="메뉴 묶음" className="mt-6 flex flex-col items-center gap-1">
        {RAIL_GROUPS.map((g) => {
          const active = g.key === group
          return (
            <div key={g.key} className="flex flex-col items-center">
              {g.direct && <span aria-hidden="true" className="my-1.5 h-px w-6 bg-line-def" />}
              <Tooltip label={g.label} side="right">
                <button
                  type="button" aria-pressed={active} aria-label={g.label}
                  onClick={() => onGroup(g.key, firstLink(g))}
                  className={clsx('pressable inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-fast',
                    active ? 'bg-page text-text-pri shadow-sm' : 'text-text-meta hover:bg-page hover:text-text-pri')}
                >
                  <g.Icon size={18} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          )
        })}
      </nav>
    </div>
  )
}

export function NavPanel({ group = 'work', onNavigate, showAll = false }) {
  const { pathname } = useLocation()
  const pending = useReviewCount()
  const current = sectionOf(pathname)
  const groups = showAll ? RAIL_GROUPS : RAIL_GROUPS.filter((g) => g.key === group)

  const row = (m) => {
    const active = current?.key === m.key
    const cls = clsx('flex min-h-10 items-center gap-2 rounded-md px-2 transition-colors duration-fast',
      active ? 'bg-mute text-text-pri' : 'text-text-sec hover:bg-mute hover:text-text-pri')
    return (
      <li key={m.key}>
        <NavLink to={m.to} end={m.end} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cls}>
          <m.Icon size={16} aria-hidden="true" className={clsx('shrink-0', active ? 'text-text-pri' : 'text-text-meta')} />
          <span className={clsx('min-w-0 flex-1 truncate type-body-sm', active && 'font-bold')}>{m.label}</span>
          {m.queue && pending > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs bg-text-pri px-1.5 type-count text-text-inverse" aria-label={'확인 대기 ' + pending + '건'}>{pending}</span>
          )}
        </NavLink>
      </li>
    )
  }

  return (
    <div className="flex flex-col px-2 py-3">
      {groups.map((g, i) => (
        <section key={g.key} aria-label={g.label} className={clsx(i > 0 && 'mt-6')}>
          <div className="mb-1 flex min-h-10 items-center pl-2">
            <h2 className="type-strong text-text-pri">{g.label}</h2>
          </div>
          <ul className="flex flex-col gap-0.5">{g.items.map(row)}</ul>
        </section>
      ))}
    </div>
  )
}

export default NavPanel
