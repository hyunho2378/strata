// 문서함 첫 화면. 문서, 시트, 설문지 전환 → 새로 만들기 양식 → 최근 항목.
import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronRight, FileText, FileUp, ListChecks, MoreVertical, Pin, Plus, Search, Sheet } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import Button from '../../components/ui/Button.jsx'
import ChoiceChips from '../../components/ui/ChoiceChips.jsx'
import Input from '../../components/ui/Input.jsx'
import SegmentControl from '../../components/ui/SegmentControl.jsx'
import useToast from '../../hooks/useToast.js'
import { VAR_BY_KEY } from '../../lib/docVars.js'
import { DOC_CATEGORIES, DOC_TEMPLATES, FORM_TEMPLATES, SHEET_TEMPLATES } from '../../lib/workspaceTemplates.js'
import useWorkspaceStore, { useWorkspaceInit } from '../../store/useWorkspaceStore.js'
import * as api from '../../lib/workspaceApi.js'
import { markdownToHtml } from './docConvert.js'

export const KINDS = [
  { key: 'doc', label: '문서', Icon: FileText, templates: DOC_TEMPLATES, newLabel: '새 문서', text: 'text-kind-doc', bg: 'bg-kind-doc' },
  { key: 'sheet', label: '시트', Icon: Sheet, templates: SHEET_TEMPLATES, newLabel: '새 시트', text: 'text-kind-sheet', bg: 'bg-kind-sheet' },
  { key: 'form', label: '설문지', Icon: ListChecks, templates: FORM_TEMPLATES, newLabel: '새 설문지', text: 'text-kind-form', bg: 'bg-kind-form' }
]
export const editorPath = (item) => `/docs/${item.kind}/${item.id}`

const fmt = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('ko-KR')
}

// 서식 보기. 문서, 시트, 설문지가 같은 틀(흰 쪽 카드, 같은 비율과 여백)을 쓰고 안쪽 그림만 다르다
function TemplateThumb({ kind, t }) {
  let inner
  if (t.key === 'blank') inner = <span className="flex h-full items-center justify-center"><Plus size={36} aria-hidden="true" className="text-text-ter" /></span>
  else if (kind === 'sheet') {
    inner = (
      <>
        {/* 표 격자는 선이 아니라 1px 틈과 면 색으로 그린다(UI.md 0장 예외) */}
        <div className="grid grid-cols-4 gap-px bg-line-sub p-px">
          {Array.from({ length: 20 }).map((_, i) => <span key={i} className={clsx('h-3.5', i < 4 ? 'bg-mute' : 'bg-page')} />)}
        </div>
        <p className="mt-2 line-clamp-3 type-count font-normal text-text-meta">{t.columns.map((c) => c.label).join(', ')}</p>
      </>
    )
  } else if (kind === 'form') {
    inner = (
      <>
        <div className="h-1 rounded-xs bg-kind-form" />
        <div className="mt-2 space-y-1.5">
          {t.questions.slice(0, 4).map((q, i) => <p key={i} className="truncate rounded-xs bg-subtle px-1.5 py-1 type-count font-normal text-text-sec">{q.title}</p>)}
        </div>
      </>
    )
  } else {
    const text = t.html.replace(/<div class="dv dv-block"[^>]*><\/div>/g, '[표]\n').replace(/<span class="dv" data-var="(\w+)"[^>]*><\/span>/g, (_, k) => `[${VAR_BY_KEY[k]?.label || '자료'}]`).replace(/<span class="dv" data-calc[^>]*><\/span>/g, '[계산]').replace(/<\/(h1|h2|p|li)>/g, '\n').replace(/<[^>]+>/g, '').split('\n').filter(Boolean).slice(0, 8)
    inner = text.map((l, i) => <p key={i} className={clsx('truncate type-count', i === 0 ? 'mb-1 text-center text-text-pri' : 'font-normal text-text-meta')}>{l}</p>)
  }
  const K = KINDS.find((k) => k.key === kind) || KINDS[0]
  return (
    <span className="relative block aspect-[3/4] overflow-hidden rounded-md bg-page shadow-sm transition-[box-shadow,transform] duration-fast group-hover:-translate-y-0.5 group-hover:shadow-md">
      {/* 종류 색 머리: 문서 파랑, 시트 초록, 설문지 보라 */}
      <span className={clsx('flex h-7 items-center gap-1.5 px-3 type-count text-text-inverse', K.bg)}>
        <K.Icon size={13} aria-hidden="true" />{K.label}
      </span>
      <span className="block h-[calc(100%-28px)] overflow-hidden p-3">{inner}</span>
    </span>
  )
}

