// 위쪽 시설 검색. 커스텀 콤보박스(네이티브 select 금지).
import { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import { Search } from 'lucide-react'

export default function SearchCombo({ items = [], onPick, placeholder = '시설 이름으로 찾기' }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const rootRef = useRef(null)
  const listId = useId()

  const hits = q.trim()
    ? items.filter((f) => f.name?.includes(q.trim()) || f.addr?.includes(q.trim())).slice(0, 8)
    : []

  useEffect(() => {
    const away = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [])

  const choose = (f) => { onPick?.(f.id); setQ(f.name); setOpen(false) }

  const onKeyDown = (e) => {
    if (!hits.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => (i + 1) % hits.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => (i - 1 + hits.length) % hits.length) }
    if (e.key === 'Enter') { e.preventDefault(); choose(hits[hi]) }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta"><Search size={16} /></span>
      <input
        type="text" value={q} placeholder={placeholder} aria-label="시설 검색"
        role="combobox" aria-expanded={open && hits.length > 0} aria-controls={listId} aria-autocomplete="list"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0) }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        className="h-10 w-full rounded-sm bg-page pl-9 pr-3 type-body-sm text-text-pri shadow-md placeholder:text-text-ter"
      />
      {open && hits.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-12 z-dropdown overflow-hidden rounded-md bg-page py-1 shadow-md">
          {hits.map((f, i) => (
            <li key={f.id} role="option" aria-selected={i === hi}>
              <button
                type="button" onMouseEnter={() => setHi(i)} onClick={() => choose(f)}
                className={clsx('flex w-full flex-col items-start px-3 py-2 text-left', i === hi ? 'bg-primary-soft' : 'hover:bg-mute')}
              >
                <span className="type-body-sm text-text-pri">{f.name}</span>
                {f.addr && <span className="type-meta text-text-meta">{f.addr}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
