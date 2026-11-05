// hazard.js 특보 연출. 한파는 차가운 하늘과 눈 입자, 호우는 비 입자와 젖은 노면, 해일은 해안과 연결된 저지대 침수면이다.
// 침수 수위는 상수로 둔 시연 연출이다. 해일 전파 물리해석이나 공식 예측이 아니다.
// 침수 영역은 바다 셀에서 시작한 연결 판정으로 만들고 내륙의 고립된 저지대는 잠기지 않는다.
import * as THREE from 'three'
import { RENDER } from './palette.js'

// 시연용 정수위(해발 m). 실제 예측 수위가 아니다
export const TSUNAMI_LEVEL_M = 6

const PRECIP_COUNT = 9000

function makePrecip({ kind }) {
  const n = PRECIP_COUNT
  const pos = new Float32Array(n * 3)
  const seed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = Math.random() * 2 - 1
    pos[i * 3 + 1] = Math.random()
    pos[i * 3 + 2] = Math.random() * 2 - 1
    seed[i] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const uniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(1.2, 0.5, 1.2) },  // 카메라 주변만 채운다(km)
    uSize: { value: kind === 'rain' ? 1.6 : 2.6 },
    uFall: { value: kind === 'rain' ? 0.62 : 0.085 },
    uSway: { value: kind === 'rain' ? 0.004 : 0.03 },
    uColor: { value: new THREE.Color(kind === 'rain' ? '#cfdbe6' : '#ffffff') },
    uOpacity: { value: kind === 'rain' ? 0.5 : 0.85 },
    uStretch: { value: kind === 'rain' ? 5.5 : 1 }
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime; uniform vec3 uCenter; uniform vec3 uBox;
      uniform float uSize; uniform float uFall; uniform float uSway;
      varying float vA;
      void main() {
        vec3 p = position;
        float y = fract(p.y - uTime * uFall * (0.7 + aSeed * 0.6));
        vec3 w = uCenter + vec3(p.x * uBox.x, y * uBox.y, p.z * uBox.z);
        w.x += sin(uTime * 1.3 + aSeed * 12.0) * uSway;
        w.z += cos(uTime * 1.1 + aSeed * 9.0) * uSway;
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (1.0 + aSeed * 0.8) * (300.0 / max(0.2, -mv.z)) * 0.08;
        vA = 0.45 + 0.55 * aSeed;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; uniform float uStretch;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        c.y /= uStretch;
        float d = length(c);
        float a = (1.0 - smoothstep(0.18, 0.5, d)) * uOpacity * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  pts.renderOrder = 8
  return { points: pts, uniforms }
}

export default class Hazard {
  constructor({ parent, dem, meta, toXZ, exag = 1 }) {
    this.group = new THREE.Group()
    this.group.name = 'hazard'
    parent.add(this.group)
    this.dem = dem
    this.meta = meta
    this.toXZ = toXZ
    this.exag = exag
    this.kind = 'none'
    this.snow = null
    this.rain = null
    this.flood = null
  }

  setDem(dem, meta) { this.dem = dem; this.meta = meta }

  set(kind) {
    this.kind = kind || 'none'
    if (this.kind === 'cold') {
      if (!this.snow) { this.snow = makePrecip({ kind: 'snow' }); this.group.add(this.snow.points) }
    } else if (this.snow) { this.group.remove(this.snow.points); this.snow.points.geometry.dispose(); this.snow.points.material.dispose(); this.snow = null }

    if (this.kind === 'rain') {
      if (!this.rain) { this.rain = makePrecip({ kind: 'rain' }); this.group.add(this.rain.points) }
    } else if (this.rain) { this.group.remove(this.rain.points); this.rain.points.geometry.dispose(); this.rain.points.material.dispose(); this.rain = null }

    if (this.kind === 'tsunami') this.buildFlood(TSUNAMI_LEVEL_M)
    else this.clearFlood()
    return this.kind
  }

  clearFlood() {
    if (!this.flood) return
    this.group.remove(this.flood)
    this.flood.geometry.dispose()
    this.flood.material.dispose()
    this.flood = null
  }

