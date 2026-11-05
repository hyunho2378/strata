// 전역 큐를 그린다. App.jsx 에 한 번만 마운트한다. 문구는 useToast 로 넣는다.
import clsx from 'clsx'
import { Check, Info, X, XCircle } from 'lucide-react'
import { useLang } from '../../i18n/LangContext.jsx'
import { useToastStore } from '../../hooks/useToast.js'

// 9단계. 톤은 셋이다. neutral 은 그냥 알림, primary 는 완료, danger 는 실패와 입력 오류다.
// 초록 완료 토스트와 주황 경고 토스트는 없앴다
const TONE = {
  neutral: 'bg-mute text-text-sec',
  primary: 'bg-primary-soft text-primary-text',
  danger: 'bg-danger-soft text-danger-text'
}
const ICON = { neutral: Info, primary: Check, danger: XCircle }

export default function Toast() {
  // map 변수명이 t 라 사전 함수는 tr 로 받는다
  const { t: tr } = useLang()
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  if (!toasts.length) return null

  return (
    <div
      aria-live="polite"
      className="fixed left-1/2 top-4 z-toast flex w-full max-w-toast -translate-x-1/2 flex-col gap-2 px-4 md:left-auto md:right-4 md:translate-x-0 md:px-0"
    >
      {toasts.map((t) => {
        const Icon = ICON[t.tone] || Info
        return (
          <div key={t.id} className={clsx('toast-item flex items-start gap-2 rounded-md p-3 shadow-md', TONE[t.tone] || TONE.neutral)}>
            <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="flex-1 min-w-0 type-body-sm">{t.message}</p>
            <button type="button" aria-label={tr('common.action.close')} onClick={() => dismiss(t.id)} className="shrink-0">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
