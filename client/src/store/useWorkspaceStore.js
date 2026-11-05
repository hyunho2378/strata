// useWorkspaceStore.js 문서함(문서, 시트, 설문지) 저장소.
// 서버 모드: /api/workspace(Upstash Redis)에 저장하고, 설문 응답은 서버에서 모은다.
// 메모리 모드: 서버 저장소가 없을 때(로컬 개발 등). 새로고침하면 처음 상태로 돌아간다. 브라우저 저장소는 쓰지 않는다.
// 실제 주민 개인정보를 넣지 않는다.
import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import * as api from '../lib/workspaceApi.js'
import { DOC_TEMPLATES, FORM_TEMPLATES, SHEET_TEMPLATES } from '../lib/workspaceTemplates.js'

// 서버 id 규칙(^[A-Za-z][A-Za-z0-9_-]{1,63}$)에 맞는 추측하기 어려운 id
const nid = (p) => `${p}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
const now = () => new Date().toISOString()

// 공문 정보(meta): 양식(preset), 항목 체계, 기안문 두문과 결문, 결재란, 공고 머리, 보도자료 머리. 한글 내보내기에 그대로 쓴다
const metaOf = (t) => ({
  template: t.key, preset: t.preset || '보고서', numbering: t.numbering || 'report', bodyFont: 'myeongjo',
  head: t.head ? { ...t.head } : null, foot: t.foot ? { ...t.foot } : null, approval: t.approval ? [...t.approval] : null,
  noticeHead: t.noticeHead ? { ...t.noticeHead } : null, press: t.press ? JSON.parse(JSON.stringify(t.press)) : null
})
const fromDocTemplate = (t, title) => ({
  id: nid('d'), kind: 'doc', title: title || t.head?.title || t.title, html: t.html, meta: metaOf(t), updatedAt: now(), createdAt: now(),
  versions: [{ at: now(), label: '처음 만듦', html: t.html }]
})
const fromSheetTemplate = (t, title) => ({
  id: nid('s'), kind: 'sheet', title: title || t.title,
  columns: t.columns.map((c) => ({ ...c })), rows: (t.rows || []).map((r) => [...r]),
  source: t.source || null, formId: null, updatedAt: now(), createdAt: now()
})
const fromFormTemplate = (t, title) => ({
  id: nid('f'), kind: 'form', title: title || t.title, desc: t.desc,
  questions: t.questions.map((q) => ({ ...q, id: nid('q'), options: q.options ? [...q.options] : undefined })),
  responses: [], open: true, sheetId: null, updatedAt: now(), createdAt: now()
})

function buildSeed() {
  const docs = [
    fromDocTemplate(DOC_TEMPLATES.find((t) => t.key === 'situation')),
    fromDocTemplate(DOC_TEMPLATES.find((t) => t.key === 'continuity')),
    fromDocTemplate(DOC_TEMPLATES.find((t) => t.key === 'request'), '동해시 안전과 협조 요청 공문'),
    fromDocTemplate(DOC_TEMPLATES.find((t) => t.key === 'interview'), '망상동 담당 부서 면담 기록')
  ]
  const sheets = [
    fromSheetTemplate(SHEET_TEMPLATES.find((t) => t.key === 'facilities'), '시설 기능 대장'),
    fromSheetTemplate(SHEET_TEMPLATES.find((t) => t.key === 'closure'), '운영 중단 일정표')
  ]
  const form = fromFormTemplate(FORM_TEMPLATES.find((t) => t.key === 'facilityCheck'), '시설 운영 확인 요청')
  const formSheet = {
    id: nid('s'), kind: 'sheet', title: `${form.title} (응답)`, columns: [], rows: [],
    source: 'form', formId: form.id, updatedAt: now(), createdAt: now()
  }
  form.sheetId = formSheet.id
  return [...docs, ...sheets, form, formSheet]
}

// 서버 동기화 예약. id 별 1초 지연, 실패 시 5초 간격 3회 재시도
const timers = new Map()
const retries = new Map()
let initPromise = null

export const useWorkspaceStore = create((set, get) => {
  const isServer = () => get().mode === 'server'

  const pushNow = async (id) => {
    clearTimeout(timers.get(id)); timers.delete(id)
    const item = get().items.find((x) => x.id === id)
    if (!item) return
    set({ sync: 'saving' })
    try {
      await api.put(item)
      retries.delete(id)
      set({ sync: timers.size ? 'saving' : 'idle', savedAt: now() })
    } catch {
      const n = (retries.get(id) || 0) + 1
      retries.set(id, n)
      set({ sync: 'error' })
      if (n <= 3) timers.set(id, setTimeout(() => pushNow(id), 5000))
    }
  }
  const schedule = (id) => {
    if (!isServer()) return
    clearTimeout(timers.get(id))
    timers.set(id, setTimeout(() => pushNow(id), 1000))
    set({ sync: 'saving' })
  }

  return {
    items: buildSeed(),
    mode: 'loading',   // loading | server | memory
    ready: false,
    sync: 'idle',      // idle | saving | error
    savedAt: null,

    get: (id) => get().items.find((x) => x.id === id),

    init: () => {
      if (initPromise) return initPromise
      initPromise = (async () => {
        try {
          let items = await api.list()
          if (!items.length) {
            const r = await api.seed(get().items)
            items = r.seeded ? get().items : await api.list()
            if (!items.length) items = get().items
          }
          set({ items, mode: 'server', ready: true })
          window.addEventListener('pagehide', () => {
            for (const id of [...timers.keys()]) {
              const item = get().items.find((x) => x.id === id)
              if (!item) continue
              const body = JSON.stringify(api.serialize(item))
              if (body.length < 60_000) fetch('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
            }
          })
        } catch {
          set({ mode: 'memory', ready: true })
        }
      })()
      return initPromise
    },

    flush: async () => { await Promise.all([...timers.keys()].map((id) => pushNow(id))) },

    create: (kind, templateKey, title) => {
      let item
      if (kind === 'doc') item = fromDocTemplate(DOC_TEMPLATES.find((t) => t.key === templateKey) || DOC_TEMPLATES[0], title)
      if (kind === 'sheet') item = fromSheetTemplate(SHEET_TEMPLATES.find((t) => t.key === templateKey) || SHEET_TEMPLATES[0], title)
      if (kind === 'form') item = fromFormTemplate(FORM_TEMPLATES.find((t) => t.key === templateKey) || FORM_TEMPLATES[0], title)
      set((s) => ({ items: [item, ...s.items] }))
      schedule(item.id)
      return item.id
    },

    createFromHtml: (title, html) => {
      const item = { id: nid('d'), kind: 'doc', title, html, updatedAt: now(), createdAt: now(), versions: [{ at: now(), label: '파일에서 가져옴', html }] }
      set((s) => ({ items: [item, ...s.items] }))
      schedule(item.id)
      return item.id
    },

    update: (id, patch) => {
      if (get().items.find((x) => x.id === id)?.meta?.locked) return
      set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)) }))
      schedule(id)
    },

    remove: (id) => {
      if (get().items.find((x) => x.id === id)?.meta?.locked) return
      const gone = get().items.filter((x) => x.id === id || x.formId === id).map((x) => x.id)
      set((s) => ({ items: s.items.filter((x) => !gone.includes(x.id)) }))
      for (const g of gone) {
        clearTimeout(timers.get(g)); timers.delete(g)
        if (isServer()) api.del(g).catch(() => {})
      }
    },

    duplicate: (id) => {
      const src = get().items.find((x) => x.id === id)
      if (!src) return null
      const copy = JSON.parse(JSON.stringify(src))
      copy.id = nid(src.kind[0])
      copy.title = `${src.title} 사본`
      copy.createdAt = now(); copy.updatedAt = now()
      if (copy.kind === 'form') { copy.responses = []; copy.sheetId = null }
      if (copy.meta) { delete copy.meta.locked; delete copy.meta.pinned }
      set((s) => ({ items: [copy, ...s.items] }))
      schedule(copy.id)
      return copy.id
    },

    // 문서 버전 저장. 같은 내용이면 건너뛴다
    saveVersion: (id, label) => {
      if (get().items.find((x) => x.id === id)?.meta?.locked) return
      let changed = false
      set((s) => ({
        items: s.items.map((x) => {
          if (x.id !== id || x.kind !== 'doc') return x
          const last = x.versions[x.versions.length - 1]
          if (last && last.html === x.html) return x
          changed = true
          return { ...x, versions: [...x.versions, { at: now(), label: label || '자동 저장', html: x.html }].slice(-30) }
        })
      }))
      if (changed) schedule(id)
    },

    // 설문 응답. 서버 모드에서는 서버에 보내고 응답 목록을 다시 읽는다. 결과 { ok, message }
    submit: async (formId, answers) => {
      if (!isServer()) {
        set((s) => ({ items: s.items.map((x) => (x.id === formId ? { ...x, responses: [...x.responses, { id: nid('r'), at: now(), answers }] } : x)) }))
        return { ok: true }
      }
      try {
        await get().flush()
        await api.submit(formId, answers)
        await get().refreshResponses(formId)
        return { ok: true }
      } catch (e) {
        return { ok: false, message: e.message || '응답을 보내지 못했습니다' }
      }
    },

    refreshResponses: async (formId) => {
      if (!isServer()) return
      const list = await api.responses(formId)
      set((s) => ({ items: s.items.map((x) => (x.id === formId ? { ...x, responses: list } : x)) }))
    },

    linkSheet: (formId) => {
      const form = get().items.find((x) => x.id === formId)
      if (!form) return null
      if (form.sheetId && get().items.some((x) => x.id === form.sheetId)) return form.sheetId
      const sheet = { id: nid('s'), kind: 'sheet', title: `${form.title} (응답)`, columns: [], rows: [], source: 'form', formId, updatedAt: now(), createdAt: now() }
      set((s) => ({ items: [sheet, ...s.items.map((x) => (x.id === formId ? { ...x, sheetId: sheet.id } : x))] }))
      schedule(sheet.id); schedule(formId)
      return sheet.id
    }
  }
})

// 문서함 화면이 처음 열릴 때 서버 저장소를 확인한다. 준비되면 true
export function useWorkspaceInit() {
  const ready = useWorkspaceStore((s) => s.ready)
  const init = useWorkspaceStore((s) => s.init)
  useEffect(() => { init() }, [init])
  return ready
}

// 응답 탭이 열려 있는 동안 10초마다 서버 응답을 다시 읽는다
export function useFormResponsePolling(formId, enabled) {
  const refreshResponses = useWorkspaceStore((s) => s.refreshResponses)
  const mode = useWorkspaceStore((s) => s.mode)
  const [loading, setLoading] = useState(false)
  const refresh = useCallback(async () => {
    if (!formId || mode !== 'server') return
    setLoading(true)
    try { await refreshResponses(formId) } catch { /* 다음 주기에 다시 시도 */ } finally { setLoading(false) }
  }, [formId, mode, refreshResponses])
  useEffect(() => {
    if (!enabled || mode !== 'server') return undefined
    refresh()
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 10000)
    return () => clearInterval(t)
  }, [enabled, mode, refresh])
  return { refresh, loading }
}

export default useWorkspaceStore
