// scripts/build-plan-doc.mjs 상세기획서 마크다운을 kordoc 보고서 양식 한글 파일(HWPX)로 만든다.
// 사용: node scripts/build-plan-doc.mjs <원고.md> <결과.hwpx> [조판.svg]
//  - 그림은 원고 폴더 기준 상대 경로(![설명](img/01.jpg))로 읽어 문서에 넣는다
//  - 장 제목(## Ⅱ 이후, ## 별첨) 앞에서 쪽을 나눈다. 더 나눌 줄은 BREAKS='### 핵심 기능|### 공공데이터' 처럼 앞부분을 준다
//  - 쪽 나눔은 api/_hwpxStyle.js 의 문단 모양 덧입힘(⟪pN⟫)을 그대로 쓴다
//  - 조판.svg 를 주면 kordoc 조판 엔진으로 그린 쪽을 저장한다(PDF 만들 때 쓴다)
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { applyHwpxStyles } from '../api/_hwpxStyle.js'

const [mdPath, outPath, svgPath] = process.argv.slice(2)
if (!mdPath || !outPath) { console.error('사용: node scripts/build-plan-doc.mjs <원고.md> <결과.hwpx> [조판.svg]'); process.exit(1) }
const k = await import('kordoc')
const base = dirname(resolve(mdPath))
let md = await readFile(mdPath, 'utf8')
const extra = (process.env.BREAKS || '').split('|').filter(Boolean)
let n = 0; const paras = {}
md = md.split('\n').map((l) => {
  if (/^## (Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ|별첨)/.test(l) || extra.some((b) => l.startsWith(b))) { n++; paras[n] = { pageBreak: 1 }; return `⟪p${n}⟫\n\n${l}` }
  return l
}).join('\n')
const images = {}
for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) images[m[1]] = new Uint8Array(await readFile(resolve(base, m[1])))
const warnings = []
const raw = await k.markdownToHwpx(md, { gongmun: { preset: k.normalizeGongmunPreset('보고서') }, images, warnings })
const styled = await applyHwpxStyles(raw, { spans: {}, paras })
const buf = Buffer.from(styled.buffer)
const v = await k.validateHwpx(buf)
if (!v.ok) { console.error('한글 문서 검사 실패', v.issues); process.exit(2) }
await writeFile(outPath, buf)
let pages = null
if (svgPath) { const r = await k.renderHwpxToSvg(buf, { reflow: true }); await writeFile(svgPath, r.svg); pages = r.pageCount }
console.log(JSON.stringify({ valid: v.ok, pages, breaks: n, images: Object.keys(images).length, bytes: buf.length, warnings: warnings.slice(0, 10) }))
