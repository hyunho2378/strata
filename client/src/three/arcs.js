// arcs.js 대체 시설 호. 같은 역할 색의 베지어 튜브를 띄우고 0.8초 동안 진행광이 도착한다.
// 호는 대체 후보의 관계를 뜻한다. 실제 도로 경로와 이동 시간이 아니다.
import * as THREE from 'three'
import { ROLE_COLOR } from './palette.js'

const RUN_MS = 800

const VERT = /* glsl */`
  varying float vT;
  varying vec3 vNormalW;
  void main() {
    vT = uv.x;
    vNormalW = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  precision highp float;
  varying float vT;
  varying vec3 vNormalW;
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uOpacity;
  void main() {
    // 진행광: 앞쪽 좁은 띠가 밝고 지나간 자리는 색만 남는다
    float head = 1.0 - smoothstep(0.0, 0.085, abs(vT - uProgress));
    float trail = smoothstep(uProgress - 0.5, uProgress, vT) * step(vT, uProgress);
    float shade = 0.55 + 0.45 * abs(vNormalW.y);
    vec3 col = uColor * shade + vec3(1.0) * head * 0.85;
    float a = uOpacity * (0.42 + 0.5 * trail + head * 0.6);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`

export default class Arcs {
  constructor({ parent }) {
    this.group = new THREE.Group()
    this.group.name = 'alternativeArcs'
    parent.add(this.group)
    this.list = []
    this.cache = new Map()
  }

  clear() {
    for (const a of this.list) {
      this.group.remove(a.mesh)
      a.mesh.geometry.dispose()
      a.mesh.material.dispose()
    }
    this.list = []
  }

  // links: [{ fromId, toId, role, from: Vector3, to: Vector3 }]
  show(links, now = performance.now()) {
    this.clear()
    for (const L of links) {
      if (!L.from || !L.to) continue
      const key = `${L.fromId}>${L.toId}:${L.role}`
      let curve = this.cache.get(key)
      if (!curve) {
        const mid = L.from.clone().add(L.to).multiplyScalar(0.5)
        const span = L.from.distanceTo(L.to)
        // 최고점은 양끝 거리에 비례한다. 지면에 붙지 않도록 최소 높이를 둔다
        mid.y = Math.max(L.from.y, L.to.y) + Math.max(0.09, span * 0.32)
        curve = new THREE.QuadraticBezierCurve3(L.from.clone(), mid, L.to.clone())
        this.cache.set(key, curve)
      }
      const geo = new THREE.TubeGeometry(curve, 72, Math.max(0.004, curve.v0.distanceTo(curve.v2) * 0.012), 10, false)
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(ROLE_COLOR[L.role] || '#2574f5') },
          uProgress: { value: 0 },
          uOpacity: { value: 0.95 }
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = 6
      this.group.add(mesh)
      this.list.push({ mesh, mat, t0: now })
    }
    return this.list.length
  }

  update(now) {
    let busy = false
    for (const a of this.list) {
      const k = Math.min(1.15, (now - a.t0) / RUN_MS)
      a.mat.uniforms.uProgress.value = k
      if (k < 1.15) busy = true
    }
    return busy
  }

  dispose() { this.clear(); this.group.parent?.remove(this.group) }
}
