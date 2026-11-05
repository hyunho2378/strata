// time.js 시각과 남은 시간 표기. 24시간제, 오전 오후 표기 금지(DESIGN 5절)
export const MIN = 60000
export const HOUR = 60 * MIN

const pad = (n) => String(n).padStart(2, '0')

export function fmtHM(ms) {
  if (ms == null || Number.isNaN(ms)) return '--:--'
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtDate(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

export function fmtDateTime(ms) {
  return `${fmtDate(ms)} ${fmtHM(ms)}`
}

// 남은 시간. 음수면 경과로 표기
export function remainText(ms) {
  const neg = ms < 0
  const total = Math.floor(Math.abs(ms) / MIN)
  const h = Math.floor(total / 60)
  const m = total % 60
  const body = h > 0 ? `${h}시간 ${m}분` : `${m}분`
  return neg ? `${body} 경과` : body
}

export function minutesText(min) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

// 기준 시각과 날짜가 다르면 익일 표기. 자정을 넘긴 완료 시각이 이른 시각처럼 읽히는 것을 막는다
export function fmtHMFrom(ms, baseMs) {
  if (ms == null || Number.isNaN(ms)) return '--:--'
  const nextDay = baseMs != null && new Date(ms).toDateString() !== new Date(baseMs).toDateString()
  return `${nextDay ? '익일 ' : ''}${fmtHM(ms)}`
}