export default function WorkspaceHome() {
  const [params, setParams] = useSearchParams()
  const kindKey = params.get('kind') || 'doc'
  const kind = KINDS.find((k) => k.key === kindKey) || KINDS[0]
  const items = useWorkspaceStore((s) => s.items)
  const create = useWorkspaceStore((s) => s.create)
  const duplicate = useWorkspaceStore((s) => s.duplicate)
  const remove = useWorkspaceStore((s) => s.remove)
  const navigate = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(null)
  const ready = useWorkspaceInit()
  const mode = useWorkspaceStore((s) => s.mode)
  const createFromHtml = useWorkspaceStore((s) => s.createFromHtml)
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [cat, setCat] = useState('all')

  const importFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setImporting(true)
    try {
      const r = await api.parseFile(f)
      const title = (r.title || f.name.replace(/\.[^.]+$/, '')).slice(0, 80)
      const id = createFromHtml(title, markdownToHtml(r.markdown))
      toast(`${f.name} 파일을 문서로 가져왔습니다`, 'primary')
      navigate(`/docs/doc/${id}`)
    } catch (err) {
      toast(err.message || '파일을 읽지 못했습니다', 'danger')
    } finally {
      setImporting(false)
    }
  }

  const pinned = useMemo(() => items.filter((x) => x.meta?.pinned && (!q || x.title.includes(q))), [items, q])
  const list = useMemo(() => items
    .filter((x) => !x.meta?.pinned)
    .filter((x) => x.kind === kind.key)
    .filter((x) => !q || x.title.includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items, kind.key, q])

  const make = (t) => {
    const id = create(kind.key, t.key)
    navigate(`/docs/${kind.key}/${id}`)
  }

  const cats = kind.key === 'doc'
    ? [{ value: 'all', label: `전체 ${kind.templates.length - 1}` }, ...DOC_CATEGORIES.map((c) => ({ value: c.key, label: `${c.label} ${DOC_TEMPLATES.filter((t) => t.cat === c.key).length}` }))]
    : [{ value: 'all', label: `전체 ${kind.templates.length - 1}` }]
  const NOTE = {
    doc: '행정업무운영 편람 양식(기안문, 보고서, 계획서, 공고, 회의록, 보도자료)을 따라요. 숫자 칸은 상황판의 지금 값으로 채워요.',
    sheet: '시설 대장과 설문 응답을 정리하는 표예요. 설문 응답은 자동으로 쌓여요.',
    form: '담당 부서와 주민에게 링크로 보내는 설문이에요. 응답은 시트로 바로 모여요.'
  }

  return (
    <PageShell title="문서함">
      {/* 머리: 종류 전환(공용 SegmentControl)과 검색(공용 Input). 세 종류 모두 같은 배치 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentControl label="종류" value={kind.key} onChange={(v) => { setParams({ kind: v }); setCat('all'); setQ('') }}
          items={KINDS.map((k) => ({ value: k.key, label: k.label, icon: k.Icon, iconClass: k.text }))} />
        <Input compact label={`${kind.label} 검색`} placeholder={`${kind.label} 검색`} value={q} onChange={(e) => setQ(e.target.value)}
          leftIcon={<Search size={16} aria-hidden="true" />} className="w-full cq-md:w-80" />
      </div>

      <section className="mt-6 rounded-md bg-subtle p-4 cq-lg:p-6" aria-labelledby="tpl-title">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <h2 id="tpl-title" className="type-h3 text-text-pri">{kind.newLabel} 시작</h2>
          {kind.key === 'doc' && (
            <>
              <input ref={fileRef} type="file" accept=".hwp,.hwpx,.pdf,.docx" className="sr-only" onChange={importFile} />
              <Button variant="secondary" size="sm" disabled={importing} leftIcon={<FileUp size={16} aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
                {importing ? '파일 읽는 중' : '한글 파일 가져오기'}
              </Button>
            </>
          )}
        </div>
        <ChoiceChips label="서식 종류" size="sm" value={cat} onChange={setCat} options={cats} className="mt-3" />
        <p className="mt-2 type-meta text-text-meta">{NOTE[kind.key]}</p>
        <ul className="mt-4 grid grid-cols-2 gap-4 cq-sm:grid-cols-3 cq-lg:grid-cols-4 cq-xl:grid-cols-6">
          {kind.templates.filter((t) => kind.key !== 'doc' || cat === 'all' || t.key === 'blank' || t.cat === cat).map((t) => (
            <li key={t.key} className="min-w-0">
              <button type="button" onClick={() => make(t)} className="group block w-full text-left" title={t.desc}>
                <TemplateThumb kind={kind.key} t={t} />
                <span className="mt-2 block truncate type-strong text-text-pri">{t.title}</span>
                <span className="line-clamp-2 block min-h-10 type-meta text-text-meta">{t.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {kind.key === 'doc' && pinned.length > 0 && (
        <section className="mt-8" aria-labelledby="pin-title">
          <h2 id="pin-title" className="type-h3 text-text-pri">고정 문서</h2>
          <ul className="mt-3 grid gap-3 cq-lg:grid-cols-2">
            {pinned.map((x) => (
              <li key={x.id}>
                <Link to={editorPath(x)} className="flex items-center gap-3 rounded-md bg-page p-4 shadow-sm transition-shadow duration-fast hover:shadow-md">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-text-pri text-text-inverse"><Pin size={18} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-strong text-text-pri">{x.title}</span>
                    <span className="block truncate type-meta text-text-meta">판 {x.meta?.version}, 작업할 때마다 갱신, 한글과 PDF로 저장 가능</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-text-meta" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="recent-title">
        <h2 id="recent-title" className="type-h3 text-text-pri">최근 {kind.label} <span className="ml-1 type-body-sm text-text-meta tabular-nums">{list.length}개</span></h2>
        {!ready ? (
          <p className="mt-3 type-body-sm text-text-meta">문서함을 불러오고 있어요.</p>
        ) : list.length === 0 ? (
          <p className="mt-3 type-body-sm text-text-meta">아직 만든 {kind.label}가 없어요. 위 양식에서 시작하세요.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-px overflow-hidden rounded-md bg-line-sub shadow-sm">
            {list.map((x) => (
              <li key={x.id} className="relative flex items-center gap-3 bg-page px-4 py-3">
                <span className={clsx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-text-inverse', kind.bg)}><kind.Icon size={18} aria-hidden="true" /></span>
                <Link to={editorPath(x)} className="min-w-0 flex-1">
                  <span className="block truncate type-strong text-text-pri hover:underline">{x.title}</span>
                  <span className="block type-meta text-text-meta">
                    {x.kind === 'form' && `응답 ${x.responses.length}개, `}
                    {x.kind === 'sheet' && x.source === 'roster' && '명부와 연결, '}
                    {x.kind === 'sheet' && x.source === 'form' && '설문 응답과 연결, '}
                    {fmt(x.updatedAt)} 수정
                  </span>
                </Link>
                <button type="button" aria-label={`${x.title} 메뉴`} onClick={() => setMenu(menu === x.id ? null : x.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-meta hover:bg-mute">
                  <MoreVertical size={18} aria-hidden="true" />
                </button>
                {menu === x.id && (
                  <div className="absolute right-4 top-12 z-dropdown w-40 rounded-md bg-page py-1 shadow-md">
                    <button type="button" className="block w-full px-3 py-2 text-left type-body-sm hover:bg-mute" onClick={() => { const id = duplicate(x.id); setMenu(null); toast('사본을 만들었습니다', 'primary'); if (id) navigate(`/docs/${x.kind}/${id}`) }}>사본 만들기</button>
                    <button type="button" className="block w-full px-3 py-2 text-left type-body-sm text-danger-text hover:bg-mute" onClick={() => { remove(x.id); setMenu(null); toast('삭제했습니다') }}>삭제</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 type-meta text-text-meta">{mode === 'server' ? '문서함은 서버에 저장해요. 실제 주민 정보는 넣지 마세요.' : '문서함은 시연용이라 이 창에만 저장해요. 새로고침하면 처음 상태로 돌아가니 필요한 문서는 내보내기로 받아 두세요. 실제 주민 정보는 넣지 마세요.'}</p>
      </section>
    </PageShell>
  )
}
