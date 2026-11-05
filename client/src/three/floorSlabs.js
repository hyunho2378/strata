// floorSlabs.js 건물 한 동을 층 단위 슬래브로 나눠 위아래로 벌려 보여 준다.
// 길이 단위는 km 다(proj.js 와 같다). 층 높이는 3.2m 를 쓴다(buildingBuild.js FLOOR_M 과 같은 값).
//
// 층수 규칙
//   지상층수: 건물 자료(GIS건물통합정보)의 지상층수를 먼저 쓴다. 값이 없으면 건물 높이를 3.2m 로 나눠 반올림하고 최소 1층으로 둔다.
//   지하층수: 건물 자료에 지하층수 항목이 없다. 그래서 층을 지어내지 않는다.
//             시설 이름이나 역할 원자료 명칭에 '지하 n층' 같은 단서가 있을 때만 그 수만큼 지하 슬래브를 만든다.
//             '지하' 라는 말만 있고 숫자가 없으면 지하 1층으로 둔다. 단서가 전혀 없으면 지하 슬래브는 0개다.
//
// 역할 표식 배치 규칙(공공시설일 때만)
//   역할 원자료 명칭 또는 시설 이름에서 아래 순서로 단서를 찾는다.
//     1) '지하 n층' 또는 'B n' -> 지하 n층 슬래브
//     2) '지상 n층' 또는 'n층'  -> 지상 n층 슬래브
//     3) '지하' 만 있음         -> 지하 1층 슬래브
//     4) 단서 없음              -> 1층 슬래브 옆에 표식만 붙인다(층을 지어내지 않는다)
import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { ROLE_COLOR, ROLE_LABEL } from './palette.js'

export const FLOOR_M = 3.2
const FLOOR_KM = FLOOR_M / 1000
const SLAB_GAP = FLOOR_KM * 1.15   // 벌렸을 때 슬래브 사이 빈 간격(km)

// 명칭에서 층 단서를 읽는다. 돌려주는 값은 { floor, hint } 이고 floor 는 지상 양수, 지하 음수, 단서 없음은 null
// '지하주차장 1층' 처럼 지하와 숫자 사이에 말이 끼어 있는 표기도 지하 층으로 읽는다
export function floorHint(text) {
  const s = String(text || '')
  let m = s.match(/지하[^\d층]{0,6}(\d+)\s*층/)
  if (m) return { floor: -Number(m[1]), hint: m[0] }
  m = s.match(/\bB\s?(\d+)\b/i)
  if (m) return { floor: -Number(m[1]), hint: m[0] }
  m = s.match(/(?:지상\s*)?(\d+)\s*층/)
  if (m) return { floor: Number(m[1]), hint: m[0] }
  if (/지하/.test(s)) return { floor: -1, hint: '지하' }
  return { floor: null, hint: '' }
}

// 건물 자료와 시설 자료로 층 구성을 만든다
export function floorPlan({ name = '', floors = 0, heightM = 0, facility = null } = {}) {
  const above = Math.max(1, floors > 0 ? floors : Math.round((heightM || FLOOR_M) / FLOOR_M))
  const texts = [name, facility?.name || '', ...(facility?.roles || []).map((r) => r.subLabel || '')]
  let below = 0
  for (const t of texts) {
    const h = floorHint(t)
    if (h.floor != null && h.floor < 0) below = Math.max(below, -h.floor)
  }
  const marks = []
  for (const r of facility?.roles || []) {
    if (!ROLE_LABEL[r.role]) continue
    const a = floorHint(r.subLabel)
    const b = floorHint(facility?.name)
    const picked = a.floor != null ? a : b
    const floor = picked.floor != null ? picked.floor : 1
    marks.push({
      role: r.role,
      label: r.subLabel || ROLE_LABEL[r.role],
      floor: Math.max(-Math.max(below, 1), Math.min(above, floor)),
      // 단서가 없으면 1층 슬래브 옆에 붙인 표식이라는 뜻이다
      guessed: picked.floor == null
    })
  }
  return { above, below: Math.max(below, marks.some((m) => m.floor < 0) ? 1 : 0), floorH: FLOOR_KM, marks }
}

const label = (text, kind) => {
  const el = document.createElement('span')
  el.textContent = text
  const base = {
    display: 'inline-flex', alignItems: 'center', height: '20px', padding: '0 7px', borderRadius: '6px',
    font: '700 11px/1 Pretendard, system-ui, sans-serif', whiteSpace: 'nowrap', pointerEvents: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.22)'
  }
  if (kind === 'role') Object.assign(el.style, base, { color: '#ffffff' })
  else Object.assign(el.style, base, { background: 'rgba(255,255,255,0.94)', color: '#1e2124' })
  return el
}

export default class FloorSlabs {
  constructor({ parent }) {
    this.group = new THREE.Group()
    this.group.name = 'floorSlabs'
    this.group.visible = false
    parent.add(this.group)
    this.slabs = []
    this.progress = 0
    this.key = null
    this.plan = null
  }

  get active() { return !!this.key }

