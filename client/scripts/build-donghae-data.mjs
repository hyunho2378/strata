// build-donghae-data.mjs 동해시 실제 공개 자료를 앱 데이터 모듈(src/mock/donghaeData.js)로 바꾼다.
// 실행: node scripts/build-donghae-data.mjs   (client 폴더에서)
// 원자료는 scripts/data-raw 에 둔다. 각 파일의 출처와 기준 시점은 DATA_SOURCES 에 적는다.
// 개인 단위 자료는 쓰지 않는다. 대상자 수는 통계에서 나눈 추정치이고 개인은 seed.js 가 가상으로 만든다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const RAW = path.join(here, 'data-raw')
const OUT = path.join(here, '..', 'src', 'mock', 'donghaeData.js')
const read = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'))
const exists = (f) => fs.existsSync(path.join(RAW, f))

const pop = read('kosis_pop.json')
const judged = read('ltc_grades.json')
const users = read('ltc_users.json')
const acmd = read('acmd_51170.json')
const bdongs = read('villages0.json')
const fac = read('facilities.json')
const arch = exists('archhub_bdong.json') ? read('archhub_bdong.json') : {}

const DONG_ORDER = ['CG', 'SJ', 'BS', 'BG', 'DH', 'BH', 'MH', 'BP', 'MS', 'SH']
const DONG_NAME = { CG: '천곡동', SJ: '송정동', BS: '북삼동', BG: '부곡동', DH: '동호동', BH: '발한동', MH: '묵호동', BP: '북평동', MS: '망상동', SH: '삼화동' }
// 행정동 안 법정동 순서. 마을 코드(동코드-번호)가 이 순서를 따른다
const BDONG_ORDER = {
  CG: ['천곡동', '평릉동'], SJ: ['송정동', '용정동'], BS: ['지흥동', '효가동', '동회동', '나안동', '쇄운동'],
  BG: ['부곡동'], DH: ['동호동 일대'], BH: ['발한동'], MH: ['묵호진동', '어달동', '대진동'],
  BP: ['북평동', '구미동', '추암동', '구호동', '단봉동', '지가동', '이도동', '귀운동', '대구동', '호현동', '내동'],
  MS: ['망상동', '심곡동', '초구동', '괴란동', '만우동'], SH: ['삼화동', '이기동', '이로동', '신흥동', '비천동', '달방동']
}

// 화면 문구 규칙: 가운데점 대신 쉼표, 시·군·구는 시군구
const clean = (t) => String(t ?? '').replaceAll('시·군·구', '시군구').replaceAll('·', ', ')
const dotDate = (iso) => { const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : iso }
const r1 = (x) => Math.round(x * 10) / 10
const r5 = (x) => Math.round(x * 1e5) / 1e5
const M_PER_DEG_LAT = 111320
function distM([lon1, lat1], [lon2, lat2]) {
  const lat = ((lat1 + lat2) / 2) * (Math.PI / 180)
  return Math.hypot((lon2 - lon1) * M_PER_DEG_LAT * Math.cos(lat), (lat2 - lat1) * M_PER_DEG_LAT)
}
// 최대 잔여 방식 정수 배분. 합계를 정확히 맞춘다
function apportion(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0) || 1
  const raw = weights.map((w) => (total * w) / sum)
  const out = raw.map(Math.floor)
  let left = total - out.reduce((s, x) => s + x, 0)
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0; k += 1, left -= 1) out[order[k % order.length][1]] += 1
  return out
}

// 경로당(동해시 마을회관및경로당 표준데이터). 지번주소에서 법정동을 읽는다
function parseCsv(text) {
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells = []
    let cur = ''
    let q = false
    for (const ch of line) {
      if (ch === '"') q = !q
      else if (ch === ',' && !q) { cells.push(cur); cur = '' } else cur += ch
    }
    cells.push(cur)
    rows.push(cells)
  }
  const [head, ...body] = rows
  return body.map((c) => Object.fromEntries(head.map((h, i) => [h.trim(), (c[i] || '').trim()])))
}
const seniorRows = parseCsv(fs.readFileSync(path.join(RAW, 'kyungro.csv'), 'utf8'))
const SENIOR = seniorRows.map((r) => {
  const m = r['소재지지번주소'].match(/동해시\s+(\S+동)/)
  return {
    name: r['시설명'], road: r['소재지도로명주소'].replace('강원특별자치도 ', ''), bdong: m ? m[1] : null,
    tel: r['전화번호'] || null, lngLat: [r5(Number(r['경도'])), r5(Number(r['위도']))], areaM2: Number(r['건물면적']) || null
  }
}).filter((s) => Number.isFinite(s.lngLat[0]) && s.lngLat[0] > 0)
const seniorDate = seniorRows[0]?.['데이터기준일자']

