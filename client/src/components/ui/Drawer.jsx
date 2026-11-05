// 화면 위에 띄우는 창. 기본은 가운데 모달(공용 Modal). 휴대폰 메뉴처럼 side='left' 일 때만 왼쪽에서 밀려 나오는 서랍.
// 오른쪽 서랍은 쓰지 않는다(사용자 결정 2026-10-07: 추가, 상세, 알림 모두 가운데 모달).
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useLang } from '../../i18n/LangContext.jsx'
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js'
import useFocusTrap from '../../hooks/useFocusTrap.js'
import IconButton from './IconButton.jsx'
import Modal from './Modal.jsx'

export default function Drawer(props) {
  if (props.side !== 'left') return <Modal open={props.open} onClose={props.onClose} title={props.title} footer={props.footer} className={props.size === 'wide' ? 'max-w-dialog-wide' : undefined}>{props.children}</Modal>
  return <SideSheet {...props} />
}

function SideSheet({ open, onClose, title, footer, side, children }) {
  const { t } = useLang()
  const trapRef = useFocusTrap(open, onClose)
  useBodyScrollLock(open)
  if (!open) return null
  const isLeft = side === 'left'
  // body 로 띄운다: 화면 안의 container query 상자(layout containment)에 갇히지 않게
  return createPortal(
    <div className="fixed inset-0 z-drawer">
      <div className="absolute inset-0 bg-text-pri/40 animate-fade-in-sheet" onClick={onClose} />
      <aside
        ref={trapRef} role="dialog" aria-modal="true" aria-label={title}
        className={clsx(
          'absolute top-0 flex h-full w-full max-w-dialog flex-col bg-page shadow-lg',
          isLeft ? 'left-0 animate-slide-in-left' : 'right-0 animate-slide-in-right'
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between bg-subtle px-5">
          <h2 className="type-h2 text-text-pri">{title}</h2>
          <IconButton aria-label={t('common.action.close')} size="sm" onClick={onClose}><X size={20} /></IconButton>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 bg-subtle p-4">{footer}</footer>}
      </aside>
    </div>,
    document.body

  )
}
