// ui-audit.mjs UI_PLAYBOOK 5.1 정적 검수. node scripts/ui-audit.mjs  (위반 0건이어야 통과)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const files = []
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name)
  if (e.isDirectory()) walk(p)
  else if (/\.(jsx?|css)$/.test(e.name)) files.push(p)
})
walk(ROOT)

const rel = (p) => path.relative(ROOT, p)
const inUi = (p) => rel(p).startsWith('components/ui/')
const isPage = (p) => rel(p).startsWith('pages/')

const RULES = [
  { id: '액센트 보더', re: /border-l-|border-l\b|border-t-[2-9]|w-\[3px\]|ring-2 ring-primary\b|\bborder-primary\b/g, skip: (p) => inUi(p) || /\/ReviewRow\.jsx$/.test(rel(p)) },
  { id: '굵기 직접 지정', re: /\bfont-(thin|light|normal|medium|semibold|bold|extrabold|black)\b/g, skip: (p) => rel(p) === 'components/ui/Button.jsx' },
  { id: '카드 표면 직접 작성', re: /\bshadow-card\b/g, skip: (p) => inUi(p) || rel(p).startsWith('components/dashboard/') || /\/MetricCard\.jsx$/.test(rel(p)) },
  { id: 'details 직접 사용', re: /<details\b/g, skip: (p) => rel(p) === 'components/ui/Disclosure.jsx' },
  { id: '키값 dl 직접 작성', re: /grid-cols-\[auto_1fr\]/g, skip: (p) => rel(p) === 'components/ui/KeyValue.jsx' || rel(p) === 'components/dashboard/DataTable.jsx' },
  { id: '페이지 원시 컨트롤', re: /<(button|input|textarea|select)\b/g, skip: (p) => !isPage(p) },
  { id: '페이지 로컬 스테퍼', re: /function Stepper\b/g, skip: (p) => !isPage(p) },
  { id: 'hex 직접 입력', re: /#[0-9A-Fa-f]{6}\b/g, skip: (p) => rel(p) === 'tokens.js' },
  { id: '금지 속성', re: /transition-all|hover:scale|hover:-?translate|localStorage|sessionStorage|type="(date|time)"|bg-gradient|linear-gradient|backdrop-blur/g, skip: () => false },
  { id: '금지 문자', re: /[·—–]|[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, skip: (p) => rel(p) === 'tokens.js' },
  { id: '니다체', re: /니다/g, skip: () => false },
  // 2026-10-02 3차: 레퍼런스 3종(make-interfaces-feel-better, emil/apple, material3) 반영
  { id: '원시 표', re: /<table\b/g, skip: (p) => [/\/DataTable\.jsx$/, /\/Heatmap\.jsx$/, /\/ShortageTable\.jsx$/].some((re) => re.test(rel(p))) },
  { id: 'DataTable 직접 사용', re: /import DataTable\b/g, skip: (p) => rel(p) === 'components/dashboard/TableCard.jsx' },
  { id: '아이콘 타일', re: /h-(8|9|10|11|12) w-\1[^"']*bg-(primary|danger|mute)-soft|bg-(primary|danger)-soft[^"']*h-(8|9|10|11|12) w-(8|9|10|11|12)/g, skip: () => false },
  { id: '설명 문장', re: /desc=["'`][^"'`]{28,}["'`]|>\s*[가-힣][^<>{}]{44,}</g, skip: (p) => !/^(pages|components)\//.test(rel(p)) || rel(p).startsWith('components/ui/') }
]

let total = 0
for (const rule of RULES) {
  const hits = []
  for (const f of files) {
    if (rule.skip(f)) continue
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return // 주석 제외
      const m = line.match(rule.re)
      if (m) hits.push(`  ${rel(f)}:${i + 1}  ${m.join(' ')}`)
    })
  }
  total += hits.length
  console.log(`${hits.length ? 'FAIL' : 'ok  '} ${rule.id} ${hits.length}`)
  if (hits.length) console.log(hits.slice(0, 40).join('\n'))
}
console.log(total ? `\n위반 ${total}건` : '\n위반 0건')
process.exit(total ? 1 : 0)
