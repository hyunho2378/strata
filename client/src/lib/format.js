// format.js 표시 포맷 단일 출처. 숫자는 전부 tabular-nums 클래스와 같이 쓴다.
import { format, differenceInMinutes, differenceInHours, differenceInCalendarDays } from 'date-fns'

export function formatNumber(n) {
  return Number(n ?? 0).toLocaleString('ko-KR')
}

export function formatPrice(n) {
  const v = Number(n ?? 0)
  if (v === 0) return '무료'
  if (v < 0) return `-${formatNumber(Math.abs(v))}원 할인`
  return `${formatNumber(v)}원`
}

// opt: undefined(2026.09.06) | 'time'(09:06) | 'datetime' | 'relative'
export function formatDate(iso, opt) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (opt === 'time') return format(d, 'HH:mm')
  if (opt === 'datetime') return format(d, 'yyyy.MM.dd HH:mm')
  if (opt === 'relative') {
    const now = new Date()
    const min = differenceInMinutes(now, d)
    if (min < 1) return '방금'
    if (min < 60) return `${min}분 전`
    const hr = differenceInHours(now, d)
    if (hr < 24) return `${hr}시간 전`
    return `${differenceInCalendarDays(now, d)}일 전`
  }
  return format(d, 'yyyy.MM.dd')
}

// 근거 카드의 오래된 자료 경고 기준. DESIGN.md 근거 표시 절
export function isStale(iso, days = 90) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return differenceInCalendarDays(new Date(), d) > days
}
