// 주민 공개 화면. 담당자 화면과 같은 카드와 같은 여백을 쓰고 내용만 쉽게 바꾼다.
// 지금 이용할 수 있는지, 왜 쉬는지, 대신 갈 곳이 어디인지 세 가지만 보여 준다.
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { MapPin, Search } from 'lucide-react'
import Card from '../../components/ui/Card.jsx'
import Input from '../../components/ui/Input.jsx'
import StatusBadge from '../../components/strata/StatusBadge.jsx'
import FacilityThumb from '../../components/strata/FacilityThumb.jsx'
import { activeEvents, dotDate, statusAt, useStrata } from '../../lib/strataData.js'
import { basisShort, km, statusCount } from '../../lib/strataStats.js'

export default function PublicScreen() {
  const { data, ready, empty } = useStrata()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const now = Date.now()

  const facilities = data.facilities || []
  const roles = data.roles || []
  const byId = useMemo(() => Object.fromEntries(facilities.map((f) => [f.id, f])), [facilities])
  const counts = useMemo(() => {
    const out = {}
    for (const f of facilities) for (const r of new Set((f.roles || []).map((x) => x.role))) out[r] = (out[r] || 0) + 1
    return out
  }, [facilities])
  const status = useMemo(() => statusCount(facilities, now), [facilities, now])

  const list = useMemo(() => facilities.filter((f) => {
    if (role !== 'all' && !(f.roles || []).some((r) => r.role === role)) return false
    if (!q) return true
    return `${f.name} ${f.dong || ''} ${f.type || ''} ${f.addr || ''}`.includes(q)
  }).sort((a, b) => (statusAt(a, now) === 'open' ? 1 : 0) - (statusAt(b, now) === 'open' ? 1 : 0)), [facilities, q, role, now])

  const chips = [{ id: 'all', label: '전체', n: facilities.length }, ...roles.map((r) => ({ id: r.id, label: r.label, n: counts[r.id] || 0 }))]
  const roleLabel = (id) => roles.find((r) => r.id === id)?.label || '기타'

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-12 pt-6 md:px-6 lg:px-8 lg:pt-10">
      <p className="type-caption text-text-meta">동해시 공공시설</p>
      <h1 className="type-h1 text-text-pri">지금 이용할 수 있는 곳</h1>
      <p className="mt-2 type-body-sm text-text-sec">쉼터와 대피소와 돌봄 시설이 오늘 문을 열었는지 확인하고, 쉬는 곳이면 대신 갈 곳을 보세요.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Card><p className="type-caption text-text-sec">오늘 운영 중</p><p className="mt-1 type-h2 tabular-nums text-text-pri">{status.open}곳</p></Card>
        <Card><p className="type-caption text-text-sec">오늘 쉬는 곳</p><p className="mt-1 type-h2 tabular-nums text-danger-text">{status.closed}곳</p></Card>
        <Card><p className="type-caption text-text-sec">확인이 필요한 곳</p><p className="mt-1 type-h2 tabular-nums text-text-pri">{status.check}곳</p></Card>
      </div>

      <div className="mt-6 max-w-text">
        <Input
          label="시설 찾기" placeholder="시설 이름이나 동 이름"
          value={q} onChange={(e) => setQ(e.target.value)}
          leftIcon={<Search size={16} aria-hidden="true" />}
        />
      </div>

      <div role="radiogroup" aria-label="시설 종류 고르기" className="mt-4 flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const on = role === c.id
          return (
            <button
              key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setRole(c.id)}
              className={clsx('pressable inline-flex h-8 min-h-11 items-center gap-1.5 rounded-sm px-3 type-caption transition-colors duration-fast md:min-h-0',
                on ? 'bg-primary-soft text-primary-text' : 'bg-mute text-text-sec hover:bg-line-sub hover:text-text-pri')}
            >
              {c.label}<span className="tabular-nums">{c.n}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 type-meta text-text-meta">{list.length}곳을 찾았어요.</p>

      <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.slice(0, 60).map((f) => {
          const st = statusAt(f, now)
          const ev = activeEvents(f, now)[0]
          const alt = [...(f.alternatives || [])].sort((a, b) => a.distM - b.distM)[0]
          return (
            <li key={f.id}>
              <Card className="h-full">
                <div className="flex gap-3">
                  <FacilityThumb facility={f} className="shrink-0 bg-subtle" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 type-body-strong text-text-pri">{f.name}</p>
                      <StatusBadge status={st} />
                    </div>
                    <p className="mt-0.5 type-meta text-text-meta">{[f.type, f.dong].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
                <p className="mt-3 type-body-sm text-text-sec">{[...new Set((f.roles || []).map((r) => r.role))].map(roleLabel).join(', ')}</p>
                {ev && <p className="mt-2 type-body-sm text-danger-text">{ev.cause || ev.kind} 때문에 {ev.end ? dotDate(ev.end) : '아직 정해지지 않은 날'}까지 쉬어요.</p>}
                {st !== 'open' && alt && (
                  <p className="mt-2 type-body-sm text-text-sec">대신 갈 곳은 {byId[alt.facilityId]?.name || '가까운 시설'}이고 {km(alt.distM)} 떨어져 있어요.</p>
                )}
                {f.addr && (
                  <p className="mt-3 flex items-start gap-1.5 type-meta text-text-meta">
                    <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                    <span className="min-w-0">{f.addr}</span>
                  </p>
                )}
              </Card>
            </li>
          )
        })}
        {ready && (empty || !list.length) && <li className="py-10 text-center type-body-sm text-text-meta">찾는 조건에 맞는 시설이 없어요.</li>}
      </ul>

      <p className="mt-8 type-meta text-text-meta">{basisShort(data.basis)}</p>
    </div>
  )
}
