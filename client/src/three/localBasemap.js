// localBasemap.js 3D 상황판을 가까이 볼 때 카메라 둘레만 골목 단위로 다시 그린다.
// OpenFreeMap 벡터 타일 z14(OpenMapTiles 스키마, 저작권 OpenStreetMap 기여자)를 받아 한 변 size km 정사각형을 2048 픽셀(약 1.5m)로 그린다.
// 사전에 구운 바탕(광역 25m, 동해시 6m)보다 촘촘하다. 길 이름도 같이 돌려준다.
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader as Pbf } from 'pbf'

const TILES = 'https://tiles.openfreemap.org/planet'
const C = {
  land: '#ffffff', forest: '#b9dca4', built: '#f4f5f6', park: '#cbe6b8', water: '#b1cefb', waterLine: '#86aff9',
  roadCase: '#8a949e', roadFill: '#ffffff', path: '#b1b8be', rail: '#58616a', parking: '#e6e8ea', pitch: '#a8d5a1'
}
// 도로 등급별 폭(m)과 색. 간선 도로는 진한 주황, 생활 도로는 얇고 밝은 흰색, 사람 길은 회색이다
const ROAD = {
  path: { w: [1.2, 2.2], fill: '#ccd2d8', line: '#b6bec5' },
  track: { w: [2, 3.2], fill: '#ccd2d8', line: '#b6bec5' },
  pedestrian: { w: [3, 4.8], fill: '#e8ecef', line: '#c2c9cf' },
  service: { w: [3.6, 5.6], fill: '#ffffff', line: '#c2c9cf' },
  minor: { w: [6.5, 9.2], fill: '#ffffff', line: '#aab2b9' },
  tertiary: { w: [9, 12.6], fill: '#ffffff', line: '#99a2aa' },
  secondary: { w: [11, 15], fill: '#ffe4a3', line: '#dcae53' },
  primary: { w: [13, 18], fill: '#ffd166', line: '#d79a2b' },
  trunk: { w: [15, 21], fill: '#f9a825', line: '#c77c14' },
  motorway: { w: [18, 25], fill: '#f08a24', line: '#bc6413' }
}
const ORDER = ['path', 'track', 'pedestrian', 'service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']

let tplPromise = null
const tileCache = new Map()
async function tileTemplate() {
  tplPromise ||= fetch(TILES).then((r) => r.json()).then((j) => j.tiles[0])
  return tplPromise
}
async function getTile(x, y) {
  const key = `${x},${y}`
  if (tileCache.has(key)) return tileCache.get(key)
  const p = (async () => {
    const tpl = await tileTemplate()
    const r = await fetch(tpl.replace('{z}', 14).replace('{x}', x).replace('{y}', y))
    if (!r.ok) return null
    return new VectorTile(new Pbf(new Uint8Array(await r.arrayBuffer())))
  })().catch(() => null)
  tileCache.set(key, p)
  if (tileCache.size > 400) tileCache.delete(tileCache.keys().next().value)
  return p
}