// 1) 재가 장기요양 수급자 추정(2025). 급여이용수급자에서 시설급여 이용자를 뺀다
const GR = ['1등급', '2등급', '3등급', '4등급', '5등급', '인지지원등급']
const facOf = (g) => (users['노인요양시설'][g] || 0) + (users['노인요양공동생활가정'][g] || 0)
const homeRaw = Object.fromEntries(GR.map((g) => [g, Math.max(0, users.total[g] - facOf(g))]))
const homeTotal = users.total['계'] - users['노인요양시설']['계'] - users['노인요양공동생활가정']['계']
const homeByGradeArr = apportion(homeTotal, GR.map((g) => homeRaw[g]))
const homeByGrade = Object.fromEntries(GR.map((g, i) => [g, homeByGradeArr[i]]))
// 이송 등급 대응(가정). 노인장기요양보험법 시행령 제7조 등급 정의를 근거로 한 운영 가정
const TRANSPORT_OF = { '1등급': 'bed', '2등급': 'wheelchair', '3등급': 'assist', '4등급': 'assist', '5등급': 'walk', 인지지원등급: 'walk' }
const homeByTransport = { bed: 0, wheelchair: 0, assist: 0, walk: 0 }
for (const g of GR) homeByTransport[TRANSPORT_OF[g]] += homeByGrade[g]

// 2) 행정동 배분: 75세 이상 인구 비율
const dongStats = Object.fromEntries(DONG_ORDER.map((c) => {
  const d = pop.dongs[DONG_NAME[c]]
  return [c, { name: DONG_NAME[c], admCode: d.code, total: d.total, age65: d.age65, age75: d.age75, age85: d.age85, agingRate: r1((d.age65 / d.total) * 100) }]
}))
const dongTargets = apportion(homeTotal, DONG_ORDER.map((c) => dongStats[c].age75))
DONG_ORDER.forEach((c, i) => { dongStats[c].targets = dongTargets[i] })

// 3) 법정동 배분: 주거 규모 가중치(단독주택 동수 + 공동주택 연면적 ÷ 100㎡). 자료가 빠진 동은 경로당 수 비례
const APT_M2 = 100
const villages = []
for (const dong of DONG_ORDER) {
  const names = BDONG_ORDER[dong]
  const list = names.map((n) => {
    const b = bdongs.find((x) => x.name === n && x.dongCode === dong) || bdongs.find((x) => x.name === n)
    if (!b) throw new Error(`법정동 없음: ${n}`)
    return b
  })
  const archOf = (b) => (b.bdongCode ? arch[b.bdongCode] : null)
  const allArch = list.length > 1 && list.every((b) => archOf(b))
  const seniorCount = (b) => SENIOR.filter((s) => s.bdong === b.name).length
  let weights
  let basis
  if (list.length === 1) {
    weights = [1]
    basis = '행정동 전체'
  } else if (allArch) {
    weights = list.map((b) => { const a = archOf(b); return a.detached + a.apartmentArea / APT_M2 })
    basis = '주거 규모 가중치(건축HUB 법정동 건축물 통계)'
  } else {
    weights = list.map((b) => Math.max(0.5, seniorCount(b)))
    basis = '경로당 수 비례(건축물 통계 일부 미수신)'
  }
  const counts = apportion(dongStats[dong].targets, weights)
  list.forEach((b, i) => {
    const code = `${dong}-${String(i + 1).padStart(2, '0')}`
    const ref = [b.lon, b.lat]
    // 집결지: 같은 법정동 경로당 분포의 중심에 가장 가까운 경로당. 동호동 일대는 동호경로당
    const pool = b.name === '동호동 일대'
      ? SENIOR.filter((s) => s.name === '동호경로당')
      : SENIOR.filter((s) => s.bdong === b.name)
    const mid = pool.length ? [pool.reduce((t, s) => t + s.lngLat[0], 0) / pool.length, pool.reduce((t, s) => t + s.lngLat[1], 0) / pool.length] : ref
    const pickup = pool.length ? pool.reduce((best, s) => (distM(s.lngLat, mid) < distM(best.lngLat, mid) ? s : best)) : null
    const a = archOf(b)
    villages.push({
      code, dongCode: dong, name: b.name, bdongCode: b.bdongCode ? `51170${b.bdongCode}` : null,
      lngLat: pickup ? pickup.lngLat : [r5(b.lon), r5(b.lat)],
      center: [r5(b.lon), r5(b.lat)],
      pickup: pickup ? { name: pickup.name, road: pickup.road, tel: pickup.tel } : null,
      targets: counts[i],
      weight: r1(weights[i]), weightBasis: basis,
      housing: a ? { detached: a.detached, apartmentArea: a.apartmentArea } : null,
      seniorCenters: SENIOR.filter((s) => s.bdong === b.name).length
    })
  })
}

