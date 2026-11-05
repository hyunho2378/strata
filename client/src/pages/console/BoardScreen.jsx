// 상황판. 본문 안의 큰 카드 하나가 3D 지도다. 전체 화면으로 덮지 않는다.
// 지도를 가리지 않도록 기본 상태에서는 왼쪽 요약 카드 하나만 띄우고,
// 역할 거르기와 대표 장면은 '레이어' 버튼을 눌러 펼치는 팝오버에 둔다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Layers } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import PageShell from '../../components/strata/PageShell.jsx'
import FacilityDetail from '../../components/strata/FacilityDetail.jsx'
import StrataMap from '../../components/map/StrataMap.jsx'
import RolePanel from '../../components/map/RolePanel.jsx'
import MapSummary from '../../components/map/MapSummary.jsx'
import BuildingCard from '../../components/map/BuildingCard.jsx'
import TimeBar from '../../components/map/TimeBar.jsx'
import SearchCombo from '../../components/map/SearchCombo.jsx'
import SegmentControl from '../../components/ui/SegmentControl.jsx'
import { loadRoleColors } from '../../components/map/roleColors.js'
import { dotDate, useJson, useStrata } from '../../lib/strataData.js'
import { basisShort, statusCount } from '../../lib/strataStats.js'
import useMediaQuery from '../../hooks/useMediaQuery.js'
import useFacilityThumb from '../../hooks/useFacilityThumb.js'

