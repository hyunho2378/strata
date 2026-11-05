// 자료 넣기 작업 창. 상황판과 같은 계산으로 만든 숫자를 문서에 넣고, 문서 안에서만 쓸 값으로 바로 고친다.
// 줄을 누르면 그 자리에서 숫자나 글을 고친다(이 문서의 같은 자료 칸이 모두 바뀜). 넣기는 오른쪽 + 단추.
// 계산은 자료 두 개와 연산을 골라 만든다. 내부 키나 식은 보이지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Pencil, Plus, RotateCcw } from 'lucide-react'
import Button from '../../components/ui/Button.jsx'
import Select from '../../components/ui/Select.jsx'
import { VAR_BY_KEY, VAR_DEFS, evalCalc, formatVar } from '../../lib/docVars.js'

const OPS = [
  { value: 'ratio', label: 'A가 B에서 차지하는 비율(%)', sym: (a, b) => `${a}/${b}*100`, unit: '%' },
  { value: 'div', label: 'A 나누기 B', sym: (a, b) => `${a}/${b}` },
  { value: 'mul', label: 'A 곱하기 B', sym: (a, b) => `${a}*${b}` },
  { value: 'add', label: 'A 더하기 B', sym: (a, b) => `${a}+${b}` },
  { value: 'sub', label: 'A 빼기 B', sym: (a, b) => `${a}-${b}` }
]
const PRESETS = [
  { label: '미이송 비율', a: 'unserved', op: 'ratio', b: 'scopeTargets', digits: 1 },
  { label: '차량 가용률', a: 'vehiclesAvail', op: 'ratio', b: 'vehicles', digits: 1 },
  { label: '부족 마을 비율', a: 'shortVillages', op: 'ratio', b: 'scopeVillages', digits: 1 },
  { label: '도우미 1명당 대상자', a: 'scopeTargets', op: 'div', b: 'helpers', digits: 1, unit: '명' },
  { label: '추천 배정으로 줄어드는 인원', a: 'unserved', op: 'sub', b: 'unservedOpt', digits: 0, unit: '명' }
]
const UNITS = ['', '%', '명', '대', '곳', '건', '배', '분']
const NUMS = VAR_DEFS.filter((d) => d.num).map((d) => ({ value: d.key, label: d.label }))

