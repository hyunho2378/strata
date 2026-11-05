// 시설. 왼쪽은 검색과 분류 칩과 목록, 오른쪽은 지도이고 시설을 고르면 그 자리에 상세가 열린다.
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import PageShell from '../../components/strata/PageShell.jsx'
import FacilityDetail from '../../components/strata/FacilityDetail.jsx'
import FacilityThumb from '../../components/strata/FacilityThumb.jsx'
import StatusBadge from '../../components/strata/StatusBadge.jsx'
import StrataMap from '../../components/map/StrataMap.jsx'
import Input from '../../components/ui/Input.jsx'
import { loadRoleColors } from '../../components/map/roleColors.js'
import { statusAt, useStrata } from '../../lib/strataData.js'
import useMediaQuery from '../../hooks/useMediaQuery.js'
import useFacilityThumb from '../../hooks/useFacilityThumb.js'

export default function FacilitiesScreen() {
  const { data, ready, empty } = useStrata()
  const { id } = useParams()
  const navigate = useNavigate()
  const isWide = useMediaQuery('(min-width: 1024px)')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [colors, setColors] = useState({})
  const mapRef = useRef(null)
  const now = Date.now()

  const facilities = data.facilities || []
  const roles = data.roles || []
  useEffect(() => { loadRoleColors(roles.map((r) => r.id)).then(setColors) }, [roles])

  const byId = useMemo(() => Object.fromEntries(facilities.map((f) => [f.id, f])), [facilities])
  const counts = useMemo(() => {
    const out = {}
    for (const f of facilities) for (const r of new Set((f.roles || []).map((x) => x.role))) out[r] = (out[r] || 0) + 1
    return out
  }, [facilities])

  const list = useMemo(() => facilities.filter((f) => {
    if (role !== 'all' && !(f.roles || []).some((r) => r.role === role)) return false
    if (!q) return true
    const key = `${f.name} ${f.dong || ''} ${f.type || ''} ${f.addr || ''}`
    return key.includes(q)
  }), [facilities, q, role])

  // 시설을 고르면 지도는 그대로 두고 그 위에 상세를 올린다. 대표 그림은 3D 엔진이 만들어 준다
  const thumb = useFacilityThumb(mapRef, id || null)

  const selected = id ? byId[id] : null
  const chips = [{ id: 'all', label: '전체', n: facilities.length }, ...roles.map((r) => ({ id: r.id, label: r.label, n: counts[r.id] || 0 }))]

  return (
    <PageShell title="시설" eyebrow="동해시 공공시설" desc={`${facilities.length}곳을 역할과 이름으로 찾아보세요.`} full>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 w-full flex-col lg:w-96">
          <Input
            label="시설 찾기" compact placeholder="시설 이름, 동 이름, 분류"
            value={q} onChange={(e) => setQ(e.target.value)}
            leftIcon={<Search size={16} aria-hidden="true" />}
          />
          <div role="radiogroup" aria-label="역할 고르기" className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const on = role === c.id
              return (
                <button
                  key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setRole(c.id)}
                  className={clsx('pressable inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 type-caption transition-colors duration-fast',
                    on ? 'bg-primary-soft text-primary-text' : 'bg-mute text-text-sec hover:bg-line-sub hover:text-text-pri')}
                >
                  {c.label}<span className="tabular-nums">{c.n}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 shrink-0 type-meta text-text-meta">{list.length}곳을 찾았어요.</p>
          <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {list.slice(0, 200).map((f) => {
              const st = statusAt(f, now)
              const on = f.id === id
              return (
                <li key={f.id}>
                  <button
                    type="button" onClick={() => navigate(`/facilities/${f.id}`)} aria-current={on ? 'true' : undefined}
                    className={clsx('pressable flex w-full gap-3 rounded-sm p-3 text-left transition-colors duration-fast', on ? 'bg-primary-soft' : 'bg-subtle hover:bg-mute')}
                  >
                    <FacilityThumb facility={f} className="shrink-0 bg-page" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate type-body-strong text-text-pri">{f.name}</span>
                        <StatusBadge status={st} />
                      </span>
                      <span className="mt-0.5 block truncate type-meta text-text-meta">{[f.type, f.dong].filter(Boolean).join(', ')}</span>
                      <span className="mt-0.5 block truncate type-meta text-text-sec">
                        {[...new Set((f.roles || []).map((r) => r.role))].map((r) => roles.find((x) => x.id === r)?.label || '기타').join(', ')}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
            {ready && !list.length && <li className="py-10 text-center type-body-sm text-text-meta">찾는 조건에 맞는 시설이 없어요.</li>}
            {ready && empty && <li className="py-10 text-center type-body-sm text-text-meta">시설 자료를 아직 불러오지 못했어요.</li>}
          </ul>
        </div>

        {isWide && (
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-md bg-canvas">
            <StrataMap
              ref={mapRef}
              facilities={facilities} roleFilter={role === 'all' ? [] : [role]} time={now} focusId={id || null}
              onPick={(e) => { if (e.type === 'facility') navigate(`/facilities/${e.id}`) }}
            />
            {selected && (
              <div className="absolute inset-0 overflow-hidden">
                <FacilityDetail
                  facility={selected} data={data} byId={byId} colors={colors} time={now} variant="page"
                  thumbSrc={thumb.id === selected.id ? thumb.src : null}
                  thumbLoading={thumb.id === selected.id && thumb.loading}
                  onClose={() => navigate('/facilities')}
                  onPickFacility={(fid) => navigate(`/facilities/${fid}`)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}
