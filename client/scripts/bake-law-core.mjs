// 핵심 법령 내장본 굽기. 이 업무에 바로 쓰는 법령과 조례의 조문 전체를 법제처 국가법령정보(korean-law-mcp 경유)에서 받아
// public/law/core.json 으로 저장한다. 화면은 이 내장본에서 먼저 찾고(즉시, 서버 한도 무관), 없는 법령만 서버로 묻는다.
// 실행: node scripts/bake-law-core.mjs  (약 1~3분, 기준일은 파일 안 bakedAt)
import { writeFileSync } from 'node:fs'
import { parseArticle, parseHead, parseSearch, parseToc } from '../src/lib/lawParse.js'

const ENDPOINT = process.env.LAW_MCP_URL || 'https://mcp.gomdori.app/law'
// [검색어, 정확한 이름, 쓰임]
const LAWS = [
  ['재난안전법', '재난 및 안전관리 기본법', '대피명령(제40조), 강제대피(제42조), 재난관리 체계'],
  ['재난 및 안전관리 기본법 시행령', '재난 및 안전관리 기본법 시행령', '재난의 범위, 재난관리책임기관, 대책본부'],
  ['동해시 재난 및 안전관리 기본 조례', '동해시 재난 및 안전관리 기본 조례', '동해시 대책본부, 재난지역 주민대피(제60조)'],
  ['행정업무의 운영 및 혁신에 관한 규정', '행정업무의 운영 및 혁신에 관한 규정', '공문서 작성, 기안, 결재'],
  ['행정업무의 운영 및 혁신에 관한 규정 시행규칙', '행정업무의 운영 및 혁신에 관한 규정 시행규칙', '항목 구분(제2조), 기안문 서식'],
  ['개인정보 보호법', '개인정보 보호법', '재난취약자 명부 수집, 이용, 제3자 제공'],
  ['재해구호법', '재해구호법', '임시주거시설, 구호'],
  ['자연재해대책법', '자연재해대책법', '풍수해, 대설, 재해지도'],
  ['지진ㆍ화산재해대책법', '지진·화산재해대책법', '지진해일 대피, 지진재해'],
  ['산림재난방지법', '산림재난방지법', '산불, 산사태 등 산림재난 대응(2026. 2. 1. 산림보호법에서 이관)'],
  ['산림보호법', '산림보호법', '산림보호구역, 산림 병해충']
]

async function call(name, args) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })
    const t = await r.text()
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 3000 * (attempt + 1))); continue }
    let j
    try { j = JSON.parse(t) } catch { const d = t.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)); j = JSON.parse(d[d.length - 1]) }
    return (j.result?.content || []).map((c) => c.text || '').join('\n')
  }
  throw new Error(`${name} 한도 초과`)
}
const norm = (s) => s.replace(/[ㆍ·\s]/g, '')

async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) } }))
  return out
}

const out = { bakedAt: new Date().toISOString().slice(0, 10), source: '법제처 국가법령정보 Open API(korean-law-mcp 경유)', laws: [] }
for (const [query, exact, use] of LAWS) {
  const found = parseSearch(await call('search_law', { query, display: 10 }))
  const hit = found.find((x) => norm(x.name) === norm(exact)) || found[0]
  if (!hit) { console.log('못 찾음', query); continue }
  const kind = hit.kind
  const tocText = kind === 'ordin' ? await call('execute_tool', { tool_name: 'get_ordinance', params: { ordinSeq: hit.mst } }) : await call('get_law_text', { mst: hit.mst })
  const head = parseHead(tocText)
  const toc = parseToc(tocText, kind)
  const articles = (await pool(toc, 5, async (t) => {
    const txt = kind === 'ordin' ? await call('execute_tool', { tool_name: 'get_ordinance', params: { ordinSeq: hit.mst, jo: t.jo } }) : await call('get_law_text', { mst: hit.mst, jo: t.jo })
    const a = parseArticle(txt, t.jo)
    return a ? { jo: t.jo, title: a.title || t.title, text: a.text } : { jo: t.jo, title: t.title, text: '' }
  })).filter((a) => a.text)
  out.laws.push({ name: head.name || hit.name, kind, type: hit.type, mst: hit.mst, lawId: hit.lawId || '', org: hit.org || '', promulgated: head.promulgated || hit.promulgated, effective: head.effective || hit.effective, use, articles })
  console.log(hit.name, kind, hit.mst, `목차 ${toc.length}, 본문 ${articles.length}`)
}
writeFileSync('public/law/core.json', JSON.stringify(out))
console.log('총', out.laws.reduce((a, l) => a + l.articles.length, 0), '조문')
