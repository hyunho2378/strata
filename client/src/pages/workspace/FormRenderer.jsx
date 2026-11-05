// 설문지 응답 화면 본체. 응답 링크(/f/:id)와 편집기 응답 화면이 같이 쓴다.
import { useState } from 'react'
import clsx from 'clsx'
import { CircleCheck } from 'lucide-react'
import Button from '../../components/ui/Button.jsx'

export default function FormRenderer({ form, onSubmit, preview = false }) {
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const set = (qid, v) => { setAnswers((a) => ({ ...a, [qid]: v })); setErrors((e) => ({ ...e, [qid]: false })) }

  if (!form.open && !preview) {
    return (
      <div className="rounded-md bg-page p-6 shadow-sm">
        <h1 className="type-h2 text-text-pri">{form.title}</h1>
        <p className="mt-2 type-body text-text-sec">지금은 응답을 받지 않아요.</p>
      </div>
    )
  }
  if (done) {
    return (
      <div className="rounded-md bg-page p-6 shadow-sm">
        <CircleCheck size={32} aria-hidden="true" className="text-success" />
        <h1 className="mt-3 type-h2 text-text-pri">응답을 보냈습니다</h1>
        <p className="mt-2 type-body text-text-sec">참여해 주셔서 고마워요.</p>
        <Button className="mt-4" variant="secondary" onClick={() => { setAnswers({}); setDone(false) }}>다른 응답 쓰기</Button>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    const miss = Object.fromEntries(form.questions.filter((q) => q.required && (answers[q.id] == null || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !answers[q.id].length))).map((q) => [q.id, true]))
    setErrors(miss)
    if (Object.keys(miss).length) {
      document.getElementById(`q-${Object.keys(miss)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSending(true); setSendError('')
    try {
      const r = await onSubmit?.(answers)
      if (r && r.ok === false) { setSendError(r.message || '응답을 보내지 못했습니다'); return }
      setDone(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="overflow-hidden rounded-md bg-page shadow-sm">
        <div className="h-2 bg-primary" />
        <div className="p-5 md:p-6">
          <h1 className="type-h2 text-text-pri">{form.title}</h1>
          {form.desc && <p className="mt-2 whitespace-pre-line type-body text-text-sec">{form.desc}</p>}
          <p className="mt-3 type-meta text-danger-text">* 표시는 꼭 답해야 하는 질문입니다</p>
          <p className="mt-2 rounded-md bg-subtle px-3 py-2 type-meta text-text-sec">이 설문에는 주민등록번호, 상세 주소, 병력 같은 주민 정보를 넣지 마세요. 시연용 설문이에요.</p>
        </div>
      </div>
      {form.questions.map((q) => (
        <fieldset key={q.id} id={`q-${q.id}`} className={clsx('rounded-md p-5 shadow-sm md:p-6', errors[q.id] ? 'bg-danger-soft' : 'bg-page')}>
          <legend className="type-body-strong text-text-pri">{q.title}{q.required && <span className="ml-1 text-danger-text" aria-label="필수">*</span>}</legend>
          <div className="mt-3">
            {q.type === 'short' && <input autoComplete="off" spellCheck={false} value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} className="focus-ring-within h-11 w-full rounded-sm bg-subtle px-3 type-body" placeholder="내 답변" />}
            {q.type === 'long' && <textarea autoComplete="off" spellCheck={false} value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} rows={3} className="focus-ring-within w-full resize-y rounded-sm bg-subtle p-3 type-body" placeholder="내 답변" />}
            {q.type === 'date' && <input autoComplete="off" spellCheck={false} inputMode="numeric" value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} className="focus-ring-within h-11 w-48 rounded-sm bg-subtle px-3 type-body" placeholder="2026. 10. 12." />}
            {q.type === 'choice' && (
              <div className="space-y-1">
                {(q.options || []).map((o) => (
                  <label key={o} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-mute">
                    <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => set(q.id, o)} className="" />
                    <span className="type-body text-text-pri">{o}</span>
                  </label>
                ))}
              </div>
            )}
            {q.type === 'check' && (
              <div className="space-y-1">
                {(q.options || []).map((o) => {
                  const cur = answers[q.id] || []
                  return (
                    <label key={o} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-mute">
                      <input type="checkbox" checked={cur.includes(o)} onChange={() => set(q.id, cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])} className="" />
                      <span className="type-body text-text-pri">{o}</span>
                    </label>
                  )
                })}
              </div>
            )}
            {q.type === 'scale' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-meta text-text-meta">전혀 아니다</span>
                {Array.from({ length: (q.max || 5) - (q.min || 1) + 1 }, (_, i) => (q.min || 1) + i).map((n) => (
                  <button key={n} type="button" onClick={() => set(q.id, n)} aria-pressed={answers[q.id] === n}
                    className={clsx('h-11 w-11 rounded-sm type-strong tabular-nums', answers[q.id] === n ? 'bg-primary text-text-inverse' : 'bg-mute text-text-pri hover:bg-line-sub')}>{n}</button>
                ))}
                <span className="type-meta text-text-meta">매우 그렇다</span>
              </div>
            )}
          </div>
          {errors[q.id] && <p className="mt-2 type-caption text-danger-text">답해야 하는 질문입니다</p>}
        </fieldset>
      ))}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Button type="submit" loading={sending}>{preview ? '시험 제출' : '보내기'}</Button>
          {sendError && <p className="type-caption text-danger-text" role="alert">{sendError}</p>}
        </div>
        <button type="button" onClick={() => { setAnswers({}); setErrors({}) }} className="type-body-sm text-primary-text">양식 지우기</button>
      </div>
    </form>
  )
}
