// 현황판. 흰 본문 위에 회색 면 카드를 벤토로 깐다.
// 1행: 오늘 지정 공백 | 이번 달 운영 중단 일정 | 확인할 일
// 2행: 대체 시설이 먼 곳 | 역할별 시설 수 | 오늘 운영 상태
// 숫자는 모두 client/src/data/strata.json 에서 계산한다.
import { useMemo } from 'react'
import clsx from 'clsx'
import { ArrowRight, ChevronRight, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card.jsx'
import PageShell, { todayLabel } from '../../components/strata/PageShell.jsx'
import MetricCard from '../../components/strata/MetricCard.jsx'
import BasisLine from '../../components/strata/BasisLine.jsx'
import { dotDate, useStrata } from '../../lib/strataData.js'
import { basisShort, farAlternatives, fmt, km, monthEvents, reviewItems, roleCounts, statusCount, todayGap } from '../../lib/strataStats.js'

// 이번 달 막대. 가로축은 1일부터 말일까지다
function MonthBars({ month }) {
  if (!month.rows.length) return <p className="py-6 text-center type-body-sm text-text-meta">이번 달에 걸친 운영 중단 일정이 없어요.</p>
  return (
    <div className="flex flex-col gap-2">
      {month.rows.slice(0, 7).map((r) => (
        <div key={r.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
          <span className="truncate type-meta text-text-sec" title={r.facility.name}>{r.facility.name}</span>
          <span className="relative block h-5 rounded-xs bg-mute">
            <span
              className={clsx('absolute inset-y-0 rounded-xs', r.event.certainty === '확정' ? 'bg-danger' : 'bg-primary')}
              style={{ left: `${r.left * 100}%`, width: `${r.width * 100}%` }}
              title={`${r.event.cause || r.event.kind} ${r.event.start ? dotDate(r.event.start) : ''}`}
            />
          </span>
        </div>
      ))}
      <div className="mt-1 flex justify-between type-meta tabular-nums text-text-meta">
        <span>1일</span><span>{Math.round(month.days / 2)}일</span><span>{month.days}일</span>
      </div>
      <p className="type-meta text-text-meta">빨간 막대는 확정 일정, 파란 막대는 공고에서 읽은 예정 일정이에요.</p>
    </div>
  )
}

export default function OverviewScreen() {
  const { data, ready, empty } = useStrata()
  const now = Date.now()
  const facilities = data.facilities || []
  const roles = data.roles || []

  const gap = useMemo(() => todayGap(facilities, now), [facilities, now])
  const month = useMemo(() => monthEvents(facilities, now), [facilities, now])
  const review = useMemo(() => reviewItems(facilities), [facilities])
  const counts = useMemo(() => roleCounts(facilities), [facilities])
  const far = useMemo(() => farAlternatives(facilities), [facilities])
  const status = useMemo(() => statusCount(facilities, now), [facilities, now])
  const roleLabel = (id) => roles.find((r) => r.id === id)?.label || '기타'
  const weather = data.weather || null

  const actions = (
    <>
      <Link to="/facilities" className="pressable inline-flex h-10 items-center gap-2 rounded-sm bg-subtle px-4 type-body-sm text-text-sec hover:bg-mute">시설 찾기</Link>
      <Link to="/board" className="pressable inline-flex h-10 items-center gap-2 rounded-sm bg-text-pri pl-4 pr-1.5 type-strong text-text-inverse hover:bg-text-sec">
        상황판 열기
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-page text-text-pri"><ArrowRight size={16} aria-hidden="true" /></span>
      </Link>
    </>
  )

  return (
    <PageShell title="오늘의 현황" eyebrow={todayLabel()} actions={actions}>
      {ready && empty && <p className="py-16 text-center type-body-sm text-text-meta">시설 자료를 아직 불러오지 못했어요.</p>}

      <div className="grid gap-3 cq-md:grid-cols-6 cq-xl:grid-cols-12">
        <Card tone="mute" title="오늘 지정 공백" className="flex flex-col cq-md:col-span-3 cq-xl:col-span-3" bodyClassName="flex flex-1 flex-col">
          <p className="type-meta text-text-meta">운영이 멈춰 비어 있는 역할</p>
          <p className="mt-1 type-kpi text-danger-text">{fmt(gap.roleSlots)}<span className="ml-1 type-h3">개</span></p>
          <p className="mt-1 type-meta text-text-meta">시설 {gap.facilities}곳에서 비어요.</p>
          <ul className="mt-4 flex flex-col gap-1">
            {gap.items.slice(0, 4).map(({ facility, roles: rs }) => (
              <li key={facility.id}>
                <Link to={`/facilities/${facility.id}`} className="flex min-h-10 items-center gap-2 rounded-sm px-2 hover:bg-page">
                  <span className="min-w-0 flex-1 truncate type-body-sm text-text-pri">{facility.name}</span>
                  <span className="shrink-0 type-meta text-text-meta">{rs.map(roleLabel).join(', ')}</span>
                </Link>
              </li>
            ))}
            {!gap.items.length && <li className="type-body-sm text-text-meta">오늘 비는 역할이 없어요.</li>}
          </ul>
          <div className="mt-auto pt-4"><BasisLine basis={basisShort(data.basis)} /></div>
        </Card>

        <Card
          tone="mute" title="이번 달 운영 중단 일정" meta={`${month.rows.length}건`}
          className="cq-md:col-span-6 cq-xl:col-span-6"
          actions={<Link to="/review" className="inline-flex items-center gap-0.5 type-meta text-text-sec hover:text-text-pri">판독함<ChevronRight size={14} aria-hidden="true" /></Link>}
        >
          <MonthBars month={month} />
        </Card>

        <Card
          tone="mute" title="확인할 일" className="cq-md:col-span-3 cq-xl:col-span-3"
          actions={<span className="type-h2 tabular-nums text-text-pri">{review.length}</span>}
        >
          <ul className="-mx-2 flex flex-col">
            {review.slice(0, 6).map((it) => (
              <li key={it.id}>
                <Link to="/review" className="flex min-h-11 items-center gap-2.5 rounded-sm px-2 hover:bg-page">
                  <Circle size={16} aria-hidden="true" className={clsx('shrink-0', it.kind === '대장 확인' ? 'text-text-meta' : 'text-danger')} />
                  <span className="min-w-0 flex-1 truncate type-body-sm text-text-pri">{it.facility.name}</span>
                  <span className="shrink-0 type-meta text-text-meta">{it.kind}</span>
                </Link>
              </li>
            ))}
            {!review.length && <li className="type-body-sm text-text-meta">확인할 항목이 없어요.</li>}
          </ul>
        </Card>

        <Card
          tone="mute" title="대체 시설이 먼 곳" className="cq-md:col-span-6 cq-xl:col-span-5"
          actions={<Link to="/board" className="inline-flex items-center gap-0.5 type-meta text-text-sec hover:text-text-pri">상황판<ChevronRight size={14} aria-hidden="true" /></Link>}
        >
          <ul className="-mx-2 flex flex-col">
            {far.map(({ facility, role, alt }) => (
              <li key={facility.id}>
                <Link to={`/facilities/${facility.id}`} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-page">
                  <span className="min-w-0">
                    <span className="block truncate type-body-strong text-text-pri">{facility.name}</span>
                    <span className="block type-meta text-text-meta">{roleLabel(role)} 역할을 대신할 곳까지 거리, 오르막 {Math.round(alt.climbM || 0)}m</span>
                  </span>
                  <span className="type-strong tabular-nums text-danger-text">{km(alt.distM)}</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-text-meta" />
                </Link>
              </li>
            ))}
            {!far.length && <li className="py-4 type-body-sm text-text-meta">운영 중단 일정이 잡힌 시설이 없어요.</li>}
          </ul>
        </Card>

        <Card tone="mute" title="역할별 시설 수" className="cq-md:col-span-3 cq-xl:col-span-4">
          <ul className="flex flex-col gap-1.5">
            {roles.map((r) => {
              const n = counts[r.id] || 0
              const max = Math.max(1, ...roles.map((x) => counts[x.id] || 0))
              return (
                <li key={r.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                  <span className="truncate type-body-sm text-text-sec">{r.label}</span>
                  <span className="block h-2 rounded-xs bg-mute">
                    <span className="block h-full rounded-xs bg-primary" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <span className="text-right type-meta tabular-nums text-text-meta">{n}</span>
                </li>
              )
            })}
            {!roles.length && <li className="type-body-sm text-text-meta">역할 자료를 아직 불러오지 못했어요.</li>}
          </ul>
        </Card>

        <div className="grid gap-3 cq-md:col-span-3 cq-xl:col-span-3">
          <MetricCard label="오늘 운영 중" value={fmt(status.open)} unit="곳" sub={`등록 시설 ${fmt(facilities.length)}곳 가운데`} />
          <MetricCard label="확인 필요" value={fmt(status.check)} unit="곳" tone={status.check ? 'danger' : 'neutral'} sub="대장과 공지가 달라요." to="/review" />
          {weather && (
            <Card tone="mute" title="특보와 날씨">
              <p className="type-body-sm text-text-sec">{weather.summary}</p>
              <BasisLine className="mt-2" source={weather.source} />
            </Card>
          )}
        </div>
      </div>

      <p className="mt-6 type-meta text-text-meta">{basisShort(data.basis)}</p>
    </PageShell>
  )
}
