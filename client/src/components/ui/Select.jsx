// 네이티브 select 금지(PITFALLS 21). 커스텀 listbox.
// DESIGN_DELTA.md 추가 2. 봄내 FieldSelect 디테일 흡수: 옵션 아이콘 + 주 텍스트 + 보조 텍스트,
// compact 변형, 열릴 때 선택 옵션으로 하이라이트 이동, detail 0 키보드 발화 무애니메이션, usePopExit 퇴장.
// options: [{ value, label, icon, secondary }]
// size: md(기본 44px, md 이상 36px) | sm(32px) | xs(28px, 편집기 도구줄). portal: 목록을 body 에 띄워 스크롤 상자에 잘리지 않게(도구줄, 지도 패널)
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import usePopExit from '../../hooks/usePopExit.js'

export default function Select({
  label, value, onChange, options = [], placeholder = '선택',
  disabled, error, compact = false, id, className, size = 'md', portal = true, menuMinWidth = 0, triggerClassName, hideLabel = false
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
  const typed = useRef({ s: '', t: 0 })
  const [pos, setPos] = useState(null)
  const small = size !== 'md'

  // 포털 목록 위치: 아래 공간이 모자라면 위로 연다. 화면 오른쪽 끝을 넘지 않게 맞춘다
  useLayoutEffect(() => {
    if (!open || !portal) return undefined
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.max(r.width, menuMinWidth)
      const below = window.innerHeight - r.bottom - 8
      const up = below < 220 && r.top > below
      const maxH = Math.min(320, Math.max(120, (up ? r.top : below) - 8))
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
      setPos({ left, width, maxH, top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, portal, menuMinWidth])

  const selected = options.find((o) => o.value === value) || null
  // 아이콘은 대문자 변수로 받는다. 소문자 멤버 표현식으로 바로 쓰면 네이티브 태그 금지 grep 에 걸린다
  const SelectedIcon = selected?.icon

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!rootRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // 열릴 때 선택 옵션으로 하이라이트 이동 + 스크롤 정렬
  useEffect(() => {
    if (!open) return
    const idx = Math.max(0, options.findIndex((o) => o.value === value))
    setHighlight(idx)
    requestAnimationFrame(() => { listRef.current?.children[idx]?.scrollIntoView({ block: 'nearest' }) })
  }, [open, options, value])

  const pick = (i, viaKeyboard = false) => {
    if (!options[i]) return
    onChange?.(options[i].value)
    setInstantPop(viaKeyboard)
    setOpen(false)
    triggerRef.current?.focus()
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
      setInstantPop(true)          // 키보드 개시 닫힘은 무애니메이션
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
    else if (e.key === 'Home') { e.preventDefault(); move(-highlight) }
    else if (e.key === 'End') { e.preventDefault(); move(options.length - 1 - highlight) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(highlight, true) }
    else if (e.key.length === 1) {
      const now = Date.now()
      typed.current.s = now - typed.current.t < 700 ? typed.current.s + e.key : e.key
      typed.current.t = now
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.s.toLowerCase()))
      if (i >= 0) move(i - highlight)
    }
  }

  return (
    <div className={clsx('relative', className)} ref={rootRef} onKeyDown={onKeyDown}>
      {label && !compact && !hideLabel && <label htmlFor={btnId} className="block type-caption text-text-sec mb-1.5">{label}</label>}
      <button
        ref={triggerRef} id={btnId} type="button" role="combobox"
        aria-haspopup="listbox" aria-expanded={open}
        aria-invalid={error ? true : undefined} aria-controls={`${btnId}-list`}
        aria-activedescendant={open ? `${btnId}-opt-${highlight}` : undefined}
        aria-label={compact || hideLabel ? label : undefined}
        disabled={disabled}
        onClick={(e) => { setInstantPop(e.detail === 0); setOpen((o) => !o) }}
        onMouseDown={(e) => { if (portal) e.preventDefault() }}
        className={clsx(
          'flex items-center gap-2 transition-colors duration-fast',
          size === 'xs' ? 'h-7 rounded-xs px-2' : size === 'sm' ? 'h-8 rounded-sm px-2.5' : 'h-11 rounded-sm px-3 md:h-10',
          compact ? clsx('w-auto max-w-full', !small && 'md:h-9') : 'w-full',
          'disabled:cursor-not-allowed disabled:opacity-40',
          error ? 'bg-danger-soft' : open ? 'bg-primary-soft text-primary-text' : 'bg-subtle hover:bg-mute',
          compact ? 'justify-start' : 'justify-between',
          triggerClassName
        )}
      >
        {compact && label && !hideLabel && <span className="shrink-0 type-caption text-text-meta">{label}</span>}
        <span className="flex min-w-0 items-center gap-2">
          {!compact && SelectedIcon && <SelectedIcon size={16} className="shrink-0 text-text-meta" aria-hidden="true" />}
          <span className={clsx('truncate', small ? 'type-count font-normal' : 'type-body-sm', selected ? 'text-text-pri' : 'text-text-ter')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={small ? 14 : 16} className={clsx('shrink-0 text-text-meta transition-transform duration-fast', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>

      {popMounted && (portal ? (p) => createPortal(p, document.body) : (p) => p)(
        <ul
          style={portal && pos ? { position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH, zIndex: 75 } : undefined}
          onMouseDown={(e) => { if (portal) e.preventDefault() }}
          ref={listRef} id={`${btnId}-list`} role="listbox" aria-label={label} tabIndex={-1}
          aria-hidden={popClosing || undefined}
          className={clsx(
            'pop-panel origin-top z-dropdown overflow-y-auto rounded-md bg-page p-1 shadow-md',
            portal ? (pos ? '' : 'invisible fixed') : 'absolute inset-x-0 top-full mt-1 max-h-80',
            instantPop && 'pop-instant',
            popClosing && 'pop-panel-exit'
          )}
        >
          {options.map((o, i) => {
            const Icon = o.icon
            return (
              <li
                key={o.value} id={`${btnId}-opt-${i}`} role="option" aria-selected={o.value === value}
                onMouseEnter={() => setHighlight(i)}
                onClick={(e) => pick(i, e.detail === 0)}
                className={clsx(
                  'flex cursor-pointer items-center gap-3 px-2.5 rounded-xs transition-colors duration-fast',
                  small ? 'min-h-8 md:min-h-8' : 'min-h-11',
                  highlight === i || o.value === value ? 'bg-mute text-text-pri' : 'text-text-sec'
                )}
              >
                {Icon && <Icon size={20} className="shrink-0 text-text-meta" aria-hidden="true" />}
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <span className={clsx('truncate', small ? 'type-meta' : 'type-body-sm')} style={o.style}>{o.label}</span>
                  {o.secondary && <span className="shrink-0 type-caption text-text-meta">{o.secondary}</span>}
                </span>
                {o.value === value && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
              </li>
            )
          })}
          {!options.length && <li className="min-h-11 px-2.5 flex items-center type-body-sm text-text-ter">항목 없음</li>}
        </ul>
      )}
      {error && !compact && <p className="mt-1 type-caption text-danger-text">{error}</p>}
    </div>
  )
}
