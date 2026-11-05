// roleLayers.js 시설 지붕 위에 쌓는 역할 층. 계약서 2장의 역할 9종 순서를 고정 자리로 쓴다.
// 역할을 가진 자리만 판을 채우고 없는 역할은 빈 자리로 남겨 자리 자체가 읽히게 만든다.
// 판은 무광 도자기 느낌의 둥근 사각형이고, 판 사이에 실제 간격과 접촉 음영을 둔다.
// 층 높이는 건물 층수를 뜻하지 않는다. 판 하나가 역할 하나다.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { ROLE_COLOR, ROLE_ORDER, roleIndex } from './palette.js'

const MAX = 4096          // 판 최대 개수(시설 약 450곳 x 평균 2.5역할 여유)
const PLATE = 0.055       // 판 한 변(km). 줌 보정 전 기준값
const THICK = 0.009       // 판 두께(km)
const GAP = 0.0075        // 판 사이 빈 간격(km)
const SLOT = THICK + GAP

const FADE_MS = 400       // 소등과 점등 페이드(계약서 4항)
const BLINK_MS = 900      // 확인 필요 상태의 깜박임 1회

const toColor = (hex) => new THREE.Color(hex)

function patchPlateMaterial(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSlot;
        attribute float aAlpha;
        attribute float aGlow;
        uniform float uPlateScale;
        uniform float uSlotY;
        varying float vAlpha;
        varying float vGlow;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAlpha = aAlpha;
        vGlow = aGlow;
        transformed *= uPlateScale;
        transformed.y += (aSlot + 0.65) * uSlotY * uPlateScale;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vAlpha;
        varying float vGlow;`)
      // 측면에만 얇은 발광 테두리를 둔다. 활성 판만 켜진다
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rim = 1.0 - smoothstep(0.22, 0.62, abs(vNormal.y));
        totalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.03 + 0.65 * rim);`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor.a *= vAlpha;`)
  }
  mat.customProgramCacheKey = () => 'strata-role-plate'
  return mat
}

export default class RoleLayers {
  constructor({ parent, heightAt, toXZ, roofOffset = 0.004, roofAt = null }) {
    this.heightAt = heightAt
    this.toXZ = toXZ
    this.roofOffset = roofOffset
    // 시설 좌표에 해당하는 실제 건물 지붕 높이. 찾지 못하면 지형 높이로 돌아간다
    this.roofAt = roofAt
    this.facilities = []
    this.items = []            // { facilityId, role, slot, index, base, target, cur }
    this.byFacility = new Map()
    this.filter = null
    this.timeMs = null
    this.focusId = null
    this.plateScale = 1
    this.needsAttr = false
    this.anim = []

    this.group = new THREE.Group()
    this.group.name = 'roleLayers'
    parent.add(this.group)

    this.uniforms = {
      uPlateScale: { value: 1 },
      uSlotY: { value: SLOT }
    }

    const geo = new RoundedBoxGeometry(PLATE, THICK, PLATE, 1, THICK * 0.45)
    const mat = patchPlateMaterial(new THREE.MeshStandardMaterial({
      roughness: 0.52, metalness: 0, transparent: true, depthWrite: true
    }), this.uniforms)
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.userData.roleLayers = this
    this.group.add(this.mesh)

    // 접촉 음영. 판보다 조금 넓은 어두운 면을 바로 아래에 둔다
    const shGeo = new RoundedBoxGeometry(PLATE * 1.04, THICK * 0.28, PLATE * 1.04, 1, THICK * 0.12)
    const shMat = patchPlateMaterial(new THREE.MeshStandardMaterial({
      color: 0x0b0e12, roughness: 1, metalness: 0, transparent: true, opacity: 0.5, depthWrite: false
    }), { uPlateScale: this.uniforms.uPlateScale, uSlotY: this.uniforms.uSlotY })
    this.contact = new THREE.InstancedMesh(shGeo, shMat, MAX)
    this.contact.count = 0
    this.contact.frustumCulled = false
    this.contact.renderOrder = -1
    this.group.add(this.contact)

    this.aSlot = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1)
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1)
    this.aGlow = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1)
    geo.setAttribute('aSlot', this.aSlot)
    geo.setAttribute('aAlpha', this.aAlpha)
    geo.setAttribute('aGlow', this.aGlow)
    this.cSlot = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1)
    this.cAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1)
    this.cGlow = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1)
    shGeo.setAttribute('aSlot', this.cSlot)
    shGeo.setAttribute('aAlpha', this.cAlpha)
    shGeo.setAttribute('aGlow', this.cGlow)
  }

  // ---------- 구성 ----------
  setFacilities(facilities) {
    this.facilities = Array.isArray(facilities) ? facilities : []
    this.items = []
    this.byFacility = new Map()
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    const pos = new THREE.Vector3()
    let i = 0
    for (const f of this.facilities) {
      if (typeof f.lon !== 'number' || typeof f.lat !== 'number') continue
      const [x, z] = this.toXZ(f.lon, f.lat)
      const roof = this.roofAt ? this.roofAt(f) : null
      const y = (typeof roof === 'number' ? roof : this.heightAt(f.lon, f.lat)) + this.roofOffset
      const list = []
      // 역할 하나에 판 하나다. 세부 기능(한파와 무더위가 다른 줄로 온 경우)은 같은 자리에 합친다
      const seen = new Map()
      for (const r of Array.isArray(f.roles) ? f.roles : []) {
        if (roleIndex(r.role) < 0) continue
        const prev = seen.get(r.role)
        if (prev) { if (r.cap) prev.cap = (prev.cap || 0) + r.cap; continue }
        seen.set(r.role, { role: r.role, cap: r.cap || null })
      }
      const roles = [...seen.values()]
      for (const r of roles) {
        const slot = roleIndex(r.role)
        if (slot < 0 || i >= MAX) continue
        pos.set(x, y, z)
        m.compose(pos, q, s)
        this.mesh.setMatrixAt(i, m)
        this.contact.setMatrixAt(i, m)
        const color = toColor(ROLE_COLOR[r.role])
        this.mesh.setColorAt(i, color)
        this.aSlot.setX(i, slot)
        this.cSlot.setX(i, slot)
        const it = { index: i, facilityId: f.id, role: r.role, slot, color, cap: r.cap ?? null, alpha: 1, glow: 0, aT: 1, gT: 0, blinkUntil: 0 }
        this.items.push(it)
        list.push(it)
        i += 1
      }
      this.byFacility.set(f.id, { facility: f, items: list, x, z, y })
    }
    this.mesh.count = i
    this.contact.count = i
    this.mesh.instanceMatrix.needsUpdate = true
    this.contact.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
    this.aSlot.needsUpdate = true
    this.cSlot.needsUpdate = true
    this.applyState(true)
  }

  setRoleFilter(roleIds) {
    this.filter = Array.isArray(roleIds) && roleIds.length ? new Set(roleIds) : null
    this.applyState()
  }

  setTime(ms) {
    this.timeMs = typeof ms === 'number' ? ms : null
    this.applyState()
  }

  setFocus(id) {
    this.focusId = id || null
    this.applyState()
  }

  // 역할 층의 목표 상태. 상태 status 와 이벤트 구간과 역할 필터를 한 함수에서 계산한다
  applyState(instant = false) {
    const now = performance.now()
    for (const entry of this.byFacility.values()) {
      const f = entry.facility
      const closed = f.status === 'closed'
      const check = f.status === 'check'
      const offRoles = new Set()
      if (this.timeMs != null) {
        for (const ev of f.events || []) {
          const a = ev.start ? Date.parse(`${ev.start}T00:00:00+09:00`) : null
          const b = ev.end ? Date.parse(`${ev.end}T23:59:59+09:00`) : null
          if (a != null && this.timeMs < a) continue
          if (b != null && this.timeMs > b) continue
          if (a == null && b == null) continue
          for (const r of ev.roles || []) offRoles.add(r)
        }
      }
      for (const it of entry.items) {
        const hidden = this.filter && !this.filter.has(it.role)
        const off = closed || offRoles.has(it.role)
        // 운영 중단은 판을 내려앉히지 않고 빈 자리로 남긴다. 채도를 빼고 투명도를 낮춘다
        let alpha = off ? 0.22 : hidden ? 0.05 : 1
        let glow = off || hidden ? 0 : this.focusId && this.focusId === it.facilityId ? 0.85 : 0.3
        const target = off ? it.color.clone().lerp(new THREE.Color(0x9aa2aa), 0.9) : it.color
        it.c0 = new THREE.Color(); this.mesh.getColorAt(it.index, it.c0)
        it.cT = target.clone(); it.fadeAt = now; it.a0 = it.alpha; it.g0 = it.glow
        it.aT = alpha
        it.gT = glow
        if (check && !off && !hidden && !it.checkSeen) { it.blinkUntil = now + BLINK_MS; it.checkSeen = true }
        if (instant) { it.alpha = alpha; it.glow = glow; this.mesh.setColorAt(it.index, target); it.fadeAt = now - FADE_MS }
      }
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
    this.needsAttr = true
    this.writeAttr()
  }

  writeAttr() {
    for (const it of this.items) {
      this.aAlpha.setX(it.index, it.alpha)
      this.aGlow.setX(it.index, it.glow)
      this.cAlpha.setX(it.index, it.alpha * 0.9)
      this.cGlow.setX(it.index, 0)
    }
    this.aAlpha.needsUpdate = true
    this.aGlow.needsUpdate = true
    this.cAlpha.needsUpdate = true
    this.cGlow.needsUpdate = true
  }

  // 매 프레임. 페이드와 깜박임만 CPU 에서 보간하고 행렬은 다시 쓰지 않는다
  update(now, cameraDist) {
    // 줌 보정: 멀리서도 판이 읽히게 키우고 가까이서는 실제 크기에 가깝게 줄인다
    // 가까이에서는 건물 지붕에 얹히는 크기로, 멀어지면 읽힐 만큼만 키운다
    const want = Math.max(0.3, Math.min(2.0, cameraDist * 0.22))
    if (Math.abs(want - this.plateScale) > 0.004) {
      this.plateScale += (want - this.plateScale) * 0.2
      this.uniforms.uPlateScale.value = this.plateScale
    }
    let busy = false
    const tmp = new THREE.Color()
    for (const it of this.items) {
      const k = Math.min(1, Math.max(0, (now - it.fadeAt) / FADE_MS))
      let a = it.aT
      let g = it.gT
      if (k < 1) {
        it.alpha = it.a0 + (it.aT - it.a0) * k; it.glow = it.g0 + (it.gT - it.g0) * k
        this.mesh.setColorAt(it.index, tmp.copy(it.c0).lerp(it.cT, k)); this.mesh.instanceColor.needsUpdate = true; busy = true
      } else { it.alpha = it.aT; it.glow = it.gT; if (it.cT) this.mesh.setColorAt(it.index, it.cT) }
      if (it.blinkUntil > now) {
        const p = 1 - (it.blinkUntil - now) / BLINK_MS
        g = it.gT + Math.sin(p * Math.PI) * 1.4
        busy = true
      }
      if (it.blinkUntil > now) it.glow = g
    }
    if (busy) this.writeAttr()
    return busy
  }

  // 판 집기. 교차한 인스턴스를 시설 id 로 돌려준다
  pick(raycaster) {
    if (!this.mesh.count) return null
    let best = null, bestD = Infinity
    for (const it of this.items) {
      if (it.alpha < 0.1) continue
      const pt = this.slotPosition(it.facilityId, it.role)
      const d = raycaster.ray.distanceToPoint(pt)
      if (d < PLATE * this.plateScale * 0.8 && d < bestD) { bestD = d; best = { facilityId: it.facilityId, role: it.role, point: pt } }
    }
    if (best) return best
    return null
  }

  facilityAt(id) { return this.byFacility.get(id) || null }

  roleStack(id) {
    const e = this.byFacility.get(id)
    return e ? e.items.map((it) => ({ role: it.role, slot: it.slot, alpha: it.alpha })) : []
  }

  // 역할 자리의 세계 좌표. 대체 호의 시작과 끝으로 쓴다
  slotPosition(id, role) {
    const e = this.byFacility.get(id)
    if (!e) return null
    const slot = roleIndex(role)
    const s = this.plateScale
    return new THREE.Vector3(e.x, e.y + (slot + 0.65) * SLOT * s, e.z)
  }

  dispose() {
    this.group.parent?.remove(this.group)
    this.mesh.geometry.dispose(); this.mesh.material.dispose()
    this.contact.geometry.dispose(); this.contact.material.dispose()
  }
}

export { ROLE_ORDER, PLATE, SLOT }
