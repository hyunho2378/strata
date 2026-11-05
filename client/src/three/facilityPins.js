// facilityPins.js 공공시설 분류 아이콘 핀과 이름 라벨. 밝은 바탕 지도 위에서 시설 종류가 먼저 읽히게 한다.
// 핀은 CSS2D 로 그린다. 아이콘은 외부 파일 없이 여기서 만든 단순 SVG 다.
// 화면 좌표 겹침을 검사해 우선순위가 낮은 핀부터 숨긴다. 등급별 라벨 상한을 지킨다.
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { ROLE_COLOR } from './palette.js'

// 분류별 색과 아이콘. 색은 역할 색 체계를 따른다
const KIND = {
  school: { label: '학교', color: ROLE_COLOR.evac, path: 'M3 10 12 5l9 5-9 5zM6 12v5c0 1 3 2 6 2s6-1 6-2v-5' },
  senior: { label: '경로당', color: ROLE_COLOR.care, path: 'M12 4a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 4zM8.5 20v-5l-1.6 1.4M15.5 20v-5l1.6 1.4M9.4 10h5.2l1.2 4H8.2z' },
  medical: { label: '병원', color: ROLE_COLOR.medical, path: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z' },
  admin: { label: '행정', color: ROLE_COLOR.admin, path: 'M3 10 12 4l9 6M5 10v9M19 10v9M9 19v-6h6v6M3 20h18' },
  sports: { label: '체육', color: ROLE_COLOR.sports, path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M3 12h18' },
  evac: { label: '대피', color: ROLE_COLOR.housing, path: 'M12 3 4 6v6c0 4.4 3.3 8.2 8 9 4.7-.8 8-4.6 8-9V6zM9 12l2.2 2.4L15.5 10' },
  water: { label: '급수', color: ROLE_COLOR.water, path: 'M12 3c3.6 4.2 5.6 7.2 5.6 9.6A5.6 5.6 0 0 1 12 18.2a5.6 5.6 0 0 1-5.6-5.6C6.4 10.2 8.4 7.2 12 3z' },
  safety: { label: '안전', color: ROLE_COLOR.transit, path: 'M12 3 3 7v5c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7zM12 8v5M12 16v.1' },
  care: { label: '돌봄', color: ROLE_COLOR.shelter, path: 'M12 20S4 15 4 9.6A4.1 4.1 0 0 1 12 7a4.1 4.1 0 0 1 8 2.6C20 15 12 20 12 20z' }
}

// 시설 유형과 역할로 분류를 고른다. 유형이 먼저고, 유형이 모호하면 역할을 본다
export function pinKind(f) {
  const t = f?.type || ''
  if (t === '학교') return 'school'
  if (t === '경로당') return 'senior'
  if (t === '의료기관' || t === '약국') return 'medical'
  if (t === '행정복지센터') return 'admin'
  if (t === '체육시설') return 'sports'
  if (t === '경찰' || t === '소방') return 'safety'
  if (t === '복지시설') return 'care'
  const roles = new Set((f?.roles || []).map((r) => r.role))
  if (roles.has('water')) return 'water'
  if (roles.has('medical')) return 'medical'
  if (roles.has('sports')) return 'sports'
  if (roles.has('care')) return 'care'
  return 'evac'
}

function pinElement(kind, name, onClick) {
  const wrap = document.createElement('div')
  Object.assign(wrap.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', pointerEvents: 'none', transform: 'translateY(-10px)' })
  const K = KIND[kind] || KIND.evac
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = `${name} ${K.label}`
  btn.setAttribute('aria-label', `${name} ${K.label}`)
  Object.assign(btn.style, {
    width: '26px', height: '26px', padding: '0', border: '2px solid #ffffff', borderRadius: '8px',
    background: K.color, cursor: 'pointer', pointerEvents: 'auto', display: 'grid', placeItems: 'center',
    boxShadow: '0 2px 5px rgba(16,24,32,0.3)'
  })
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${K.path}"/></svg>`
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick?.() })
  const tail = document.createElement('span')
  Object.assign(tail.style, { width: '0', height: '0', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #ffffff', marginTop: '-1px' })
  const lab = document.createElement('span')
  lab.textContent = name
  Object.assign(lab.style, {
    font: '700 11px/1.2 Pretendard, system-ui, sans-serif', color: '#1e2124', whiteSpace: 'nowrap',
    textShadow: '0 0 3px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,0.9)'
  })
  wrap.append(btn, tail, lab)
  return { wrap, btn, lab }
}

export default class FacilityPins {
  constructor({ parent, toXZ, heightAt, roofAt, onPick }) {
    this.toXZ = toXZ
    this.heightAt = heightAt
    this.roofAt = roofAt
    this.onPick = onPick
    this.items = []
    this.focusId = null
    this.enabled = true
    this.parent = parent
  }

  setFacilities(facilities) {
    this.clear()
    for (const f of facilities || []) {
      if (typeof f.lon !== 'number' || typeof f.lat !== 'number') continue
      const kind = pinKind(f)
      const { wrap, btn, lab } = pinElement(kind, f.name || f.id, () => this.onPick?.({ type: 'facility', id: f.id }))
      const obj = new CSS2DObject(wrap)
      const [x, z] = this.toXZ(f.lon, f.lat)
      const roof = this.roofAt?.(f)
      const y = (typeof roof === 'number' ? roof : this.heightAt(f.lon, f.lat)) + 0.012
      obj.position.set(x, y, z)
      obj.visible = false
      this.parent.add(obj)
      // 우선순위: 역할이 많은 시설과 공공 운영 시설이 먼저 보인다
      const prio = (f.roles?.length || 0) * 10 + (kind === 'admin' || kind === 'medical' ? 25 : kind === 'school' ? 18 : 6)
      this.items.push({ id: f.id, obj, wrap, btn, lab, prio, kind, name: f.name || f.id, x, z, y })
    }
    return this.items.length
  }

  setFocus(id) {
    this.focusId = id || null
    for (const it of this.items) {
      const on = it.id === this.focusId
      it.btn.style.transform = on ? 'scale(1.18)' : 'scale(1)'
      it.btn.style.boxShadow = on ? '0 0 0 3px rgba(23,66,158,0.35), 0 2px 6px rgba(16,24,32,0.35)' : '0 2px 5px rgba(16,24,32,0.3)'
      it.lab.style.fontWeight = on ? '800' : '700'
    }
  }

  setEnabled(on) {
    this.enabled = !!on
    if (!on) for (const it of this.items) it.obj.visible = false
  }

  // 화면 좌표 겹침 정리. taken 은 이미 다른 라벨이 차지한 사각형 목록이다
  update(camera, W, H, { maxLabels = 24, cameraDist = 3, taken = [], vec } = {}) {
    if (!this.enabled || !this.items.length) return 0
    const v = vec
    const cand = []
    for (const it of this.items) {
      // 멀리서는 역할이 많은 시설만, 가까이서는 모두 후보가 된다
      const minPrio = cameraDist > 6 ? 30 : cameraDist > 3 ? 16 : 0
      if (it.prio < minPrio) { it.obj.visible = false; continue }
      v.set(it.x, it.y, it.z).project(camera)
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { it.obj.visible = false; continue }
      cand.push({ it, x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H })
    }
    cand.sort((a, b) => (b.it.id === this.focusId ? 1 : 0) - (a.it.id === this.focusId ? 1 : 0) || b.it.prio - a.it.prio)
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    let shown = 0
    for (const c of cand) {
      if (shown >= maxLabels) { c.it.obj.visible = false; continue }
      const w = Math.max(30, c.it.name.length * 11 + 10)
      const r = { x: c.x - w / 2, y: c.y - 30, w, h: 52 }
      const clash = taken.some((t) => overlap(r, t))
      c.it.obj.visible = !clash
      if (!clash) { taken.push(r); shown += 1 }
    }
    return shown
  }

  clear() {
    for (const it of this.items) { it.obj.parent?.remove(it.obj); it.wrap.remove() }
    this.items = []
  }

  dispose() { this.clear() }
}

export { KIND }
