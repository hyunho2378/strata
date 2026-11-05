// 지도에서 시설이 아닌 일반 건물을 골랐을 때 오른쪽에 뜨는 카드.
// 층수와 높이를 보여 주고 '층 나눠 보기'로 3D 건물을 층 단위로 벌린다.
import { Building2, Layers3, X } from 'lucide-react'
import Button from '../ui/Button.jsx'

export default function BuildingCard({ building, exploded = false, onExplode, onCollapse, onClose }) {
  if (!building) return null
  const floors = Number(building.floors) || 0
  const height = Number(building.heightM) || 0
  return (
    <section aria-label="건물 정보" className="flex w-full flex-col overflow-hidden rounded-lg bg-page p-5 shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-subtle">
          <Building2 size={24} aria-hidden="true" className="text-text-meta" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="type-meta text-text-meta">지정 역할이 없는 건물</p>
          <h2 className="type-h2 text-text-pri">일반 건물</h2>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="건물 정보 닫기" className="pressable -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-meta hover:bg-mute">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-subtle px-3 py-2">
          <dt className="type-meta text-text-meta">층수</dt>
          <dd className="type-h3 tabular-nums text-text-pri">{floors ? `${floors}층` : '기록 없음'}</dd>
        </div>
        <div className="rounded-sm bg-subtle px-3 py-2">
          <dt className="type-meta text-text-meta">높이</dt>
          <dd className="type-h3 tabular-nums text-text-pri">{height ? `${height.toFixed(1)}m` : '기록 없음'}</dd>
        </div>
      </dl>

      <div className="mt-4">
        {exploded
          ? <Button size="sm" variant="secondary" onClick={onCollapse} leftIcon={<Layers3 size={16} aria-hidden="true" />}>층 모아 보기</Button>
          : <Button size="sm" variant="secondary" onClick={onExplode} leftIcon={<Layers3 size={16} aria-hidden="true" />}>층 나눠 보기</Button>}
      </div>
      <p className="mt-3 type-meta text-text-meta">건물 자료는 국토교통부 GIS 건물통합정보에서 읽어요.</p>
    </section>
  )
}
