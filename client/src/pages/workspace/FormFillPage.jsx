// 설문지 응답 화면(/f/:id). 로그인 없이 연다. 서버에 있는 설문을 먼저 찾고, 없으면 이 창의 설문을 쓴다.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Logo from '../../components/nav/Logo.jsx'
import * as api from '../../lib/workspaceApi.js'
import useWorkspaceStore from '../../store/useWorkspaceStore.js'
import FormRenderer from './FormRenderer.jsx'

export default function FormFillPage() {
  const { id } = useParams()
  const local = useWorkspaceStore((s) => s.items.find((x) => x.id === id && x.kind === 'form'))
  const submitLocal = useWorkspaceStore((s) => s.submit)
  const [remote, setRemote] = useState(undefined) // undefined 확인 중, null 서버에 없음

  useEffect(() => {
    let alive = true
    api.publicForm(id).then((f) => { if (alive) setRemote(f) }).catch(() => { if (alive) setRemote(null) })
    return () => { alive = false }
  }, [id])

  const form = remote || local
  const onSubmit = async (answers) => {
    if (remote) {
      try { await api.submit(id, answers); return { ok: true } } catch (e) { return { ok: false, message: e.message } }
    }
    return submitLocal(id, answers)
  }

  return (
    <div className="min-h-dvh bg-primary-soft">
      <header className="flex h-14 items-center justify-center bg-page shadow-sm"><Logo linked={false} /></header>
      <main className="mx-auto w-full max-w-form px-4 py-6">
        {remote === undefined && !local ? (
          <p className="py-10 text-center type-body-sm text-text-meta">설문지를 불러오고 있어요.</p>
        ) : form ? (
          <FormRenderer form={{ ...form, responses: form.responses || [] }} onSubmit={onSubmit} />
        ) : (
          <div className="rounded-md bg-page p-6 shadow-sm">
            <h1 className="type-h2 text-text-pri">설문지를 찾을 수 없습니다</h1>
            <p className="mt-2 type-body text-text-sec">링크가 바르지 않거나 지워진 설문지예요.</p>
          </div>
        )}
      </main>
    </div>
  )
}
