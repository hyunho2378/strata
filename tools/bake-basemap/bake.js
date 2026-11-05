// bake.js 3D 지도 바탕을 사전에 구워 두는 스크립트(브라우저에서 실행).
// OpenFreeMap 벡터 타일(OpenMapTiles 스키마, 저작권 OpenStreetMap 기여자)을 받아 우리 색으로 다시 그려
//   1) 광역 바탕(동해 강릉 삼척 정선 태백 전체)과 2) 동해시 상세 바탕(건물과 모든 도로)을 이미지로 만들고
//   3) 지명(마을, 산봉우리, 소방서 병원 같은 주요 시설) 목록을 JSON 으로 뽑는다.
// 이미지는 경위도 선형 격자다. 3D 장면이 쓰는 평면 좌표(proj.js)와 같은 모양이라 그대로 입힌다.
// 실행: tools/bake-basemap/README.md 참고. 결과는 client/public/terrain/ 과 client/src/mock/geoPlaces.js 로 옮긴다.
//
// 색은 client/src/tokens.js 의 KRDS 회색과 파랑 값을 옮긴 것이다.
const C = {
  land: '#ffffff', forest: '#e6e8ea', built: '#f4f5f6', park: '#eceef0',
  water: '#b1cefb', waterLine: '#86aff9', building: '#cdd1d5', buildingEdge: '#8a949e',
  roadCase: '#8a949e', roadFill: '#ffffff', roadMinor: '#ffffff', path: '#b1b8be', rail: '#58616a'
}

