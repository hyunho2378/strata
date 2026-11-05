// hwpDoc.js 한글 문서 엔진(편집 화면 쪽). 편집 화면, 인쇄, 한글(HWPX) 내보내기가 같은 값을 쓴다.
// 양식별 값(쪽 여백, 글꼴, 글자 크기, 장평, 자간, 줄 간격, 정렬, 항목 부호와 단계별 들여쓰기)은 kordoc 이 실제로 만드는
// HWPX 를 풀어 잰 hwpMetrics.json(scripts/bake-hwp-metrics.mjs)에서 읽는다. 그래서 화면과 내보낸 파일의 문단 모양이 같다.
// 항목 부호는 kordoc 과 같은 규칙으로 매긴다: 단계별 번호, 상위 단계가 바뀌면 하위 번호 초기화, 항목 사이에 일반 문단이 끼면 처음부터.
import METRICS from './hwpMetrics.json'

export const PRESETS = [
  { key: '기안문', label: '일반기안문(별지 제1호서식)', numbering: 'standard' },
  { key: '보고서', label: '보고서', numbering: 'report' },
  { key: '개조식', label: '개조식 보고서(정부 표준)', numbering: 'report' },
  { key: '계획서', label: '계획서', numbering: 'report' },
  { key: '업무보고', label: '업무보고', numbering: 'report' },
  { key: '알림', label: '공고, 알림', numbering: 'standard' },
  { key: '통지', label: '통지, 안내', numbering: 'standard' },
  { key: '회의록', label: '회의록', numbering: 'standard' },
  { key: '보도자료', label: '보도자료', numbering: 'report' },
  { key: '방침서', label: '방침서', numbering: 'report' }
]
export const presetOf = (key) => PRESETS.find((p) => p.key === key) || PRESETS[1]
export const metricsOf = (key) => METRICS.presets[key] || METRICS.presets['보고서']
export const METRICS_INFO = { kordoc: METRICS.kordoc, generatedAt: METRICS.generatedAt }
export const END_MARK = { 기안문: true }

// 한글 글꼴 이름과 화면 대체 글꼴. 문서에는 왼쪽 이름이 들어가고, 이 컴퓨터에 그 글꼴이 없으면 오른쪽으로 보인다
const FONT_CSS = {
  함초롬바탕: "'함초롬바탕','HCR Batang','Noto Serif KR',serif",
  함초롬돋움: "'함초롬돋움','HCR Dotum','Noto Sans KR',sans-serif",
  휴먼명조: "'휴먼명조','HumanMyeongjo','Noto Serif KR',serif",
  한컴돋움: "'한컴돋움','HancomDotum','Noto Sans KR',sans-serif",
  굴림체: "'굴림체','GulimChe','Nanum Gothic Coding','Noto Sans KR',monospace",
  굴림: "'굴림','Gulim','Noto Sans KR',sans-serif",
  바탕: "'바탕','Batang','Noto Serif KR',serif",
  돋움: "'돋움','Dotum','Noto Sans KR',sans-serif",
  '맑은 고딕': "'맑은 고딕','Malgun Gothic','Noto Sans KR',sans-serif",
  HY헤드라인M: "'HY헤드라인M','HYHeadLine-Medium','Noto Sans KR',sans-serif",
  HY견고딕: "'HY견고딕','HYGothic-Extra','Noto Sans KR',sans-serif"
}
export const FONTS = Object.keys(FONT_CSS)
export const fontCss = (name) => FONT_CSS[name] || FONT_CSS.함초롬바탕
const HEAVY = { HY헤드라인M: 700, HY견고딕: 800 }
export const SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32]
export const LINE_SPACINGS = [100, 130, 145, 150, 160, 170, 180, 190, 200]

// 스타일(한글 스타일 목록 자리)
export const STYLES = [
  { key: 'p', label: '바탕글' },
  { key: 'h1', label: '제목' },
  { key: 'h2', label: '장 제목' },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((lv) => ({ key: `gm${lv}`, label: `개요 ${lv}` })),
  { key: 'note', label: '참고(※)' }
]

