// 시설 상세. 상황판 오른쪽 패널과 시설 화면에서 같은 모습으로 열린다.
// 머리(이름, 분류, 운영 상태와 문구, 대표 자리, 행동 버튼) 아래에 탭 네 개를 둔다.
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowUpRight, Building, FileText, Layers, MapPin, Share2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import Tabs from '../ui/Tabs.jsx'
import Button from '../ui/Button.jsx'
import StatusBadge from './StatusBadge.jsx'
import FacilityThumb from './FacilityThumb.jsx'
import useToast from '../../hooks/useToast.js'
import { activeEvents, dotDate, statusAt } from '../../lib/strataData.js'
import { basisShort, km } from '../../lib/strataStats.js'
import { krds } from '../../tokens.js'

const TABS = [
  { value: 'home', label: '홈' },
  { value: 'schedule', label: '운영 일정' },
  { value: 'alt', label: '대체 시설' },
  { value: 'info', label: '정보' }
]

// 운영 상태 한 줄. 색만으로 알리지 않도록 글자로도 적는다
function statusLine(facility, ms) {
  const ev = activeEvents(facility, ms)[0]
  if (ev) return `${ev.cause || ev.kind} 때문에 ${ev.end ? dotDate(ev.end) : '아직 정해지지 않은 날'}까지 쉬어요.`
  const next = (facility.events || [])
    .map((e) => ({ e, s: e.start ? Date.parse(e.start) : NaN }))
    .filter((x) => !Number.isNaN(x.s) && x.s > ms)
    .sort((a, b) => a.s - b.s)[0]
  if (next) return `${dotDate(next.e.start)}부터 ${next.e.cause || next.e.kind} 일정이 잡혀 있어요.`
  if (facility.status === 'check') return '대장과 공지가 달라 담당 부서 확인이 필요해요.'
  return '오늘은 평소대로 열어요.'
}

function Row({ icon: Icon, children }) {
  return (
    <li className="flex gap-2.5 py-1.5">
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-text-meta" />
      <span className="min-w-0 flex-1 type-body-sm text-text-sec">{children}</span>
    </li>
  )
}

