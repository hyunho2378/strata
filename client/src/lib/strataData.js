// strataData.js 자료 불러오기. client/src/data 는 자료 담당 영역이라 파일이 아직 없을 수 있다.
// import.meta.glob 으로 있는 파일만 집어 오고, 없으면 빈 상태를 돌려준다. 이전 프로젝트 파일은 읽지 않는다.
import { useEffect, useState } from 'react'

const JSONS = import.meta.glob('../data/*.json')
const pick = (name) => JSONS[`../data/${name}`]

export const EMPTY = { generatedAt: '', basis: '', sources: [], roles: [], facilities: [], stats: {} }

// 원자료 시설 이름에는 '지하주차장 1층' 같은 부속 공간 꼬리말이 붙어 있다.
// 지도 라벨과 목록 제목에는 대표 시설명만 쓰고 꼬리말은 상세의 역할 행에서만 보여 준다.
const SPACE_TAIL = /\s+((?:전체\s*동의\s*|[\d~]+동\s*)?(?:지하\s*\d*\s*층?\s*)?(?:주차장|대피소|회의실|연회장|방공호)(?:\s*지하)?(?:\s*[\d~]+\s*층)?)\s*$/

export function splitFacilityName(full) {
  const raw = String(full || '').replace(/\s+/g, ' ').trim()
  const m = raw.match(SPACE_TAIL)
  if (!m) return { name: raw, space: '' }
  const space = m[1].trim()
  const head = raw.slice(0, m.index).trim()
  if (!head || !/지하|층|전체 동의/.test(space)) return { name: raw, space: '' }
  return { name: head, space }
}

// 화면이 읽는 시설 목록. name 은 대표 시설명, space 는 부속 공간, fullName 은 원자료 이름이다
export function normalizeFacilities(list) {
  return (list || []).map((f) => {
    const { name, space } = splitFacilityName(f.name)
    return space ? { ...f, name, space, fullName: f.name } : { ...f, space: '', fullName: f.name }
  })
}

export async function loadJson(name) {
  const loader = pick(name)
  if (!loader) return null
  try {
    const mod = await loader()
    return mod?.default ?? mod ?? null
  } catch {
    return null
  }
}

export const loadStrata = () => loadJson('strata.json')
export const loadScenes = () => loadJson('scenes.json')
export const loadInside = () => loadJson('inside.json')

// 자료 한 벌을 읽어 상태로 돌려준다. ready 는 읽기를 마쳤다는 뜻이고, empty 는 파일이 아직 없다는 뜻이다
export function useStrata() {
  const [state, setState] = useState({ data: EMPTY, ready: false, empty: true })
  useEffect(() => {
    let live = true
    loadStrata().then((d) => {
      if (!live) return
      const data = d ? { ...EMPTY, ...d, facilities: normalizeFacilities(d.facilities) } : EMPTY
      setState({ data, ready: true, empty: !d || !(d.facilities || []).length })
    })
    return () => { live = false }
  }, [])
  return state
}

export function useJson(name) {
  const [state, setState] = useState({ data: null, ready: false })
  useEffect(() => {
    let live = true
    loadJson(name).then((d) => { if (live) setState({ data: d, ready: true }) })
    return () => { live = false }
  }, [name])
  return state
}

// 운영 상태 표기. 화면에는 이 라벨만 보인다
export const STATUS_LABEL = { open: '운영 중', closed: '운영 중단', check: '확인 필요' }

export const roleLabel = (data, id) => (data.roles || []).find((r) => r.id === id)?.label || id

// 지금 시각에 걸린 운영 중단 일정
export const activeEvents = (facility, ms) => (facility.events || []).filter((e) => {
  const s = e.start ? Date.parse(e.start) : null
  const t = e.end ? Date.parse(e.end) : null
  if (s == null && t == null) return false
  if (s != null && ms < s) return false
  if (t != null && ms > t) return false
  return true
})

export function statusAt(facility, ms) {
  if (activeEvents(facility, ms).length) return 'closed'
  return facility.status || 'open'
}

export function countByStatus(facilities, ms) {
  const out = { open: 0, closed: 0, check: 0 }
  for (const f of facilities) out[statusAt(f, ms)] = (out[statusAt(f, ms)] || 0) + 1
  return out
}

// 날짜 표기. 2026-10-28 을 2026. 10. 28. 로 바꾼다
export function dotDate(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}
