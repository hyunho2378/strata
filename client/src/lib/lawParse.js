// lawParse.js 법제처 국가법령정보(korean-law-mcp 경유) 응답 글을 화면용 구조로 바꾼다.
// 서버 함수(api/law.js), 내장본 굽기(tools/bake-law), 시험(tests)이 같이 쓴다. 외부 모듈 없음.

const lines = (t) => String(t || '').replace(/\r/g, '').split('\n')
const dot8 = (s) => (/^\d{8}$/.test(s || '') ? `${s.slice(0, 4)}. ${Number(s.slice(4, 6))}. ${Number(s.slice(6, 8))}.` : s || '')
export const fmtDate = dot8

// 오류 표시([NOT_FOUND] 등)
export function upstreamError(text) {
  const m = String(text || '').match(/^\[([A-Z_]+)\]\s*(.*)$/m)
  return m && /NOT_FOUND|INVALID|ERROR|FAIL|LIMIT/.test(m[1]) ? { code: m[1], message: m[2].replace(/^:\s*/, '').trim() } : null
}

// search_law: 법령(1. 이름 [현행] / - 법령ID / - MST / - 공포일 / 시행일 / - 구분)과 자치법규([MST] 이름 / 지자체 / 공포일 / 시행일) 두 틀
export function parseSearch(text) {
  const out = []
  let cur = null
  for (const raw of lines(text)) {
    const l = raw.trim()
    let m
    if ((m = l.match(/^\d+\.\s+(.+?)(?:\s+\[([^\]]+)\])?$/)) && !l.startsWith('- ')) {
      cur = { kind: 'law', name: m[1], status: m[2] || '' }; out.push(cur); continue
    }
    if ((m = l.match(/^\[(\d+)\]\s+(.+)$/))) { cur = { kind: 'ordin', id: m[1], mst: m[1], name: m[2] }; out.push(cur); continue }
    if (!cur) continue
    if ((m = l.match(/^-?\s*법령ID:\s*(\S+)/))) cur.lawId = m[1]
    else if ((m = l.match(/^-?\s*MST:\s*(\S+)/))) cur.mst = m[1]
    else if ((m = l.match(/공포일:\s*(\d{8})(?:\s*\/\s*시행일:\s*(\d{8}))?/))) { cur.promulgated = m[1]; if (m[2]) cur.effective = m[2] }
    else if ((m = l.match(/^시행일:\s*(\d{8})/))) cur.effective = m[1]
    else if ((m = l.match(/^-?\s*구분:\s*(.+)$/))) cur.type = m[1]
    else if ((m = l.match(/^지자체:\s*(.+)$/))) { cur.type = '자치법규'; cur.org = m[1] }
  }
  return out.filter((x) => x.mst)
}

// 법령 머리(법령명, 공포일, 시행일)
export function parseHead(text) {
  const h = {}
  for (const l of lines(text).slice(0, 12)) {
    let m
    if ((m = l.match(/^(?:법령명|자치법규명):\s*(.+)$/))) h.name = m[1].trim()
    else if ((m = l.match(/^공포일:\s*(\d{8})/))) h.promulgated = m[1]
    else if ((m = l.match(/^시행일:\s*(\d{8})/))) h.effective = m[1]
    else if ((m = l.match(/^자치단체:\s*(.+)$/))) h.org = m[1].trim()
    else if ((m = l.match(/^소관부서:\s*(.+)$/))) h.dept = m[1].trim()
  }
  return h
}

// 목차: 법령은 "제N조 제목", 자치법규는 제목만 차례로 나온다(조 번호는 차례에서 붙인다)
export function parseToc(text, kind = 'law') {
  const body = lines(text)
  const i = body.findIndex((l) => /^목차/.test(l.trim()))
  if (i < 0) return []
  const out = []
  for (const raw of body.slice(i + 1)) {
    const l = raw.trim()
    if (!l) continue
    if (/^특정 조문|^💡|^ℹ️/.test(l)) break
    const m = l.match(/^(제\d+조(?:의\d+)?)\s*(.*)$/)
    if (m) out.push({ jo: m[1], title: m[2] || '' })
    else if (kind === 'ordin') out.push({ jo: `제${out.length + 1}조`, title: l })
  }
  return out
}

