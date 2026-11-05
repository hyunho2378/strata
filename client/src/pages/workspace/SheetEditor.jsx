// 시트 편집기. 열 문자와 행 번호, 수식 입력줄, 정렬, 검색, CSV 가져오기와 내보내기, 구글 시트로 복사.
// 연결 시트: source 'form' 은 설문 응답을 그대로 보여 준다. 응답은 고칠 수 없다.
import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowDownAZ, ArrowUpAZ, Copy, Download, Link2, Plus, Search, Sheet, Trash2, Upload } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Select from '../../components/ui/Select.jsx'
import { toCsv } from '../../components/ui/ExportButton.jsx'
import useToast from '../../hooks/useToast.js'
import useWorkspaceStore, { useFormResponsePolling, useWorkspaceInit } from '../../store/useWorkspaceStore.js'
import EditorFrame, { download } from './EditorFrame.jsx'

const letter = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26) } return s }

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export default function SheetEditor() {
  const { id } = useParams()
  const sheet = useWorkspaceStore((s) => s.items.find((x) => x.id === id))
  const form = useWorkspaceStore((s) => s.items.find((x) => x.id === sheet?.formId))
  const update = useWorkspaceStore((s) => s.update)
  const toast = useToast()
  const fileRef = useRef(null)
  const [sel, setSel] = useState({ r: 0, c: 0 })
  const [q, setQ] = useState('')
  // 큰 시트는 200행씩 나눠 그린다. 검색과 정렬은 전체 행 기준
  const [limit, setLimit] = useState(200)
  const [sort, setSort] = useState(null)
  const ready = useWorkspaceInit()
  const mode = useWorkspaceStore((s) => s.mode)
  useFormResponsePolling(sheet?.formId, ready && sheet?.source === 'form')

  // 화면에 그릴 열과 행. 연결 시트는 원본에서 매번 다시 만든다
  const { columns, rows, locked } = useMemo(() => {
    if (!sheet) return { columns: [], rows: [], locked: true }
    if (sheet.source === 'form') {
      if (!form) return { columns: [{ key: 'none', label: '연결된 설문지 없음' }], rows: [], locked: true }
      return {
        columns: [{ key: 'at', label: '제출 시각' }, ...form.questions.map((qq) => ({ key: qq.id, label: qq.title }))],
        rows: form.responses.map((r) => [new Date(r.at).toLocaleString('ko-KR'), ...form.questions.map((qq) => {
          const v = r.answers[qq.id]
          return Array.isArray(v) ? v.join(', ') : (v ?? '')
        })]),
        locked: true
      }
    }
    return { columns: sheet.columns, rows: sheet.rows, locked: false }
  }, [sheet, form])

  // 검색과 정렬은 보기만 바꾼다. 원래 행 번호를 들고 다닌다
  const view = useMemo(() => {
    let list = rows.map((r, i) => ({ r, i }))
    if (q) list = list.filter(({ r }) => r.some((v) => String(v).includes(q)))
    if (sort) {
      list = [...list].sort((a, b) => {
        const x = a.r[sort.c] ?? ''; const y = b.r[sort.c] ?? ''
        const nx = Number(x); const ny = Number(y)
        const cmp = x !== '' && y !== '' && !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : String(x).localeCompare(String(y), 'ko')
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [rows, q, sort])

  if (!ready) return <div className="flex min-h-dvh items-center justify-center bg-canvas type-body-sm text-text-meta">시트를 불러오고 있어요.</div>
  if (!sheet) return <Navigate to="/docs?kind=sheet" replace />

  const setCell = (ri, ci, value) => {
    const col = columns[ci]
    if (locked || col?.readOnly) return
    const next = sheet.rows.map((r) => [...r])
    next[ri][ci] = value
    update(id, { rows: next })
  }
  const setHeader = (ci, label) => {
    if (locked || sheet.source) return
    update(id, { columns: sheet.columns.map((c, i) => (i === ci ? { ...c, label } : c)) })
  }
  const addRow = () => update(id, { rows: [...sheet.rows, columns.map(() => '')] })
  const addCol = () => update(id, {
    columns: [...sheet.columns, { key: `c${Date.now()}`, label: `열 ${sheet.columns.length + 1}` }],
    rows: sheet.rows.map((r) => [...r, ''])
  })
  const delRow = () => {
    if (!sheet.rows.length) return
    update(id, { rows: sheet.rows.filter((_, i) => i !== sel.r) })
    setSel({ r: Math.max(0, sel.r - 1), c: sel.c })
  }

  const exportCsv = () => {
    const cols = columns.map((c, i) => ({ label: c.label, value: (r) => r[i] }))
    download(`${sheet.title}.csv`, toCsv(cols, rows), 'text/csv;charset=utf-8')
  }
  const copyForGoogle = async () => {
    const tsv = [columns.map((c) => c.label), ...rows].map((r) => r.map((v) => String(v ?? '').replace(/\t|\n/g, ' ')).join('\t')).join('\n')
    try {
      await navigator.clipboard.writeText(tsv)
      window.open('https://sheets.new', '_blank', 'noopener')
      toast('표를 복사했어요. 새 구글 시트 A1 칸에 붙여 넣으세요', 'primary')
    } catch { toast('복사하지 못했어요. 브라우저 권한을 확인하세요', 'danger') }
  }
  const importCsv = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const data = parseCsv((await f.text()).replace(/^\uFEFF/, ''))
    if (!data.length) return
    const [head, ...body] = data
    update(id, { columns: head.map((l, i) => ({ key: `c${i}`, label: l })), rows: body.map((r) => head.map((_, i) => r[i] ?? '')) })
    toast(`${body.length}행을 가져왔습니다`, 'primary')
  }

  const onKey = (e, vi, ci) => {
    const move = { ArrowDown: [1, 0], Enter: [1, 0], ArrowUp: [-1, 0] }[e.key]
    if (!move) return
    e.preventDefault()
    const ni = Math.min(Math.min(view.length, limit) - 1, Math.max(0, vi + move[0]))
    const target = document.querySelector(`[data-cell="${ni}-${ci}"]`)
    target?.focus()
  }

  const selRow = rows[sel.r]
  const selVal = selRow ? (selRow[sel.c] ?? '') : ''
  const selLocked = locked || columns[sel.c]?.readOnly

  const actions = (
    <>
      {!sheet.source && (
        <>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={importCsv} />
          <Button variant="ghost" size="sm" collapse="xl" leftIcon={<Upload size={16} aria-hidden="true" />} onClick={() => fileRef.current?.click()}>CSV 가져오기</Button>
        </>
      )}
      <Button variant="ghost" size="sm" collapse="lg" leftIcon={<Download size={16} aria-hidden="true" />} onClick={exportCsv}>CSV 저장</Button>
      <Button size="sm" collapse="sm" leftIcon={<Copy size={16} aria-hidden="true" />} onClick={copyForGoogle}>구글 시트로 복사</Button>
    </>
  )

  const bar = (
    <div className="bg-subtle">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 md:px-5">
        {!sheet.source && (
          <>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={addRow}>행</Button>
            <Button variant="ghost" size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={addCol}>열</Button>
            <Button variant="ghost" size="sm" leftIcon={<Trash2 size={16} aria-hidden="true" />} onClick={delRow}>선택 행 삭제</Button>
            <span className="mx-1 h-5 w-px bg-line-sub" />
          </>
        )}
        <Button variant="ghost" size="sm" leftIcon={<ArrowDownAZ size={16} aria-hidden="true" />} onClick={() => setSort({ c: sel.c, dir: 'asc' })}>오름차순</Button>
        <Button variant="ghost" size="sm" leftIcon={<ArrowUpAZ size={16} aria-hidden="true" />} onClick={() => setSort({ c: sel.c, dir: 'desc' })}>내림차순</Button>
        {sort && <button type="button" onClick={() => setSort(null)} className="type-caption text-primary-text underline">정렬 해제</button>}
        <label className="ml-auto flex h-9 w-full max-w-xs items-center gap-2 rounded-md bg-mute px-3 sm:w-auto">
          <Search size={14} aria-hidden="true" className="text-text-meta" />
          <input autoComplete="off" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} placeholder="시트에서 찾기" className="min-w-0 flex-1 bg-transparent type-body-sm outline-none" />
        </label>
      </div>
      <div className="flex items-center gap-2 bg-subtle px-3 md:px-5">
        <span className="w-14 shrink-0 py-2 text-center type-caption text-text-meta tabular-nums">{letter(sel.c)}{sel.r + 2}</span>
        <span className="h-5 w-px bg-line-sub" />
        <span className="px-1 type-caption italic text-text-meta">fx</span>
        <input autoComplete="off" spellCheck={false}
          aria-label="선택한 칸 내용" defaultValue={selVal} key={`${sel.r}-${sel.c}-${selVal}`} readOnly={selLocked}
          onBlur={(e) => { if (e.target.value !== String(selVal)) setCell(sel.r, sel.c, e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className={clsx('min-w-0 flex-1 bg-transparent py-2 type-body-sm outline-none', selLocked && 'text-text-meta')}
        />
      </div>
    </div>
  )

  const note = sheet.source === 'form'
    ? <>설문지 <Link to={`/docs/form/${sheet.formId}`} className="text-primary-text underline">{form?.title}</Link> 응답이 자동으로 쌓여요. 응답은 고칠 수 없어요.</>
      : null

  return (
    <EditorFrame fill kind="sheet" Icon={Sheet} title={sheet.title} onTitle={(t) => update(id, { title: t })} updatedAt={sheet.updatedAt} actions={actions} tabs={bar}>
      {note && (
        <p className="flex items-center gap-2 bg-primary-soft px-4 py-2 type-body-sm text-primary-text md:px-6">
          <Link2 size={16} aria-hidden="true" className="shrink-0" />
          <span>{note}</span>
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-page">
        {/* 표 격자는 선이 아니라 1px 틈과 면 색으로 그린다(UI.md 0장 예외) */}
        <table className="border-separate border-spacing-px bg-line-sub type-body-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 h-7 w-12 bg-subtle" />
              {columns.map((c, ci) => (
                <th key={c.key} className={clsx('h-7 min-w-36 bg-subtle type-caption font-normal tabular-nums', sel.c === ci ? 'text-primary-text' : 'text-text-meta')}>{letter(ci)}</th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 h-9 bg-subtle type-caption font-normal text-text-meta">1</th>
              {columns.map((c, ci) => (
                <th key={c.key} className="h-9 bg-page p-0 text-left">
                  <input autoComplete="off" spellCheck={false}
                    value={c.label} readOnly={locked || !!sheet.source} onChange={(e) => setHeader(ci, e.target.value)} aria-label={`${letter(ci)}열 제목`}
                    className="h-9 w-full bg-transparent px-2 type-strong text-text-pri focus:bg-primary-soft"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.slice(0, limit).map(({ r, i }, vi) => (
              <tr key={i}>
                <th className={clsx('sticky left-0 z-raised h-8 bg-subtle type-caption font-normal tabular-nums', sel.r === i ? 'text-primary-text' : 'text-text-meta')}>{i + 2}</th>
                {columns.map((c, ci) => {
                  const ro = locked || c.readOnly
                  const bad = c.options && r[ci] && !c.options.includes(r[ci])
                  return (
                    <td key={c.key} className={clsx('h-8 p-0', bad ? 'bg-danger-soft' : 'bg-page')}>
                      {c.options && !ro ? (
                        <Select label={`${letter(ci)}${i + 2}`} hideLabel size="xs" portal menuMinWidth={140}
                          value={r[ci] ?? ''} placeholder={r[ci] || '선택'}
                          onChange={(v) => setCell(i, ci, v)}
                          options={[{ value: '', label: '비우기' }, ...c.options.map((o) => ({ value: o, label: o }))]}
                          triggerClassName="h-8 w-full rounded-none bg-transparent" />
                      ) : (
                      <input autoComplete="off" spellCheck={false}
                        data-cell={`${vi}-${ci}`}
                        defaultValue={r[ci] ?? ''} key={`${i}-${ci}-${r[ci]}`}
                        readOnly={ro}
                        onFocus={() => setSel({ r: i, c: ci })}
                        onBlur={(e) => { if (e.target.value !== String(r[ci] ?? '')) setCell(i, ci, e.target.value) }}
                        onKeyDown={(e) => onKey(e, vi, ci)}
                        aria-label={`${letter(ci)}${i + 2}`}
                        className={clsx('h-8 w-full bg-transparent px-2 focus:bg-primary-soft', ro ? 'text-text-sec' : 'text-text-pri', c.type === 'number' && 'text-right tabular-nums')}
                      />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {view.length === 0 && <p className="px-6 py-8 type-body-sm text-text-meta">{q ? '찾는 내용이 없어요.' : '아직 행이 없어요.'}</p>}
        {view.length > limit && (
          <div className="px-4 py-3 md:px-6">
            <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + 200)}>다음 200행 보기</Button>
            <span className="ml-3 type-meta text-text-meta tabular-nums">{view.length}행 중 {limit}행 표시</span>
          </div>
        )}
      </div>
      <footer className="flex items-center justify-between bg-subtle px-4 py-2 type-meta text-text-meta md:px-6">
        <span className="tabular-nums">{view.length === rows.length ? `${rows.length}행` : `${rows.length}행 중 ${view.length}행 표시`}</span>
        <span>{mode === 'server' ? '서버에 저장됩니다' : '새로고침하면 처음 상태로 돌아갑니다'}</span>
      </footer>
    </EditorFrame>
  )
}
