// build-village-terrain.mjs 마을 집결지의 고도, 바다까지 거리, 둘레 300m 최대 경사를 계산해 src/mock/villageTerrain.js 를 만든다.
// 지형: public/terrain/region-dem.png(AWS Terrain Tiles z11, 경위도 격자). 바다는 고도 0 칸.
// 실행: node scripts/build-village-terrain.mjs (pngjs 필요: npm i -D pngjs 또는 임시 설치)
import fs from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PNG } = require(process.env.PNGJS || 'pngjs')
const { DEM_META } = await import('../src/mock/geoRegion.js')
const { VILLAGES } = await import('../src/mock/donghaeData.js')
const png = PNG.sync.read(fs.readFileSync(new URL('../public/terrain/region-dem.png', import.meta.url)))
const { cols, rows, bbox: [w, s, e, n] } = DEM_META
const at = (c, r) => { const i = (r * cols + c) * 4; return (png.data[i] * 256 + png.data[i + 1]) / 10 }
const cr = (lon, lat) => [Math.round(((lon - w) / (e - w)) * (cols - 1)), Math.round(((n - lat) / (n - s)) * (rows - 1))]
const mLon = (e - w) / (cols - 1) * 111320 * Math.cos(37.5 * Math.PI / 180), mLat = (n - s) / (rows - 1) * 110574
const out = {}
for (const v of VILLAGES) {
  const [lon, lat] = v.lngLat
  const [c, r] = cr(lon, lat)
  const elev = at(c, r)
  // 바다까지 거리: 반경을 넓혀 가며 고도 0 칸을 찾는다(최대 15km)
  let sea = null
  for (let R = 1; R < 200 && sea == null; R++) {
    for (let dc = -R; dc <= R && sea == null; dc++) for (const dr of [-R, R]) { if (at(c + dc, r + dr) === 0) sea = Math.hypot(dc * mLon, dr * mLat) }
    for (let dr = -R; dr <= R && sea == null; dr++) for (const dc of [-R, R]) { if (at(c + dc, r + dr) === 0) sea = Math.hypot(dc * mLon, dr * mLat) }
  }
  // 둘레 300m 안 최대 경사(도)
  let slope = 0
  const k = Math.ceil(300 / mLon)
  for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
    if (Math.hypot(dc * mLon, dr * mLat) > 300) continue
    const x = c + dc, y = r + dr
    const gx = (at(x + 1, y) - at(x - 1, y)) / (2 * mLon), gy = (at(x, y + 1) - at(x, y - 1)) / (2 * mLat)
    slope = Math.max(slope, Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI)
  }
  out[v.code] = { elev: Math.round(elev), seaKm: sea == null ? null : Math.round(sea) / 1000, slope: Math.round(slope) }
}
const head = `// villageTerrain.js 마을 집결지 지형 값. scripts/build-village-terrain.mjs 가 만든다(직접 고치지 않는다).
// 고도(m), 바다까지 거리(km), 둘레 300m 최대 경사(도). 지형 출처 AWS Terrain Tiles(Mapzen) z11, 칸 약 90m 라 해안 저지대는 오차가 크다.
`
fs.writeFileSync(new URL('../src/mock/villageTerrain.js', import.meta.url), head + 'export const VILLAGE_TERRAIN = ' + JSON.stringify(out) + '\n')
console.log(Object.entries(out).map(([k, x]) => `${k} ${VILLAGES.find((v) => v.code === k).name} 고도${x.elev} 바다${x.seaKm} 경사${x.slope}`).join('\n'))
