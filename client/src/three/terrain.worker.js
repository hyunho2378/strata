// terrain.worker.js 지형 조각과 건물 입체를 화면 흐름을 막지 않고 만든다. 동해시 조각부터 보낸다.
import { makeDem, buildPiece } from './terrainBuild.js'
import { buildBuildings, readBuildings } from './buildingBuild.js'

self.onmessage = async (e) => {
  const { data, meta, pieces, spacing, first, buildings } = e.data
  const dem = makeDem(data, meta)
  const order = [...pieces].sort((a, b) => (first.includes(a.sgg) ? 0 : 1) - (first.includes(b.sgg) ? 0 : 1))
  let n = 0
  for (const p of order) {
    const r = buildPiece(p, dem, spacing[p.sgg] || 0.2)
    n += 1
    self.postMessage({ type: 'piece', piece: r, n, total: order.length }, [r.pos.buffer, r.col.buffer, r.idx.buffer, r.line.buffer, r.wallPos.buffer, r.wallCol.buffer, r.wallIdx.buffer])
  }
  self.postMessage({ type: 'done' })
  // 건물: 파일을 받아 조각별로 세운다
  if (!buildings?.url) return
  try {
    const res = await fetch(buildings.url)
    if (!res.ok) throw new Error(`건물 파일 ${res.status}`)
    const buf = await res.arrayBuffer()
    const withBox = pieces.map((p) => {
      let b = [180, 90, -180, -90]
      for (const poly of p.coordinates) for (const [x, y] of poly[0]) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]
      return { code: p.code, coordinates: p.coordinates, bbox: b }
    })
    const list = buildBuildings(readBuildings(buf, buildings.bbox), withBox, dem.sample)
    for (const r of list) self.postMessage({ type: 'buildings', b: r }, [r.pos.buffer, r.idx.buffer, r.bid.buffer, r.info.buffer])
    self.postMessage({ type: 'buildingsDone', total: list.reduce((s, r) => s + r.count, 0) })
  } catch (err) {
    self.postMessage({ type: 'buildingsError', message: String(err?.message || err) })
  }
}
