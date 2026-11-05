// docVars.js 문서에 넣는 자료값. 지도 화면과 같은 자료(client/src/data/strata.json)로 지금 숫자를 만든다.
// 문서 안에서는 <span class="dv" data-var="키"> 로 들어가고, 문서를 열 때와 [자료 새로 고침]을 누를 때 값이 바뀐다.
// 계산은 <span class="dv" data-calc="식" data-fmt="소수 자리"> 로 들어간다. 식에는 자료 키와 + - * / ( ) 숫자만 쓴다.
import { countByStatus } from './strataData.js'

const n = (x) => Number(x || 0).toLocaleString('ko-KR')
export const dotDate = (d = new Date()) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`

// 자료 목록(편집기 오른쪽 자료 넣기에 보이는 순서). group 으로 묶는다
export const VAR_DEFS = [
  { key: 'today', label: '오늘 날짜', group: '기본' },
  { key: 'basis', label: '자료 기준', group: '기본' },
  { key: 'org', label: '기관명', group: '기본' },
  { key: 'facilities', label: '등록 시설', unit: '곳', group: '시설', num: true },
  { key: 'multiRole', label: '둘 이상 기능 시설', unit: '곳', group: '시설', num: true },
  { key: 'threePlus', label: '세 기능 이상 시설', unit: '곳', group: '시설', num: true },
  { key: 'roles', label: '기능 종류', unit: '종', group: '시설', num: true },
  { key: 'open', label: '운영 중 시설', unit: '곳', group: '운영', num: true },
  { key: 'closed', label: '운영 중단 시설', unit: '곳', group: '운영', num: true },
  { key: 'check', label: '확인 필요 시설', unit: '곳', group: '운영', num: true },
  { key: 'events', label: '등록된 중단 일정', unit: '건', group: '운영', num: true },
  { key: 'alternatives', label: '대체 시설 연결', unit: '건', group: '운영', num: true },
  { key: 'tableRoles', label: '기능별 시설 수 표', group: '표', table: true },
  { key: 'tableClosed', label: '운영 중단 시설 표', group: '표', table: true }
]
export const VAR_BY_KEY = Object.fromEntries(VAR_DEFS.map((d) => [d.key, d]))

const TD = 'border:1px solid #33363d;padding:4px 6px;text-align:center'
const TH = `${TD};background:#e6e8ea;font-weight:700`
const table = (head, rows) => `<table class="dv-table" style="border-collapse:collapse;width:100%;margin:6px 0"><thead><tr>${head.map((h) => `<th style="${TH}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="${TD}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`

// 값 계산. data 는 strata.json 한 벌, ms 는 보고 있는 시각
export function computeVars(data, ms = Date.now()) {
  const facilities = data?.facilities || []
  const roles = data?.roles || []
  const by = countByStatus(facilities, ms)
  const roleCount = Object.fromEntries(roles.map((r) => [r.id, 0]))
  let events = 0
  let alts = 0
  let multi = 0
  let three = 0
  for (const f of facilities) {
    const ids = [...new Set((f.roles || []).map((r) => r.role))]
    if (ids.length >= 2) multi += 1
    if (ids.length >= 3) three += 1
    for (const id of ids) roleCount[id] = (roleCount[id] || 0) + 1
    events += (f.events || []).length
    alts += (f.alternatives || []).length
  }
  const closedRows = facilities
    .filter((f) => (f.events || []).length)
    .flatMap((f) => (f.events || []).map((e) => [f.name, e.cause || e.kind || '', `${e.start || '미정'} ~ ${e.end || '미정'}`, e.certainty || '']))
  const vals = {
    today: dotDate(new Date()),
    basis: data?.basis || '○○○',
    org: '동해시',
    facilities: facilities.length,
    multiRole: multi,
    threePlus: three,
    roles: roles.length,
    open: by.open || 0,
    closed: by.closed || 0,
    check: by.check || 0,
    events,
    alternatives: alts
  }
  vals.tableRoles = roles.length
    ? table(['기능', '시설 수'], roles.map((r) => [r.label, `${n(roleCount[r.id] || 0)}곳`]))
    : table(['기능', '시설 수'], [['자료 없음', '']])
  vals.tableClosed = closedRows.length
    ? table(['시설', '사유', '기간', '확실성'], closedRows)
    : table(['시설', '사유', '기간', '확실성'], [['운영 중단 일정 없음', '', '', '']])
  return vals
}

export function formatVar(key, vals) {
  const d = VAR_BY_KEY[key]
  const v = vals[key]
  if (v == null) return '○○○'
  if (d?.num && typeof v === 'number') return `${n(v)}${d.unit || ''}`
  return String(v)
}

// 계산식: 자료 키와 숫자, 사칙연산만 허용
export function evalCalc(expr, vals, digits = 0) {
  const src = String(expr).replace(/[A-Za-z][A-Za-z0-9]*/g, (k) => (VAR_BY_KEY[k]?.num ? String(Number(vals[k] || 0)) : 'NaN'))
  if (!/^[\d\s+\-*/().NaN]+$/.test(src)) return '계산 불가'
  try {
    const r = Function(`"use strict";return (${src})`)()
    if (!Number.isFinite(r)) return '계산 불가'
    return r.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  } catch { return '계산 불가' }
}

// 문서에서 고친 값(overrides: 키별 글)을 얹는다. 숫자로 읽히면 숫자로 바꿔 계산에도 쓴다
export function withOverrides(vals, overrides) {
  if (!overrides) return vals
  const out = { ...vals }
  for (const [k, t] of Object.entries(overrides)) {
    if (t == null) continue
    const num = Number(String(t).replace(/[,\s]/g, '').replace(/(명|대|곳|건|%|분)$/, ''))
    out[k] = VAR_BY_KEY[k]?.num && Number.isFinite(num) && /\d/.test(t) ? num : t
  }
  return out
}

// 문서 안 자료 칸을 지금 값으로 바꾼다. 표 자료는 칸 안에 표를 다시 그린다
export function refreshVars(root, vals) {
  root.querySelectorAll('.dv[data-var]').forEach((el) => {
    const k = el.dataset.var
    if (VAR_BY_KEY[k]?.table) el.innerHTML = vals[k] || ''
    else el.textContent = formatVar(k, vals)
  })
  root.querySelectorAll('.dv[data-calc]').forEach((el) => {
    el.textContent = `${evalCalc(el.dataset.calc, vals, Number(el.dataset.fmt || 0))}${el.dataset.unit || ''}`
  })
}

// 템플릿용 자료 칸 HTML
export const V = (key) => VAR_BY_KEY[key]?.table
  ? `<div class="dv dv-block" data-var="${key}" contenteditable="false"></div>`
  : `<span class="dv" data-var="${key}" contenteditable="false"></span>`
export const C = (expr, unit = '', digits = 0) => `<span class="dv" data-calc="${expr}" data-fmt="${digits}" data-unit="${unit}" contenteditable="false"></span>`
