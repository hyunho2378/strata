// buildingBuild.js 건물 윤곽을 지형 위 입체로 세운다. 순수 계산이라 Web Worker 에서 돈다.
// 입력 파일 두 가지
//   v2(국토교통부 GIS건물통합정보, tools/bake-buildings/extract.cjs): Uint32 [2, 건물 수, 꼭짓점 수] / Uint16 꼭짓점 수 / Uint8 지상층수 / Uint16 높이(0.1m) / Uint8 용도 / 정렬 / Uint16 [경도, 위도]
//   v1(Overture): Uint32 [건물 수, 꼭짓점 수] / Uint16 꼭짓점 수 / Uint8 지상층수 / 정렬 / Uint16 [경도, 위도]
// 높이: 대장 높이(m)가 있으면 그 값, 없으면 지상층수 x 3.2m, 둘 다 없으면 1층(3.2m). 지형과 같은 배율로 높인다
// 꼭짓점을 아끼려고 건물마다 윗고리와 아랫고리만 두고 면 방향 음영은 재질(flatShading)이 화면에서 계산한다
import earcut from 'earcut'
import { EXAG, toXZ } from './proj.js'

export const FLOOR_M = 3.2

export function readBuildings(buf, bbox) {
  const dv = new DataView(buf)
  const v2 = dv.getUint32(0, true) === 2 && buf.byteLength > 12
  let p = v2 ? 4 : 0
  const n = dv.getUint32(p, true); p += 4
  const nPts = dv.getUint32(p, true); p += 4
  const counts = new Uint16Array(buf.slice(p, p + n * 2)); p += n * 2
  const floors = new Uint8Array(buf, p, n); p += n
  let heights = null, uses = null
  if (v2) { heights = new Uint16Array(buf.slice(p, p + n * 2)); p += n * 2; uses = new Uint8Array(buf, p, n); p += n }
  p += (4 - (p % 4)) % 4
  const xy = new Uint16Array(buf, p, nPts * 2)
  const [w, s, e, nn] = bbox
  return { n, counts, floors, heights, uses, xy, lon: (u) => w + (u / 65535) * (e - w), lat: (v) => s + (v / 65535) * (nn - s) }
}

function inRing(x, y, r) {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// pieces: [{ code, coordinates, bbox }], sample(lon, lat) 는 고도(m)
export function buildBuildings(data, pieces, sample) {
  const { n, counts, floors, heights, uses, xy, lon, lat } = data
  // 1차: 건물별 조각 정하기, 크기 세기
  const owner = new Int32Array(n).fill(-1)
  const starts = new Uint32Array(n)
  const nv = new Uint32Array(pieces.length)   // 꼭짓점 수
  const ni = new Uint32Array(pieces.length)   // 색인 수
  const nb = new Uint32Array(pieces.length)   // 건물 수
  let o = 0
  let last = -1
  const test = (k, cx, cy) => {
    const p = pieces[k]
    return cx >= p.bbox[0] && cx <= p.bbox[2] && cy >= p.bbox[1] && cy <= p.bbox[3] && p.coordinates.some((poly) => inRing(cx, cy, poly[0]) && !poly.slice(1).some((h) => inRing(cx, cy, h)))
  }
  for (let i = 0; i < n; i++) {
    const m = counts[i]
    starts[i] = o
    let cx = 0, cy = 0
    for (let k = 0; k < m; k++) { cx += xy[o + k * 2]; cy += xy[o + k * 2 + 1] }
    o += m * 2
    cx = lon(cx / m); cy = lat(cy / m)
    let pk = last >= 0 && test(last, cx, cy) ? last : -1
    if (pk < 0) for (let k = 0; k < pieces.length; k++) if (test(k, cx, cy)) { pk = k; break }
    if (pk < 0) continue
    last = pk
    owner[i] = pk
    nv[pk] += m * 2
    ni[pk] += m * 6 + (m - 2) * 3
    nb[pk] += 1
  }
  // 2차: 조각별 배열 채우기
  const out = pieces.map((p, k) => ({
    code: p.code, count: 0,
    pos: new Float32Array(nv[k] * 3), idx: new Uint32Array(ni[k]), bid: new Uint32Array(nv[k]),
    info: new Float32Array(nb[k] * 5), vi: 0, ii: 0
  }))
  const xz = []
  for (let i = 0; i < n; i++) {
    const pk = owner[i]
    if (pk < 0) continue
    const b = out[pk]
    const m = counts[i]
    const s0 = starts[i]
    let gMin = Infinity, gMax = -Infinity, cx = 0, cy = 0
    xz.length = 0
    for (let k = 0; k < m; k++) {
      const a = lon(xy[s0 + k * 2]), c = lat(xy[s0 + k * 2 + 1])
      cx += a; cy += c
      const g = (sample(a, c) / 1000) * EXAG
      if (g < gMin) gMin = g
      if (g > gMax) gMax = g
      xz.push(toXZ(a, c))
    }
    const hm = heights && heights[i] ? heights[i] / 10 : floors[i] ? floors[i] * FLOOR_M : FLOOR_M
    const y0 = gMin - 0.004
    const y1 = gMax + (hm / 1000) * EXAG
    const bi = b.count
    b.count += 1
    b.info.set([cx / m, cy / m, floors[i], uses ? uses[i] : 0, hm], bi * 5)
    const v = b.vi
    for (let k = 0; k < m; k++) {
      const [x, z] = xz[k]
      b.pos.set([x, y1, z], (v + k) * 3)
      b.pos.set([x, y0, z], (v + m + k) * 3)
      b.bid[v + k] = bi
      b.bid[v + m + k] = bi
    }
    let ii = b.ii
    // 옆면: 윗고리 k, k+1 과 아랫고리 k, k+1
    for (let k = 0; k < m; k++) {
      const a = v + k, c = v + ((k + 1) % m), a2 = v + m + k, c2 = v + m + ((k + 1) % m)
      b.idx[ii++] = a; b.idx[ii++] = a2; b.idx[ii++] = c
      b.idx[ii++] = c; b.idx[ii++] = a2; b.idx[ii++] = c2
    }
    // 지붕
    const flat = new Array(m * 2)
    for (let k = 0; k < m; k++) { flat[k * 2] = xz[k][0]; flat[k * 2 + 1] = xz[k][1] }
    const tri = earcut(flat)
    for (let t = 0; t < tri.length && ii + 2 < b.idx.length + 1; t += 3) { b.idx[ii++] = v + tri[t]; b.idx[ii++] = v + tri[t + 2]; b.idx[ii++] = v + tri[t + 1] }
    b.ii = ii
    b.vi = v + m * 2
  }
  return out.filter((b) => b.count > 0).map((b) => ({ code: b.code, count: b.count, pos: b.pos, idx: b.idx.subarray(0, b.ii).slice(), bid: b.bid, info: b.info }))
}