// 4) 임시주거시설(국민재난안전포털)
const roughCoords = new Set(['동해시청소년수련관', '쌍용C&E 기업연수원'])
const shelters = acmd.map((s, i) => {
  const name = s.VT_ACMD_FCLTY_NM.trim()
  const addr = s.DTL_ADRES.replace(/\s+/g, ' ').replace('강원특별자치도 ', '').replace(/-0$/, '').trim()
  const bd = (addr.match(/동해시 (\S+동)/) || [])[1] || null
  return {
    code: `TS-${String(i + 1).padStart(2, '0')}`, name, kind: clean(s.ACMD_FCLTY_SE_CD), address: addr,
    capacity: s.VT_ACMD_PSBL_NMPR, areaM2: s.FCLTY_AR, quake: s.ERTHQK_SHUNT_AT === '적용', tel: s.TEL_NO || null,
    lngLat: [r5(Number(s.LO)), r5(Number(s.LA))], coordApprox: roughCoords.has(name), bdong: bd,
    villageCode: villages.find((v) => v.name === bd)?.code || null
  }
})

// 5) 도로 주행 시간(OSRM). 마을 집결지 → 임시주거시설 27곳 전부, 가까운 순. 좌표가 같으면 저장해 둔 결과를 다시 쓴다
const OSRM_FILE = 'osrm_village_shelter.json'
const key = JSON.stringify([villages.map((v) => [v.code, v.lngLat]), shelters.map((s) => s.lngLat)])
let osrm = exists(OSRM_FILE) ? read(OSRM_FILE) : null
if (!osrm || osrm.key !== key) {
  const coords = [...villages.map((v) => v.lngLat), ...shelters.map((s) => s.lngLat)].map(([x, y]) => `${x},${y}`).join(';')
  const src = villages.map((_, i) => i).join(';')
  const dst = shelters.map((_, j) => villages.length + j).join(';')
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=${src}&destinations=${dst}&annotations=duration,distance`
  const res = await fetch(url, { headers: { 'User-Agent': 'strata-data-build/1.0' } })
  const d = await res.json()
  if (d.code !== 'Ok') throw new Error(`OSRM ${d.code}`)
  osrm = { key, source: 'router.project-osrm.org table, driving, OpenStreetMap', fetchedAt: new Date().toISOString(), villages: villages.map((v) => v.code), durations: d.durations, distances: d.distances }
  fs.writeFileSync(path.join(RAW, OSRM_FILE), JSON.stringify(osrm))
}
for (const [i, v] of villages.entries()) {
  const row = osrm.durations[i]
  const km = osrm.distances[i]
  if (osrm.villages[i] !== v.code) throw new Error(`OSRM 순서 불일치 ${osrm.villages[i]} ${v.code}`)
  v.drive = row.map((sec, j) => [shelters[j].code, r1(sec / 60), r1(km[j] / 1000)])
    .sort((a, b) => a[1] - b[1])
}

const SOURCES = {
  population: { label: '주민등록인구', org: '행정안전부(KOSIS)', table: pop.table, period: pop.period },
  ltcJudged: { label: '장기요양 등급 판정', org: '국민건강보험공단(KOSIS)', table: judged.table, period: `${judged.period}년` },
  ltcUsers: { label: '장기요양 급여이용수급자', org: '국민건강보험공단(KOSIS)', table: users.table, period: `${users.period}년` },
  ltcFacilities: { label: '장기요양기관 정원과 현원', org: '국민건강보험공단 장기요양기관 검색', table: fac.ltcSource, period: '2026. 10. 6.' },
  shelters: { label: '이재민 임시주거시설', org: '행정안전부 국민재난안전포털', table: 'acmdfcltyList_51170.json', period: '2026. 10. 6. 조회' },
  seniorCenters: { label: '마을회관과 경로당', org: '동해시(공공데이터포털 표준데이터 15114136)', table: '강원특별자치도 동해시 마을회관및경로당', period: dotDate(seniorDate) },
  centers: { label: '동 행정복지센터', org: '동해시청 누리집', table: fac.centerSource, period: '2026. 10. 6. 조회' },
  buildings: { label: '법정동 건축물 통계', org: '국토교통부 건축HUB', table: '건축물대장 표제부 법정동 집계(주용도별)', period: '2026. 10. 조회' },
  boundaries: { label: '행정동 경계', org: 'vuski/admdongkor', table: 'ver20230701', period: '2023. 7. 1.' },
  roads: { label: '도로 주행 시간', org: 'OSRM 공개 서버(OpenStreetMap)', table: osrm.source, period: `${osrm.fetchedAt.slice(0, 10).replaceAll('-', '. ')}. 계산` },
  places: { label: '법정동 기준점', org: 'OpenStreetMap', table: 'place 노드(ODbL)', period: '2026. 10. 조회' }
}

for (const v of Object.values(SOURCES)) { v.table = clean(v.table); v.label = clean(v.label) }

const LTC = {
  period: users.period,
  judged: judged.values,
  users: users.total,
  facilityUsers: Object.fromEntries(['계', ...GR].map((g) => [g, (users['노인요양시설'][g] || 0) + (users['노인요양공동생활가정'][g] || 0)])),
  dayCareUsers: users['주야간보호'],
  homeTotal, homeByGrade, homeByTransport, transportOf: TRANSPORT_OF,
  facilityCounts: clean(users.facilityTable)
}

const banner = `// donghaeData.js 자동 생성 파일. client/scripts/build-donghae-data.mjs 로 만든다. 직접 고치지 않는다.
// 마을(법정동), 임시주거시설, 경로당, 장기요양기관, 행정복지센터는 실제 공개 자료다. 출처와 기준 시점은 DATA_SOURCES.
// 마을별 대상자 수(targets)는 통계를 나눈 추정치다. 개인 단위 자료는 없다.
`
const js = (name, v) => `export const ${name} = ${JSON.stringify(v)}\n`
fs.writeFileSync(OUT, banner
  + js('DATA_SOURCES', SOURCES)
  + js('DONG_STATS', dongStats)
  + js('LTC', LTC)
  + js('VILLAGES', villages)
  + js('TEMP_SHELTERS', shelters)
  + js('LTC_RESIDENTIAL', fac.residential.map((f) => ({ ...f, lngLat: [f.lon, f.lat], lat: undefined, lon: undefined })))
  + js('LTC_DAYCARE', fac.dayCare.map((f) => ({ ...f, lngLat: [f.lon, f.lat], lat: undefined, lon: undefined })))
  + js('DONG_CENTERS', fac.centers.map((f) => ({ ...f, lngLat: [f.lon, f.lat], lat: undefined, lon: undefined })))
  + js('SENIOR_CENTERS', SENIOR)
  + js('ALLOC', { aptM2PerHousehold: APT_M2, rule: '재가 수급자 추정치를 행정동별 75세 이상 인구 비율로 나누고, 법정동은 주거 규모 가중치로 나눈다' })
)
const sum = villages.reduce((s, v) => s + v.targets, 0)
console.log(`villages ${villages.length}, targets ${sum} (home ${homeTotal}), shelters ${shelters.length}, senior ${SENIOR.length}`)
console.log('byTransport', homeByTransport)
for (const v of villages) console.log(v.code, v.name, v.targets, v.pickup?.name || '-', v.drive[0].join(' '), v.weightBasis)
