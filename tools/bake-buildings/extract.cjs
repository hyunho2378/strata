#!/usr/bin/env node
// extract.cjs 국토교통부 GIS건물통합정보(브이월드 데이터마켓, 강원특별자치도 전체데이터 SHP)에서
// 동해시 강릉시 삼척시 정선군 태백시 건물만 골라 3D 상황판용 이진 파일로 만든다. GDAL 없이 Node 만으로 돈다.
//
// 자료 받기(브이월드 로그인 필요, 무료): https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18
//   시·도 강원특별자치도 / 구분 전체데이터 / SHP. 좌표계 EPSG:5186, 속성 CP949. 라이선스 공공누리 출처표시(CC BY)
// 쓰는 법: npm i proj4 iconv-lite && node extract.cjs <압축 푼 폴더>/AL_D010_51_YYYYMMDD <출력.bin> "<경도 서>,<위도 남>,<경도 동>,<위도 북>"
//
// 쓰는 필드(컬럼 정의서): A3 법정동코드, A8 주용도코드, A16 높이(m, 0 은 미기재), A23 시군구코드, A26 지상층수
// 출력 구조(리틀 엔디언)
//   Uint32 [버전 2, 건물 수, 꼭짓점 수] / Uint16 건물별 꼭짓점 수 / Uint8 지상층수 / Uint16 높이(0.1m) / Uint8 용도 분류 / 4바이트 정렬 / Uint16 [경도, 위도] 쌍(범위 0~65535)
// 용도 분류: 0 기타, 1 주택(단독 공동), 2 노유자시설, 3 의료시설, 4 교육연구시설, 5 공공 업무(업무시설 공공용시설 교정군사), 6 근린생활 판매 숙박, 7 공장 창고 위험물
const fs = require('fs')
const path = require('path')
const proj4 = require('proj4')
const iconv = require('iconv-lite')

