// PATTERNS.md 15번. Esc 닫기, 포커스 트랩, 열릴 때 첫 포커스 요소, body 스크롤 락.
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useLang } from '../../i18n/LangContext.jsx'
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js'
import useFocusTrap from '../../hooks/useFocusTrap.js'
import IconButton from './IconButton.jsx'

export default function Modal({ open, onClose, title, footer, children, className }) {
  const { t } = useLang()
  const trapRef = useFocusTrap(open, onClose)
  useBodyScrollLock(open)
  if (!open) return null
  // body 로 띄운다: 화면 안의 container query 상자(layout containment)에 갇히지 않게
  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text-pri/40 animate-fade-in" onClick={onClose} />
      <div
        ref={trapRef} role="dialog" aria-modal="true" aria-label={title}
        className={clsx('relative flex max-h-[90dvh] w-full max-w-dialog flex-col rounded-lg bg-page shadow-lg animate-pop-in', className)}
      >
        <header className="px-6 pt-6 flex items-start justify-between gap-4">
          <h2 className="type-h2 text-text-pri">{title}</h2>
          <IconButton aria-label={t('common.action.close')} size="sm" onClick={onClose}><X size={20} /></IconButton>
        </header>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
        {footer && <footer className="px-6 pb-6 flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>,
    document.body

  )
}
