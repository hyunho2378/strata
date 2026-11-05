// terrainBuild.js 읍면동 한 곳을 지형 조각(윗면과 옆면)으로 만든다. 순수 계산이라 Web Worker 와 Node 에서 같이 쓴다.
// 윗면: 경계를 촘촘히 나눈 점과 안쪽 격자 점을 델로네 삼각분할하고 경계 변을 강제로 지킨 뒤, 바깥에 놓인 삼각형을 걷어낸다.
// 옆면: 경계 고리를 따라 지형 높이에서 바닥까지 세운다. 단면 색은 위가 밝고 아래로 갈수록 짙어진다.
import Delaunator from 'delaunator'
import Constrainautor from '@kninnug/constrainautor'
import { EXAG, toLonLat, toXZ } from './proj.js'

// 고도 격자. data 는 경위도 격자 Float32(m), 위쪽이 북쪽
export function makeDem(data, meta) {
  const [w, s, e, n] = meta.bbox
  const { cols, rows } = meta
  const sample = (lon, lat) => {
    const fx = ((lon - w) / (e - w)) * (cols - 1)
    const fy = ((n - lat) / (n - s)) * (rows - 1)
    const x0 = Math.max(0, Math.min(cols - 2, Math.floor(fx)))
    const y0 = Math.max(0, Math.min(rows - 2, Math.floor(fy)))
    const ax = Math.max(0, Math.min(1, fx - x0))
    const ay = Math.max(0, Math.min(1, fy - y0))
    const i = y0 * cols + x0
    return (data[i] * (1 - ax) + data[i + 1] * ax) * (1 - ay) + (data[i + cols] * (1 - ax) + data[i + cols + 1] * ax) * ay
  }
  return { sample, cols, rows, data, meta }
}

// 바닥 높이(km). 가장 낮은 곳보다 한참 아래에 둔다
export const BASE_Y = -1.1

function pointInRings(x, z, rings) {
  let inside = false
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, zi] = r[i], [xj, zj] = r[j]
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
    }
  }
  return inside
}

// 고리를 spacing(km) 이하 간격으로 다시 나눈다. 마지막 점(첫 점과 같음)은 뺀다
function resample(ring, spacing) {
  const out = []
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[i + 1]
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.ceil(len / spacing))
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n])
  }
  return out
}

// 한 폴리곤(바깥 고리 + 구멍들)의 윗면
export function topOf(poly, spacing) {
  const rings = poly.map((r) => resample(r, spacing))
  const pts = []
  const edges = []
  for (const r of rings) {
    const base = pts.length
    r.forEach((p, i) => { pts.push(p); edges.push([base + i, base + ((i + 1) % r.length)]) })
  }
  const nBoundary = pts.length
  // 안쪽 격자 점. 경계 점과 너무 가까우면 뺀다
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
  const cell = spacing * 0.7
  const bucket = new Map()
  const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`
  for (let i = 0; i < nBoundary; i++) { const k = key(pts[i][0], pts[i][1]); (bucket.get(k) || bucket.set(k, []).get(k)).push(i) }
  const near = (x, z) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell)
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = bucket.get(`${cx + a},${cz + b}`)
      if (l) for (const i of l) if (Math.hypot(pts[i][0] - x, pts[i][1] - z) < spacing * 0.62) return true
    }
    return false
  }
  for (let z = z0 + spacing / 2; z < z1; z += spacing) {
    const off = (Math.round((z - z0) / spacing) % 2) * (spacing / 2)
    for (let x = x0 + spacing / 2 + off; x < x1; x += spacing) {
      if (pointInRings(x, z, rings) && !near(x, z)) pts.push([x, z])
    }
  }
  const flat = new Float64Array(pts.length * 2)
  pts.forEach((p, i) => { flat[i * 2] = p[0]; flat[i * 2 + 1] = p[1] })
  const del = new Delaunator(flat)
  const con = new Constrainautor(del)
  for (const [a, b] of edges) { if (a !== b) { try { con.constrainOne(a, b) } catch { /* 겹치는 변은 건너뜀 */ } } }
  const keep = []
  const tri = del.triangles
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t + 1], c = tri[t + 2]
    const cx = (pts[a][0] + pts[b][0] + pts[c][0]) / 3
    const cz = (pts[a][1] + pts[b][1] + pts[c][1]) / 3
    // 델로네 결과는 (x, z) 평면에서 반시계라 위에서 보면 뒷면이다. 순서를 바꿔 윗면이 위를 보게 한다
    if (pointInRings(cx, cz, rings)) keep.push(a, c, b)
  }
  return { pts, keep, rings, nBoundary }
}

// 높이에 따른 바탕 밝기(0~1). 낮은 땅은 밝고 높은 산은 조금 짙다
function shade(h) { return 0.97 - Math.min(1, h / 1.5) * 0.18 }

export function buildPiece(piece, dem, spacing) {
  const { sample } = dem
  const pos = []
  const col = []
  const idx = []
  const wallPos = []
  const wallCol = []
  const wallIdx = []
  const line = []
  let hMax = 0
  let hSum = 0
  let hN = 0
  const heightAt = (x, z) => { const [lon, lat] = toLonLat(x, z); return (sample(lon, lat) / 1000) * EXAG }
  for (const poly of piece.coordinates) {
    const rings = poly.map((r) => r.map(([lon, lat]) => toXZ(lon, lat)))
    const { pts, keep, rings: rs } = topOf(rings, spacing)
    const offset = pos.length / 3
    // 높이는 경위도로 되돌려 격자에서 읽는다
    for (const [x, z] of pts) {
      const h = heightAt(x, z)
      hMax = Math.max(hMax, h); hSum += h; hN++
      pos.push(x, h, z)
      const g = shade(h)
      col.push(g, g, g)
    }
    for (const i of keep) idx.push(offset + i)
    // 옆면
    for (const r of rs) {
      const m = r.length
      for (let i = 0; i < m; i++) {
        const a = r[i], b = r[(i + 1) % m]
        const ha = heightAt(a[0], a[1])
        const hb = heightAt(b[0], b[1])
        line.push(a[0], ha + 0.004, a[1], b[0], hb + 0.004, b[1])
        const base = wallPos.length / 3
        wallPos.push(a[0], ha, a[1], b[0], hb, b[1], b[0], BASE_Y, b[1], a[0], BASE_Y, a[1])
        const top = 0.9, bot = 0.5
        wallCol.push(top, top, top, top, top, top, bot, bot, bot, bot, bot, bot)
        wallIdx.push(base, base + 2, base + 1, base, base + 3, base + 2)
      }
    }
  }
  return {
    code: piece.code,
    pos: new Float32Array(pos), col: new Float32Array(col), idx: new Uint32Array(idx),
    line: new Float32Array(line),
    wallPos: new Float32Array(wallPos), wallCol: new Float32Array(wallCol), wallIdx: new Uint32Array(wallIdx),
    hMax, hMean: hN ? hSum / hN : 0
  }
}
