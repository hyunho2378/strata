// 설문지 편집기. 질문, 응답, 설정 탭. 응답은 연결 시트에 자동으로 쌓인다.
import { useState } from 'react'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, Copy, Eye, Link2, ListChecks, Plus, RefreshCw, Sheet, Trash2, X } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Select from '../../components/ui/Select.jsx'
import Toggle from '../../components/ui/Toggle.jsx'
import useToast from '../../hooks/useToast.js'
import { QUESTION_TYPES } from '../../lib/workspaceTemplates.js'
import useWorkspaceStore, { useFormResponsePolling, useWorkspaceInit } from '../../store/useWorkspaceStore.js'
import EditorFrame from './EditorFrame.jsx'
import FormRenderer from './FormRenderer.jsx'

const TABS = [{ v: 'q', l: '질문' }, { v: 'r', l: '응답' }, { v: 's', l: '설정' }]
let qseq = 0

function Summary({ form }) {
  if (!form.responses.length) return <p className="type-body-sm text-text-meta">아직 응답이 없어요. 링크를 보내거나 응답 화면에서 시험 제출해 보세요.</p>
  return (
    <div className="space-y-3">
      {form.questions.map((q) => {
        const vals = form.responses.map((r) => r.answers[q.id]).filter((v) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
        let body
        if (q.type === 'choice' || q.type === 'check' || q.type === 'scale') {
          const opts = q.type === 'scale' ? Array.from({ length: (q.max || 5) - (q.min || 1) + 1 }, (_, i) => (q.min || 1) + i) : (q.options || [])
          const count = (o) => vals.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length
          const max = Math.max(1, ...opts.map(count))
          body = (
            <ul className="space-y-2">
              {opts.map((o) => (
                <li key={o} className="grid grid-cols-[120px_1fr_40px] items-center gap-3">
                  <span className="truncate type-body-sm text-text-sec">{o}</span>
                  <span className="h-3 rounded-xs bg-mute"><span className="block h-3 rounded-xs bg-primary" style={{ width: `${(count(o) / max) * 100}%` }} /></span>
                  <span className="text-right type-caption text-text-meta tabular-nums">{count(o)}</span>
                </li>
              ))}
            </ul>
          )
        } else {
          body = (
            <ul className="max-h-48 space-y-1 overflow-auto">
              {vals.map((v, i) => <li key={i} className="rounded-xs bg-subtle px-3 py-2 type-body-sm text-text-pri">{String(v)}</li>)}
            </ul>
          )
        }
        return (
          <section key={q.id} className="rounded-md bg-page p-5 shadow-sm">
            <h3 className="type-strong text-text-pri">{q.title}</h3>
            <p className="mb-3 type-meta text-text-meta tabular-nums">응답 {vals.length}개</p>
            {body}
          </section>
        )
      })}
    </div>
  )
}

export default function FormEditor() {
  const { id } = useParams()
  const form = useWorkspaceStore((s) => s.items.find((x) => x.id === id))
  const update = useWorkspaceStore((s) => s.update)
  const submit = useWorkspaceStore((s) => s.submit)
  const linkSheet = useWorkspaceStore((s) => s.linkSheet)
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState('q')
  const [preview, setPreview] = useState(false)
  const [active, setActive] = useState(null)
  const ready = useWorkspaceInit()
  const mode = useWorkspaceStore((s) => s.mode)
  const flush = useWorkspaceStore((s) => s.flush)
  const { refresh, loading } = useFormResponsePolling(id, ready && tab === 'r')

  if (!ready) return <div className="flex min-h-dvh items-center justify-center bg-canvas type-body-sm text-text-meta">설문지를 불러오고 있어요.</div>
  if (!form) return <Navigate to="/docs?kind=form" replace />

  const setQ = (qid, patch) => update(id, { questions: form.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) })
  const addQ = () => {
    const q = { id: `nq${Date.now()}${qseq++}`, type: 'choice', title: '새 질문', required: false, options: ['선택지 1'] }
    update(id, { questions: [...form.questions, q] }); setActive(q.id)
  }
  const delQ = (qid) => update(id, { questions: form.questions.filter((q) => q.id !== qid) })
  const moveQ = (i, d) => {
    const list = [...form.questions]; const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    update(id, { questions: list })
  }
  const link = `${window.location.origin}/f/${form.id}`
  const copyLink = async () => {
    await flush()
    try { await navigator.clipboard.writeText(link); toast('응답 링크를 복사했습니다', 'primary') } catch { toast('복사하지 못했습니다', 'danger') }
  }
  const openSheet = () => { const sid = linkSheet(id); if (sid) navigate(`/docs/sheet/${sid}`) }

  const actions = (
    <>
      <Button variant="ghost" size="sm" collapse="lg" leftIcon={<Eye size={16} aria-hidden="true" />} onClick={() => setPreview(true)}>응답 화면 보기</Button>
      <Button variant="ghost" size="sm" collapse="lg" leftIcon={<Link2 size={16} aria-hidden="true" />} onClick={copyLink}>링크 복사</Button>
      <Button size="sm" variant={form.open ? 'secondary' : 'primary'} onClick={() => update(id, { open: !form.open })}>{form.open ? '응답 마감' : '응답 다시 받기'}</Button>
    </>
  )
  const tabs = (
    <div role="tablist" className="flex justify-center gap-2 bg-subtle py-1">
      {TABS.map((t) => (
        <button key={t.v} type="button" role="tab" aria-selected={tab === t.v} onClick={() => setTab(t.v)}
          className={clsx('inline-flex h-9 items-center gap-2 rounded-md px-4 type-strong', tab === t.v ? 'bg-primary-soft text-primary-text' : 'text-text-sec hover:bg-mute')}>
          {t.l}
          {t.v === 'r' && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-primary px-1.5 type-count text-text-inverse">{form.responses.length}</span>}
        </button>
      ))}
    </div>
  )

  return (
    <EditorFrame kind="form" Icon={ListChecks} title={form.title} onTitle={(t) => update(id, { title: t })} updatedAt={form.updatedAt} actions={actions} tabs={tabs}>
      <div className="mx-auto w-full max-w-dialog-wide flex-1 px-4 py-6">
        {tab === 'q' && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md bg-page shadow-sm">
              <div className="h-2 bg-primary" />
              <div className="p-5 md:p-6">
                <input autoComplete="off" spellCheck={false} value={form.title} onChange={(e) => update(id, { title: e.target.value })} aria-label="설문지 제목" className="focus-ring-within w-full rounded-sm bg-transparent px-2 py-1 type-h2 text-text-pri transition-colors duration-fast hover:bg-subtle" />
                <textarea autoComplete="off" spellCheck={false} value={form.desc || ''} onChange={(e) => update(id, { desc: e.target.value })} rows={3} aria-label="설문지 설명" placeholder="설문지 설명" className="focus-ring-within mt-3 w-full resize-y rounded-sm bg-transparent px-2 py-1 type-body text-text-sec transition-colors duration-fast hover:bg-subtle" />
              </div>
            </div>
            {form.questions.map((q, i) => {
              const open = active === q.id
              return (
                <section key={q.id} onClick={() => setActive(q.id)} className={clsx('rounded-md bg-page p-5 transition-shadow duration-fast md:p-6', open ? 'shadow-md' : 'shadow-sm')}>
                  <div className="flex flex-wrap items-start gap-3">
                    <input autoComplete="off" spellCheck={false} value={q.title} onChange={(e) => setQ(q.id, { title: e.target.value })} aria-label={`질문 ${i + 1}`} className="focus-ring-within min-w-0 flex-1 rounded-sm bg-subtle px-3 py-2 type-body-strong text-text-pri" />
                    <div className="w-40"><Select compact value={q.type} onChange={(v) => setQ(q.id, { type: v, options: (v === 'choice' || v === 'check') ? (q.options?.length ? q.options : ['선택지 1']) : q.options })} options={QUESTION_TYPES} /></div>
                  </div>
                  {(q.type === 'choice' || q.type === 'check') && (
                    <ul className="mt-3 space-y-1">
                      {(q.options || []).map((o, oi) => (
                        <li key={oi} className="flex items-center gap-2">
                          <span className={clsx('h-4 w-4 shrink-0 bg-mute', q.type === 'choice' ? 'rounded-xs' : 'rounded-none')} />
                          <input autoComplete="off" spellCheck={false} value={o} onChange={(e) => setQ(q.id, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })} aria-label={`선택지 ${oi + 1}`} className="focus-ring-within min-w-0 flex-1 rounded-sm bg-transparent px-2 py-1.5 type-body transition-colors duration-fast hover:bg-subtle" />
                          <button type="button" aria-label="선택지 삭제" onClick={() => setQ(q.id, { options: q.options.filter((_, xi) => xi !== oi) })} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-meta hover:bg-mute"><X size={16} aria-hidden="true" /></button>
                        </li>
                      ))}
                      <li><button type="button" onClick={() => setQ(q.id, { options: [...(q.options || []), `선택지 ${(q.options?.length || 0) + 1}`] })} className="py-1.5 pl-6 type-body-sm text-primary-text">선택지 추가</button></li>
                    </ul>
                  )}
                  {q.type === 'short' && <p className="mt-3 w-1/2 rounded-sm bg-subtle px-2 py-1.5 type-body-sm text-text-meta">단답형 텍스트</p>}
                  {q.type === 'long' && <p className="mt-3 w-3/4 rounded-sm bg-subtle px-2 py-1.5 type-body-sm text-text-meta">장문형 텍스트</p>}
                  {q.type === 'scale' && <p className="mt-3 type-body-sm text-text-meta tabular-nums">{q.min || 1}부터 {q.max || 5}까지</p>}
                  {q.type === 'date' && <p className="mt-3 type-body-sm text-text-meta">연. 월. 일.</p>}
                  <div className="mt-4 flex items-center justify-end gap-1 pt-3">
                    <button type="button" aria-label="위로" onClick={() => moveQ(i, -1)} className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-meta hover:bg-mute"><ArrowUp size={16} aria-hidden="true" /></button>
                    <button type="button" aria-label="아래로" onClick={() => moveQ(i, 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-meta hover:bg-mute"><ArrowDown size={16} aria-hidden="true" /></button>
                    <button type="button" aria-label="질문 복제" onClick={() => update(id, { questions: [...form.questions.slice(0, i + 1), { ...q, id: `nq${Date.now()}${qseq++}` }, ...form.questions.slice(i + 1)] })} className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-meta hover:bg-mute"><Copy size={16} aria-hidden="true" /></button>
                    <button type="button" aria-label="질문 삭제" onClick={() => delQ(q.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-meta hover:bg-mute"><Trash2 size={16} aria-hidden="true" /></button>
                    <span className="mx-2 h-5 w-px bg-line-sub" />
                    <Toggle checked={!!q.required} onChange={(v) => setQ(q.id, { required: v })} label="필수" />
                  </div>
                </section>
              )
            })}
            <Button variant="secondary" className="w-full" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={addQ}>질문 추가</Button>
          </div>
        )}
        {tab === 'r' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-page p-5 shadow-sm">
              <div>
                <p className="type-h3 text-text-pri tabular-nums">응답 {form.responses.length}개</p>
                <p className="type-meta text-text-meta">{form.open ? '응답을 받는 중' : '응답 마감'}</p>
              </div>
              <div className="flex gap-2">
                {mode === 'server' && <Button variant="secondary" loading={loading} leftIcon={<RefreshCw size={16} aria-hidden="true" />} onClick={refresh}>새로고침</Button>}
                <Button leftIcon={<Sheet size={16} aria-hidden="true" />} onClick={openSheet}>시트에서 보기</Button>
              </div>
            </div>
            <Summary form={form} />
          </div>
        )}
        {tab === 's' && (
          <div className="space-y-3">
            <section className="rounded-md bg-page p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><p className="type-strong text-text-pri">응답 받기</p><p className="type-meta text-text-meta">끄면 링크로 들어와도 응답할 수 없습니다</p></div>
                <Toggle checked={form.open} onChange={(v) => update(id, { open: v })} />
              </div>
            </section>
            <section className="rounded-md bg-page p-5 shadow-sm">
              <p className="type-strong text-text-pri">응답 링크</p>
              <p className="mt-1 break-all type-body-sm text-text-sec">{link}</p>
              <p className="mt-2 type-meta text-text-meta">{mode === 'server' ? '다른 기기에서 제출한 응답도 이 화면에 모여요.' : '서버 저장소에 연결되지 않아 같은 브라우저 창 안에서만 응답이 모여요.'}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={copyLink}>복사</Button>
                <Button size="sm" variant="ghost" as={Link} to={`/f/${form.id}`} target="_blank">새 탭에서 열기</Button>
              </div>
            </section>
          </div>
        )}
      </div>
      <Modal open={preview} onClose={() => setPreview(false)} title="응답 화면" className="max-w-text bg-canvas">
        <div>
          <FormRenderer form={form} preview onSubmit={async (a) => { const r = await submit(id, a); if (!r.ok) { toast(r.message, 'danger'); return r } linkSheet(id); toast('시험 응답을 저장했습니다', 'primary'); return r }} />
        </div>
      </Modal>
    </EditorFrame>
  )
}
