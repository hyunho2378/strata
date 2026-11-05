// 체크박스. 실제 input 을 유지해 키보드와 스크린리더 동작을 보존. 터치 영역 44.
import clsx from 'clsx'

export default function Checkbox({ checked, onChange, label, srOnlyLabel = false, disabled, className }) {
  return (
    <label className={clsx('inline-flex items-center gap-2 min-h-11 min-w-11 md:min-h-0 md:min-w-0 cursor-pointer', disabled && 'opacity-40 cursor-not-allowed', className)}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} className="shrink-0" />
      <span className={clsx('type-body-sm text-text-sec', srOnlyLabel && 'sr-only')}>{label}</span>
    </label>
  )
}