// bbox [서, 남, 동, 북] 을 px 크기 캔버스에 그린다
export async function renderLocal(bbox, px = 2048, signal) {
  const [w, s, e, n] = bbox
  const N = 2 ** 14
  const tx = (lon) => ((lon + 180) / 360) * N
  const ty = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N }
  const x0 = Math.floor(tx(w)), x1 = Math.floor(tx(e)), y0 = Math.floor(ty(n)), y1 = Math.floor(ty(s))
  const list = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) list.push([x, y])
  const tiles = await Promise.all(list.map(([x, y]) => getTile(x, y).then((vt) => ({ x, y, vt }))))
  if (signal?.aborted) return null
  const cv = new OffscreenCanvas(px, px)
  const g = cv.getContext('2d')
  g.fillStyle = C.land
  g.fillRect(0, 0, px, px)
  const mPerPx = ((e - w) * 111320 * Math.cos((((s + n) / 2) * Math.PI) / 180)) / px
  // 도로는 실폭보다 조금 굵게 그려야 낮 지면 위에서 읽힌다
  const wpx = (m, min) => Math.max(min, (m * 1.35) / mPerPx)
  const cx = (lon) => ((lon - w) / (e - w)) * px
  const cy = (lat) => ((n - lat) / (n - s)) * px
  const proj = (X, Y, ext, p) => {
    const fx = (X + p.x / ext) / N, fy = (Y + p.y / ext) / N
    return [cx(fx * 360 - 180), cy((Math.atan(Math.sinh(Math.PI * (1 - 2 * fy))) * 180) / Math.PI)]
  }
  const each = (layer, fn) => {
    for (const { x, y, vt } of tiles) {
      const L = vt?.layers[layer]
      if (!L) continue
      for (let i = 0; i < L.length; i++) {
        const f = L.feature(i)
        fn(f, f.loadGeometry().map((r) => r.map((p) => proj(x, y, f.extent, p))), [x, y, f.extent])
      }
    }
  }
  const poly = (rings) => { g.beginPath(); for (const r of rings) { r.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath() } }
  const line = (rings) => { g.beginPath(); for (const r of rings) r.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))) }
  each('landcover', (f, r) => { const c = f.properties.class; if (c === 'wood' || c === 'forest') { g.fillStyle = C.forest; poly(r); g.fill('evenodd') } else if (c === 'grass' || c === 'farmland') { g.fillStyle = C.park; poly(r); g.fill('evenodd') } })
  each('landuse', (f, r) => { const c = f.properties.class; if (['residential', 'commercial', 'industrial', 'retail', 'railway', 'school', 'hospital'].includes(c)) { g.fillStyle = C.built; poly(r); g.fill('evenodd') } })
  each('park', (f, r) => { g.fillStyle = C.park; poly(r); g.fill('evenodd') })
  each('water', (f, r) => { g.fillStyle = C.water; poly(r); g.fill('evenodd') })
  g.lineJoin = 'round'; g.lineCap = 'round'
  each('waterway', (f, r) => { g.strokeStyle = C.waterLine; g.lineWidth = wpx(f.properties.class === 'river' ? 14 : 5, 1.5); line(r); g.stroke() })
  const by = {}
  const names = new Map()
  each('transportation', (f, r) => {
    const c = f.properties.class
    if (c === 'rail') { (by.rail ||= []).push(r); return }
    if (!ROAD[c] || f.properties.brunnel === 'tunnel') return
    ;(by[c] ||= []).push(r)
  })
  for (const c of ORDER) {
    const L = by[c]; if (!L) continue
    const R = ROAD[c]
    g.strokeStyle = R.line; g.lineWidth = wpx(R.w[1], 3)
    for (const r of L) { line(r); g.stroke() }
    g.strokeStyle = R.fill; g.lineWidth = wpx(R.w[0], 1.8)
    for (const r of L) { line(r); g.stroke() }
  }
  if (by.rail) {
    g.strokeStyle = C.rail; g.lineWidth = wpx(4, 2); for (const r of by.rail) { line(r); g.stroke() }
    g.setLineDash([wpx(12, 6), wpx(12, 6)]); g.strokeStyle = C.land; g.lineWidth = wpx(2, 1); for (const r of by.rail) { line(r); g.stroke() }
    g.setLineDash([])
  }
  // 길 이름: 이름마다 가장 긴 구간 가운데 한 점
  for (const { x, y, vt } of tiles) {
    const L = vt?.layers.transportation_name
    if (!L) continue
    for (let i = 0; i < L.length; i++) {
      const f = L.feature(i)
      const nm = f.properties['name:ko'] || f.properties.name
      if (!nm || !/[가-힣]/.test(nm)) continue
      for (const r of f.loadGeometry()) {
        if (r.length < 2) continue
        let len = 0
        for (let k = 1; k < r.length; k++) len += Math.hypot(r[k].x - r[k - 1].x, r[k].y - r[k - 1].y)
        const mid = r[Math.floor(r.length / 2)]
        const fx = (x + mid.x / f.extent) / N, fy = (y + mid.y / f.extent) / N
        const lon = fx * 360 - 180, lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * fy))) * 180) / Math.PI
        if (lon < w || lon > e || lat < s || lat > n) continue
        const old = names.get(nm)
        if (!old || old.len < len) names.set(nm, { name: nm, lon, lat, len, cls: f.properties.class })
      }
    }
  }
  return { canvas: cv, mPerPx, roads: [...names.values()].sort((a, b) => b.len - a.len).slice(0, 40) }
}