export default function FacilityDetail({
  facility, data = {}, byId = {}, colors = {}, time = Date.now(), onClose, onPickFacility, variant = 'panel',
  thumbSrc = null, thumbLoading = false, exploded = false, onExplode, onCollapse
}) {
  const [tab, setTab] = useState('home')
  const toast = useToast()
  const roles = data.roles || []
  const roleLabel = (id) => roles.find((r) => r.id === id)?.label || '기타'

  const slots = facility?.roles || []
  const roleIds = useMemo(() => [...new Set(slots.map((r) => r.role))], [slots])
  const alts = useMemo(() => [...new Map((facility?.alternatives || []).map((a) => [`${a.role}:${a.facilityId}`, a])).values()].sort((a, b) => a.distM - b.distM), [facility])
  const events = useMemo(() => [...(facility?.events || [])].sort((a, b) => Date.parse(b.start || b.notice || 0) - Date.parse(a.start || a.notice || 0)), [facility])

  if (!facility) return null
  const st = statusAt(facility, time)
  const lastModified = slots.map((r) => r.modified).filter(Boolean).sort().pop()
  const sources = [...new Set(slots.map((r) => r.source).filter(Boolean))]
    .map((id) => (data.sources || []).find((s) => s.id === id)?.label || id)

  const share = async () => {
    const url = `${window.location.origin}/facilities/${facility.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast('주소를 복사했어요.')
    } catch {
      toast('주소를 복사하지 못했어요.', 'danger')
    }
  }

  return (
    <section aria-label="시설 상세" className={clsx('flex w-full min-h-0 flex-col overflow-hidden rounded-lg bg-page', variant === 'panel' && 'shadow-md')}>
      <header className="shrink-0 px-5 pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="type-meta text-text-meta">{[facility.type, facility.dong].filter(Boolean).join(', ')}</p>
            <h2 className="type-h2 text-text-pri">{facility.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={st} />
              <p className="min-w-0 type-body-sm text-text-sec">{statusLine(facility, time)}</p>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="상세 닫기" className="pressable -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-meta hover:bg-mute">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <FacilityThumb facility={facility} size="lg" className="w-1/2 flex-1" src={thumbSrc} loading={thumbLoading} />
          <div className="flex w-1/2 flex-1 flex-col justify-center gap-1.5 rounded-md bg-subtle p-4">
            <p className="type-caption text-text-meta">맡은 역할</p>
            <ul className="flex flex-wrap gap-1.5">
              {roleIds.map((id) => (
                <li key={id} className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-page px-2.5 type-caption text-text-sec">
                  <span aria-hidden="true" className="h-2 w-2 rounded-xs" style={{ backgroundColor: colors[id] || krds.gray[40] }} />
                  {roleLabel(id)}
                </li>
              ))}
              {!roleIds.length && <li className="type-meta text-text-meta">등록된 역할이 없어요.</li>}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button as={Link} to={`/board?f=${facility.id}`} size="sm" variant="secondary" leftIcon={<MapPin size={16} aria-hidden="true" />}>상황판에서 보기</Button>
          {onExplode
            ? (
              <Button
                size="sm" variant="secondary" leftIcon={<Building size={16} aria-hidden="true" />}
                onClick={() => (exploded ? onCollapse?.() : onExplode(facility.id))}
              >
                {exploded ? '건물 층 모아 보기' : '건물 층 보기'}
              </Button>
            )
            : <Button as={Link} to={`/facility/${facility.id}/inside`} size="sm" variant="secondary" leftIcon={<Building size={16} aria-hidden="true" />}>건물 층 보기</Button>}
          <Button as={Link} to="/docs" size="sm" variant="secondary" leftIcon={<FileText size={16} aria-hidden="true" />}>협조 공문 만들기</Button>
          <Button size="sm" variant="ghost" onClick={share} leftIcon={<Share2 size={16} aria-hidden="true" />}>공유</Button>
        </div>

        <div className="mt-3">
          <Tabs items={TABS} value={tab} onChange={setTab} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
        {tab === 'home' && (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col">
              <Row icon={MapPin}>{facility.addr || '주소가 아직 없어요.'}</Row>
              <Row icon={Layers}>{facility.dong || '행정동 정보가 아직 없어요.'}</Row>
            </ul>
            <div>
              <h3 className="type-strong text-text-pri">역할과 담당 부서</h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {slots.map((r, i) => (
                  <li key={i} className="rounded-sm bg-subtle px-3 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="type-body-sm text-text-pri">{r.subLabel || roleLabel(r.role)}</p>
                      <p className="type-meta tabular-nums text-text-meta">{r.cap ? `수용 ${r.cap}명` : '수용 인원 미등록'}</p>
                    </div>
                    <p className="mt-0.5 type-meta text-text-meta">
                      {[r.deptDisaster && `재난 담당 ${r.deptDisaster}`, r.deptWelfare && `복지 담당 ${r.deptWelfare}`].filter(Boolean).join(', ') || '담당 부서 미등록'}
                    </p>
                    {facility.space && <p className="mt-0.5 type-meta text-text-meta">쓰는 자리 {facility.space}</p>}
                  </li>
                ))}
                {!slots.length && <li className="type-body-sm text-text-meta">등록된 역할이 없어요.</li>}
              </ul>
            </div>
            {data.basis && <p className="type-meta text-text-meta">{basisShort(data.basis)}</p>}
          </div>
        )}

        {tab === 'schedule' && (
          <ul className="flex flex-col gap-2">
            {events.map((e, i) => (
              <li key={i} className={clsx('rounded-sm px-3 py-2.5', e.certainty === '확정' ? 'bg-danger-soft' : 'bg-subtle')}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="type-body-sm text-text-pri">{e.cause || e.kind}</p>
                  <p className="type-caption text-text-sec">{e.certainty === '확정' ? '확정 일정' : '예정 일정'}</p>
                </div>
                <p className="mt-0.5 type-meta tabular-nums text-text-meta">
                  {e.start ? dotDate(e.start) : '시작일 미정'} 부터 {e.end ? dotDate(e.end) : '종료일 미정'} 까지
                </p>
                <p className="mt-0.5 type-meta text-text-meta">
                  {[e.notice && `공고일 ${dotDate(e.notice)}`, e.source].filter(Boolean).join(', ')}
                </p>
                {(e.roles || []).length > 0 && (
                  <p className="mt-1 type-meta text-text-sec">쉬는 역할: {e.roles.map(roleLabel).join(', ')}</p>
                )}
              </li>
            ))}
            {!events.length && <li className="py-6 text-center type-body-sm text-text-meta">잡힌 운영 중단 일정이 없어요.</li>}
          </ul>
        )}

        {tab === 'alt' && (
          <ul className="flex flex-col gap-1">
            {alts.map((a, i) => {
              const target = byId[a.facilityId]
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onPickFacility?.(a.facilityId)}
                    className="pressable flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left hover:bg-mute"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate type-body-sm text-text-pri">{target?.name || '이름 미등록 시설'}</span>
                      <span className="block type-meta text-text-meta">같은 역할 {roleLabel(a.role)}, 오르막 {Math.round(a.climbM || 0)}m</span>
                    </span>
                    <span className="shrink-0 type-strong tabular-nums text-text-sec">{km(a.distM)}</span>
                    <ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-text-meta" />
                  </button>
                </li>
              )
            })}
            {!alts.length && <li className="py-6 text-center type-body-sm text-text-meta">같은 역할을 하는 가까운 시설이 아직 없어요.</li>}
          </ul>
        )}

        {tab === 'info' && (
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="type-caption text-text-meta">출처</dt>
              <dd className="mt-0.5 type-body-sm text-text-sec">{sources.join(', ') || '출처 미등록'}</dd>
            </div>
            <div>
              <dt className="type-caption text-text-meta">마지막 수정일</dt>
              <dd className="mt-0.5 type-body-sm tabular-nums text-text-sec">{lastModified ? dotDate(lastModified) : '기록 없음'}</dd>
            </div>
            <div>
              <dt className="type-caption text-text-meta">좌표</dt>
              <dd className="mt-0.5 type-body-sm tabular-nums text-text-sec">위도 {Number(facility.lat).toFixed(5)}, 경도 {Number(facility.lon).toFixed(5)}</dd>
            </div>
            <div>
              <dt className="type-caption text-text-meta">자료 기준</dt>
              <dd className="mt-0.5 type-body-sm text-text-sec">{basisShort(data.basis) || '기준 정보 없음'}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}