export async function bake({ bbox, zoom, width, height, detail = false, onLog = () => {} }) {
  const { VectorTile } = await import('https://esm.sh/@mapbox/vector-tile@1.3.1')
  const Pbf = (await import('https://esm.sh/pbf@3.2.1')).default
  const tj = await (await fetch('https://tiles.openfreemap.org/planet')).json()
  const tpl = tj.tiles[0]
  const [w, s, e, n] = bbox
  const N = 2 ** zoom
  const tx = (lon) => ((lon + 180) / 360) * N
  const ty = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N }
  const x0 = Math.floor(tx(w)), x1 = Math.floor(tx(e)), y0 = Math.floor(ty(n)), y1 = Math.floor(ty(s))
  const cv = new OffscreenCanvas(width, height)
  const g = cv.getContext('2d')
  g.fillStyle = C.land
  g.fillRect(0, 0, width, height)
  const mPerPx = ((e - w) * 111320 * Math.cos((37.5 * Math.PI) / 180)) / width
  const px = (m, min = 1) => Math.max(min, m / mPerPx)
  const cx = (lon) => ((lon - w) / (e - w)) * width
  const cy = (lat) => ((n - lat) / (n - s)) * height

  const tiles = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([x, y])
  onLog(`tiles ${tiles.length} z${zoom} ${mPerPx.toFixed(1)}m/px`)
  const decoded = new Map()
  const places = []
  let done = 0
  async function load([x, y]) {
    for (let k = 0; k < 3; k++) {
      try {
        const r = await fetch(tpl.replace('{z}', zoom).replace('{x}', x).replace('{y}', y))
        if (r.status === 404) return null
        if (r.ok) return new VectorTile(new Pbf(new Uint8Array(await r.arrayBuffer())))
      } catch { /* 재시도 */ }
    }
    return null
  }
  for (let i = 0; i < tiles.length; i += 10) {
    await Promise.all(tiles.slice(i, i + 10).map(async (t) => { decoded.set(t.join(','), await load(t)); done++ }))
    onLog(`downloaded ${done}/${tiles.length}`)
  }

  // 타일 좌표 -> 이미지 좌표
  const project = (X, Y, ext, px0, py0) => {
    const fx = (X + px0 / ext) / N, fy = (Y + py0 / ext) / N
    const lon = fx * 360 - 180
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * fy))) * 180) / Math.PI
    return [cx(lon), cy(lat)]
  }
  const eachFeature = (layer, fn) => {
    for (const [key, vt] of decoded) {
      const lyr = vt?.layers[layer]
      if (!lyr) continue
      const [X, Y] = key.split(',').map(Number)
      for (let i = 0; i < lyr.length; i++) {
        const f = lyr.feature(i)
        const rings = f.loadGeometry().map((r) => r.map((p) => project(X, Y, f.extent, p.x, p.y)))
        fn(f, rings, [X, Y])
      }
    }
  }
  const poly = (rings) => { g.beginPath(); for (const r of rings) { r.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath() } }
  const line = (rings) => { g.beginPath(); for (const r of rings) r.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))) }

  // 땅 덮개와 토지 이용
  eachFeature('landcover', (f, rings) => {
    const c = f.properties.class
    if (c === 'wood' || c === 'forest') { g.fillStyle = C.forest; poly(rings); g.fill('evenodd') }
    else if (c === 'grass' || c === 'farmland') { g.fillStyle = C.park; poly(rings); g.fill('evenodd') }
  })
  eachFeature('landuse', (f, rings) => {
    const c = f.properties.class
    if (['residential', 'commercial', 'industrial', 'retail', 'neighbourhood', 'railway'].includes(c)) { g.fillStyle = C.built; poly(rings); g.fill('evenodd') }
  })
  eachFeature('park', (f, rings) => { g.fillStyle = C.park; poly(rings); g.fill('evenodd') })
  // 물
  eachFeature('water', (f, rings) => { g.fillStyle = C.water; poly(rings); g.fill('evenodd') })
  g.lineJoin = 'round'; g.lineCap = 'round'
  eachFeature('waterway', (f, rings) => {
    const c = f.properties.class
    g.strokeStyle = C.waterLine; g.lineWidth = px(c === 'river' ? 14 : 6, detail ? 1.2 : 0.9); line(rings); g.stroke()
  })
  // 건물(상세 바탕만)
  if (detail) {
    eachFeature('building', (f, rings) => { g.fillStyle = C.building; poly(rings); g.fill('evenodd'); g.strokeStyle = C.buildingEdge; g.lineWidth = 0.8; g.stroke() })
  }
  // 도로. 아래에서 위로 쌓는다: 작은 길 -> 큰 길
  const ROAD = {
    path: [1.4, 3], track: [2, 4], pedestrian: [2.5, 5], service: [3, 6], minor: [5, 9], tertiary: [7, 12], secondary: [9, 15], primary: [11, 18], trunk: [13, 20], motorway: [16, 24]
  }
  const order = ['path', 'track', 'pedestrian', 'service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway']
  const byClass = {}
  eachFeature('transportation', (f, rings) => {
    const c = f.properties.class
    if (c === 'rail') { (byClass.rail ||= []).push(rings); return }
    if (f.properties.brunnel === 'tunnel') return
    if (!ROAD[c] || (!detail && ['path', 'track', 'pedestrian', 'service'].includes(c))) return
    ;(byClass[c] ||= []).push(rings)
  })
  for (const c of order) {
    const list = byClass[c]; if (!list) continue
    const [wm, cm] = ROAD[c]
    const big = ['primary', 'trunk', 'motorway', 'secondary'].includes(c)
    const fill = px(wm, detail ? 1.2 : big ? 2.2 : 1.4), casing = px(cm, detail ? 2.2 : big ? 3.6 : 2.4)
    g.strokeStyle = c === 'path' || c === 'track' ? C.path : C.roadCase; g.lineWidth = casing
    for (const r of list) { line(r); g.stroke() }
    if (c !== 'path' && c !== 'track') { g.strokeStyle = C.roadFill; g.lineWidth = fill; for (const r of list) { line(r); g.stroke() } }
  }
  if (byClass.rail) {
    g.strokeStyle = C.rail; g.lineWidth = px(4, 1.2)
    for (const r of byClass.rail) { line(r); g.stroke() }
    g.setLineDash([px(14, 5), px(14, 5)]); g.strokeStyle = C.land; g.lineWidth = px(2, 0.7)
    for (const r of byClass.rail) { line(r); g.stroke() }
    g.setLineDash([])
  }

  // 지명
  const seen = new Set()
  const push = (kind, f, ll, extra) => {
    const name = f.properties['name:ko'] || f.properties.name
    if (!name || !/[가-힣]/.test(name)) return
    const k = kind + name + ll[0].toFixed(3) + ll[1].toFixed(3)
    if (seen.has(k)) return
    seen.add(k)
    places.push({ kind, name, lon: +ll[0].toFixed(5), lat: +ll[1].toFixed(5), ...extra })
  }
  const lonlatOf = (X, Y, ext, p) => { const fx = (X + p.x / ext) / N, fy = (Y + p.y / ext) / N; return [fx * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * fy))) * 180) / Math.PI] }
  for (const [key, vt] of decoded) {
    if (!vt) continue
    const [X, Y] = key.split(',').map(Number)
    for (const lname of ['place', 'mountain_peak', 'poi']) {
      const lyr = vt.layers[lname]
      if (!lyr) continue
      for (let i = 0; i < lyr.length; i++) {
        const f = lyr.feature(i)
        const geom = f.loadGeometry()
        if (!geom.length || !geom[0].length) continue
        const ll = lonlatOf(X, Y, f.extent, geom[0][0])
        if (ll[0] < w || ll[0] > e || ll[1] < s || ll[1] > n) continue
        if (lname === 'place') push('place', f, ll, { cls: f.properties.class, rank: f.properties.rank ?? 99 })
        else if (lname === 'mountain_peak') push('peak', f, ll, { ele: f.properties.ele ? Number(f.properties.ele) : null })
        else if (['hospital', 'fire_station', 'police', 'town_hall', 'harbor', 'railway', 'school', 'college', 'fuel', 'bus'].includes(f.properties.class) || ['hospital', 'fire_station', 'police', 'townhall', 'ferry_terminal', 'station', 'university', 'college', 'school'].includes(f.properties.subclass)) {
          push('poi', f, ll, { cls: f.properties.class, sub: f.properties.subclass })
        }
      }
    }
  }
  const blob = await cv.convertToBlob({ type: 'image/webp', quality: 0.92 })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
  return { b64: btoa(bin), bytes: buf.length, places, mPerPx }
}
