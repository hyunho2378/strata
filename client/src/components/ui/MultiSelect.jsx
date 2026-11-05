// 선택 항목을 트리거 안에 칩으로 보인다. 선택해도 닫히지 않는다.
// Select 와 같은 팝 규약(usePopExit, detail 0 무애니메이션, listbox).
// options: [{ value, label, icon, secondary }]
import { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, ChevronDown, X } from 'lucide-react'
import usePopExit from '../../hooks/usePopExit.js'

export default function MultiSelect({
  label, values = [], onChange, options = [], placeholder = '선택', disabled, id, className, compact = false
}) {
  const auto = useId()
  const btnId = id || auto
  const [open, setOpen] = useState(false)
  const [instantPop, setInstantPop] = useState(false)
  const { mounted: popMounted, closing: popClosing } = usePopExit(open, instantPop)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => { listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' }) })
  }, [open])   // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (v) => {
    onChange?.(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  }

  const move = (delta) => {
    setHighlight((h) => {
      const next = (h + delta + options.length) % options.length
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
      return next
    })
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'Escape') {
      setInstantPop(true)
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setInstantPop(true)
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[highlight]) toggle(options[highlight].value) }
  }

  const selected = options.filter((o) => values.includes(o.value))

  return (
    <div className={clsx('relative', className)} ref={rootRef} onKeyDown={onKeyDown}>
      {label && !compact && <label htmlFor={btnId} className="block type-caption text-text-sec mb-1.5">{label}</label>}
      <button
        ref={triggerRef} id={btnId} type="button" role="combobox"
        aria-haspopup="listbox" aria-expanded={open} aria-controls={`${btnId}-list`}
        aria-activedescendant={open ? `${btnId}-opt-${highlight}` : undefined}
        aria-label={compact ? label : undefined}
        disabled={disabled}
        onClick={(e) => { setInstantPop(e.detail === 0); setOpen((o) => !o) }}
        className={clsx(
          'flex items-center gap-2 rounded-sm px-3 transition-colors duration-fast',
          compact ? 'h-11 w-auto max-w-full justify-start md:h-9' : 'min-h-11 w-full justify-between py-2',
          'disabled:cursor-not-allowed disabled:opacity-40',
          open ? 'bg-primary-soft text-primary-text' : 'bg-subtle hover:bg-mute'
        )}
      >
        {compact ? (
          <>
            <span className="shrink-0 type-caption text-text-meta">{label}</span>
            <span className={clsx('truncate type-body-sm', selected.length ? 'text-text-pri' : 'text-text-ter')}>
              {selected.length ? (selected.length === 1 ? selected[0].label : `${selected[0].label} 외 ${selected.length - 1}`) : placeholder}
            </span>
          </>
        ) : selected.length ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {selected.map((o) => (
              <span key={o.value} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-xs bg-primary-soft text-primary-text type-caption">
                {o.label}
                <X size={12} aria-hidden="true" onClick={(e) => { e.stopPropagation(); toggle(o.value) }} />
              </span>
            ))}
          </span>
        ) : (
          <span className="truncate type-body-sm text-text-ter">{placeholder}</span>
        )}
        <ChevronDown size={16} className="shrink-0 text-text-meta" aria-hidden="true" />
      </button>

      {popMounted && (
        <ul
          ref={listRef} id={`${btnId}-list`} role="listbox" aria-multiselectable="true" aria-label={label} tabIndex={-1}
          aria-hidden={popClosing || undefined}
          className={clsx(
            'pop-panel origin-top absolute inset-x-0 top-full mt-1 z-dropdown max-h-80 overflow-y-auto',
            'rounded-md bg-page shadow-md p-1',
            instantPop && 'pop-instant',
            popClosing && 'pop-panel-exit'
          )}
        >
          {options.map((o, i) => {
            const Icon = o.icon
            return (
              <li
                key={o.value} id={`${btnId}-opt-${i}`} role="option" aria-selected={values.includes(o.value)}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => toggle(o.value)}
                className={clsx(
                  'flex cursor-pointer items-center gap-3 min-h-11 px-2.5 rounded-xs transition-colors duration-fast',
                  highlight === i ? 'bg-mute text-text-pri' : 'text-text-sec'
                )}
              >
                {Icon && <Icon size={20} className="shrink-0 text-text-meta" aria-hidden="true" />}
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <span className="truncate type-body-sm">{o.label}</span>
                  {o.secondary && <span className="shrink-0 type-caption text-text-meta">{o.secondary}</span>}
                </span>
                {values.includes(o.value) && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
