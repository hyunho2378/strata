// CSV 내보내기(dah ExportButton 구조). 엑셀 한글 깨짐 방지 BOM 포함. 파일명에 기관명과 시각.
import { Download } from 'lucide-react'
import Button from './Button.jsx'

const esc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(columns, rows) {
  const head = columns.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => esc(c.value ? c.value(r) : r[c.key])).join(',')).join('\n')
  return `\uFEFF${head}\n${body}`
}

export default function ExportButton({ columns, rows, filename, label = 'CSV 내보내기', variant = 'secondary', size = 'md' }) {
  const onClick = () => {
    const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant={variant} size={size} onClick={onClick} disabled={!rows.length} leftIcon={<Download size={16} aria-hidden="true" />}>
      {label}
    </Button>
  )
}