// 조문 본문 줄 나눔: 항(①), 호(1.), 목(가.) 앞에서 줄을 바꾼다(자치법규와 해석례는 한 줄로 붙어 온다)
export function breakClauses(s) {
  return String(s || '')
    .replace(/\s*([①-⑳])/g, '\n$1')
    // 호(1.)와 목(가.) 앞에서 줄 바꿈. 날짜(2014. 2. 5.)처럼 숫자 뒤 점에 이어지는 경우는 건드리지 않는다
    .replace(/\s*(\d{1,2}(?:의\d+)?\.\s)/g, (m, num, at, all) => {
      const before = all.slice(Math.max(0, at - 12), at).replace(/\s+$/, '')
      // 날짜(2014. 2. 5.)의 월, 일이면 그대로, 문장이나 괄호, 한글 뒤에 붙은 번호면 새 줄
      if (!before || /\d\.$/.test(before) || /\d$/.test(before)) return m
      return /[.다:)」>\]가-힣]$/.test(before) ? `\n${num}` : m
    })
    .replace(/([.다:)」>\]])\s*([가-하]\.\s)/g, '$1\n$2')
    .replace(/^\n+/, '')
}

// 조문 하나: "제40조(대피명령)" 줄부터 끝까지
export function parseArticle(text, jo) {
  const body = lines(text)
  const head = parseHead(text)
  const start = body.findIndex((l) => /^제\d+조(?:의\d+)?\s*\(/.test(l.trim()) || /^제\d+조(?:의\d+)?\s/.test(l.trim()))
  if (start < 0) return null
  const first = body[start].trim()
  const m = first.match(/^(제\d+조(?:의\d+)?)\s*\(([^)]*)\)\s*(.*)$/)
  let rest = body.slice(start + 1)
  let title = m?.[2] || first.replace(/^제\d+조(?:의\d+)?\s*/, '')
  let lead = m?.[3] || ''
  // 법령은 "제40조 대피명령" 다음 줄에 "제40조(대피명령)" 이 한 번 더 온다
  if (!m && rest[0] && /^제\d+조(?:의\d+)?\s*\(/.test(rest[0].trim())) {
    const m2 = rest[0].trim().match(/^(제\d+조(?:의\d+)?)\s*\(([^)]*)\)\s*(.*)$/)
    title = m2[2]; lead = m2[3] || ''; rest = rest.slice(1)
  }
  const text2 = [lead, ...rest].join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { jo: m?.[1] || jo || first.match(/^제\d+조(?:의\d+)?/)?.[0], title, text: breakClauses(text2).replace(/\n{2,}/g, '\n').trim(), ...head }
}

// 3단 비교(legal_research law_system): "---\n제N조 ...\n---" 아래 "[시행령] 법령명 제N조 (제목)\n본문"
export function parseSystem(text) {
  const out = []
  let cur = null, item = null
  for (const raw of lines(text)) {
    const l = raw.trim()
    let m
    if ((m = l.match(/^(제\d+조(?:의\d+)?)\s/)) && !l.startsWith('[')) { cur = { jo: m[1], items: [] }; out.push(cur); item = null; continue }
    if ((m = l.match(/^\[(시행령|시행규칙|행정규칙|자치법규)\]\s+(.+?)\s+(제\d+조(?:의\d+)?)\s*\(([^)]*)\)/))) {
      if (!cur) { cur = { jo: '', items: [] }; out.push(cur) }
      item = { level: m[1], law: m[2], jo: m[3], title: m[4], text: '' }; cur.items.push(item); continue
    }
    if (item && l && l !== '---' && !/^═|^▶/.test(l)) item.text += (item.text ? '\n' : '') + l.replace(/^\(위임 내용 .*일부만 표시\)$/, '(일부만 표시)')
  }
  for (const c of out) for (const it of c.items) it.text = breakClauses(it.text)
  return out.filter((c) => c.items.length)
}