// 항목 부호 매기기(kordoc 과 같은 순서)
const GA = '가나다라마바사아자차카타파하'
const hangulSeq = (n) => {
  const i = n - 1
  const base = GA[i % 14]
  const round = Math.floor(i / 14)
  if (!round) return base
  const code = base.charCodeAt(0) - 0xac00
  const cho = Math.floor(code / 588)
  const vowels = [0, 4, 8, 13, 18, 20] // ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ
  return String.fromCharCode(0xac00 + cho * 588 + vowels[round % vowels.length] * 28)
}
export function markFor(sample, n) {
  if (!sample) return ''
  if (/^\(?1[.)]?\)?$/.test(sample) || /^\d/.test(sample) || /^\(\d/.test(sample)) return sample.replace(/\d+/, String(n))
  if (/가/.test(sample)) return sample.replace('가', hangulSeq(n))
  if (sample === '①') return n <= 20 ? String.fromCodePoint(0x245f + n) : `(${n})`
  if (sample === '㉮') return n <= 14 ? String.fromCodePoint(0x326d + n) : hangulSeq(n)
  if (sample === 'Ⅰ.' || sample === 'Ⅰ') return ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'][n - 1] + (sample.endsWith('.') ? '.' : '')
  return sample
}

// 본문 블록에 항목 부호(data-mark)를 매긴다. 기안문 계열은 장 제목(h2)을 1단계로 본다
export function annotate(root, presetKey) {
  if (!root) return
  const m = metricsOf(presetKey)
  const standard = presetOf(presetKey).numbering === 'standard'
  const counters = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  let h2n = 0
  for (const el of root.children) {
    const isGm = el.tagName === 'P' && el.classList.contains('gm')
    const isH2 = el.tagName === 'H2'
    if (isH2 && !standard) { h2n += 1; el.dataset.mark = markFor('Ⅰ', h2n); counters.fill(0); continue }
    if (isGm || (isH2 && standard)) {
      const lv = isH2 ? 1 : Math.max(1, Math.min(8, Number(el.dataset.lv || 1)))
      counters[lv] += 1
      for (let i = lv + 1; i < counters.length; i++) counters[i] = 0
      el.dataset.mark = markFor(m.levels[lv - 1]?.marker, counters[lv])
      continue
    }
    if (el.tagName === 'P' || el.tagName === 'TABLE' || el.classList?.contains('dv-block')) {
      // 일반 문단이 끼면 kordoc 은 목록을 새로 시작한다(표, 쪽 나눔은 이어짐)
      if (el.tagName === 'P' && el.textContent.trim() && !el.classList.contains('gm-note')) counters.fill(0)
    }
    if (el.dataset?.mark) delete el.dataset.mark
  }
}

const r3 = (v) => Math.round(v * 1000) / 1000
const ls = (o) => r3(((o?.ratio ?? 100) - 100) / 200 + (o?.spacing ?? 0) / 100) // 장평은 자간으로 근사(글자 폭 줄임의 절반)
const al = (a) => ({ JUSTIFY: 'justify', CENTER: 'center', RIGHT: 'right', LEFT: 'left', DISTRIBUTE: 'justify' }[a] || 'justify')
const fontRule = (o) => o ? `font-family:${fontCss(o.font)};font-size:${o.pt}pt;font-weight:${o.bold ? 700 : HEAVY[o.font] || 400};letter-spacing:${ls(o)}em;` : ''

