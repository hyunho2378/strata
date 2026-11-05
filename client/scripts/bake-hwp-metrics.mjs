// 양식별 한글 문서 실측값 굽기. kordoc 이 실제로 만드는 HWPX 를 풀어 쪽 여백, 글꼴, 글자 크기, 장평, 자간, 줄 간격,
// 문단 정렬, 항목 단계별 왼쪽 여백과 내어쓰기, 항목 부호, 부호 뒤 탭 폭을 읽는다. 편집 화면은 이 값으로 그린다.
// 실행: node scripts/bake-hwp-metrics.mjs → src/pages/workspace/hwpMetrics.json
import * as k from 'kordoc'
import JSZip from 'jszip'
import { writeFileSync } from 'node:fs'

const PRESETS = { 기안문: 'official', 보고서: 'report', 개조식: 'gaejosik', 계획서: 'plan', 업무보고: 'ministry', 알림: 'notice', 통지: 'notice', 회의록: 'minutes', 보도자료: 'press', 방침서: 'bangchim' }
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((d) => [`${'  '.repeat(d)}- LV${d + 1}첫째`, `${'  '.repeat(d)}- LV${d + 1}둘째`])
const TABLE = ['', '| 표머리가 | 표머리나 |', '| --- | --- |', '| 표내용가 | 표내용나 |', '']
const MD_HEAD = ['# 제목가나다', '', '## 장제목가나다', '', '본문문단가나다', ''].join('\n')
const MD_LEVELS = ['본문문단가나다', '', ...LEVELS, ...TABLE].join('\n')
const HU = 7200 / 25.4
const attr = (s, n) => s.match(new RegExp(`${n}="([^"]*)"`))?.[1]

async function analyze(md, preset) {
  const zip = await JSZip.loadAsync(await k.markdownToHwpx(md, { gongmun: { preset, toc: false } }))
  const header = await zip.file('Contents/header.xml').async('string')
  const secs = Object.keys(zip.files).filter((f) => /Contents\/section\d+\.xml$/.test(f)).sort()
  const section = (await Promise.all(secs.map((f) => zip.file(f).async('string')))).join('\n')
  const fonts = [...(header.match(/<hh:fontface lang="HANGUL"[^>]*>([\s\S]*?)<\/hh:fontface>/)?.[1] || '').matchAll(/<hh:font id="(\d+)" face="([^"]+)"/g)].map((m) => m[2])
  const charPr = {}
  for (const m of header.matchAll(/<hh:charPr id="(\d+)"([^>]*)>([\s\S]*?)<\/hh:charPr>/g)) {
    const b = m[3]
    charPr[m[1]] = { pt: Number(attr(m[2], 'height')) / 100, font: fonts[Number(b.match(/<hh:fontRef hangul="(\d+)"/)?.[1] || 0)], ratio: Number(b.match(/<hh:ratio hangul="(\d+)"/)?.[1] || 100), spacing: Number(b.match(/<hh:spacing hangul="(-?\d+)"/)?.[1] || 0), bold: /<hh:bold\/>/.test(b), color: attr(m[2], 'textColor') }
  }
  const paraPr = {}
  for (const m of header.matchAll(/<hh:paraPr id="(\d+)"[^>]*>([\s\S]*?)<\/hh:paraPr>/g)) {
    const b = m[2]
    const mg = Object.fromEntries([...b.matchAll(/<hc:(intent|left|right|prev|next) value="(-?\d+)"/g)].map((x) => [x[1], Number(x[2])]))
    paraPr[m[1]] = { align: b.match(/horizontal="(\w+)"/)?.[1], lineSpacing: Number(b.match(/<hh:lineSpacing type="PERCENT" value="(\d+)"/)?.[1] || 160), ...mg }
  }
  // 가장 안쪽 문단만(표를 품은 바깥 문단이 칸 글을 가로채지 않게)
  const paras = [...section.matchAll(/<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*>((?:(?!<hp:p )[\s\S])*?)<\/hp:p>/g)].map((m) => ({
    paraPr: m[1],
    runs: [...m[2].matchAll(/<hp:run charPrIDRef="(\d+)"[^>]*>([\s\S]*?)<\/hp:run>/g)].map((r) => ({ charPr: r[1], text: [...r[2].matchAll(/<hp:t>([\s\S]*?)<\/hp:t>/g)].map((t) => t[1].replace(/<hp:tab width="(\d+)"[^>]*\/>/g, (_, w) => `\t${w}\t`).replace(/<[^>]+>/g, '')).join('') })).filter((r) => r.text)
  }))
  const page = section.match(/<hp:pagePr[^>]*width="(\d+)" height="(\d+)"[^>]*>\s*<hp:margin([^>]*)\/>/)
  const find = (word) => {
    const p = paras.find((x) => x.runs.map((r) => r.text).join('').includes(word))
    if (!p) return null
    const text = p.runs.map((r) => r.text).join('')
    const run = p.runs.find((r) => r.text.includes(word.slice(0, 3))) || p.runs[p.runs.length - 1]
    const pre = text.slice(0, text.indexOf(word))
    const mrun = p.runs[0] !== run ? charPr[p.runs[0].charPr] : null
    return { marker: pre.replace(/\t\d+\t/g, ''), tab: Number(pre.match(/\t(\d+)\t/)?.[1] || 0), markerFont: mrun?.font, markerPt: mrun?.pt, markerBold: mrun?.bold, ...charPr[run.charPr], ...paraPr[p.paraPr] }
  }
  return { find, page }
}

const mm = (n) => Math.round((Number(n) / HU) * 10) / 10
const out = { generatedAt: new Date().toISOString().slice(0, 10), kordoc: k.VERSION, note: 'kordoc markdownToHwpx 산출 HWPX 실측. left, intent, prev, next, tab 은 본문 글자 크기 기준 em', presets: {} }
for (const [label, preset] of Object.entries(PRESETS)) {
  const a = await analyze(MD_LEVELS, preset)
  const h = await analyze(MD_HEAD, preset)
  const body = a.find('본문문단')
  const em = (v) => Math.round(((v || 0) / (body.pt * 100)) * 1000) / 1000
  const toEm = (o) => o && ({ ...o, left: em(o.left), intent: em(o.intent), prev: em(o.prev), next: em(o.next), tab: em(o.tab), right: em(o.right) })
  const pm = a.page[3]
  out.presets[label] = {
    preset,
    page: { width: mm(a.page[1]), height: mm(a.page[2]), top: mm(attr(pm, 'top')), bottom: mm(attr(pm, 'bottom')), left: mm(attr(pm, 'left')), right: mm(attr(pm, 'right')), header: mm(attr(pm, 'header')), footer: mm(attr(pm, 'footer')) },
    body: toEm(body), h1: toEm(h.find('제목가나다')), h2: toEm(h.find('장제목가나다')),
    levels: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => toEm(a.find(`LV${n}첫째`))),
    th: toEm(a.find('표머리가')), td: toEm(a.find('표내용나')), tdFirst: toEm(a.find('표내용가'))
  }
  const p = out.presets[label]
  console.log(label, preset, `여백 ${p.page.top}/${p.page.bottom}/${p.page.left}/${p.page.right}`, `본문 ${body.font} ${body.pt}pt 장평${body.ratio} 줄${body.lineSpacing}`, '항목', p.levels.map((l) => l?.marker).join(' '), '| h2', p.h2?.marker, p.h2?.font, p.h2?.pt)
}
writeFileSync('src/pages/workspace/hwpMetrics.json', JSON.stringify(out, null, 1))
