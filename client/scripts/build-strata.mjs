// build-strata.mjs
// 국민안전24 안전지도 원자료(동해시 51170), 경로당 표준데이터, 학교 현황, 시설관리공단 체육시설,
// 공사와 휴관 사례를 시설 단위 역할 층 데이터로 묶는다.
// 실행: node client/scripts/build-strata.mjs
//   -> client/src/data/strata.json, client/src/data/scenes.json, client/src/data/inside.json
// 담당자 이름과 전화번호는 원자료에 있어도 결과에 넣지 않는다. 부서 이름만 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const RAW = path.join(here, 'data-raw')
const DATA = path.join(here, '..', 'src', 'data')
const TODAY = '2026-10-19'
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), 'utf8'))

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const dms = (d, m, s) => (d == null || d === '' ? null : Number(d) + Number(m || 0) / 60 + Number(s || 0) / 3600)
const egen = (v) => (v == null || v === '' ? null : Number(v) / 360000)
const ts = (v) => {
  if (v == null || v === '') return null
  if (typeof v === 'string' && /\d{4}[/-]\d{2}[/-]\d{2}/.test(v)) return v.slice(0, 10).replace(/\//g, '-')
  const d = new Date(Number(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
const dept = (v) => (v ? String(v).replace(/^강원특별자치도 동해시 \S+ /, '').trim() : null)

// 역할 9종. 계약 2절의 순서를 그대로 유지한다. 층 쌓는 순서도 같다.
const ROLES = [
  { id: 'shelter', label: '쉼터' },
  { id: 'evac', label: '대피' },
  { id: 'housing', label: '임시주거' },
  { id: 'water', label: '급수' },
  { id: 'medical', label: '응급' },
  { id: 'sports', label: '체육' },
  { id: 'care', label: '돌봄' },
  { id: 'admin', label: '행정' },
  { id: 'transit', label: '통행' }
]
const roleOrder = (id) => ROLES.findIndex((r) => r.id === id)

// 안전지도 19개 층 중 시설이 아닌 급경사지와 가스사고발생이력은 제외한다.
const LAYERS = [
  { file: '한파쉼터.json', role: 'shelter', sub: 'cold', subLabel: '한파쉼터', coord: 'lola' },
  { file: '무더위쉼터.json', role: 'shelter', sub: 'heat', subLabel: '무더위쉼터', coord: 'lola' },
  { file: '미세먼지쉼터.json', role: 'shelter', sub: 'dust', subLabel: '미세먼지 쉼터', coord: 'lola' },
  { file: '민방위대피소.json', role: 'evac', sub: 'civil', subLabel: '민방위대피', coord: 'dms' },
  { file: '지진옥외대피소.json', role: 'evac', sub: 'eqOut', subLabel: '지진옥외대피', coord: 'lola' },
  { file: '지진해일대피소.json', role: 'evac', sub: 'tsunami', subLabel: '지진해일대피', coord: 'lola' },
  { file: '화학사고대피소.json', role: 'evac', sub: 'chem', subLabel: '화학사고대피', coord: 'lola' },
  { file: '이재민임시주거시설.json', role: 'housing', sub: 'house', subLabel: '이재민 임시주거', coord: 'lola' },
  { file: '지진겸용임시주거시설.json', role: 'housing', sub: 'eqHouse', subLabel: '지진겸용 임시주거', coord: 'lola' },
  { file: '비상급수시설.json', role: 'water', sub: 'emergency', subLabel: '비상급수', coord: 'dms' },
  { file: '응급의료센터.json', role: 'medical', sub: 'er', subLabel: '응급의료센터', coord: 'lola' },
  { file: '일반병원.json', role: 'medical', sub: 'clinic', subLabel: '진료', coord: 'egen' },
  { file: '보건소.json', role: 'medical', sub: 'health', subLabel: '보건기관', coord: 'egen' },
  { file: '약국.json', role: 'medical', sub: 'pharmacy', subLabel: '약국', coord: 'egen' },
  { file: '어린이안전놀이시설.json', role: 'care', sub: 'play', subLabel: '어린이 놀이', coord: 'lola' },
  { file: '경찰서.json', role: 'admin', sub: 'police', subLabel: '경찰', coord: 'lola' },
  { file: '소방서.json', role: 'admin', sub: 'fire', subLabel: '소방', coord: 'lola' }
]

// ── 고도 조회(DEM 캐시) ───────────────────────────────────────────────
// client/public/terrain/region-dem.png 를 python3 + PIL 로 뽑은 Uint16 격자.
// 고도 = v / 10 m. 격자가 없으면 python3 client/scripts/dem-grid.py 로 만든다.
const DEM = { bbox: [128.48608, 37.01882, 129.38410000000002, 37.938340000000004], cols: 900, rows: 1151 }
const demPath = path.join(RAW, 'dem_grid.bin')
let demGrid = null
if (fs.existsSync(demPath)) {
  const buf = fs.readFileSync(demPath)
  demGrid = new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2)
}
function elevation(lon, lat) {
  if (!demGrid) return null
  const [w, s, e, n] = DEM.bbox
  const fx = ((lon - w) / (e - w)) * (DEM.cols - 1)
  const fy = ((n - lat) / (n - s)) * (DEM.rows - 1)
  if (!(fx >= 0 && fy >= 0 && fx <= DEM.cols - 1 && fy <= DEM.rows - 1)) return null
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const x1 = Math.min(x0 + 1, DEM.cols - 1), y1 = Math.min(y0 + 1, DEM.rows - 1)
  const tx = fx - x0, ty = fy - y0
  const g = (x, y) => demGrid[y * DEM.cols + x] / 10
  const a = g(x0, y0) * (1 - tx) + g(x1, y0) * tx
  const b = g(x0, y1) * (1 - tx) + g(x1, y1) * tx
  return a * (1 - ty) + b * ty
}
function climb(a, b, steps = 40) {
  if (!demGrid) return null
  let prev = elevation(a.lon, a.lat), sum = 0
  if (prev == null) return null
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const h = elevation(a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t)
    if (h == null) continue
    if (h > prev) sum += h - prev
    prev = h
  }
  return Math.round(sum)
}
const distM = (a, b) => {
  const dx = (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180)
  const dy = (a.lat - b.lat) * 110540
  return Math.hypot(dx, dy)
}

// ── 원자료를 역할 기록으로 ────────────────────────────────────────────
function pickCoord(layer, o) {
  if (layer.coord === 'dms') {
    return [dms(o.facilLode, o.facilLomi, o.facilLose), dms(o.facilLade, o.facilLami, o.facilLase)]
  }
  if (layer.coord === 'egen') return [egen(o.dutyLon), egen(o.dutyLat)]
  return [num(o.lo), num(o.la)]
}
function pickName(o) {
  return String(o.rstrNm || o.facilNm || o.shelNm || o.shltrNm || o.vtAcmdfcltyNm || o.pfctNm || o.dutyName || o.facilityName || o.title || o.adres || '').trim()
}
function pickAddr(o) {
  const a = o.rnDtlAdres || o.facilRdAddr || o.dutyAddr || o.yadmAddr || o.ronaAddr || o.addrNm || o.address || o.adres
  return a && /동해시/.test(a) ? String(a).replace(/\s+/g, ' ').trim() : null
}
// 행정동은 주소 괄호 안 법정동 표기나 지역코드 이름에서 읽는다. 확인이 안 되면 빈 문자열.
function pickDong(o, addr) {
  const fromCode = o.rgnCdNm ? String(o.rgnCdNm).match(/([가-힣]+\d?동|[가-힣]+면|[가-힣]+리)$/) : null
  if (fromCode) return fromCode[1]
  const src = `${addr || ''} ${o.lotnoAddr || ''} ${o.dtlAdres || ''} ${o.adres || ''}`
  const paren = src.match(/\(([가-힣]+\d?동)[,)]/)
  if (paren) return paren[1]
  const direct = src.match(/동해시\s+([가-힣]+\d?동)\s/)
  return direct ? direct[1] : ''
}

const records = []
const layerCounts = {}
for (const layer of LAYERS) {
  const rows = readJson(path.join('safekorea', layer.file))
  layerCounts[layer.file.replace('.json', '')] = rows.length
  for (const o of rows) {
    const [lon, lat] = pickCoord(layer, o)
    if (lon == null || lat == null) continue
    const addr = pickAddr(o)
    let sub = layer.sub, subLabel = layer.subLabel
    // 응급실을 갖춘 병원만 응급 하위로 올린다(원자료 dutyEryn = 1).
    if (layer.file === '일반병원.json' && o.dutyEryn === '1') { sub = 'er', subLabel = '병원 응급실' }
    records.push({
      role: layer.role, sub, subLabel,
      name: pickName(o), addr, dong: pickDong(o, addr), lon, lat,
      cap: num(o.usePsblNmpr ?? o.useCanStfCnt ?? o.vtAcmdPsblNmpr ?? o.emgySickbdCnt),
      area: num(o.ar ?? o.fcltyAr ?? o.aceptncAr ?? o.facilPow ?? o.fcar),
      deptDisaster: dept(o.dstrDeptNm),
      deptWelfare: dept(o.soctyWlfareDeptNm),
      open: o.fcltyOprnAt ?? o.opnYn ?? o.useYn ?? o.operYnCdNm ?? null,
      modified: ts(o.modfTime || o.dtRegt || o.modifyDate) || null,
      season: o.operBeginDe ? `${o.operBeginDe}~${o.operEndDe}` : null,
      source: 'safekorea'
    })
  }
}

// 이재민 임시주거 원자료는 이름 칸이 비어 있어 동해시 수용시설 목록의 이름을 좌표로 붙인다.
const acmdRaw = readJson('acmd_51170.json')
const acmdList = Array.isArray(acmdRaw) ? acmdRaw : (acmdRaw.list || acmdRaw.items || acmdRaw.data || [])
for (const r of records) {
  if (r.sub !== 'house' || (r.name && r.name !== 'null')) continue
  let best = null, bd = 1e9
  for (const a of acmdList) {
    const lo = num(a.LO ?? a.lo ?? a.lon), la = num(a.LA ?? a.la ?? a.lat)
    if (lo == null || la == null) continue
    const d = Math.hypot(lo - r.lon, la - r.lat)
    if (d < bd) { bd = d; best = a }
  }
  if (best && bd < 0.002) r.name = String(best.VT_ACMD_FCLTY_NM || best.vtAcmdfcltyNm || best.name || '').trim()
}

// ── 시설 묶기(기존 규칙 유지: 같은 이름 1.5km, 같은 도로명주소, 80m 이름 포함) ──
const norm = (s) => {
  let n = String(s)
    .replace(/\(.*?\)/g, '')
    .replace(/[\s,.]+/g, '')
    .replace(/(운동장|체육관|비상급수시설|지하주차장.*|입구|일원)$/g, '')
    .replace(/초등학교$/, '초').replace(/중학교$/, '중').replace(/여자고등학교$/, '여고').replace(/고등학교$/, '고')
  if (/^동해.{2,}(초|중|고|여고)$/.test(n)) n = n.replace(/^동해/, '')
  return n
}
const roadKey = (a) => {
  if (!a) return null
  const m = String(a).replace(/\(.*?\)/g, '').match(/([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/)
  return m ? `${m[1]} ${m[2]}` : null
}
const typeOf = (n) => {
  if (/경로당|마을회관/.test(n)) return '경로당'
  if (/학교|유치원/.test(n) || /(초|중|고|여고)$/.test(norm(n))) return '학교'
  if (/(GS25|CU|세븐일레븐|이마트24|편의점)/i.test(n)) return '편의점'
  if (/약국/.test(n)) return '약국'
  if (/병원|의원|보건소|보건지소|치과|한의원/.test(n)) return '의료기관'
  if (/경찰서|지구대|파출소/.test(n)) return '경찰'
  if (/소방서|안전센터/.test(n)) return '소방'
  if (/복지관|노인|어린이집/.test(n)) return '복지시설'
  if (/행정복지센터|주민센터|시청/.test(n)) return '행정복지센터'
  if (/체육|스포츠|레포츠|경기장|구장/.test(n)) return '체육시설'
  if (/도서관|문화예술회관|박물관/.test(n)) return '문화시설'
  if (/아파트/.test(n)) return '공동주택'
  if (/해수욕장|공원|야산|광장|주차장|산$/.test(n)) return '옥외공간'
  return '기타'
}

const facilities = []
const isAddrName = (n) => !n || n === 'null' || /^강원/.test(n)
function addRole(f, r) {
  const same = f.roles.find((x) => x.role === r.role && x.sub === r.sub)
  if (same) return
  f.roles.push({
    role: r.role, sub: r.sub, subLabel: r.subLabel,
    cap: r.cap ?? null, area: r.area ?? null,
    deptDisaster: r.deptDisaster ?? null, deptWelfare: r.deptWelfare ?? null,
    modified: r.modified ?? null, season: r.season ?? null, source: r.source
  })
}
function findFacility(r, key, rk) {
  return facilities.find((x) => (x.key === key && distM(x, r) < 1500)
    || (rk && x.road === rk && !/(GS25|CU|세븐|이마트24)/.test(r.name + x.name))
    || (distM(x, r) < 80 && (x.key.includes(key) || key.includes(x.key))))
}
const ordered = [...records.filter((r) => !isAddrName(r.name)), ...records.filter((r) => isAddrName(r.name))]
for (const r of ordered) {
  if (isAddrName(r.name)) {
    if (!r.addr && /^강원/.test(r.name)) r.addr = r.name
    let near = null, nd = 1e9
    for (const x of facilities) { const d = distM(x, r); if (d < nd) { nd = d; near = x } }
    if (near && nd < 200) {
      addRole(near, r)
      if (!near.addr) near.addr = r.addr
      if (!near.dong && r.dong) near.dong = r.dong
      continue
    }
    r.name = r.addr || '이름 없는 시설'
  }
  const key = norm(r.name)
  const rk = roadKey(r.addr)
  let f = findFacility(r, key, rk)
  if (!f) {
    f = { key, road: rk, name: r.name.replace(/\s*(운동장|체육관|비상급수시설)$/, '').trim(), names: [], lon: r.lon, lat: r.lat, addr: r.addr, dong: r.dong || '', roles: [], events: [] }
    facilities.push(f)
  }
  if (!f.addr && r.addr) { f.addr = r.addr; f.road = rk }
  if (!f.dong && r.dong) f.dong = r.dong
  ;(f.names ||= []).push(r.name)
  addRole(f, r)
}

// 같은 시설에 여러 이름이 들어오면 지하층이나 부속 공간 표기가 없는 이름을 대표로 쓴다.
const stripSpace = (n) => String(n)
  .replace(/\s*(옆|앞|뒤)?\s*지하\s*\d*\s*층?\s*(방공호|주차장|대피소)?\s*$/, '')
  .replace(/\s*(비상급수시설|운동장|체육관|입구|일원)\s*$/, '')
  .replace(/\s*(옆|앞|뒤)\s*$/, '')
  .trim()
for (const f of facilities) {
  const cands = [...new Set((f.names || []).map(stripSpace).filter((n) => n && !/^강원/.test(n)))]
  if (cands.length) f.name = cands.sort((a, b) => b.length - a.length)[0]
  delete f.names
}

// ── 경로당 표준데이터: 돌봄(어르신 모임) ─────────────────────────────
const csv = fs.readFileSync(path.join(RAW, 'kyungro.csv'), 'utf8').trim().split('\n')
const head = csv[0].split(',')
let kyungroCount = 0
for (const line of csv.slice(1)) {
  const c = line.split(','), o = Object.fromEntries(head.map((h, i) => [h, c[i]]))
  const lon = num(o['경도']), lat = num(o['위도'])
  if (lon == null || lat == null) continue
  kyungroCount++
  const k = { name: o['시설명'], lon, lat, addr: o['소재지도로명주소'] || null }
  const key = norm(k.name)
  const rk = roadKey(k.addr)
  let f = facilities.find((x) => x.key === key && distM(x, k) < 1500)
    || facilities.find((x) => rk && x.road === rk && /경로당|마을회관/.test(x.name))
    || facilities.find((x) => distM(x, k) < 80 && /경로당|마을회관/.test(x.name))
  if (!f) {
    f = { key, road: rk, name: k.name, lon, lat, addr: k.addr, dong: '', roles: [], events: [] }
    facilities.push(f)
  }
  if (!f.addr && k.addr) { f.addr = k.addr; f.road = rk }
  if (!f.dong) {
    const m = String(o['소재지지번주소'] || '').match(/동해시\s+([가-힣]+\d?동|[가-힣]+리)/)
    if (m) f.dong = m[1]
  }
  addRole(f, { role: 'care', sub: 'senior', subLabel: '어르신 모임', area: num(o['건물면적']), modified: o['데이터기준일자'] || null, source: 'kyungro' })
}

// ── 학교 현황(강원특별자치도교육청): 돌봄(교육과 돌봄) ───────────────
// 좌표가 없는 목록이라 이름이 맞는 기존 시설에만 붙이고, 못 붙인 학교는 개수만 남긴다.
const SCHOOL_HTML = '/Users/juhyunho/.aside/u/0/sessions/2026-10-18_annIEssxJ9cQDxK9/tmp/v4_fac_raw/gwe_school_donghae.html'
const schools = []
if (fs.existsSync(SCHOOL_HTML)) {
  const html = fs.readFileSync(SCHOOL_HTML, 'utf8')
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || []
  for (const t of tables) {
    for (const tr of t.match(/<tr[\s\S]*?<\/tr>/g) || []) {
      const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map((c) => c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
      if (cells.length >= 3 && /^\d+$/.test(cells[0]) && /학교|유치원/.test(cells[1])) schools.push({ name: cells[1], addr: cells[2] })
    }
  }
}
let schoolMatched = 0
const schoolUnmatched = []
for (const s of schools) {
  const key = norm(s.name)
  const f = facilities.find((x) => x.key === key)
    || facilities.find((x) => x.name.replace(/\s/g, '') === s.name.replace(/\s/g, ''))
  if (f) { addRole(f, { role: 'care', sub: 'school', subLabel: '교육과 돌봄', source: 'gwe-school' }); schoolMatched++ }
  else schoolUnmatched.push(s.name)
}

// ── 시설관리공단 체육시설과 이름 규칙: 체육 ──────────────────────────
const SISUL_HTML = '/Users/juhyunho/.aside/u/0/sessions/2026-10-18_annIEssxJ9cQDxK9/tmp/v4_fac_raw/dhsisul_fac.html'
const sportsNames = []
if (fs.existsSync(SISUL_HTML)) {
  const html = fs.readFileSync(SISUL_HTML, 'utf8')
  const block = html.slice(html.indexOf('체육시설'))
  for (const m of block.matchAll(/>([가-힣A-Za-z0-9·\s]{3,30})</g)) {
    const t = m[1].trim()
    if (/(체육관|체육센터|경기장|구장|스포츠|레포츠|운동장|파크골프장|암벽장|복지회관|체육공원)$/.test(t) && !sportsNames.includes(t)) sportsNames.push(t)
  }
}
let sportsDesignated = 0
for (const n of sportsNames) {
  const key = norm(n)
  const f = facilities.find((x) => x.key === key) || facilities.find((x) => x.name.replace(/\s/g, '').includes(n.replace(/\s/g, '')))
  if (f) { addRole(f, { role: 'sports', sub: 'public', subLabel: '공공 체육시설', source: 'dhsisul' }); sportsDesignated++ }
}
let sportsByName = 0
for (const f of facilities) {
  if (f.roles.some((r) => r.role === 'sports')) continue
  if (/(체육관|레포츠타운|스포츠|운동장)/.test(f.name)) { addRole(f, { role: 'sports', sub: 'public', subLabel: '체육 공간', source: 'name-rule' }); sportsByName++ }
}
// 행정복지센터와 주민센터: 행정
let adminOffice = 0
for (const f of facilities) {
  if (/(행정복지센터|주민센터)/.test(f.name) && !f.roles.some((r) => r.role === 'admin' && r.sub === 'office')) {
    addRole(f, { role: 'admin', sub: 'office', subLabel: '행정 창구', source: 'name-rule' })
    adminOffice++
  }
}

// 통행(transit): 2026년 8월 8일 호우 통제 굴다리 4곳은 공개 지도에서 정확 지점 좌표를 확인하지 못해
// 이번 산출물에서 제외한다. 좌표를 임의로 만들지 않는다.
const transitSkipped = ['노봉굴다리', '묵호굴다리', '북평대구굴다리', '전천둔지']

// ── 운영 중단 일정 ───────────────────────────────────────────────────
const CONFIRMED = {
  동해문화예술회관: ['2026-03-24', '2026-05-22'],
  발한도서관: ['2025-06-09', '2025-07-31'],
  동해교육도서관: ['2026-09-14', '2026-11-18'],
  동해국민체육센터: ['2026-03-03', '2026-06-30'],
  동해웰빙레포츠타운: ['2026-06-11', '2026-06-16']
}
const addDays = (iso, d) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}
const raw = readJson(path.join('closures', 'events.json'))
let seq = 0
const nextEventId = () => `E${String(++seq).padStart(3, '0')}`
const eventsUnmatched = []
for (const e of raw.events) {
  const key = norm(e.facility)
  const f = facilities.find((x) => x.key === key)
    || facilities.find((x) => x.name.replace(/\s/g, '').includes(e.facility.replace(/\s/g, '')))
  const conf = CONFIRMED[e.facility]
  let start = e.start || null, end = e.end || null, certainty = '예정'
  if (conf) { start = conf[0]; end = conf[1]; certainty = '확정' }
  else if (!start && e.notice) {
    start = addDays(e.notice, 30)          // 공고일 + 30일 착공으로 추정
    end = addDays(start, e.days || 60)     // 공사기간 문구가 있으면 그 일수, 없으면 60일
  }
  const ev = {
    id: nextEventId(), kind: e.kind, cause: e.cause, notice: e.notice || null,
    start, end, certainty,
    roles: f ? [...new Set(f.roles.map((r) => r.role))] : [],
    source: e.source, url: e.url || ''
  }
  if (f) f.events.push(ev)
  else eventsUnmatched.push(e.facility)
}
// 응급실 미운영 구간(근로복지공단 동해병원, 동해시 누리집 배너 2026. 10.)
const ERSPANS = [
  ['2026-10-01T00:00:00+09:00', '2026-10-02T23:59:00+09:00'],
  ['2026-10-06T00:00:00+09:00', '2026-10-07T23:59:00+09:00'],
  ['2026-10-08T00:00:00+09:00', '2026-10-09T23:59:00+09:00'],
  ['2026-10-16T00:00:00+09:00', '2026-10-17T23:59:00+09:00'],
  ['2026-10-19T00:00:00+09:00', '2026-10-20T23:59:00+09:00'],
  ['2026-10-23T08:30:00+09:00', '2026-10-23T17:30:00+09:00'],
  ['2026-10-27T08:30:00+09:00', '2026-10-30T17:30:00+09:00']
]
const erFac = facilities.find((x) => /하평로 11/.test(x.addr || '') && x.roles.some((r) => r.role === 'medical'))
  || facilities.find((x) => x.name.replace(/\s/g, '').includes('근로복지공단동해병원'))
if (erFac) {
  for (const [s, t] of ERSPANS) {
    erFac.events.push({
      id: nextEventId(), kind: '운영중단', cause: '응급실 미운영', notice: null,
      start: s, end: t, certainty: '확정', roles: ['medical'],
      source: '동해시 누리집 배너 2026. 10.', url: 'https://www.dh.go.kr/'
    })
  }
}

// ── 아이디와 상태 ────────────────────────────────────────────────────
facilities.forEach((f, i) => {
  f.id = `F${String(i + 1).padStart(3, '0')}`
  f.type = typeOf(f.name)
  f.roles.sort((a, b) => roleOrder(a.role) - roleOrder(b.role))
})
const spans = (ev, dayIso) => {
  if (!ev.start) return false
  const d0 = `${dayIso}T00:00:00+09:00`, d1 = `${dayIso}T23:59:59+09:00`
  const s = new Date(ev.start.length > 10 ? ev.start : `${ev.start}T00:00:00+09:00`).getTime()
  const e = new Date(ev.end ? (ev.end.length > 10 ? ev.end : `${ev.end}T23:59:59+09:00`) : ev.start).getTime()
  return s <= new Date(d1).getTime() && e >= new Date(d0).getTime()
}
for (const f of facilities) {
  const hit = f.events.filter((e) => spans(e, TODAY))
  if (hit.some((e) => e.certainty === '확정')) f.status = 'closed'
  else if (hit.length || f.events.length) f.status = 'check'
  else f.status = 'open'
}

// ── 해일 대피 지점 고도 ─────────────────────────────────────────────
for (const f of facilities) {
  const t = f.roles.find((r) => r.role === 'evac' && r.sub === 'tsunami')
  if (!t) continue
  const h = elevation(f.lon, f.lat)
  if (h != null) t.elevM = Math.round(h * 10) / 10
}

// ── 대체 시설: 같은 역할(같은 sub 우선) 가장 가까운 3곳 ──────────────
const byRole = {}
for (const f of facilities) for (const r of f.roles) (byRole[r.role] ||= []).push({ f, sub: r.sub })
for (const f of facilities) {
  f.alternatives = []
  for (const r of f.roles) {
    const pool = (byRole[r.role] || []).filter((x) => x.f.id !== f.id)
    const scored = pool.map((x) => ({ x, d: distM(f, x.f), same: x.sub === r.sub ? 0 : 1 }))
    scored.sort((a, b) => (a.same - b.same) || (a.d - b.d))
    const seen = new Set()
    for (const s of scored) {
      if (seen.size >= 3) break
      if (seen.has(s.x.f.id)) continue
      seen.add(s.x.f.id)
      f.alternatives.push({ role: r.role, facilityId: s.x.f.id, distM: Math.round(s.d), climbM: climb(f, s.x.f) })
    }
  }
}

// ── 출력 ────────────────────────────────────────────────────────────
const roleCount = {}
for (const r of ROLES) roleCount[r.id] = facilities.filter((f) => f.roles.some((x) => x.role === r.id)).length
const statusCount = { open: 0, closed: 0, check: 0 }
for (const f of facilities) statusCount[f.status]++
const subCount = {}
for (const f of facilities) for (const r of f.roles) subCount[`${r.role}/${r.sub}`] = (subCount[`${r.role}/${r.sub}`] || 0) + 1

const stats = {
  facilities: facilities.length,
  records: records.length,
  multiRole: facilities.filter((f) => new Set(f.roles.map((r) => r.role)).size >= 2).length,
  threePlus: facilities.filter((f) => new Set(f.roles.map((r) => r.role)).size >= 3).length,
  byRole: roleCount,
  bySub: subCount,
  byStatus: statusCount,
  sourceLayers: layerCounts,
  kyungroRows: kyungroCount,
  schoolListed: schools.length,
  schoolMatched,
  schoolUnmatchedCount: schoolUnmatched.length,
  schoolUnmatched,
  sportsDesignated,
  sportsByNameRule: sportsByName,
  adminOfficeByNameRule: adminOffice,
  eventsTotal: seq,
  eventsUnmatched,
  transitSkipped,
  transitNote: '2026년 8월 8일 호우 통제 굴다리 4곳은 정확 지점 좌표를 공개 지도에서 확인하지 못해 제외했다.'
}

const out = {
  generatedAt: '2026-10-19T00:00:00+09:00',
  basis: '자료 기준일 2026년 10월 18일. 운영 중단 일정의 추정값은 공고일 기준이고 확정 일자와 따로 표시해요.',
  sources: [
    { id: 'safekorea', label: '국민안전24 안전지도(동해시 51170) 17개 시설 층', date: '2026. 10. 18.' },
    { id: 'kyungro', label: '전국마을회관및경로당표준데이터(공공데이터포털 15114136)', date: '2025. 11. 4.' },
    { id: 'gwe-school', label: '강원특별자치도교육청 학교현황(동해시)', date: '2026. 10. 19.' },
    { id: 'dhsisul', label: '동해시시설관리공단 관리시설안내 체육시설', date: '2026. 10. 19.' },
    { id: 'closures', label: '동해시 공사알림과 나라장터 공고와 지역 언론 휴관 사례', date: '2026. 10. 18.' },
    { id: 'dh-banner', label: '동해시 누리집 응급실 미운영 안내 배너', date: '2026. 10.' },
    { id: 'dem', label: '지형 고도 격자 client/public/terrain/region-dem.png', date: '2026. 10. 7.' }
  ],
  roles: ROLES,
  facilities: facilities.map((f) => ({
    id: f.id, name: f.name, type: f.type,
    lon: f.lon, lat: f.lat, addr: f.addr || null, dong: f.dong || '',
    roles: f.roles, status: f.status, events: f.events, alternatives: f.alternatives
  })),
  stats
}
fs.mkdirSync(DATA, { recursive: true })
fs.writeFileSync(path.join(DATA, 'strata.json'), JSON.stringify(out))

// ── 3D 대표 장면 16개(v4_3d.md 7장) ─────────────────────────────────
const find = (re) => facilities.find((f) => re.test(f.name))
const sc = (id, name, target, desc) => {
  const f = typeof target === 'string' ? find(new RegExp(target)) : null
  const r = { id, name, facilityId: f ? f.id : null, lon: f ? f.lon : (target && target.lon) || null, lat: f ? f.lat : (target && target.lat) || null, desc }
  if (r.lon == null) r.needsLocation = true
  return r
}
const scenes = [
  sc('region', '동해 전역 조감', { lon: 129.1, lat: 37.53 }, '망상에서 추암까지 해안과 서쪽 산악을 한 화면에 담는 기본 조감이다.'),
  sc('bukpyeong-girls', '북평여자고등학교', '북평여자고등학교', '한 학교에 지진옥외대피와 화학사고대피와 임시주거가 겹치는 사례다.'),
  sc('jungang-elem', '중앙초등학교', '중앙초등학교', '같은 학교 유형에서도 수용 정보와 유효기간이 다름을 비교한다.'),
  sc('dongin-er', '동해동인병원 응급실', '동해동인병원', '응급 역할의 출입구와 접근 도로를 근접 장면으로 본다.'),
  sc('iro-senior', '이로경로당', '이로경로당', '한파쉼터와 무더위쉼터가 같은 쉼터군에 함께 놓인 모습을 본다.'),
  sc('wolpyeong-senior', '월평경로당', '월평경로당', '이로경로당과 이어지는 대체 후보 관계를 보여준다.'),
  sc('donghae-gym', '동해체육관', '동해체육관', '체육 일정과 비상급수 가용 상태를 같은 시설에서 함께 읽는다.'),
  sc('wellbeing-town', '웰빙스포츠타운', '웰빙레포츠타운', '운동장 영역에 붙은 지진옥외대피 지정 범위를 보여준다.'),
  sc('balhan-lib', '발한도서관', '발한도서관', '휴관 사례가 확인된 도서관이며 공식 위치 등록이 남아 있다.'),
  sc('mukho-office', '묵호동행정복지센터 지하 1층', '묵호동행정복지센터', '지상 행정 공간과 지하 민방위대피를 수직 단면으로 나눈다.'),
  sc('bukpyeong-office', '북평동행정복지센터 옆 방공호', '^\\uBD81\\uD3C9\\uB3D9\\s*행정복지센터', '민방위대피와 비상급수 두 역할을 함께 보여준다.'),
  sc('daegu-underpass', '대구굴다리', '대구굴다리', '호우 때 통행 역할이 꺼지고 우회가 생기는 지점이며 위치 확정이 남아 있다.'),
  sc('swaeun-water', '쇄운정수장과 망상 배수지 권역', '쇄운정수장', '급수 역할의 공급 권역을 보여주며 관망 자료 등록이 남아 있다.'),
  sc('nobong-beach', '노봉해수욕장과 뒤쪽 야산', '노봉', '해변과 고지대 대피 지점의 높이 차이를 해일 침수면과 함께 본다.'),
  sc('mukho-sunrise', '묵호항과 일출공원', '일출공원', '항구 수면과 언덕 고도 차이를 일출 시각에 연결한다.'),
  sc('chuam-park', '추암 조각공원', '추암\\s*조각공원', '남쪽 해안의 지진해일 대피 지점과 해변 지형을 함께 본다.')
]
fs.writeFileSync(path.join(DATA, 'scenes.json'), JSON.stringify({ generatedAt: out.generatedAt, source: '해커톤 별첨 v4_3d.md 7장', scenes }, null, 1))

// ── 시설 속 보기 5곳 ────────────────────────────────────────────────
const insideDefs = [
  ['동해초등학교', [['hall', '현관과 로비', ['care']], ['gym', '체육관', ['sports', 'evac']], ['class-1f', '1층 교실', ['care']], ['yard', '운동장', ['evac']], ['shelter-room', '임시주거 지정 공간', ['housing']]]],
  ['동해웰빙레포츠타운', [['main-gym', '주경기장', ['sports']], ['sub-field', '보조경기장', ['sports']], ['field', '운동장', ['evac']], ['lobby', '입구 로비', ['admin']], ['water-point', '비상급수 지점', ['water']]]],
  ['이로경로당', [['main-room', '큰방', ['shelter', 'care']], ['kitchen', '주방', ['care']], ['rest', '휴게실', ['shelter']], ['entry', '현관', ['admin']]]],
  ['묵호동행정복지센터', [['office-1f', '1층 민원 창구', ['admin']], ['meeting', '회의실', ['care']], ['b1-shelter', '지하 1층 민방위대피 공간', ['evac']], ['b1-store', '지하 1층 비축 공간', ['housing']]]],
  ['근로복지공단 동해병원', [['er', '응급실', ['medical']], ['er-entry', '응급 출입구', ['medical']], ['outpatient', '외래 접수', ['medical']], ['pharmacy', '원내 약제실', ['medical']]]]
]
const inside = insideDefs.map(([name, rooms]) => {
  const f = find(new RegExp(name.replace(/\s/g, '\\s*')))
  return {
    facilityId: f ? f.id : null,
    name,
    image: f ? `/inside/${f.id}.webp` : '',
    spaces: rooms.map(([id, label, roles]) => ({ id, label, roles, polygon: [] }))
  }
})
fs.writeFileSync(path.join(DATA, 'inside.json'), JSON.stringify({ generatedAt: out.generatedAt, note: '단면 투시도 이미지가 준비되면 polygon을 채운다.', facilities: inside }, null, 1))

const size = fs.statSync(path.join(DATA, 'strata.json')).size
console.log('strata.json 크기 ' + (size / 1024).toFixed(1) + 'KB')
console.log('시설 수 ' + stats.facilities + ' / 원자료 기록 ' + stats.records)
console.log('역할별 시설 수 ' + JSON.stringify(roleCount))
console.log('역할 2종 이상 ' + stats.multiRole + ' / 3종 이상 ' + stats.threePlus)
console.log('status별 ' + JSON.stringify(statusCount))
console.log('이벤트 ' + stats.eventsTotal + ' / 미연결 ' + JSON.stringify(eventsUnmatched))
console.log('학교 목록 ' + stats.schoolListed + ' 중 연결 ' + schoolMatched + ' 미연결 ' + schoolUnmatched.length)
console.log('체육 지정 ' + sportsDesignated + ' / 이름 규칙 ' + sportsByName + ' / 행정 창구 ' + adminOffice)
console.log('scenes ' + scenes.length + ' / inside ' + inside.length)
