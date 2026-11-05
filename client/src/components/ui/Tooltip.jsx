// hover 와 focus 둘 다. 300ms 지연.
import { useRef, useState } from 'react'
import clsx from 'clsx'

export default function Tooltip({ label, side = 'top', children, className }) {
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 300) }
  const hide = () => { clearTimeout(timer.current); setOpen(false) }

  return (
    <span
      className={clsx('relative inline-flex', className)}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={clsx(
            'absolute z-dropdown whitespace-nowrap rounded-xs bg-text-pri text-text-inverse px-2 py-1 type-meta shadow-md animate-fade-in',
            side === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-2' : 'bottom-full left-1/2 -translate-x-1/2 mb-2'
          )}
        >
          {label}
        </span>
      )}
    </span>
  )
}