export default function DataPanel({ vals, base, overrides = {}, setOverride, onInsertVar, onInsertCalc, editKey, setEditKey, locked }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const [calc, setCalc] = useState({ a: 'unserved', op: 'ratio', b: 'scopeTargets', bNum: '', digits: 1, unit: '%' })

  useEffect(() => {
    if (!editKey) return
    setDraft(overrides[editKey] ?? formatVar(editKey, base))
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
  }, [editKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (k) => {
    const t = draft.trim()
    if (!t || t === formatVar(k, base)) setOverride(k, null)
    else setOverride(k, t)
    setEditKey(null)
  }

  const op = OPS.find((o) => o.value === calc.op) || OPS[0]
  const bExpr = calc.b === '__num' ? String(Number(calc.bNum) || 0) : calc.b
  const expr = op.sym(calc.a, bExpr)
  const unit = calc.op === 'ratio' ? '%' : calc.unit
  const preview = useMemo(() => `${evalCalc(expr, vals, Number(calc.digits))}${unit}`, [expr, vals, calc.digits, unit])
  const bLabel = calc.b === '__num' ? (calc.bNum || '숫자') : VAR_BY_KEY[calc.b]?.label || ''
  const aLabel = VAR_BY_KEY[calc.a]?.label || ''
  const human = { ratio: `${aLabel} ÷ ${bLabel} × 100`, div: `${aLabel} ÷ ${bLabel}`, mul: `${aLabel} × ${bLabel}`, add: `${aLabel} + ${bLabel}`, sub: `${aLabel} − ${bLabel}` }[calc.op]
  const bOptions = [...NUMS, { value: '__num', label: '직접 숫자 입력' }]
  const set = (p) => setCalc((c) => ({ ...c, ...p }))

  return (
    <div>
      <h3 className="type-strong text-text-pri">자료 넣기</h3>
      <p className="mt-1 type-meta leading-5 text-text-meta">상황판과 같은 자료로 만든 지금 값이에요. 줄을 누르면 이 문서에서 쓸 값으로 바로 고쳐요. 넣기는 + 단추를 눌러요.</p>

      {[...new Set(VAR_DEFS.map((d) => d.group))].map((g) => (
        <section key={g} className="mt-3">
          <p className="type-caption text-text-sec">{g}</p>
          <ul className="mt-1 space-y-0.5">
            {VAR_DEFS.filter((d) => d.group === g).map((d) => {
              const edited = overrides[d.key] != null
              const editing = editKey === d.key
              return (
                <li key={d.key} className={clsx('flex items-center gap-1 rounded-sm px-1', editing && 'bg-primary-soft')}>
                  {editing ? (
                    <form className="flex min-w-0 flex-1 items-center gap-1 py-1" onSubmit={(e) => { e.preventDefault(); save(d.key) }}>
                      <span className="w-20 shrink-0 truncate type-meta text-text-sec">{d.label}</span>
                      <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setEditKey(null) }}
                        aria-label={`${d.label} 값`} autoComplete="off" spellCheck={false}
                        className="h-8 min-w-0 flex-1 rounded-sm bg-primary-soft px-2 type-body-sm tabular-nums text-primary-text" />
                      <button type="submit" aria-label="고친 값 저장" title="저장" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary text-text-inverse"><Check size={15} aria-hidden="true" /></button>
                    </form>
                  ) : (
                    <button type="button" disabled={d.table || locked} onClick={() => setEditKey(d.key)} title={d.table ? '표 자료는 넣은 뒤 표 안에서 고칩니다' : '값 고치기'}
                      className="group flex min-h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-sm px-1.5 text-left hover:bg-mute disabled:hover:bg-transparent">
                      <span className="truncate type-body-sm text-text-pri">{d.label}</span>
                      <span className="flex min-w-0 items-center gap-1">
                        <span className={clsx('truncate type-meta tabular-nums', edited ? 'font-bold text-primary-text' : 'text-text-meta')}>{d.table ? '표' : formatVar(d.key, vals)}</span>
                        {!d.table && !locked && <Pencil size={12} aria-hidden="true" className="shrink-0 text-text-ter opacity-0 group-hover:opacity-100" />}
                      </span>
                    </button>
                  )}
                  {edited && !editing && (
                    <button type="button" onClick={() => setOverride(d.key, null)} aria-label={`${d.label} 상황판 값으로`} title="상황판 값으로"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-meta hover:bg-mute"><RotateCcw size={14} aria-hidden="true" /></button>
                  )}
                  {!editing && (
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsertVar(d.key)} disabled={locked} aria-label={`${d.label} 넣기`} title="문서에 넣기"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-primary-text hover:bg-primary-soft disabled:opacity-40"><Plus size={15} aria-hidden="true" /></button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <section className="mt-5 rounded-lg bg-subtle p-3">
        <p className="type-caption text-text-pri">계산 넣기</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setCalc({ a: p.a, op: p.op, b: p.b, bNum: '', digits: p.digits, unit: p.unit || (p.op === 'ratio' ? '%' : '') })}
              className="h-8 rounded-sm bg-page px-2.5 type-meta text-text-sec shadow-sm hover:text-text-pri">{p.label}</button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Select label="자료 A" size="sm" value={calc.a} onChange={(v) => set({ a: v })} options={NUMS} />
          <Select label="계산" size="sm" value={calc.op} onChange={(v) => set({ op: v })} options={OPS.map((o) => ({ value: o.value, label: o.label }))} />
          <Select label="자료 B" size="sm" value={calc.b} onChange={(v) => set({ b: v })} options={bOptions} />
          {calc.b === '__num' && (
            <input value={calc.bNum} onChange={(e) => set({ bNum: e.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" placeholder="숫자" aria-label="직접 넣을 숫자"
              autoComplete="off" spellCheck={false} className="h-8 w-full rounded-sm bg-subtle px-2 type-body-sm" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Select label="소수 자리" size="sm" value={Number(calc.digits)} onChange={(v) => set({ digits: Number(v) })} options={[0, 1, 2].map((n) => ({ value: n, label: n ? `소수 ${n}자리` : '정수' }))} />
            <Select label="단위" size="sm" value={unit} disabled={calc.op === 'ratio'} onChange={(v) => set({ unit: v })} options={UNITS.map((u) => ({ value: u, label: u || '단위 없음' }))} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-page px-3 py-2">
          <span className="type-meta text-text-meta">결과</span>
          <span className="type-strong tabular-nums text-text-pri">{preview}</span>
        </div>
        <Button size="sm" className="mt-2 w-full" disabled={locked} leftIcon={<Plus size={15} aria-hidden="true" />} onMouseDown={(e) => e.preventDefault()} onClick={() => onInsertCalc(expr, unit, Number(calc.digits))}>계산 결과 넣기</Button>
        <p className="mt-2 type-meta leading-5 text-text-meta">식: {human}. 문서를 열 때마다 지금 값으로 다시 계산해요.</p>
      </section>
    </div>
  )
}
