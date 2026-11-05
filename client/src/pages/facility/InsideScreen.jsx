// 시설 속 보기. 단면 그림 위에 공간 영역을 얹는다. 그림이나 영역 자료가 없으면 빈 상태로 둔다.
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useJson, useStrata } from '../../lib/strataData.js'
import { colors as token } from '../../tokens.js'

export default function InsideScreen() {
  const { id } = useParams()
  const { data: strata } = useStrata()
  const { data: inside, ready } = useJson('inside.json')
  const [imageOk, setImageOk] = useState(true)

  const facility = (strata.facilities || []).find((f) => f.id === id)
  const areas = useMemo(() => (inside && (inside[id]?.areas || inside[id])) || [], [inside, id])
  const hasAreas = Array.isArray(areas) && areas.length > 0

  return (
    <main className="mx-auto w-full max-w-page px-4 py-6 md:px-6">
      <Link to="/" className="type-body-sm text-primary-text underline">지도 화면으로 돌아가기</Link>
      <h1 className="mt-3 type-h1 text-text-pri">{facility?.name || '시설'} 속 보기</h1>
      <p className="mt-1 type-body-sm text-text-sec">건물 안에서 각 역할이 어느 공간을 쓰는지 보여 줘요.</p>

      {ready && (!imageOk || !hasAreas) ? (
        <div className="mt-8 rounded-md bg-page px-6 py-16 text-center shadow-sm">
          <p className="type-h3 text-text-pri">건물 층 자료 준비 중</p>
          <p className="mt-1 type-body-sm text-text-sec">단면 그림과 공간 영역이 들어오면 이 자리에 보여요.</p>
        </div>
      ) : (
        <div className="relative mt-6 overflow-hidden rounded-md bg-page shadow-sm">
          <img src={`/inside/${id}.webp`} alt={`${facility?.name || '시설'} 단면 그림`} onError={() => setImageOk(false)} className="block w-full" />
          {areas.map((a) => (
            <button
              key={a.id || a.label} type="button"
              className="absolute rounded-sm transition-opacity duration-fast hover:brightness-110"
              style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%`, backgroundColor: token.primary.DEFAULT, opacity: 0.32 }}
            >
              <span className="absolute left-1 top-1 rounded-xs bg-page px-1 type-meta text-text-pri">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