// 양식에 맞는 문서 CSS. scope 는 .hwp-page 를 감싼 선택자
export function docCss(presetKey, { showMarks = false } = {}) {
  const m = metricsOf(presetKey)
  const b = m.body
  const p = m.page
  const lv = m.levels.map((l, i) => {
    if (!l) return ''
    const hang = Math.abs(l.intent || 0)
    const markerPt = l.markerPt || l.pt
    return `.hwp-body p.gm[data-lv="${i + 1}"]{${fontRule(l)}padding-left:${r3((l.left || 0) + hang)}em;text-indent:-${hang}em;line-height:${(l.lineSpacing || b.lineSpacing) / 100};text-align:${al(l.align)};margin:${l.prev || 0}em 0 ${l.next || 0}em;}
.hwp-body p.gm[data-lv="${i + 1}"]::before{content:attr(data-mark);display:inline-block;min-width:${hang}em;text-indent:0;font-family:${fontCss(l.markerFont || l.font)};font-size:${markerPt}pt;font-weight:${l.markerBold ? 700 : HEAVY[l.markerFont] || 400};}`
  }).join('\n')
  const h = (sel, o, extra = '') => o ? `.hwp-body ${sel}{${fontRule(o)}text-align:${al(o.align)};line-height:${(o.lineSpacing || 160) / 100};margin:${o.prev || 0}em 0 ${Math.max(o.next || 0, 0.3)}em;${extra}}` : ''
  const std = presetOf(presetKey).numbering === 'standard'
  return `
.hwp-page{box-sizing:border-box;width:${p.width}mm;min-height:${p.height}mm;padding:${p.top}mm ${p.right}mm ${p.bottom}mm ${p.left}mm;background:#fff;color:#000;${fontRule(b)}line-height:${b.lineSpacing / 100};word-break:keep-all;overflow-wrap:anywhere;}
.hwp-body{outline:none;min-height:40mm;}
.hwp-body p{margin:0;text-align:${al(b.align)};}
.hwp-body p:empty::after{content:'\\200b';}
${h('h1', m.h1)}
${std ? `.hwp-body h2{${fontRule(m.levels[0])}margin:0;padding-left:${r3(Math.abs(m.levels[0]?.intent || 0))}em;text-indent:-${r3(Math.abs(m.levels[0]?.intent || 0))}em;text-align:justify;}
.hwp-body h2::before{content:attr(data-mark);display:inline-block;min-width:${r3(Math.abs(m.levels[0]?.intent || 0))}em;text-indent:0;}`
    : `${h('h2', m.h2)}
.hwp-body h2::before{content:attr(data-mark);display:inline-block;min-width:1.6em;margin-right:.5em;padding:0 .2em;text-align:center;color:#fff;background:#083891;font-size:.9em;}`}
${lv}
${[80, 85, 90, 95, 105, 110, 120].map((r) => `.hwp-body [data-ratio="${r}"]{letter-spacing:${r3((r - 100) / 200)}em;}`).join('')}
.hwp-body p.gm-note{padding-left:1.5em;text-indent:-1.5em;}
.hwp-body p.gm-note::before{content:'※';display:inline-block;min-width:1.5em;text-indent:0;}
.hwp-body blockquote{margin:.4em 0;padding:.4em .8em;border:1px solid #000;}
.hwp-body table{border-collapse:collapse;width:100%;margin:.4em 0;border:1.5px solid #000;}
.hwp-body th,.hwp-body td{border:1px solid #000;padding:2px 6px;text-align:center;vertical-align:middle;line-height:1.3;}
.hwp-body th{${fontRule(m.th)}background:#dfe6f7;border-bottom:3px double #000;}
.hwp-body td{${fontRule(m.td)}}
.hwp-body tbody td:first-child{${fontRule(m.tdFirst || m.td)}background:#f2f2f2;}
.hwp-body .dv{background:#e8effd;border-radius:2px;}
.hwp-body .dv-block{display:block;background:none;box-shadow:none;outline:1px dashed #86aff9;outline-offset:2px;}
.hwp-body hr.page-break{border:0;border-top:1px dashed #6d7882;margin:.6em 0;position:relative;overflow:visible;}
.hwp-body hr.page-break::after{content:'쪽 나눔';position:absolute;right:0;top:-.75em;font:10px/1 'Pretendard GOV',sans-serif;color:#6d7882;background:#fff;padding:0 4px;}
${showMarks ? `.hwp-body p::after,.hwp-body h1::after,.hwp-body h2::after{content:'↵';color:#8fb4f9;font:10px/1 sans-serif;margin-left:2px;}` : ''}
.hwp-frame{font-family:${fontCss(b.font)};font-size:${b.pt}pt;line-height:1.6;user-select:none;}
.gian-head .org{text-align:center;font-family:${fontCss('HY헤드라인M')};font-weight:700;font-size:${r3(b.pt * 1.75)}pt;letter-spacing:.9em;margin:.4em 0 1.4em;padding-left:.9em;}
.gian-head .row{display:flex;}
.gian-head .row b{font-weight:400;min-width:5.6em;letter-spacing:.35em;}
.gian-head .row.title{border-bottom:1px solid #000;padding-bottom:.2em;margin-bottom:.4em;}
.gian-foot .end{padding-left:1.4em;margin:.6em 0 1em;}
.gian-foot .sender{text-align:center;font-family:${fontCss('HY헤드라인M')};font-weight:700;font-size:${r3(b.pt * 1.6)}pt;margin:.6em 0 1em;}
.gian-foot .bar{height:.9em;background:#cdd1d5;margin-bottom:.3em;}
.gian-foot .line{display:flex;flex-wrap:wrap;gap:0 1.6em;font-size:.95em;}
.gian-foot .line.sign{gap:0 2.4em;padding-left:1em;}
.approval-box{float:right;border-collapse:collapse;margin:0 0 .6em 1em;font-size:.8em;}
.approval-box td{border:1px solid #000;width:4.5em;height:1.5em;text-align:center;}
.approval-box tr:last-child td{height:3em;}
.notice-head{margin-bottom:.6em;}
.notice-foot{text-align:center;margin-top:1.4em;}
.notice-foot .sender{font-weight:700;font-size:1.3em;margin-top:.4em;}
.press-head{border-top:3px solid #000;border-bottom:1px solid #000;padding:.2em 0;display:flex;justify-content:space-between;font-size:.85em;margin-bottom:.8em;}
@media print{.hwp-page{width:auto;min-height:0;padding:0;}.hwp-body .dv{background:none;box-shadow:none;}.hwp-body .dv-block{outline:0;}.hwp-body hr.page-break{break-after:page;border:0;}.hwp-body hr.page-break::after{content:none;}}
`
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const spaced = (s) => [...String(s || '')].join(' ')

// 문서 둘레(두문, 결문, 결재란, 공고, 보도자료 머리). kordoc 이 만드는 배치를 따른다. 편집 칸 밖에 그린다
export function headHtml(meta) {
  const m = meta || {}
  let out = ''
  if (m.approval?.length) out += `<table class="approval-box"><tr>${m.approval.map((a) => `<td>${esc(a)}</td>`).join('')}</tr><tr>${m.approval.map(() => '<td></td>').join('')}</tr></table>`
  if (m.preset === '기안문' && m.head) {
    out += `<div class="gian-head"><div class="org">${esc(m.head.org || '○○○')}</div>`
    out += `<div class="row"><b>${spaced('수신')}</b><span>${esc(m.head.to || '')}</span></div>`
    out += `<div class="row"><b>(경유)</b><span>${esc(m.head.via || '')}</span></div>`
    out += `<div class="row title"><b>${spaced('제목')}</b><span>${esc(m.head.title || '')}</span></div></div>`
  }
  if (m.noticeHead) out += `<div class="notice-head">${esc(m.noticeHead.no || '')}</div>`
  if (m.press) out += `<div class="press-head"><span>보도시점 ${esc(m.press.release || '')}</span><span>${esc(m.press.contact?.dept || '')} ${esc(m.press.contact?.manager || '')} ${esc(m.press.contact?.phone || '')}</span></div>`
  return out
}
export function footHtml(meta) {
  const m = meta || {}
  let out = ''
  if (END_MARK[m.preset]) out += '<div class="gian-foot"><div class="end">끝.</div></div>'
  if (m.preset === '기안문' && m.foot) {
    const f = m.foot
    const sign = [f.drafter, f.reviewer, f.approver].filter(Boolean).map((s) => `<span>${esc(s)}</span>`).join('')
    out += `<div class="gian-foot"><div class="sender">${esc(f.sender || '')}</div><div class="bar"></div>
      <div class="line sign">${sign}</div>
      <div class="line"><span>협조자</span></div>
      ${f.recipients ? `<div class="line"><span>수신자 ${esc(f.recipients)}</span></div>` : ''}
      <div class="line"><span>시행 ${esc(f.docNum || '')}</span><span>접수</span></div>
      <div class="line"><span>우 ${esc(f.zip || '')} ${esc(f.address || '')}</span><span>/ ${esc(f.site || '')}</span></div>
      <div class="line"><span>전화 ${esc(f.phone || '')}</span><span>/전송 ${esc(f.fax || '')}</span><span>/ ${esc(f.email || '')}</span><span>/ ${esc(f.disclosure || '')}</span></div></div>`
  }
  if (m.noticeHead) out += `<div class="notice-foot">${esc(m.noticeHead.date || '')}<div class="sender">${esc(m.noticeHead.sender || '')}</div></div>`
  return out
}

// ── 내보내기: 편집 본문 → kordoc 마크다운 + 글자 모양(spans) + 문단 모양(paras)
const rgbHex = (c) => {
  if (!c) return null
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase()
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!m || (m[4] != null && Number(m[4]) === 0)) return null
  return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
const toPt = (v) => {
  if (!v) return null
  const n = parseFloat(v)
  if (/pt$/.test(v)) return n
  if (/px$/.test(v)) return Math.round((n * 72) / 96 * 10) / 10
  return null
}
function styleOf(el, ctx) {
  const st = { ...ctx }
  const t = el.tagName
  if (t === 'B' || t === 'STRONG') st.b = 1
  if (t === 'I' || t === 'EM') st.i = 1
  if (t === 'U' || t === 'INS') st.u = 1
  if (t === 'S' || t === 'STRIKE' || t === 'DEL') st.s = 1
  const s = el.style
  if (!s) return st
  if (s.fontWeight === 'bold' || Number(s.fontWeight) >= 600) st.b = 1
  if (s.fontWeight === 'normal' || (Number(s.fontWeight) && Number(s.fontWeight) < 600)) delete st.b
  if (s.fontStyle === 'italic') st.i = 1
  const deco = `${s.textDecoration} ${s.textDecorationLine}`
  if (/underline/.test(deco)) st.u = 1
  if (/line-through/.test(deco)) st.s = 1
  const pt = toPt(s.fontSize); if (pt) st.pt = pt
  const color = rgbHex(s.color); if (color) st.color = color
  const bg = rgbHex(s.backgroundColor); if (bg) st.bg = bg
  if (el.dataset?.font && FONT_CSS[el.dataset.font]) st.font = el.dataset.font
  if (el.dataset?.ratio) st.ratio = Number(el.dataset.ratio)
  if (s.letterSpacing && /em$/.test(s.letterSpacing)) st.spacing = Math.round(parseFloat(s.letterSpacing) * 100)
  return st
}
function runsOf(node, ctx = {}, out = []) {
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { if (c.nodeValue) out.push({ text: c.nodeValue.replace(/\u00a0/g, ' ').replace(/\u200b/g, ''), st: ctx }); continue }
    if (c.nodeType !== 1) continue
    if (c.tagName === 'BR') { out.push({ text: ' ', st: ctx }); continue }
    runsOf(c, styleOf(c, ctx), out)
  }
  return out
}
const mdEsc = (s, inTable) => s.replace(/([\\*_`~])/g, '\\$1').replace(inTable ? /\|/g : /$^/, '\\|').replace(/⟪|⟫/g, '')
const keyOf = (st) => JSON.stringify(Object.keys(st).sort().map((k) => [k, st[k]]))

function inlineMd(node, ctx, inTable) {
  const runs = runsOf(node, ctx)
  // 같은 모양끼리 합친다
  const merged = []
  for (const r of runs) {
    const last = merged[merged.length - 1]
    if (last && keyOf(last.st) === keyOf(r.st)) last.text += r.text
    else merged.push({ ...r })
  }
  let md = ''
  for (const r of merged) {
    let text = r.text.replace(/\s+/g, ' ')
    if (!text) continue
    const extra = Object.keys(r.st).filter((k) => k !== 'b' && k !== 'i')
    if (extra.length) {
      const id = ctx.__next()
      ctx.__spans[id] = Object.fromEntries(Object.entries(r.st).filter(([k]) => !k.startsWith('__')))
      md += `⟪s${id}⟫${mdEsc(text, inTable)}⟪/⟫`
      continue
    }
    const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0]
    const core = text.trim()
    if (!core) { md += text; continue }
    const w = r.st.b && r.st.i ? '***' : r.st.b ? '**' : r.st.i ? '*' : ''
    md += `${lead}${w}${mdEsc(core, inTable)}${w}${tail}`
  }
  return md.trim()
}

// 표 → GFM 표(칸 안 글자 모양 표지 포함)
function tableMd(table, ctx) {
  const rows = [...table.querySelectorAll('tr')]
  if (!rows.length) return ''
  const cells = rows.map((tr) => [...tr.children].map((td) => inlineMd(td, ctx, true) || ' '))
  const n = Math.max(...cells.map((r) => r.length))
  const line = (r) => `| ${Array.from({ length: n }, (_, i) => r[i] ?? ' ').join(' | ')} |`
  return [line(cells[0]), `| ${Array.from({ length: n }, () => '---').join(' | ')} |`, ...cells.slice(1).map(line)].join('\n')
}

export function toHwpxPayload(root, meta) {
  const spans = {}, paras = {}
  let n = 0, pn = 0
  const ctx = { __spans: spans, __next: () => ++n }
  // ctx 의 내부 키는 모양으로 치지 않는다
  Object.defineProperty(ctx, '__spans', { enumerable: false }); Object.defineProperty(ctx, '__next', { enumerable: false })
  const standard = presetOf(meta?.preset).numbering === 'standard'
  const lines = []
  let pageBreak = false
  const paraMark = (el) => {
    const p = {}
    const a = el.style?.textAlign
    if (a && ['left', 'center', 'right', 'justify'].includes(a)) p.align = a
    const lh = el.style?.lineHeight
    if (lh && /%$/.test(lh)) p.lh = parseFloat(lh)
    if (pageBreak) { p.pageBreak = 1; pageBreak = false }
    if (!Object.keys(p).length) return ''
    pn += 1; paras[pn] = p
    return `⟪p${pn}⟫`
  }
  for (const el of root.children) {
    const tag = el.tagName
    if (tag === 'HR') { if (el.classList.contains('page-break')) pageBreak = true; continue }
    // 끝 표시는 kordoc 이 양식에 맞게 붙인다(기안문). 손으로 쓴 끝. 문단은 빼서 두 번 찍히지 않게 한다
    if (END_MARK[meta?.preset] && el.textContent.replace(/\s/g, '') === '끝.') continue
    if (tag === 'H1') { lines.push('', `# ${paraMark(el)}${inlineMd(el, ctx)}`, ''); continue }
    if (tag === 'H2') {
      if (standard) lines.push(`- ${paraMark(el)}${inlineMd(el, ctx)}`)
      else lines.push('', `## ${paraMark(el)}${inlineMd(el, ctx)}`, '')
      continue
    }
    if (tag === 'P' && el.classList.contains('gm')) {
      const lv = Math.max(1, Math.min(8, Number(el.dataset.lv || 1)))
      lines.push(`${'  '.repeat(lv - 1)}- ${paraMark(el)}${inlineMd(el, ctx)}`)
      continue
    }
    if (tag === 'P' && el.classList.contains('gm-note')) { lines.push('', `${paraMark(el)}※ ${inlineMd(el, ctx)}`, ''); continue }
    if (tag === 'TABLE') { lines.push('', tableMd(el, ctx), ''); continue }
    if (el.classList?.contains('dv-block')) { const t = el.querySelector('table'); if (t) lines.push('', tableMd(t, ctx), ''); continue }
    if (tag === 'BLOCKQUOTE') { lines.push('', `> ${inlineMd(el, ctx)}`, ''); continue }
    if (tag === 'UL' || tag === 'OL') {
      for (const li of el.querySelectorAll(':scope > li')) lines.push(`- ${inlineMd(li, ctx)}`)
      continue
    }
    const text = inlineMd(el, ctx)
    if (text) lines.push('', `${paraMark(el)}${text}`, '')
    else if (pageBreak) { /* 빈 문단에 쪽 나눔이 걸리면 다음 문단으로 넘긴다 */ }
  }
  const markdown = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
  return { markdown, spans, paras }
}

// kordoc 공문 옵션
export function gongmunOptions(meta) {
  const m = meta || {}
  const o = {}
  if (m.preset === '기안문') {
    if (m.head) o.docHead = { org: m.head.org, to: m.head.to, via: m.head.via, title: m.head.title }
    if (m.foot) o.docFoot = { ...m.foot }
  }
  if (m.approval?.length) o.approval = m.approval
  if (m.noticeHead) o.noticeHead = m.noticeHead
  if (m.press) o.press = m.press
  if (m.pageNumbers != null) o.pageNumbers = !!m.pageNumbers
  return o
}

// 인쇄용 전체 HTML(화면과 같은 CSS)
export function printHtml(title, meta, bodyHtml) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Noto+Sans+KR:wght@400;700;900&family=Nanum+Gothic+Coding&display=swap">
<style>@page{size:A4;margin:0;}body{margin:0;}${docCss(meta?.preset)}</style></head>
<body><div class="hwp-page"><div class="hwp-frame">${headHtml(meta)}</div><div class="hwp-body">${bodyHtml}</div><div class="hwp-frame">${footHtml(meta)}</div></div></body></html>`
}