  // 바다에서 연결된 저지대만 잠기는 침수면. 수위는 상수(시연 연출)
  buildFlood(levelM) {
    this.clearFlood()
    if (!this.dem || !this.meta) return null
    const { bbox, cols, rows } = this.meta
    const [w, s, e, n] = bbox
    const step = 2                        // DEM 두 칸마다 한 셀. 격자 450 x 575 수준
    const C = Math.floor(cols / step)
    const R = Math.floor(rows / step)
    const data = this.dem.data
    const elev = new Float32Array(C * R)
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) elev[r * C + c] = data[(r * step) * cols + c * step]
    }
    // 바다 셀에서 시작한 너비 우선 탐색. 수위 아래이고 바다와 이어진 셀만 침수로 본다
    const flooded = new Uint8Array(C * R)
    const q = []
    for (let r = 0; r < R; r++) { const i = r * C + C - 1; if (elev[i] <= 0.5) { flooded[i] = 1; q.push(i) } }
    let head = 0
    while (head < q.length) {
      const i = q[head++]
      const c = i % C, r = (i - c) / C
      const nb = [c > 0 ? i - 1 : -1, c < C - 1 ? i + 1 : -1, r > 0 ? i - C : -1, r < R - 1 ? i + C : -1]
      for (const j of nb) {
        if (j < 0 || flooded[j]) continue
        if (elev[j] < levelM) { flooded[j] = 1; q.push(j) }
      }
    }
    // 격자 셀을 하나의 수평면 메쉬로 만든다. 지형과 건물에 가려지도록 깊이 검사를 켠다
    const dLon = (e - w) / (cols - 1) * step
    const dLat = (n - s) / (rows - 1) * step
    const pos = []
    const dep = []
    const y = (levelM / 1000) * this.exag
    for (let r = 0; r < R - 1; r++) {
      for (let c = 0; c < C - 1; c++) {
        const i = r * C + c
        if (!flooded[i] || elev[i] > levelM) continue
        const lon0 = w + c * dLon, lat0 = n - r * dLat
        const [x0, z0] = this.toXZ(lon0, lat0)
        const [x1, z1] = this.toXZ(lon0 + dLon, lat0 - dLat)
        const d = Math.max(0, levelM - Math.max(0, elev[i]))
        pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1)
        for (let k = 0; k < 6; k++) dep.push(d)
      }
    }
    if (!pos.length) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1))
    geo.computeBoundingSphere()
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(RENDER.floodTint) },
        uTime: { value: 0 },
        uLevel: { value: levelM }
      },
      vertexShader: /* glsl */`
        attribute float aDepth;
        varying float vD; varying vec3 vW;
        void main() {
          vD = aDepth; vW = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uColor; uniform float uTime;
        varying float vD; varying vec3 vW;
        void main() {
          float deep = clamp(vD / 5.0, 0.0, 1.0);
          float ripple = sin(vW.x * 180.0 + uTime * 2.2) * 0.5 + 0.5;
          ripple *= sin(vW.z * 150.0 - uTime * 1.7) * 0.5 + 0.5;
          vec3 col = mix(vec3(0.42, 0.66, 0.74), uColor, deep);
          col += ripple * 0.06;
          // 얕은 가장자리는 투명하게 두어 침수 경계가 읽히게 한다
          float a = 0.34 + 0.5 * deep;
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = 5
    this.flood = mesh
    this.group.add(mesh)
    return mesh
  }

  update(now, center) {
    const t = now / 1000
    let busy = false
    for (const p of [this.snow, this.rain]) {
      if (!p) continue
      p.uniforms.uTime.value = t
      if (center) p.uniforms.uCenter.value.copy(center).add(new THREE.Vector3(0, -0.05, 0))
      busy = true
    }
    if (this.flood) { this.flood.material.uniforms.uTime.value = t; busy = true }
    return busy
  }

  dispose() {
    this.clearFlood()
    this.set('none')
    this.group.parent?.remove(this.group)
  }
}