const DAY = 86400000
const VIEW_MODES = [{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }]
const QUALITIES = [
  { value: 'auto', label: '자동' },
  { value: 'high', label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low', label: '낮음' }
]

export default function BoardScreen() {
  const { data, ready, empty } = useStrata()
  const { data: sceneFile } = useJson('scenes.json')
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [params, setParams] = useSearchParams()
  const mapRef = useRef(null)

  const [selectedRoles, setSelectedRoles] = useState([])
  const [hazard, setHazard] = useState('none')
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(() => Date.now())
  const [colors, setColors] = useState({})
  const [layerOpen, setLayerOpen] = useState(false)
  const [quality, setQuality] = useState('auto')
  const [viewMode, setViewMode] = useState('3d')
  const [building, setBuilding] = useState(null)
  const [exploded, setExploded] = useState(null)
  const layerRef = useRef(null)

  const facilities = data.facilities || []
  const roles = data.roles || []
  const scenes = useMemo(() => (Array.isArray(sceneFile) ? sceneFile : sceneFile?.scenes || []), [sceneFile])
  const focusId = params.get('f')
  const setFocusId = useCallback((id) => setParams(id ? { f: id } : {}, { replace: true }), [setParams])

  useEffect(() => { loadRoleColors(roles.map((r) => r.id)).then(setColors) }, [roles])

  // 팝오버는 바깥을 누르거나 Esc 를 누르면 닫는다
  useEffect(() => {
    if (!layerOpen) return undefined
    const onDown = (e) => { if (layerRef.current && !layerRef.current.contains(e.target)) setLayerOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setLayerOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [layerOpen])

  const range = useMemo(() => {
    const times = facilities.flatMap((f) => (f.events || []).flatMap((e) => [e.start, e.end]))
      .filter(Boolean).map((d) => Date.parse(d)).filter((n) => !Number.isNaN(n))
    const now = Date.now()
    return { min: Math.min(now - 90 * DAY, ...(times.length ? times : [now])), max: Math.max(now + 180 * DAY, ...(times.length ? times : [now])) }
  }, [facilities])

  const byId = useMemo(() => Object.fromEntries(facilities.map((f) => [f.id, f])), [facilities])
  const counts = useMemo(() => {
    const out = {}
    for (const f of facilities) for (const id of new Set((f.roles || []).map((r) => r.role))) out[id] = (out[id] || 0) + 1
    return out
  }, [facilities])
  const stats = useMemo(() => {
    const by = statusCount(facilities, time)
    const multi = facilities.filter((f) => new Set((f.roles || []).map((r) => r.role)).size >= 2).length
    return { facilities: facilities.length, multiRole: multi, open: by.open, closed: by.closed }
  }, [facilities, time])
  const marks = useMemo(() => facilities.flatMap((f) => (f.events || []).map((e) => ({
    at: Date.parse(e.start || e.notice || ''), label: `${f.name} ${e.cause || e.kind || ''}`, tone: 'danger'
  }))).filter((m) => !Number.isNaN(m.at)), [facilities])

  const selected = focusId ? byId[focusId] : null
  const thumb = useFacilityThumb(mapRef, focusId)
  const altLinks = useMemo(() => (selected?.alternatives || []).map((a) => ({ fromId: selected.id, toId: a.facilityId, role: a.role })), [selected])
  const toggleRole = (id) => setSelectedRoles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // 건물 층 벌리기와 모으기
  const explode = useCallback((id) => {
    const res = mapRef.current?.explodeBuilding(id)
    setExploded(res ? (res.facilityId || res.buildingId) : null)
  }, [])
  const collapse = useCallback(() => {
    mapRef.current?.collapseBuilding()
    setExploded(null)
  }, [])

  const onPick = (e) => {
    if (e.type === 'facility') { setBuilding(null); setFocusId(e.id); return }
    if (e.type === 'building') { setFocusId(null); setBuilding(e); return }
    setBuilding(null)
    setFocusId(null)
    if (exploded) collapse()
  }

  const closeDetail = () => { if (exploded) collapse(); setFocusId(null) }
  const closeBuilding = () => { if (exploded) collapse(); setBuilding(null) }

  const actions = <SearchCombo items={facilities} onPick={setFocusId} />

  const roleText = selectedRoles.length
    ? `고른 역할 ${selectedRoles.map((id) => roles.find((r) => r.id === id)?.label).filter(Boolean).join(', ')}`
    : `역할 ${roles.length}종을 모두 보고 있어요.`

  return (
    <PageShell title="상황판" hideHeader full>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-canvas">
        <StrataMap
          ref={mapRef}
          facilities={facilities} roleFilter={selectedRoles} time={time} hazard={hazard}
          quality={quality} viewMode={viewMode}
          focusId={focusId} alternatives={altLinks}
          onPick={onPick}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-raised flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto w-full max-w-80 shadow-md md:w-80">{actions}</div>
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            <SegmentControl label="보기 방식" value={viewMode} onChange={setViewMode} items={VIEW_MODES} className="shadow-md" />
            <SegmentControl label="그림 품질" value={quality} onChange={setQuality} items={QUALITIES} className="shadow-md" />
            <div className="relative" ref={layerRef}>
              <button
                type="button" onClick={() => setLayerOpen((o) => !o)}
                aria-expanded={layerOpen} aria-haspopup="dialog"
                className={clsx('pressable inline-flex h-10 items-center gap-2 rounded-sm px-3 type-caption shadow-md',
                  layerOpen ? 'bg-primary-soft text-primary-text' : 'bg-page text-text-sec hover:text-text-pri')}
              >
                <Layers size={16} aria-hidden="true" />
                레이어
              </button>
              {layerOpen && (
                <div role="dialog" aria-label="레이어 고르기" className="absolute right-0 top-12 flex max-h-96 w-map-panel flex-col overflow-y-auto rounded-lg bg-page p-4 shadow-md">
                  <RolePanel
                    roles={roles} colors={colors} selected={selectedRoles} counts={counts}
                    onToggle={toggleRole} onAll={() => setSelectedRoles([])}
                    scenes={scenes}
                    onScene={(s) => {
                      if (s.facilityId) setFocusId(s.facilityId)
                      if (s.hazard) setHazard(s.hazard)
                      if (s.at) setTime(Date.parse(s.at))
                      setLayerOpen(false)
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {isDesktop && (
          <div className="absolute left-3 top-16 z-raised w-map-panel">
            <MapSummary
              stats={stats} basis={basisShort(data.basis)} roleText={roleText} dateText={dotDate(new Date(time))}
            />
          </div>
        )}

        {isDesktop && selected && (
          <div className="absolute bottom-20 right-3 top-16 z-raised flex w-map-aside 2xl:w-map-aside-lg">
            <FacilityDetail
              facility={selected} data={data} byId={byId} colors={colors} time={time}
              thumbSrc={thumb.id === selected.id ? thumb.src : null}
              thumbLoading={thumb.id === selected.id && thumb.loading}
              exploded={exploded === selected.id}
              onExplode={explode} onCollapse={collapse}
              onClose={closeDetail} onPickFacility={setFocusId}
            />
          </div>
        )}

        {isDesktop && !selected && building && (
          <div className="absolute right-3 top-16 z-raised w-map-aside 2xl:w-map-aside-lg">
            <BuildingCard
              building={building}
              exploded={exploded === building.buildingId}
              onExplode={() => explode(building.buildingId)}
              onCollapse={collapse}
              onClose={closeBuilding}
            />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-raised p-3">
          <TimeBar
            min={range.min} max={range.max} value={time} onChange={setTime}
            playing={playing} onPlay={() => setPlaying((p) => !p)}
            hazard={hazard} onHazard={setHazard} marks={marks}
          />
        </div>

        {ready && empty && (
          <div className="pointer-events-none absolute inset-0 z-raised flex items-center justify-center p-4">
            <div className="pointer-events-auto rounded-lg bg-page px-6 py-5 text-center shadow-md">
              <p className="type-h3 text-text-pri">시설 자료 준비 중</p>
              <p className="mt-1 type-body-sm text-text-sec">자료가 들어오면 지도 위에 역할 층이 쌓여요.</p>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
