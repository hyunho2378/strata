// 지도 위 요약 카드. 지도를 가리지 않도록 상황판 기본 상태에서는 이 카드 하나만 띄운다.
// 역할 거르기는 '레이어' 버튼을 눌러 펼치는 팝오버에 둔다.
export default function MapSummary({ stats = {}, basis, roleText, dateText }) {
  const rows = [
    ['등록 시설', stats.facilities],
    ['두 역할 이상', stats.multiRole],
    ['운영 중', stats.open],
    ['운영 중단', stats.closed]
  ]
  return (
    <section aria-label="지금 현황 요약" className="w-full rounded-lg bg-page p-4 shadow-md">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="type-h3 text-text-pri">지금 현황</h2>
        {dateText && <p className="type-meta tabular-nums text-text-meta">{dateText}</p>}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-sm bg-subtle px-3 py-2">
            <dt className="type-meta text-text-meta">{label}</dt>
            <dd className="type-h3 tabular-nums text-text-pri">{value ?? 0}</dd>
          </div>
        ))}
      </dl>
      {roleText && <p className="mt-2 type-meta text-text-sec">{roleText}</p>}
      {basis && <p className="mt-1 type-meta text-text-meta">{basis}</p>}
    </section>
  )
}
