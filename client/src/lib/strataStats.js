// strataStats.js 현황판과 판독함이 쓰는 집계. 숫자는 모두 client/src/data/strata.json 에서 뽑는다.
import { useMemo } from 'react'
import { activeEvents, statusAt, useStrata } from './strataData.js'

export const fmt = (n) => Number(n || 0).toLocaleString('ko-KR')

// 해당 시각에 운영이 멈춘 시설과 비는 역할 수
export function todayGap(facilities, ms) {
  const items = []
  let roleSlots = 0
  for (const f of facilities) {
    const evs = activeEvents(f, ms)
    if (!evs.length) continue
    const roles = new Set(evs.flatMap((e) => e.roles || []))
    roleSlots += roles.size
    items.push({ facility: f, roles: [...roles], event: evs[0] })
  }
  return { items, roleSlots, facilities: items.length }
}

// 이번 달에 걸치는 운영 중단 일정. 막대 위치는 1일부터 말일까지를 0~1 로 환산한다
export function monthEvents(facilities, ms) {
  const base = new Date(ms)
  const from = new Date(base.getFullYear(), base.getMonth(), 1).getTime()
  const to = new Date(base.getFullYear(), base.getMonth() + 1, 1).getTime() - 1
  const span = to - from
  const rows = []
  for (const f of facilities) {
    for (const e of f.events || []) {
      const s = e.start ? Date.parse(e.start) : null
      const t = e.end ? Date.parse(e.end) : null
      if (s == null && t == null) continue
      const a = Math.max(from, s ?? from)
      const b = Math.min(to, t ?? to)
      if (b < from || a > to) continue
      rows.push({
        key: f.id + '-' + (e.id || e.notice || ''),
        facility: f,
        event: e,
        left: (a - from) / span,
        width: Math.max(0.02, (b - a) / span),
        openBefore: s != null && s < from,
        openAfter: t != null && t > to
      })
    }
  }
  return { rows: rows.sort((x, y) => x.left - y.left), from, to, days: new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate() }
}

// 판독 대기 줄. AI 가 읽은 공지 가운데 사람이 확인해야 하는 것만 모은다
export function reviewItems(facilities) {
  const out = []
  for (const f of facilities) {
    for (const e of f.events || []) {
      if (e.certainty === '확정') continue
      out.push({
        id: f.id + '-' + (e.id || e.notice || ''),
        facility: f,
        event: e,
        kind: '공지 판독',
        reason: e.start ? '공고에서 읽은 기간이라 착공 여부를 확인해요.' : '공고에 기간이 없어 시작일을 확인해요.'
      })
    }
  }
  for (const f of facilities) {
    if (f.status !== 'check' || (f.events || []).some((e) => e.certainty !== '확정')) continue
    out.push({ id: f.id + '-reg', facility: f, event: null, kind: '대장 확인', reason: '대장과 공지가 달라 담당 부서에 확인해요.' })
  }
  return out
}

export function roleCounts(facilities) {
  const out = {}
  for (const f of facilities) for (const id of new Set((f.roles || []).map((r) => r.role))) out[id] = (out[id] || 0) + 1
  return out
}

// 가장 가까운 대체 시설까지 거리가 먼 곳. 운영 중단 일정이 잡힌 시설만 본다
export function farAlternatives(facilities, limit = 5) {
  const rows = []
  for (const f of facilities) {
    if (!(f.events || []).length) continue
    const best = {}
    for (const a of f.alternatives || []) {
      if (best[a.role] == null || a.distM < best[a.role].distM) best[a.role] = a
    }
    const picks = Object.entries(best)
    if (!picks.length) continue
    const [role, alt] = picks.sort((x, y) => y[1].distM - x[1].distM)[0]
    rows.push({ facility: f, role, alt })
  }
  return rows.sort((a, b) => b.alt.distM - a.alt.distM).slice(0, limit)
}

export const statusCount = (facilities, ms) => facilities.reduce((acc, f) => {
  const st = statusAt(f, ms)
  acc[st] = (acc[st] || 0) + 1
  return acc
}, { open: 0, closed: 0, check: 0 })

// 메뉴 배지에 쓰는 판독 대기 건수
export function useReviewCount() {
  const { data } = useStrata()
  return useMemo(() => reviewItems(data.facilities || []).length, [data])
}

export const km = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + 'km' : Math.round(m) + 'm')

// 자료 기준 문구. 화면에는 첫 문장만 쓴다
export const basisShort = (basis) => (basis ? String(basis).split('.')[0].trim() + '.' : '')
