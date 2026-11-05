// main.js 3D 엔진 확인용 페이지. 서비스 화면이 아니라 계약서 3장 공개 메서드를 직접 눌러 보는 자리다.
// 데이터는 계약 스키마 발췌본(__fixtures__/sample.json)을 쓴다.
import Region3D from '../Region3D.js'
import sample from '../__fixtures__/sample.json'
import { ROLE_COLOR, ROLE_LABEL, ROLE_ORDER } from '../palette.js'

const stage = document.getElementById('stage')
const out = document.getElementById('out')

const map = new Region3D(stage, {
  theme: 'light',
  onPick: (p) => {
    lastPick = p
    if (p?.type === 'facility') say(`시설 ${p.id} ${nameOf(p.id)}${p.role ? ` 역할 ${p.role}` : ''}${p.floors ? ` 지상 ${p.floors}층` : ''}`)
    else if (p?.type === 'building') say(`일반 건물 ${p.buildingId} 지상 ${p.floors}층 높이 ${p.heightM}m`)
    else say('빈 곳')
  },
  onQuality: (q) => say(`등급 자동 조절 ${q.level} (${q.fps}fps)`),
  onReady: () => { say('지형과 건물 준비 완료'); map.setFacilities(sample.facilities) }
})
window.map = map

let lastPick = null
const nameOf = (id) => sample.facilities.find((f) => f.id === id)?.name || id
let msg = ''
function say(s) { msg = s; draw() }
function draw() {
  const st = map.stats()
  out.innerHTML = `fps ${st.fps} / 드로우콜 ${st.calls} / 삼각형 ${(st.triangles / 1000).toFixed(0)}k<br>`
    + `역할 판 ${st.plates}개 / 층 슬래브 ${st.slabs}개<br>`
    + `등급 ${st.quality} (${st.qualityMode}) / 보기 ${st.viewMode}<br>`
    + `태양 고도 ${st.sun.altitudeDeg.toFixed(1)}도 방위 ${st.sun.azimuthDeg.toFixed(1)}도<br>`
    + `<span style="color:#9aa2aa">${msg}</span>`
}
setInterval(draw, 500)

// 역할 9종 필터 단추
const roleBox = document.getElementById('roles')
const active = new Set()
for (const id of ROLE_ORDER) {
  const b = document.createElement('button')
  b.textContent = ROLE_LABEL[id]
  b.style.borderLeft = `6px solid ${ROLE_COLOR[id]}`
  b.onclick = () => {
    if (active.has(id)) active.delete(id)
    else active.add(id)
    b.style.background = active.has(id) ? '#1e2124' : '#e6e8ea'
    b.style.color = active.has(id) ? '#ffffff' : '#1e2124'
    map.setRoleFilter([...active])
    say(active.size ? `역할 필터 ${[...active].join(', ')}` : '역할 필터 해제')
  }
  roleBox.appendChild(b)
}

const schoolId = sample.facilities.find((f) => /학교/.test(f.name))?.id
const shelterId = sample.facilities.find((f) => f.name === '이로경로당')?.id || sample.facilities[0].id
const adminId = sample.facilities.find((f) => f.type === '행정복지센터')?.id || shelterId

// 확인용 대상 고르기. tall 은 짝지어진 건물의 층수가 가장 많은 시설, base 는 이름에 지하 단서가 있는 시설이다
function pickFacility(kind) {
  let best = null
  for (const [fid, link] of map.facilityBuilding) {
    const B = map.buildingMeshes.get(link.code)
    if (!B) continue
    const f = sample.facilities.find((x) => x.id === fid)
    const fl = B.info[link.bi * 5 + 2] || Math.round((B.info[link.bi * 5 + 4] || 3.2) / 3.2)
    if (kind === 'base' && !/지하/.test(`${f?.name || ''}${(f?.roles || []).map((r) => r.subLabel).join('')}`)) continue
    if (!best || fl > best.fl) best = { fid, fl }
  }
  return best?.fid || shelterId
}