  // ring: [[x, z], ...] 건물 지붕 윤곽(km). groundY 는 건물 바닥, roofY 는 지붕 높이
  // plateAt(role) 은 그 시설의 역할 판 위치다. 값이 있으면 판과 층 슬래브를 선으로 잇는다
  show({ key, ring, groundY, roofY, plan, plateAt = null }) {
    this.clear()
    if (!ring?.length || !plan) return 0
    this.key = key
    this.plan = plan
    const shape = new THREE.Shape()
    ring.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)))
    shape.closePath()
    const h = Math.max(0.0008, (roofY - groundY) / plan.above)
    const roleOf = new Map()
    for (const m of plan.marks) {
      const list = roleOf.get(m.floor) || []
      list.push(m)
      roleOf.set(m.floor, list)
    }
    const make = (floor) => {
      const thick = h * 0.82
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 1 })
      geo.rotateX(-Math.PI / 2)
      const marks = roleOf.get(floor) || []
      // 역할이 붙은 층은 그 역할 색을 옅게 섞고, 나머지 층은 중성 회색이다
      const col = marks.length
        ? new THREE.Color('#ffffff').lerp(new THREE.Color(ROLE_COLOR[marks[0].role]), 0.42)
        : new THREE.Color(floor < 0 ? '#c9ced4' : '#eef1f3')
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.78, metalness: 0, flatShading: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 25),
        new THREE.LineBasicMaterial({ color: 0x5a636b, transparent: true, opacity: 0.75 })
      )
      mesh.add(edge)
      const base = floor > 0 ? groundY + (floor - 1) * h : groundY + floor * h
      const order = floor > 0 ? floor - 1 : floor
      const name = floor > 0 ? `${floor}층` : `지하 ${-floor}층`
      const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length
      const cz = ring.reduce((a, p) => a + p[1], 0) / ring.length
      let side = 0.012
      for (const [x] of ring) side = Math.max(side, Math.abs(x - cx) + 0.006)
      // 모든 슬래브에 해당 층 이름표를 단다
      if (true) {
        const lab = new CSS2DObject(label(name, 'floor'))
        lab.position.set(cx + side, thick * 0.5, cz)
        mesh.add(lab)
      }
      for (let k = 0; k < marks.length; k++) {
        const m = marks[k]
        const el = label(m.guessed ? `${m.label} 층 단서 없음` : m.label, 'role')
        el.style.background = ROLE_COLOR[m.role]
        const ro = new CSS2DObject(el)
        // 같은 층에 여러 역할이 붙으면 위로 차례로 쌓는다
        ro.position.set(cx - side, thick * 0.5 + k * 0.009, cz)
        mesh.add(ro)
      }
      this.group.add(mesh)
      this.slabs.push({ mesh, base, order, floor, thick })
    }
    for (let f = plan.below; f >= 1; f--) make(-f)
    for (let f = 1; f <= plan.above; f++) make(f)
    // 역할 판과 그 역할이 속한 층 슬래브를 잇는 선
    this.links = []
    if (plateAt) {
      for (const m of plan.marks) {
        const top = plateAt(m.role)
        const slab = this.slabs.find((s) => s.floor === m.floor)
        if (!top || !slab) continue
        const geo = new THREE.BufferGeometry().setFromPoints([top.clone(), top.clone()])
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(ROLE_COLOR[m.role]), transparent: true, opacity: 0.9 }))
        line.renderOrder = 5
        this.group.add(line)
        this.links.push({ line, top, slab })
      }
    }
    this.group.visible = true
    this.setProgress(0)
    return this.slabs.length
  }

  // k 는 0(붙어 있음) 에서 1(완전히 벌어짐)
  setProgress(k) {
    this.progress = k
    // 지하 슬래브가 지형에 묻히지 않도록 벌리는 동안 전체를 지하층 수만큼 들어 올린다
    const lift = (this.plan?.below || 0) * SLAB_GAP * k
    for (const s of this.slabs) {
      s.mesh.position.y = s.base + s.order * SLAB_GAP * k + lift
      for (const c of s.mesh.children) if (c.isCSS2DObject) c.visible = k > 0.35
    }
    for (const L of this.links || []) {
      const p = L.line.geometry.attributes.position
      p.setXYZ(0, L.top.x, L.top.y, L.top.z)
      p.setXYZ(1, L.top.x, L.slab.mesh.position.y + L.slab.thick, L.top.z)
      p.needsUpdate = true
      L.line.material.opacity = 0.25 + 0.65 * k
    }
  }

  clear() {
    for (const s of this.slabs) {
      s.mesh.traverse((o) => {
        if (o.isCSS2DObject) o.element?.remove()
        o.geometry?.dispose?.()
        o.material?.dispose?.()
      })
      this.group.remove(s.mesh)
    }
    for (const L of this.links || []) { L.line.geometry.dispose(); L.line.material.dispose(); this.group.remove(L.line) }
    this.links = []
    this.slabs = []
    this.group.visible = false
    this.key = null
    this.plan = null
    this.progress = 0
  }

  dispose() {
    this.clear()
    this.group.parent?.remove(this.group)
  }
}
