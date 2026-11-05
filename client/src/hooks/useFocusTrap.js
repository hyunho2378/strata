// useFocusTrap.js Modal 과 Drawer 가 함께 쓴다. Esc 닫기, Tab 순환, 닫을 때 이전 포커스 복원.
import { useEffect, useRef } from 'react'

const SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export default function useFocusTrap(active, onClose) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active || !ref.current) return
    const node = ref.current
    const prev = document.activeElement
    const items = () => Array.from(node.querySelectorAll(SELECTOR)).filter((el) => el.offsetParent !== null)
    items()[0]?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return }
      if (e.key !== 'Tab') return
      const list = items()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    node.addEventListener('keydown', onKey)
    return () => { node.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [active, onClose])

  return ref
}
