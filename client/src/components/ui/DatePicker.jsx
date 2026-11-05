// 날짜 고르기. 운영체제 날짜 입력 대신 디자인 시스템 달력을 띄운다(포털, 모달 위에도 보임).
// value 는 'YYYY-MM-DD' 문자열, 화면에는 공문 표기 '2026. 10. 2.(금)'로 보인다.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n) => String(n).padStart(2, '0')
const parse = (s) => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s || ''); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null }
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const dotDate = (s) => { const d = parse(s); return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${WEEK[d.getDay()]})` : '' }

export default function DatePicker({ label, value, onChange, hint, error, disabled, placeholder = '날짜 고르기', className }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const sel = parse(value)
  const [view, setView] = useState(() => sel || new Date())
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const pop = useRef(null)

  useEffect(() => { if (open) setView(sel || new Date()) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!btn.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [open])
  useLayoutEffect(() => {
    if (!open) return
    const r = btn.current.getBoundingClientRect()
    const H = 340, W = 300
    const up = window.innerHeight - r.bottom < H + 8 && r.top > H
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)), top: up ? r.top - H - 4 : r.bottom + 4, width: W })
  }, [open])

  const y = view.getFullYear(), m = view.getMonth()
  const first = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(y, m, i + 1))]
  const today = ymd(new Date())
  const pick = (d) => { onChange?.(ymd(d)); setOpen(false); btn.current?.focus() }

  return (
    <div className={className}>
      {label && <label htmlFor={id} className="mb-1.5 block type-caption text-text-sec">{label}</label>}
      <div className="relative">
        <button ref={btn} id={id} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={clsx('flex h-11 w-full items-center gap-2 rounded-sm px-3 text-left transition-colors duration-fast disabled:opacity-40 md:h-10',
            error ? 'bg-danger-soft' : open ? 'bg-primary-soft text-primary-text' : 'bg-subtle hover:bg-mute')}>
          <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-text-meta" />
          <span className={clsx('min-w-0 flex-1 truncate type-body-sm', sel ? 'text-text-pri' : 'text-text-ter')}>{sel ? dotDate(value) : placeholder}</span>
        </button>
        {sel && !disabled && (
          <button type="button" aria-label="날짜 지우기" onClick={() => onChange?.('')} className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-text-meta hover:bg-mute">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {hint && !error && <p className="mt-1 type-caption font-normal text-text-meta">{hint}</p>}
      {error && <p className="mt-1 type-caption text-danger-text">{error}</p>}
      {open && pos && createPortal(
        <div ref={pop} role="dialog" aria-label={`${label || '날짜'} 고르기`} style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 75 }}
          className="pop-panel rounded-md bg-page p-3 shadow-md">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="이전 달" onClick={() => setView(new Date(y, m - 1, 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-sm hover:bg-mute"><ChevronLeft size={16} /></button>
            <span className="type-strong tabular-nums text-text-pri">{y}년 {m + 1}월</span>
            <button type="button" aria-label="다음 달" onClick={() => setView(new Date(y, m + 1, 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-sm hover:bg-mute"><ChevronRight size={16} /></button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center">
            {WEEK.map((w, i) => <span key={w} className={clsx('h-7 type-meta leading-7', i === 0 ? 'text-danger-text' : 'text-text-meta')}>{w}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />
              const k = ymd(d)
              const on = value === k
              return (
                <button key={k} type="button" onClick={() => pick(d)} aria-pressed={on}
                  className={clsx('m-0.5 inline-flex h-9 items-center justify-center rounded-sm type-body-sm tabular-nums transition-colors duration-fast',
                    on ? 'bg-primary font-bold text-text-inverse' : k === today ? 'font-bold text-primary-text hover:bg-mute' : d.getDay() === 0 ? 'text-danger-text hover:bg-mute' : 'text-text-pri hover:bg-mute')}>
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between">
            <button type="button" onClick={() => pick(new Date())} className="h-8 rounded-sm px-2.5 type-meta text-primary-text hover:bg-mute">오늘</button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-sm px-2.5 type-meta text-text-sec hover:bg-mute">닫기</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