// 용어 목록과 상세
export function parseTermList(text) {
  return lines(text).map((l) => l.trim()).filter((l) => l && !/^법령용어|^💡|^⚠️|^\[|^HTTP/.test(l)).slice(0, 60)
}
export function parseTermDetail(text) {
  const out = []
  const blocks = String(text || '').split(/\n(?=[^\n]+ \([^)]+\)\n\n정의:)/)
  for (const b of blocks) {
    const name = b.match(/^([^\n(]+?) \(/m)?.[1]?.trim()
    const def = b.match(/정의:\s*\n([\s\S]*?)(?:\n\n출처:|$)/)?.[1]?.trim()
    const src = b.match(/출처:\s*(.+)/)?.[1]?.trim()
    const cat = b.match(/분류:\s*(.+)/)?.[1]?.trim()
    if (name && def) out.push({ name: name.replace(/^법령용어 상세\s*/, ''), definition: def, source: src || '', category: cat || '' })
  }
  return out
}

// 해석례, 판례 목록: "[id] 제목" 아래 "키: 값"
export function parseDecisions(text) {
  const out = []
  let cur = null
  const total = String(text || '').match(/총\s*([\d,]+)건/)?.[1]
  for (const raw of lines(text)) {
    const l = raw.trim()
    let m
    if ((m = l.match(/^\[(\d+)\]\s+(.+)$/))) { cur = { id: m[1], title: m[2] }; out.push(cur); continue }
    if (!cur || !l) continue
    if ((m = l.match(/^(해석례번호|사건번호|회신일자|선고일|법원|해석기관|판결유형|질의기관):\s*(.+)$/))) cur[m[1]] = m[2]
  }
  return { total: total ? Number(total.replace(/,/g, '')) : out.length, items: out }
}

// 해석례, 판례 전문: "=== 제목 ===", "기본 정보:", 이어서 "질의요지:", "회신내용:", "이유:" 같은 절
export function parseDecision(text) {
  const t = String(text || '')
  const title = t.match(/^===\s*(.+?)\s*===/m)?.[1] || ''
  const info = {}
  const im = t.match(/기본 정보:\n([\s\S]*?)\n\n/)
  if (im) for (const l of lines(im[1])) { const m = l.trim().match(/^([^:]+):\s*(.+)$/); if (m) info[m[1]] = m[2] }
  const sections = []
  const re = /\n([가-힣 ]{2,12}):\n/g
  const idx = []
  let m
  while ((m = re.exec(t))) if (m[1] !== '기본 정보') idx.push({ name: m[1].trim(), at: m.index, end: re.lastIndex })
  idx.forEach((s, i) => {
    const body = t.slice(s.end, i + 1 < idx.length ? idx[i + 1].at : undefined).replace(/<관계 법령>\s*$/, '').trim()
    if (body) sections.push({ name: s.name, text: body.replace(/(\d\))\1/g, '$1').replace(/(다\.)(?=[가-힣「])/g, '$1\n') })
  })
  return { title, info, sections }
}

// 별표: 첫 줄은 제목, 나머지는 마크다운(표)
export function parseAnnex(text) {
  const t = String(text || '').trim()
  const [first, ...rest] = lines(t)
  return { title: first.trim(), markdown: rest.join('\n').replace(/^\(파일 형식:[^)]*\)\s*/m, '').trim() }
}

// 문서 속 인용 「법령명」 제N조(의N)
export function findLawCitations(text) {
  const out = []
  const re = /「([^」]{2,60})」\s*(제\s*\d+\s*조(?:\s*의\s*\d+)?)(?:\s*(제\s*\d+\s*항))?/g
  let m
  while ((m = re.exec(String(text || '')))) {
    const jo = m[2].replace(/\s+/g, '')
    const key = `${m[1]}|${jo}`
    if (!out.some((x) => x.key === key)) out.push({ key, law: m[1].trim(), jo, hang: m[3]?.replace(/\s+/g, '') || '', raw: m[0] })
  }
  return out
}
