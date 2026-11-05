// 편집기 공통 틀. 왼쪽 위 문서함으로 돌아가기, 제목 바로 고치기, 저장 상태, 오른쪽 동작 버튼.
// 사이드바 없이 화면 전체를 쓴다(구글 문서와 같은 배치).
import clsx from 'clsx'
import { ArrowLeft, Cloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import useWorkspaceStore from '../../store/useWorkspaceStore.js'

export function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 문서, 시트, 설문지 편집기가 모두 쓰는 머리(높이 44px). 뒤로, 종류 표시, 제목, 저장 상태, 오른쪽 동작 순서가 같다
export default function EditorFrame({ fill = false, kind, Icon, title, onTitle, updatedAt, actions, tabs, badge, suffix, children }) {
  const [draft, setDraft] = useState(title)
  useEffect(() => { setDraft(title) }, [title])
  const commit = () => { const t = draft.trim(); if (t && t !== title) onTitle(t); else setDraft(title) }
  const mode = useWorkspaceStore((s) => s.mode)
  const sync = useWorkspaceStore((s) => s.sync)
  const savedAt = useWorkspaceStore((s) => s.savedAt)
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : ''
  const KIND_LABEL = { doc: '문서', sheet: '시트', form: '설문지' }
  return (
    <div className={fill ? 'flex h-dvh flex-col overflow-hidden bg-canvas' : 'flex min-h-dvh flex-col bg-canvas'}>
      <header className="sticky top-0 z-nav shrink-0 bg-page shadow-sm">
        <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 md:h-11">
          <Link to={`/docs?kind=${kind}`} aria-label="문서함으로" title="문서함으로" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-sec hover:bg-mute">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <span className={clsx('hidden h-6 shrink-0 items-center gap-1 rounded-xs px-1.5 type-count text-text-inverse sm:inline-flex', { doc: 'bg-kind-doc', sheet: 'bg-kind-sheet', form: 'bg-kind-form' }[kind])}>
            {Icon && <Icon size={12} aria-hidden="true" />}{badge || KIND_LABEL[kind]}
          </span>
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            aria-label="제목" autoComplete="off" spellCheck={false}
            className="min-w-20 max-w-md flex-1 truncate rounded-xs bg-transparent px-1.5 py-0.5 type-strong text-text-pri transition-colors duration-fast hover:bg-mute focus:bg-subtle"
          />
          {suffix && <span className="hidden shrink-0 type-meta text-text-meta sm:inline">{suffix}</span>}
          <span className="ml-2 hidden shrink-0 items-center gap-1 whitespace-nowrap type-meta text-text-meta lg:inline-flex">
            <Cloud size={13} aria-hidden="true" />{mode === 'server'
              ? (sync === 'saving' ? '저장 중' : sync === 'error' ? '저장 실패, 다시 시도 중' : `서버에 저장됨${savedAt ? ` ${new Date(savedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}` : ''}`)
              : (time ? `${time} 저장됨(이 창)` : '저장됨(이 창)')}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>
        </div>
        {tabs}
      </header>
      {children}
    </div>
  )
}
