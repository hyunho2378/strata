// 운영 상태 배지. 색 하나로만 알리지 않도록 글자를 함께 둔다.
import Badge from '../ui/Badge.jsx'

export const STATUS_TEXT = { open: '운영 중', closed: '운영 중단', check: '확인 필요' }
const TONE = { open: 'primary', closed: 'danger', check: 'neutral' }

export default function StatusBadge({ status = 'open' }) {
  return <Badge tone={TONE[status] || 'neutral'}>{STATUS_TEXT[status] || '확인 필요'}</Badge>
}
