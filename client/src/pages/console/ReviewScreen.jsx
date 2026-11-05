// 판독함. AI 가 읽은 운영 중단 공지를 사람이 확인하는 줄이다.
// 왼쪽은 대기 줄, 오른쪽은 읽은 값과 원문 출처다. 확인과 보류는 이 화면 안에서만 표시한다.
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, ExternalLink, PauseCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageShell from '../../components/strata/PageShell.jsx'
import Card from '../../components/ui/Card.jsx'
import Button from '../../components/ui/Button.jsx'
import Badge from '../../components/ui/Badge.jsx'
import StatusBadge from '../../components/strata/StatusBadge.jsx'
import useToast from '../../hooks/useToast.js'
import { dotDate, statusAt, useStrata } from '../../lib/strataData.js'
import { reviewItems } from '../../lib/strataStats.js'

export default function ReviewScreen() {
  const { data, ready } = useStrata()
  const toast = useToast()
  const [done, setDone] = useState({})
  const [pick, setPick] = useState(null)
  const now = Date.now()

  const items = useMemo(() => reviewItems(data.facilities || []), [data])
  const current = items.find((x) => x.id === pick) || items.find((x) => !done[x.id]) || items[0]
  const left = items.filter((x) => !done[x.id]).length
  const roleLabel = (id) => (data.roles || []).find((r) => r.id === id)?.label || '기타'

  const mark = (id, state) => {
    setDone((d) => ({ ...d, [id]: state }))
    toast(state === 'ok' ? '확인 처리했어요.' : '보류함으로 옮겼어요.')
  }

  return (
    <PageShell title="판독함" eyebrow="운영 중단 공지 확인" desc={`사람이 확인할 공지가 ${left}건 남았어요.`} full>
      <div className="flex min-h-0 flex-1 gap-4">
        <ul className="flex min-h-0 w-full flex-col gap-1.5 overflow-y-auto pr-1 lg:w-96">
          {items.map((it) => {
            const state = done[it.id]
            const on = current?.id === it.id
            return (
              <li key={it.id}>
                <button
                  type="button" onClick={() => setPick(it.id)} aria-current={on ? 'true' : undefined}
                  className={clsx('pressable w-full rounded-sm p-3 text-left transition-colors duration-fast', on ? 'bg-primary-soft' : 'bg-subtle hover:bg-mute')}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate type-body-strong text-text-pri">{it.facility.name}</span>
                    {state === 'ok' && <Badge tone="primary">확인 완료</Badge>}
                    {state === 'hold' && <Badge tone="neutral">보류</Badge>}
                  </span>
                  <span className="mt-0.5 block type-meta text-text-meta">{it.kind}, {it.event?.cause || it.event?.kind || '대장 대조'}</span>
                  <span className="mt-0.5 block truncate type-meta text-text-sec">{it.reason}</span>
                </button>
              </li>
            )
          })}
          {ready && !items.length && <li className="py-10 text-center type-body-sm text-text-meta">확인할 공지가 없어요.</li>}
        </ul>

        <div className="hidden min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex">
          {current ? (
            <>
              <Card tone="mute" title="판독 결과" meta={current.kind}>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="type-caption text-text-meta">시설</dt>
                    <dd className="mt-0.5 type-body-sm text-text-pri">{current.facility.name}</dd>
                  </div>
                  <div>
                    <dt className="type-caption text-text-meta">지금 상태</dt>
                    <dd className="mt-0.5"><StatusBadge status={statusAt(current.facility, now)} /></dd>
                  </div>
                  <div>
                    <dt className="type-caption text-text-meta">사유</dt>
                    <dd className="mt-0.5 type-body-sm text-text-sec">{current.event?.cause || current.event?.kind || '대장과 공지 대조'}</dd>
                  </div>
                  <div>
                    <dt className="type-caption text-text-meta">기간</dt>
                    <dd className="mt-0.5 type-body-sm tabular-nums text-text-sec">
                      {current.event?.start ? dotDate(current.event.start) : '시작일 미정'} 부터 {current.event?.end ? dotDate(current.event.end) : '종료일 미정'} 까지
                    </dd>
                  </div>
                  <div>
                    <dt className="type-caption text-text-meta">쉬는 역할</dt>
                    <dd className="mt-0.5 type-body-sm text-text-sec">{(current.event?.roles || []).map(roleLabel).join(', ') || '확인 필요'}</dd>
                  </div>
                  <div>
                    <dt className="type-caption text-text-meta">확실성</dt>
                    <dd className="mt-0.5 type-body-sm text-text-sec">{current.event?.certainty === '확정' ? '확정 일정' : '예정 일정'}</dd>
                  </div>
                </dl>
                <p className="mt-4 type-body-sm text-text-sec">{current.reason}</p>
              </Card>

              <Card tone="mute" title="원문과 출처">
                <p className="type-body-sm text-text-sec">{current.event?.source || '공개 자료 대장'}</p>
                <p className="mt-1 type-meta text-text-meta">{current.event?.notice ? `공고일 ${dotDate(current.event.notice)}` : '공고일 미등록'}</p>
                {current.event?.url && (
                  <a href={current.event.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-sm bg-page px-3 type-body-sm text-primary-text">
                    원문 열어 보기
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </Card>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => mark(current.id, 'ok')} leftIcon={<CheckCircle2 size={16} aria-hidden="true" />}>확인 완료</Button>
                <Button variant="secondary" onClick={() => mark(current.id, 'hold')} leftIcon={<PauseCircle size={16} aria-hidden="true" />}>보류</Button>
                <Link to={`/facilities/${current.facility.id}`} className="pressable inline-flex h-10 items-center rounded-sm px-3 type-body-sm text-text-sec hover:bg-mute">시설 상세 보기</Link>
              </div>
            </>
          ) : (
            <p className="py-16 text-center type-body-sm text-text-meta">확인할 공지가 없어요.</p>
          )}
        </div>
      </div>
    </PageShell>
  )
}