const [, , base, outFile, bboxArg] = process.argv
if (!base || !outFile || !bboxArg) { console.error('사용법: node extract.cjs <AL_D010_51_YYYYMMDD 경로(확장자 없이)> <출력.bin> "서,남,동,북"'); process.exit(1) }
const BBOX = bboxArg.split(',').map(Number)
const SGG = new Set(['51170', '51150', '51230', '51770', '51190'])
proj4.defs('EPSG:5186', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
const toLL = proj4('EPSG:5186', 'EPSG:4326')
const useClass = (code) => {
  const c = code.slice(0, 2)
  if (c === '01' || c === '02') return 1
  if (c === '11') return 2
  if (c === '09') return 3
  if (c === '10' || code === 'Z8000') return 4
  if (c === '14' || c === '23' || code === 'Z9000') return 5
  if (c === '03' || c === '04' || c === '07' || c === '15' || code === 'Z3000' || code === 'Z6000') return 6
  if (c === '17' || c === '18' || c === '19') return 7
  return 0
}

// DBF 필드 위치
const dbf = fs.openSync(base + '.dbf', 'r')
const h = Buffer.alloc(32); fs.readSync(dbf, h, 0, 32, 0)
const n = h.readUInt32LE(4), hl = h.readUInt16LE(8), rl = h.readUInt16LE(10)
const fh = Buffer.alloc(hl); fs.readSync(dbf, fh, 0, hl, 0)
const off = {}
let o = 1
for (let p = 32; p < hl - 1; p += 32) { const name = fh.toString('ascii', p, p + 11).replace(/\0.*$/, ''); const len = fh[p + 16]; off[name] = [o, len]; o += len }
const str = (r, k) => r.toString('latin1', off[k][0], off[k][0] + off[k][1]).trim()
const num = (r, k) => { const v = parseFloat(str(r, k)); return Number.isFinite(v) ? v : 0 }

// 1) 속성에서 대상 레코드 고르기
const pick = []
const CH = 4000
const buf = Buffer.alloc(rl * CH)
for (let s = 0; s < n; s += CH) {
  const m = Math.min(CH, n - s)
  fs.readSync(dbf, buf, 0, rl * m, hl + s * rl)
  for (let i = 0; i < m; i++) {
    const r = buf.subarray(i * rl, (i + 1) * rl)
    if (r[0] === 0x2a) continue // 삭제 표시
    if (!SGG.has(str(r, 'A23'))) continue
    pick.push({ i: s + i, fl: Math.max(0, Math.round(num(r, 'A26'))), h: num(r, 'A16'), use: useClass(str(r, 'A8')) })
  }
}
console.log('대상 건물', pick.length)

// 2) 도형 읽기(SHX 로 위치를 찾는다)
const shx = fs.readFileSync(base + '.shx')
const shp = fs.openSync(base + '.shp', 'r')
const recs = []
let nPts = 0
const W = BBOX[2] - BBOX[0], H = BBOX[3] - BBOX[1]
for (const p of pick) {
  const at = shx.readInt32BE(100 + p.i * 8) * 2
  const len = shx.readInt32BE(100 + p.i * 8 + 4) * 2
  const rec = Buffer.alloc(len + 8)
  fs.readSync(shp, rec, 0, len + 8, at)
  const type = rec.readInt32LE(8)
  if (type !== 5 && type !== 15 && type !== 25) continue
  const numParts = rec.readInt32LE(8 + 36), numPoints = rec.readInt32LE(8 + 40)
  const parts = []
  for (let k = 0; k < numParts; k++) parts.push(rec.readInt32LE(8 + 44 + k * 4))
  const ptsAt = 8 + 44 + numParts * 4
  for (let k = 0; k < numParts; k++) {
    const a = parts[k], b = k + 1 < numParts ? parts[k + 1] : numPoints
    const ring = []
    for (let q = a; q < b; q++) ring.push([rec.readDoubleLE(ptsAt + q * 16), rec.readDoubleLE(ptsAt + q * 16 + 8)])
    // SHP 바깥 고리는 시계방향(부호 넓이 < 0). 구멍은 건너뛴다
    let area = 0
    for (let q = 0; q < ring.length - 1; q++) area += ring[q][0] * ring[q + 1][1] - ring[q + 1][0] * ring[q][1]
    if (area > 0 || ring.length < 4) continue
    const ll = ring.slice(0, -1).map(([x, y]) => toLL.forward([x, y]))
    if (ll.some(([lon, lat]) => lon < BBOX[0] || lon > BBOX[2] || lat < BBOX[1] || lat > BBOX[3])) continue
    recs.push({ ll, fl: Math.min(255, p.fl), h: Math.min(6553, Math.round(p.h * 10)), use: p.use })
    nPts += ll.length
  }
}
console.log('윤곽', recs.length, '꼭짓점', nPts)

const N = recs.length
const headBytes = 12 + N * 2 + N + N * 2 + N
const pad = (4 - (headBytes % 4)) % 4
const out = Buffer.alloc(headBytes + pad + nPts * 4)
out.writeUInt32LE(2, 0); out.writeUInt32LE(N, 4); out.writeUInt32LE(nPts, 8)
let w = 12
for (const r of recs) { out.writeUInt16LE(r.ll.length, w); w += 2 }
for (const r of recs) { out.writeUInt8(r.fl, w); w += 1 }
for (const r of recs) { out.writeUInt16LE(r.h, w); w += 2 }
for (const r of recs) { out.writeUInt8(r.use, w); w += 1 }
w += pad
for (const r of recs) for (const [lon, lat] of r.ll) {
  out.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(((lon - BBOX[0]) / W) * 65535))), w); w += 2
  out.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(((lat - BBOX[1]) / H) * 65535))), w); w += 2
}
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true })
fs.writeFileSync(outFile, out)
const byUse = {}
for (const r of recs) byUse[r.use] = (byUse[r.use] || 0) + 1
console.log('완료', outFile, out.length, 'bytes', JSON.stringify(byUse), '층수 있음', recs.filter((r) => r.fl > 0).length)
