// 문서 변환 도구. 편집기 HTML 을 마크다운으로(HWPX 내보내기), 마크다운을 HTML 로(한글 파일 가져오기),
// 본문에서 법령 인용을 찾는 함수를 모아 둔다. 브라우저 DOM 을 쓴다.
// .doc-page 스타일은 index.css 에 있어 표는 인라인 스타일로 그린다.

const TD = 'border:1px solid #9ca3af;padding:6px 8px;vertical-align:top'
const TH = `${TD};background:#f3f4f6;font-weight:700`
const TABLE = 'border-collapse:collapse;width:100%;margin:12px 0;font-size:14px'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const squash = (s) => String(s).replace(/[\u00a0\s]+/g, ' ')

// ---------- HTML 에서 마크다운 ----------

const mdText = (s) => s.replace(/\\/g, '\\\\').replace(/([*_`[\]<])/g, '\\$1')

function inline(node, ctx = {}) {
  let out = ''
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += mdText(squash(n.nodeValue)); return }
    if (n.nodeType !== 1) return
    const tag = n.tagName
    if (tag === 'BR') { out += ctx.cell ? ' ' : '  \n'; return }
    if (tag === 'UL' || tag === 'OL' || tag === 'TABLE') return // 블록은 호출한 쪽에서 처리
    const inner = inline(n, ctx)
    if (!inner.trim()) { out += inner; return }
    if (tag === 'B' || tag === 'STRONG') out += `**${inner.trim()}**`
    else if (tag === 'I' || tag === 'EM') out += `*${inner.trim()}*`
    else if (tag === 'A') {
      const href = n.getAttribute('href') || ''
      out += /^(https?:|mailto:)/i.test(href) ? `[${inner.trim()}](${href.replace(/\)/g, '%29')})` : inner
    } else out += inner
  })
  return out
}

function cellText(cell) {
  return inline(cell, { cell: true }).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

function tableMd(table) {
  const rows = [...table.querySelectorAll('tr')].map((tr) => [...tr.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH').map(cellText)).filter((r) => r.length)
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.length))
  const pad = (r) => [...r, ...Array(cols - r.length).fill('')]
  const line = (r) => `| ${pad(r).join(' | ')} |`
  return [line(rows[0]), `| ${Array(cols).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n')
}

function listMd(list, depth = 0) {
  const ordered = list.tagName === 'OL'
  const lines = []
  let i = 0
  ;[...list.children].forEach((li) => {
    if (li.tagName !== 'LI') return
    i += 1
    const text = inline(li).replace(/\s*\n\s*/g, ' ').trim()
    const pad = '  '.repeat(depth)
    lines.push(`${pad}${ordered ? `${i}.` : '-'} ${text}`)
    li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => lines.push(listMd(sub, depth + 1)))
  })
  return lines.filter(Boolean).join('\n')
}

// 첫 글자가 마크다운 문법으로 읽히지 않게 막는다
const guardStart = (s) => s.replace(/^(\s*)([#>+-]|\d+[.)])(\s)/, '$1\\$2$3')

export function htmlToMarkdown(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  const blocks = []
  const walk = (parent) => {
    let buf = ''
    const flush = () => { const t = guardStart(buf.trim()); if (t) blocks.push(t); buf = '' }
    parent.childNodes.forEach((n) => {
      if (n.nodeType === 3) { buf += mdText(squash(n.nodeValue)); return }
      if (n.nodeType !== 1) return
      const tag = n.tagName
      if (/^H[1-6]$/.test(tag)) {
        flush()
        const t = inline(n).replace(/\s*\n\s*/g, ' ').trim()
        if (t) blocks.push(`${tag === 'H1' ? '#' : '##'} ${t}`)
      } else if (tag === 'UL' || tag === 'OL') { flush(); const t = listMd(n); if (t) blocks.push(t) }
      else if (tag === 'TABLE') { flush(); const t = tableMd(n); if (t) blocks.push(t) }
      else if (tag === 'P') {
        flush()
        const t = guardStart(inline(n).replace(/(\s*\n)+$/, '').trim())
        if (t) blocks.push(t)
        n.querySelectorAll(':scope > ul, :scope > ol, :scope > table').forEach((sub) => { blocks.push(sub.tagName === 'TABLE' ? tableMd(sub) : listMd(sub)) })
      } else if (tag === 'DIV' || tag === 'SECTION' || tag === 'BLOCKQUOTE') {
        flush(); walk(n)
      } else if (tag === 'BR') { flush() }
      else buf += inline({ childNodes: [n] })
    })
    flush()
  }
  walk(root)
  return blocks.join('\n\n')
}

// ---------- 마크다운에서 HTML ----------

const ALLOWED_INLINE = ['br', 'sup', 'sub', 'b', 'strong', 'i', 'em', 'u']

function inlineHtml(raw) {
  // 허용한 태그만 남기고 나머지는 글자로 둔다
  let s = esc(raw)
  s = s.replace(new RegExp(`&lt;(\\/?)(${ALLOWED_INLINE.join('|')})\\s*\\/?&gt;`, 'gi'), (m, close, tag) => (tag.toLowerCase() === 'br' ? '<br>' : `<${close}${tag.toLowerCase()}>`))
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, (m, c) => `&#${c.charCodeAt(0)};`)
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<i>$2</i>')
  return s
}

// kordoc 이 복잡한 표를 HTML 로 내보낼 때가 있어 허용 목록으로 다시 만든다
function cleanTableHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const t = doc.querySelector('table')
  if (!t) return ''
  const cell = (c) => {
    const span = ['colspan', 'rowspan'].map((a) => { const v = parseInt(c.getAttribute(a) || '', 10); return v > 1 && v < 50 ? ` ${a}="${v}"` : '' }).join('')
    const tag = c.tagName === 'TH' ? 'th' : 'td'
    const body = inlineHtml(c.innerHTML.replace(/<br\s*\/?>/gi, '&lt;br&gt;').replace(/<(?!\/?(?:sup|sub|b|strong|i|em|u)\b)[^>]*>/gi, '').replace(/&lt;br&gt;/g, '<br>').replace(/<(\/?)(sup|sub|b|strong|i|em|u)>/gi, '&lt;$1$2&gt;').replace(/&(?!lt;|gt;|amp;|quot;|#)/g, '&amp;'))
    return `<${tag}${span} style="${tag === 'th' ? TH : TD}">${body}</${tag}>`
  }
  const rows = [...t.querySelectorAll('tr')].map((tr) => `<tr>${[...tr.children].filter((c) => /^(TD|TH)$/.test(c.tagName)).map(cell).join('')}</tr>`)
  return `<table style="${TABLE}"><tbody>${rows.join('')}</tbody></table>`
}

const splitRow = (line) => {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}
const isSep = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line) && line.includes('-')

export function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0
  const isBlank = (l) => !l || !l.trim()
  const listRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/

  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) { i++; continue }

    // 원문 HTML 표
    if (/^\s*<table\b/i.test(line)) {
      const buf = []
      while (i < lines.length) { buf.push(lines[i]); if (/<\/table>/i.test(lines[i])) { i++; break } i++ }
      const t = cleanTableHtml(buf.join('\n'))
      if (t) out.push(t)
      continue
    }
    // 제목
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (h) {
      const text = inlineHtml(h[2])
      if (h[1].length === 1) out.push(`<h1>${text}</h1>`)
      else if (h[1].length === 2) out.push(`<h2>${text}</h2>`)
      else out.push(`<p><b>${text}</b></p>`)
      i++; continue
    }
    // GFM 표
    if (line.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(line)
      i += 2
      const body = []
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) { body.push(splitRow(lines[i])); i++ }
      const cols = Math.max(head.length, ...body.map((r) => r.length))
      const fit = (r) => [...r, ...Array(cols - r.length).fill('')]
      out.push(`<table style="${TABLE}"><tbody><tr>${fit(head).map((c) => `<th style="${TH}">${inlineHtml(c)}</th>`).join('')}</tr>${body.map((r) => `<tr>${fit(r).map((c) => `<td style="${TD}">${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    // 목록(들여쓰기로 중첩)
    if (listRe.test(line)) {
      const stack = [] // { indent, ordered }
      let html = ''
      while (i < lines.length && !isBlank(lines[i]) && listRe.test(lines[i])) {
        const [, sp, mark, text] = lines[i].match(listRe)
        const indent = sp.replace(/\t/g, '  ').length
        const ordered = /\d/.test(mark)
        while (stack.length && indent < stack[stack.length - 1].indent) { html += `</li></${stack.pop().ordered ? 'ol' : 'ul'}>` }
        if (!stack.length || indent > stack[stack.length - 1].indent) {
          stack.push({ indent, ordered }); html += `<${ordered ? 'ol' : 'ul'}><li>`
        } else html += '</li><li>'
        html += inlineHtml(text)
        i++
      }
      while (stack.length) html += `</li></${stack.pop().ordered ? 'ol' : 'ul'}>`
      out.push(html)
      continue
    }
    // 문단. 빈 줄이나 다른 블록이 나올 때까지 모은다
    const buf = []
    while (i < lines.length && !isBlank(lines[i]) && !/^\s{0,3}#{1,6}\s/.test(lines[i]) && !listRe.test(lines[i]) && !/^\s*<table\b/i.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isSep(lines[i + 1]))) {
      buf.push(lines[i].replace(/^\s*>\s?/, '').replace(/\s{2,}$/, '<br>').trim())
      i++
    }
    if (buf.length) out.push(`<p>${buf.map(inlineHtml).join(' ').replace(/&lt;br&gt;/g, '<br>')}</p>`)
  }
  return out.join('') || '<h1>제목 없는 문서</h1><p></p>'
}

// ---------- 법령 인용 ----------

const CITE = /「([^」]{2,60})」\s*((?:제\s*\d+\s*조(?:\s*의\s*\d+)?)(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?)/g
const ARTICLE_ONLY = /제\s*\d+\s*조/

// 서버 호출 전에 본문에 조문 인용이 있는지 본다. 법령명이 붙은 것만 목록으로 돌려준다
export function findCitations(text) {
  const found = []
  const seen = new Set()
  for (const m of String(text).matchAll(CITE)) {
    const c = `${m[1].trim()} ${m[2].replace(/\s+/g, '')}`
    if (!seen.has(c)) { seen.add(c); found.push(c) }
  }
  return { citations: found, hasArticle: ARTICLE_ONLY.test(text) }
}

export const hashText = (s) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return `${s.length}:${h.toString(36)}`
}