const acts = {
  region: () => { map.clearFocus(); say('동해 전역 조감') },
  school: () => { map.focusFacility(schoolId); say(`학교 근접 ${nameOf(schoolId)}`) },
  shelter: () => { map.focusFacility(shelterId); say(`${nameOf(shelterId)} 근접`) },
  clear: () => { map.clearFocus(); say('전역 복귀') },
  t0: () => { map.setTime(Date.parse('2026-07-01T12:00:00+09:00')); say('2026년 7월 1일. 공사 전') },
  t1: () => { map.setTime(Date.parse('2026-09-20T12:00:00+09:00')); say('2026년 9월 20일. 공사 구간 역할 소등') },
  t2: () => { map.setTime(Date.parse('2026-12-01T12:00:00+09:00')); say('2026년 12월 1일. 공사 뒤') },
  alt: () => {
    const links = []
    for (const f of sample.facilities) {
      for (const a of f.alternatives || []) links.push({ fromId: f.id, toId: a.facilityId, role: a.role })
      if (links.length > 40) break
    }
    say(`대체 시설 호 ${map.showAlternatives(links)}개`)
  },
  altoff: () => { map.showAlternatives([]); say('호 지움') },
  'h-none': () => say(`특보 ${JSON.stringify(map.setHazard('none'))}`),
  'h-cold': () => say(`특보 ${JSON.stringify(map.setHazard('cold'))}`),
  'h-rain': () => say(`특보 ${JSON.stringify(map.setHazard('rain'))}`),
  'h-tsunami': () => say(`특보 ${JSON.stringify(map.setHazard('tsunami'))} 시연 연출`),
  'sun-dawn': () => say(`태양 ${JSON.stringify(map.setSunDate(new Date('2026-10-19T07:10:00+09:00')))}`),
  'sun-day': () => say(`태양 ${JSON.stringify(map.setSunDate(new Date('2026-10-19T12:00:00+09:00')))}`),
  'sun-dusk': () => say(`태양 ${JSON.stringify(map.setSunDate(new Date('2026-10-19T16:40:00+09:00')))}`),
  'q-auto': () => say(`품질 ${map.setQuality('auto')}`),
  'q-high': () => say(`품질 ${map.setQuality('high')}`),
  'q-medium': () => say(`품질 ${map.setQuality('medium')}`),
  'q-low': () => say(`품질 ${map.setQuality('low')}`),
  'q-info': () => { const q = map.getQuality(); say(`${q.reason} / 지금 ${q.level}`) },
  'x-tall': () => say(`층 분리 ${JSON.stringify(map.explodeBuilding(pickFacility('tall')))}`),
  'x-base': () => say(`층 분리 ${JSON.stringify(map.explodeBuilding(pickFacility('base')))}`),
  'x-last': () => {
    const key = lastPick?.buildingId || lastPick?.id
    say(key ? `층 분리 ${JSON.stringify(map.explodeBuilding(key))}` : '먼저 건물을 집는다')
  },
  'x-off': () => say(`다시 합치기 ${map.collapseBuilding()}`),
  'v-3d': () => say(`보기 ${map.setViewMode('3d')}`),
  'v-2d': () => say(`보기 ${map.setViewMode('2d')}`),
  thumb: async () => {
    const id = lastPick?.id || map.focusId || shelterId
    const url = await map.renderThumbnail(id, { width: 488, height: 300 })
    const img = document.getElementById('thumb')
    if (url) { img.src = url; img.style.display = 'block'; say(`대표 이미지 ${nameOf(id)} ${Math.round(url.length / 1024)}KB`) }
    else say('대표 이미지를 만들지 못했다')
  },
  ao: () => say(`AO ${map.setAmbientOcclusion(!map.aoWanted) ? '켜짐' : '꺼짐'}`)
}

for (const b of document.querySelectorAll('#panel button[data-act]')) {
  b.onclick = () => acts[b.dataset.act]?.()
}
