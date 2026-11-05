// 문서 편집기. 한글(웹한글)과 같은 배치로 만든다.
//  제목 줄 | 메뉴(파일 편집 보기 입력 서식 쪽 검토 도구) | 메뉴별 기능 상자 | 서식 도구 상자(스타일, 글꼴, 크기, 글자, 정렬, 줄 간격)
//  가로·세로 눈금자 | 가운데 A4 쪽 | 오른쪽 작업 창 | 아래 상태 표시줄(쪽, 글자, 양식, 삽입, 확대)
// 쪽 모양(여백, 글꼴, 글자 크기, 장평, 줄 간격, 항목 부호와 들여쓰기)은 kordoc 이 만드는 HWPX 실측값(hwpMetrics.json)으로 그린다.
// [한글 문서 보기]는 내보낼 HWPX 파일을 서버에서 실제로 만들고 kordoc 조판 엔진으로 그린 쪽을 보여 준다(파일과 같은 모양).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CalendarDays, ClipboardPaste, Cloud, Copy, Database, Eye, FileCheck2, FileDown, FilePlus2, FileText, Highlighter, History, IndentDecrease, IndentIncrease, Info, Italic, Lock, Minus, Omega, PaintRoller, PanelRight, Paperclip, Pilcrow, Plus, Printer, Redo2, RefreshCw, Replace, Scale, Scissors, Search, SeparatorHorizontal, Sigma, Strikethrough, Table2, Type, Underline, Undo2, X
, Ruler as RulerIcon
} from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Badge from '../../components/ui/Badge.jsx'
import Select from '../../components/ui/Select.jsx'
import * as api from '../../lib/workspaceApi.js'
import { findCitations, hashText } from './docConvert.js'
import { C as calcHtml, V as varHtml, computeVars, refreshVars, withOverrides } from '../../lib/docVars.js'
import DataPanel from './DataPanel.jsx'
import { krds } from '../../tokens.js'
import {
  END_MARK, FONTS, LINE_SPACINGS, METRICS_INFO, PRESETS, SIZES, STYLES, annotate, docCss, fontCss, footHtml, gongmunOptions, headHtml,
  metricsOf, presetOf, toHwpxPayload
} from './hwpDoc.js'
import useToast from '../../hooks/useToast.js'
import { useStrata } from '../../lib/strataData.js'
import useWorkspaceStore, { useWorkspaceInit } from '../../store/useWorkspaceStore.js'
import EditorFrame, { download } from './EditorFrame.jsx'
import Button from '../../components/ui/Button.jsx'
import { htmlPagesToPdf, paginateHtml, printHtmlPages } from './hwpPages.js'

const lawCache = new Map()
const LAW_TONE = { exists: ['success', '실존'], not_found: ['danger', '없음'], unknown: ['warning', '확인 불가'] }
const MM = 96 / 25.4
const exec = (cmd, arg) => document.execCommand(cmd, false, arg)
const COLORS = ['#000000', '#33363d', '#58616a', '#8a949e', '#256ef4', '#083891', '#d63d4a', '#ab2b36']
const MARKS = ['#fff3a3', '#d8e5fd', '#f5d6d9', '#e6e8ea']
const SYMBOLS = ['「', '」', '『', '』', '·', 'ㆍ', '∼', '○', '●', '□', '■', '◇', '◆', '△', '▲', '※', '☞', '→', '←', '↑', '↓', '①', '②', '③', '④', '⑤', '㉮', '㉯', '㉰', '℃', '㎞', '㎡', '㎏', '%', '∨', '≒', '±', '×', '÷', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ']
const today = () => { const d = new Date(); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` }

// ── 작은 부품
function RibbonBtn({ label, Icon, onClick, active, disabled, wide }) {
  return (
    <button type="button" title={label} aria-pressed={active || undefined} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={clsx('flex h-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xs px-2 type-count font-normal leading-tight text-text-sec hover:bg-mute hover:text-text-pri disabled:opacity-40', wide ? 'min-w-16' : 'min-w-12', active && 'bg-primary-soft text-primary-text')}>
      <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
const RibbonSep = () => <span aria-hidden="true" className="mx-1.5 h-11 w-px shrink-0 bg-line-sub" />
function Tool({ label, onClick, children, active }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active || undefined}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={clsx('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xs text-text-sec hover:bg-mute hover:text-text-pri', active && 'bg-primary-soft text-primary-text')}>
      {children}
    </button>
  )
}
const Sep = () => <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-line-def" />
// 선택 상자: 디자인 시스템 Select(포털 목록). 네이티브 select 금지
function Pick({ label, value, onChange, options, className, size = 'xs' }) {
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }))
  return (
    <Select label={label} hideLabel value={value} onChange={onChange} options={opts} size={size} portal className={clsx('shrink-0', className)} menuMinWidth={140}
      placeholder={opts.find((o) => o.value === '')?.label || '선택'} />
  )
}

// 눈금자: 쪽 폭(mm)과 여백, cm 단위. 한글처럼 본문 시작점이 0
function HRuler({ page, zoom }) {
  const cm = Math.floor(page.width / 10)
  return (
    <div aria-hidden="true" className="relative mx-auto h-5 select-none overflow-hidden bg-page" style={{ width: `${page.width * zoom}mm` }}>
      <div className="absolute inset-y-0 left-0 bg-mute" style={{ width: `${page.left * zoom}mm` }} />
      <div className="absolute inset-y-0 right-0 bg-mute" style={{ width: `${page.right * zoom}mm` }} />
      {Array.from({ length: cm * 2 + 1 }).map((_, i) => {
        const x = (i * 5 - (page.left % 10)) + page.left - (page.left % 10) // 5mm 간격
        const mmPos = i * 5
        const fromBody = Math.round((mmPos - page.left) / 10)
        return (
          <span key={i} className="absolute bottom-0 w-px bg-text-ter" style={{ left: `${mmPos * zoom}mm`, height: i % 2 === 0 ? 7 : 4 }}>
            {i % 2 === 0 && mmPos > page.left && mmPos < page.width - page.right && fromBody % 2 === 0 && <span className="absolute -top-3 left-0.5 type-count font-normal text-text-meta">{fromBody}</span>}
            {void x}
          </span>
        )
      })}
    </div>
  )
}
function VRuler({ page, zoom, pages }) {
  const total = page.height * pages
  return (
    <div aria-hidden="true" className="relative w-5 shrink-0 select-none overflow-hidden bg-page" style={{ height: `${total * zoom}mm` }}>
      {Array.from({ length: pages }).map((_, p) => (
        <div key={p}>
          <div className="absolute inset-x-0 bg-mute" style={{ top: `${(p * page.height) * zoom}mm`, height: `${page.top * zoom}mm` }} />
          <div className="absolute inset-x-0 bg-mute" style={{ top: `${((p + 1) * page.height - page.bottom) * zoom}mm`, height: `${page.bottom * zoom}mm` }} />
        </div>
      ))}
      {Array.from({ length: Math.floor(total / 10) + 1 }).map((_, i) => (
        <span key={i} className="absolute right-0 h-px bg-text-ter" style={{ top: `${i * 10 * zoom}mm`, width: i % 5 === 0 ? 8 : 4 }} />
      ))}
    </div>
  )
}

const MENUS = [['file', '파일'], ['edit', '편집'], ['view', '보기'], ['insert', '입력'], ['format', '서식'], ['page', '쪽'], ['review', '검토'], ['tools', '도구']]
const PANELS = [['shape', '글자, 문단'], ['data', '자료 넣기'], ['info', '문서 정보'], ['lint', '공문 검사'], ['law', '법령'], ['history', '버전']]

export default function DocEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const doc = useWorkspaceStore((s) => s.items.find((x) => x.id === id))
  const update = useWorkspaceStore((s) => s.update)
  const saveVersion = useWorkspaceStore((s) => s.saveVersion)
  const create = useWorkspaceStore((s) => s.create)
  const duplicate = useWorkspaceStore((s) => s.duplicate)
  const toast = useToast()
  const bodyRef = useRef(null)
  const pageRef = useRef(null)
  const timer = useRef(null)
  const latest = useRef(null)
  const painter = useRef(null)
  const ready = useWorkspaceInit()
  const [menu, setMenu] = useState('edit')
  const [panel, setPanel] = useState('shape')
  const [panelOpen, setPanelOpen] = useState(true)
  const [ruler, setRuler] = useState(true)
  const [showMarks, setShowMarks] = useState(false)
  const [view, setView] = useState('edit') // edit | preview
  const [preview, setPreview] = useState(null)
  // 좁은 화면은 쪽 폭에 맞춰 시작(가로로 잘리지 않게)
  const [zoom, setZoom] = useState(() => { const avail = (typeof window !== 'undefined' ? window.innerWidth : 1280) - (window.innerWidth >= 1024 ? 360 : 24); return Math.max(40, Math.min(100, Math.floor((avail / 794) * 10) * 10)) })
  const [stats, setStats] = useState({ chars: 0, pages: 1, page: 1, para: 1 })
  const [cur, setCur] = useState({ style: 'p', font: '', size: '', align: 'left', lh: 160 })
  const [law, setLaw] = useState(null)
  const [lint, setLint] = useState(null)
  const [pop, setPop] = useState(null) // table | symbol | color | mark | find
  const [tablePick, setTablePick] = useState({ r: 3, c: 3 })
  const [find, setFind] = useState({ q: '', r: '', n: 0 })
  const [editKey, setEditKey] = useState(null)

  const { data: strata } = useStrata()
  const baseVals = useMemo(() => computeVars(strata), [strata])

  const meta = doc?.meta || { preset: '보고서' }
  const locked = !!meta.locked
  // 문서에서 고친 자료 값(meta.varOverrides)을 상황판 값 위에 얹는다
  const vals = useMemo(() => withOverrides(baseVals, meta.varOverrides), [baseVals, meta.varOverrides])
  const presetKey = PRESETS.some((p) => p.key === meta.preset) ? meta.preset : '보고서'
  const preset = presetOf(presetKey)
  const metrics = metricsOf(presetKey)
  const page = metrics.page
  const css = useMemo(() => docCss(presetKey, { showMarks }), [presetKey, showMarks])
  const setMeta = (patch) => { update(id, { meta: { ...meta, ...patch } }); setPreview(null) }

  const measure = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    annotate(el, presetKey)
    const chars = el.innerText.replace(/\s/g, '').length
    // 화면 확대(zoom)와 상관없이 실제 쪽 높이로 나눈다(getBoundingClientRect 는 확대가 적용된 값)
    const h = (pageRef.current?.getBoundingClientRect().height || 1) / (zoom / 100)
    const pages = Math.max(1, Math.ceil((h - 4) / (page.height * MM)))
    setStats((s) => ({ ...s, chars, pages }))
  }, [presetKey, page.height, zoom])

  useEffect(() => {
    if (bodyRef.current && doc) {
      bodyRef.current.innerHTML = doc.html
      // 기안문은 끝 표시를 kordoc 이 붙이므로 본문 끝의 손 끝. 문단을 뺀다
      if (END_MARK[doc.meta?.preset]) [...bodyRef.current.children].filter((el) => el.textContent.replace(/\s/g, '') === '끝.').forEach((el) => el.remove())
      refreshVars(bodyRef.current, vals)
      measure()
      try { exec('defaultParagraphSeparator', 'p') } catch { /* 일부 브라우저 미지원 */ }
    }
  }, [id, ready]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { measure() }, [presetKey, measure])
  // 자료 값을 고치면 본문 자료 칸을 바로 바꾼다
  useEffect(() => { if (bodyRef.current && ready) refreshVars(bodyRef.current, vals) }, [vals]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (latest.current != null) { update(id, { html: latest.current }); saveVersion(id) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 커서 자리의 글자와 문단 모양
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      const node = sel?.anchorNode
      if (!node || !bodyRef.current?.contains(node)) return
      const el = node.nodeType === 1 ? node : node.parentElement
      const block = el.closest('p, h1, h2, li, td, th, blockquote')
      const cs = getComputedStyle(el)
      const style = block?.tagName === 'H1' ? 'h1' : block?.tagName === 'H2' ? 'h2' : block?.classList.contains('gm') ? `gm${block.dataset.lv}` : block?.classList.contains('gm-note') ? 'note' : 'p'
      const named = el.closest('[data-font]')?.dataset.font
      const fontName = named || FONTS.find((f) => cs.fontFamily.includes(f)) || ''
      const pt = Math.round(((parseFloat(cs.fontSize) * 72) / 96) * 10) / 10
      const bcs = block ? getComputedStyle(block) : cs
      const lh = block?.style.lineHeight ? parseFloat(block.style.lineHeight) : Math.round((parseFloat(bcs.lineHeight) / parseFloat(bcs.fontSize)) * 100) || 160
      const align = { center: 'center', right: 'right', justify: 'justify' }[bcs.textAlign] || 'left'
      const blocks = [...bodyRef.current.children]
      const top = (block || el).getBoundingClientRect().top - (pageRef.current?.getBoundingClientRect().top || 0)
      setCur({ style, font: fontName, size: pt, align, lh, bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'), strike: document.queryCommandState('strikeThrough') })
      setStats((s) => ({ ...s, page: Math.max(1, Math.ceil(top / (zoom / 100) / (page.height * MM))), para: Math.max(1, blocks.indexOf(block?.closest('.hwp-body > *') || block) + 1) }))
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [zoom, page.height])

  // 단축키: 저장 Ctrl+S, 찾기 Ctrl+F, 바꾸기 Ctrl+H, 인쇄 Ctrl+P, 문서 보기 Ctrl+Shift+P
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 's') { e.preventDefault(); saveVersion(id, '저장'); toast('저장했습니다', 'primary') }
      if (e.key === 'f' || e.key === 'h') { e.preventDefault(); setPop('find') }
      if (e.key === 'p' && !e.shiftKey) { e.preventDefault(); doExport('print') }
      if (e.key === 'P' || (e.key === 'p' && e.shiftKey)) { e.preventDefault(); openPreview() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!ready) return <div className="flex min-h-dvh items-center justify-center bg-canvas type-body-sm text-text-meta">문서를 불러오고 있어요.</div>
  if (!doc) return <Navigate to="/docs?kind=doc" replace />

  const onInput = () => {
    measure()
    setPreview(null)
    latest.current = bodyRef.current.innerHTML
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      update(id, { html: bodyRef.current.innerHTML })
      saveVersion(id)
      latest.current = null
    }, 800)
  }
  const focusBody = () => { if (!bodyRef.current.contains(document.activeElement)) bodyRef.current.focus() }

  const currentBlocks = () => {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return []
    const range = sel.getRangeAt(0)
    const blocks = [...bodyRef.current.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > blockquote')]
    const hit = blocks.filter((b) => range.intersectsNode(b))
    if (hit.length) return hit
    const el = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('p, h1, h2, blockquote')
    return el && bodyRef.current.contains(el) ? [el] : []
  }
  const setStyle = (key) => {
    currentBlocks().forEach((b) => {
      let target = b
      const want = key === 'h1' ? 'H1' : key === 'h2' ? 'H2' : 'P'
      if (b.tagName !== want) { target = document.createElement(want); target.innerHTML = b.innerHTML; target.style.cssText = b.style.cssText; b.replaceWith(target) }
      target.removeAttribute('class'); target.removeAttribute('data-lv'); target.removeAttribute('data-mark')
      if (key.startsWith('gm')) { target.className = 'gm'; target.dataset.lv = key.slice(2) }
      if (key === 'note') { target.className = 'gm-note'; if (target.firstChild?.nodeType === 3) target.firstChild.nodeValue = target.firstChild.nodeValue.replace(/^※\s*/, '') }
    })
    onInput()
  }
  const shiftLevel = (d) => {
    currentBlocks().forEach((b) => {
      if (b.tagName !== 'P') return
      if (!b.classList.contains('gm')) { if (d > 0) { b.className = 'gm'; b.dataset.lv = '1' } return }
      const lv = Number(b.dataset.lv || 1) + d
      if (lv < 1) { b.removeAttribute('class'); b.removeAttribute('data-lv'); b.removeAttribute('data-mark') } else b.dataset.lv = String(Math.min(8, lv))
    })
    onInput()
  }
  const insertHtml = (html) => { focusBody(); exec('insertHTML', html); onInput() }
  const pageBreak = () => insertHtml('<hr class="page-break"><p><br></p>')
  const onKeyDown = (e) => {
    if (e.key === 'Tab') { e.preventDefault(); shiftLevel(e.shiftKey ? -1 : 1) }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); pageBreak() }
  }
  // 붙여넣기는 글만(웹 서식이 섞여 한글 파일이 깨지지 않게). 줄마다 문단
  const onPaste = (e) => {
    const text = e.clipboardData?.getData('text/plain')
    if (text == null) return
    e.preventDefault()
    const parts = text.replace(/\r/g, '').split('\n')
    if (parts.length === 1) exec('insertText', parts[0])
    else exec('insertHTML', parts.map((t) => `<p>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;') || '<br>'}</p>`).join(''))
    onInput()
  }

  // 글자 모양
  const wrapSel = (fn) => {
    const sel = window.getSelection()
    if (!sel?.rangeCount || sel.isCollapsed || !bodyRef.current.contains(sel.anchorNode)) { toast('먼저 글자를 고르세요'); return }
    const range = sel.getRangeAt(0)
    const span = document.createElement('span')
    fn(span)
    span.appendChild(range.extractContents())
    range.insertNode(span)
    sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(span); sel.addRange(r)
    onInput()
  }
  const setSize = (pt) => wrapSel((s) => { s.style.fontSize = `${pt}pt` })
  const setFont = (name) => wrapSel((s) => { s.style.fontFamily = fontCss(name); s.dataset.font = name })
  const setSpacing = (v) => wrapSel((s) => { s.style.letterSpacing = `${v / 100}em` })
  const setRatio = (v) => wrapSel((s) => { s.dataset.ratio = String(v) })
  const setColor = (c) => { focusBody(); exec('styleWithCSS', true); exec('foreColor', c); exec('styleWithCSS', false); onInput(); setPop(null) }
  const setMark = (c) => { focusBody(); exec('styleWithCSS', true); exec('hiliteColor', c); exec('styleWithCSS', false); onInput(); setPop(null) }
  const clearFormat = () => { focusBody(); exec('removeFormat'); onInput() }
  const setLineHeight = (lh) => { currentBlocks().forEach((b) => { b.style.lineHeight = `${lh}%` }); onInput() }
  const align = (a) => { currentBlocks().forEach((b) => { b.style.textAlign = a }); onInput() }
  // 모양 복사: 커서 자리 글자 모양을 기억했다가 다음에 고른 글자에 입힌다
  const copyShape = () => {
    const sel = window.getSelection()
    if (painter.current) {
      if (!sel || sel.isCollapsed) { toast('모양을 입힐 글자를 고르세요'); return }
      const p = painter.current
      wrapSel((s) => { Object.assign(s.style, p.style); if (p.font) s.dataset.font = p.font })
      painter.current = null; toast('모양을 입혔습니다', 'primary'); return
    }
    const node = sel?.anchorNode
    if (!node || !bodyRef.current.contains(node)) return
    const el = node.nodeType === 1 ? node : node.parentElement
    const cs = getComputedStyle(el)
    painter.current = { style: { fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, color: cs.color, textDecoration: cs.textDecorationLine === 'none' ? '' : cs.textDecorationLine }, font: el.closest('[data-font]')?.dataset.font }
    toast('모양을 기억했어요. 입힐 글자를 고르고 다시 누르세요', 'primary')
  }

  const insertTable = (r, c) => {
    const head = `<tr>${Array.from({ length: c }, (_, i) => `<th>항목 ${i + 1}</th>`).join('')}</tr>`
    const rows = Array.from({ length: Math.max(1, r - 1) }, () => `<tr>${Array.from({ length: c }, () => '<td>&nbsp;</td>').join('')}</tr>`).join('')
    insertHtml(`<table><thead>${head}</thead><tbody>${rows}</tbody></table><p><br></p>`)
    setPop(null)
  }
  const insertVar = (key) => { insertHtml(`${varHtml(key)}&nbsp;`); refreshVars(bodyRef.current, vals) }
  const insertCalc = (expr, unit, digits) => { insertHtml(`${calcHtml(expr, unit, digits)}&nbsp;`); refreshVars(bodyRef.current, vals) }
  const setOverride = (k, t) => { const o = { ...(meta.varOverrides || {}) }; if (t == null) delete o[k]; else o[k] = t; setMeta({ varOverrides: o }) }
  const refreshAll = () => { refreshVars(bodyRef.current, vals); onInput(); toast('자료를 지금 값으로 바꿨습니다', 'primary') }
  const freezeVars = () => {
    bodyRef.current.querySelectorAll('.dv').forEach((el) => {
      if (el.classList.contains('dv-block')) { const d = document.createElement('div'); d.innerHTML = el.innerHTML; el.replaceWith(...d.childNodes) } else el.replaceWith(document.createTextNode(el.textContent))
    })
    onInput(); toast('자료 칸을 지금 값의 글자로 고정했습니다', 'primary')
  }

  // 찾기, 바꾸기(본문 글 노드 기준)
  const textNodes = () => {
    const w = document.createTreeWalker(bodyRef.current, NodeFilter.SHOW_TEXT)
    const out = []
    while (w.nextNode()) if (!w.currentNode.parentElement.closest('.dv')) out.push(w.currentNode)
    return out
  }
  const findNext = () => {
    if (!find.q) return
    const nodes = textNodes()
    const hits = []
    nodes.forEach((n) => { let i = n.nodeValue.indexOf(find.q); while (i >= 0) { hits.push([n, i]); i = n.nodeValue.indexOf(find.q, i + 1) } })
    if (!hits.length) { toast('찾는 글이 없습니다'); return }
    const k = find.n % hits.length
    const [n, i] = hits[k]
    const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + find.q.length)
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r)
    n.parentElement.scrollIntoView({ block: 'center' })
    setFind((f) => ({ ...f, n: f.n + 1 }))
  }
  const replaceAll = () => {
    if (!find.q) return
    let count = 0
    textNodes().forEach((n) => { const parts = n.nodeValue.split(find.q); if (parts.length > 1) { count += parts.length - 1; n.nodeValue = parts.join(find.r) } })
    onInput(); toast(count ? `${count}곳을 바꿨습니다` : '찾는 글이 없습니다', count ? 'primary' : undefined)
  }

  const name = doc.title.replace(/[\\/:*?"<>|]/g, '')
  const payload = () => ({ title: doc.title, preset: presetKey, gongmun: gongmunOptions({ ...meta, preset: presetKey }), ...toHwpxPayload(bodyRef.current, { ...meta, preset: presetKey }) })
  // 내보낼 HWPX 를 서버에서 만들어 kordoc 으로 그린 쪽(문서 보기, 인쇄, PDF 가 같이 쓴다)
  const ensurePreview = async () => {
    if (preview?.state === 'ok') return preview
    setPreview({ state: 'loading' })
    try {
      const r = { state: 'ok', ...(await api.hwpxPreview(payload())) }
      setPreview(r)
      return r
    } catch (e) {
      const msg = e.code === 'UNAVAILABLE' ? '한글 문서 보기는 서버에서 만들어요. 연결을 확인하세요' : e.message
      setPreview({ state: 'error', message: msg })
      throw new Error(msg)
    }
  }
  const openPreview = async () => { setView('preview'); try { await ensurePreview() } catch { /* 창에 표시 */ } }
  const doExport = async (type) => {
    setPop(null)
    const body = bodyRef.current.innerHTML
    if (type === 'hwpx') {
      try {
        const blob = await api.hwpx(payload())
        download(`${name}.hwpx`, blob)
        toast(`${preset.label} 양식 한글 문서를 받았습니다(구조 검사 통과)`, 'primary')
      } catch (e) { toast(e.message, 'danger') }
    }
    // 인쇄와 PDF 저장: 편집 화면과 같은 양식 CSS 로 A4 쪽을 나눠 만든다(표는 쪽을 넘기지 않음)
    const pagesNow = () => paginateHtml({ pageCss: docCss(presetKey), bodyHtml: body, headHtml: headHtml({ ...meta, preset: presetKey }), footHtml: footHtml({ ...meta, preset: presetKey }), page })
    if (type === 'print') {
      if (!printHtmlPages(pagesNow(), { pageCss: docCss(presetKey), title: doc.title })) toast('팝업이 막혀 인쇄 창을 열지 못했습니다', 'danger')
    }
    if (type === 'pdf') {
      try {
        toast('PDF 를 만드는 중입니다')
        const pages = pagesNow()
        const blob = await htmlPagesToPdf(pages, { pageCss: docCss(presetKey), title: doc.title })
        download(`${name}.pdf`, blob)
        toast(`PDF ${pages.length}쪽을 받았습니다`, 'primary')
      } catch (e) { toast(`PDF 를 만들지 못했습니다: ${e.message}`, 'danger') }
    }
    if (type === 'md') download(`${name}.md`, toHwpxPayload(bodyRef.current, meta).markdown.replace(/⟪(?:s\d+|p\d+|\/)⟫/g, ''), 'text/markdown')
  }
  const runLint = async () => {
    setPanelOpen(true); setPanel('lint'); setLint({ state: 'loading' })
    try {
      const r = await api.lint(toHwpxPayload(bodyRef.current, meta).markdown.replace(/⟪(?:s\d+|p\d+|\/)⟫/g, ''), presetKey)
      setLint({ state: 'ok', ...r })
    } catch (e) { setLint({ state: 'error', message: e.message }) }
  }
  const checkLaw = async () => {
    setPanelOpen(true); setPanel('law')
    const text = bodyRef.current?.innerText || ''
    const { citations, hasArticle } = findCitations(text)
    if (!hasArticle || !citations.length) { setLaw({ state: 'empty' }); return }
    const key = hashText(text)
    if (lawCache.has(key)) { setLaw(lawCache.get(key)); return }
    setLaw({ state: 'loading' })
    try {
      const r = await api.law(text)
      if (r.status === 'rate_limited') { setLaw({ state: 'limited' }); return }
      const v = { state: 'ok', results: r.results || [] }
      lawCache.set(key, v); setLaw(v)
    } catch {
      setLaw({ state: 'ok', results: citations.map((c) => ({ citation: c, status: 'unknown', detail: '법령 서버에 연결하지 못했습니다' })) })
    }
  }
  const restore = (v) => {
    bodyRef.current.innerHTML = v.html
    refreshVars(bodyRef.current, vals)
    update(id, { html: v.html }); saveVersion(id, '이전 버전 복원'); measure()
    toast('이전 버전으로 되돌렸습니다', 'primary')
  }
  const newDoc = () => { const nid = create('doc', 'blank'); navigate(`/docs/doc/${nid}`) }
  const openPanel = (k) => { setPanelOpen(true); setPanel(k); if (k === 'lint') runLint(); if (k === 'law') checkLaw() }
  const z = zoom / 100

  // 메뉴별 기능 상자
  const ribbon = {
    file: <>
      <RibbonBtn label="새 문서" Icon={FilePlus2} onClick={newDoc} />
      <RibbonBtn label="문서함" Icon={FileText} onClick={() => navigate('/docs?kind=doc')} />
      <RibbonBtn label="저장" Icon={Cloud} onClick={() => { saveVersion(id, '저장'); toast('저장했습니다', 'primary') }} />
      <RibbonSep />
      <RibbonBtn label="한글로 저장" Icon={FileDown} wide onClick={() => doExport('hwpx')} />
      <RibbonBtn label="PDF 저장" Icon={FileDown} onClick={() => doExport('pdf')} />
      <RibbonSep />
      <RibbonBtn label="인쇄" Icon={Printer} onClick={() => doExport('print')} />
      <RibbonBtn label="마크다운" Icon={FileDown} onClick={() => doExport('md')} />
      <RibbonSep />
      <RibbonBtn label="한글 문서 보기" Icon={Eye} wide active={view === 'preview'} onClick={openPreview} />
      <RibbonBtn label="문서 정보" Icon={Info} onClick={() => openPanel('info')} />
    </>,
    edit: <>
      <RibbonBtn label="되돌리기" Icon={Undo2} onClick={() => exec('undo')} />
      <RibbonBtn label="다시 실행" Icon={Redo2} onClick={() => exec('redo')} />
      <RibbonSep />
      <RibbonBtn label="오려 두기" Icon={Scissors} onClick={() => { focusBody(); exec('cut') }} />
      <RibbonBtn label="복사하기" Icon={Copy} onClick={() => { focusBody(); exec('copy') }} />
      <RibbonBtn label="붙이기" Icon={ClipboardPaste} onClick={async () => { try { const t = await navigator.clipboard.readText(); focusBody(); exec('insertText', t); onInput() } catch { toast('붙이기는 Ctrl+V 를 쓰세요') } }} />
      <RibbonBtn label="모양 복사" Icon={PaintRoller} active={!!painter.current} onClick={copyShape} />
      <RibbonSep />
      <RibbonBtn label="찾기" Icon={Search} onClick={() => setPop('find')} />
      <RibbonBtn label="바꾸기" Icon={Replace} onClick={() => setPop('find')} />
      <RibbonSep />
      <RibbonBtn label="글자 모양" Icon={Type} onClick={() => openPanel('shape')} />
      <RibbonBtn label="문단 모양" Icon={AlignJustify} onClick={() => openPanel('shape')} />
      <RibbonBtn label="표" Icon={Table2} onClick={() => setPop('table')} />
      <RibbonBtn label="자료" Icon={Database} onClick={() => openPanel('data')} />
    </>,
    view: <>
      <RibbonBtn label="쪽 편집" Icon={FileText} active={view === 'edit'} onClick={() => setView('edit')} />
      <RibbonBtn label="한글 문서 보기" Icon={Eye} wide active={view === 'preview'} onClick={openPreview} />
      <RibbonSep />
      <RibbonBtn label="문단 부호" Icon={Pilcrow} active={showMarks} onClick={() => setShowMarks((v) => !v)} />
      <RibbonBtn label="눈금자" Icon={RulerIcon} active={ruler} onClick={() => setRuler((v) => !v)} />
      <RibbonBtn label="작업 창" Icon={PanelRight} active={panelOpen} onClick={() => setPanelOpen((v) => !v)} />
      <RibbonSep />
      <RibbonBtn label="쪽 맞춤" Icon={Minus} onClick={() => setZoom(70)} />
      <RibbonBtn label="100%" Icon={Search} onClick={() => setZoom(100)} />
      <RibbonBtn label="폭 맞춤" Icon={Plus} onClick={() => setZoom(120)} />
    </>,
    insert: <>
      <RibbonBtn label="표" Icon={Table2} onClick={() => setPop('table')} />
      <RibbonBtn label="쪽 나누기" Icon={SeparatorHorizontal} onClick={pageBreak} />
      <RibbonSep />
      <RibbonBtn label="자료" Icon={Database} onClick={() => openPanel('data')} />
      <RibbonBtn label="계산식" Icon={Sigma} onClick={() => openPanel('data')} />
      <RibbonBtn label="날짜" Icon={CalendarDays} onClick={() => { focusBody(); exec('insertText', today()); onInput() }} />
      <RibbonBtn label="문자표" Icon={Omega} onClick={() => setPop('symbol')} />
      <RibbonBtn label="붙임" Icon={Paperclip} onClick={() => insertHtml('<p>붙임 1. ○○○ 1부.</p>')} />
      <RibbonBtn label="참고(※)" Icon={Info} onClick={() => insertHtml('<p class="gm-note">○○○</p>')} />
    </>,
    format: <>
      <RibbonBtn label="글자 모양" Icon={Type} onClick={() => openPanel('shape')} />
      <RibbonBtn label="문단 모양" Icon={AlignJustify} onClick={() => openPanel('shape')} />
      <RibbonSep />
      <RibbonBtn label="한 수준 감소" Icon={IndentDecrease} onClick={() => shiftLevel(-1)} />
      <RibbonBtn label="한 수준 증가" Icon={IndentIncrease} onClick={() => shiftLevel(1)} />
      <RibbonSep />
      <RibbonBtn label="글자 색" Icon={Type} onClick={() => setPop('color')} />
      <RibbonBtn label="형광펜" Icon={Highlighter} onClick={() => setPop('mark')} />
      <RibbonBtn label="모양 지우기" Icon={X} onClick={clearFormat} />
      <RibbonBtn label="모양 복사" Icon={PaintRoller} onClick={copyShape} />
    </>,
    page: <>
      <div className="flex shrink-0 flex-col justify-center gap-1 px-2">
        <span className="type-count font-normal text-text-meta">문서 양식</span>
        <Pick label="문서 양식" value={presetKey} onChange={(v) => setMeta({ preset: v, head: v === '기안문' && !meta.head ? { org: '동해시', to: '', via: '', title: doc.title } : meta.head, foot: v === '기안문' && !meta.foot ? { sender: '동해시장' } : meta.foot })} options={PRESETS.map((p) => ({ value: p.key, label: p.label }))} className="w-52" />
      </div>
      <RibbonSep />
      <div className="flex shrink-0 flex-col justify-center px-2 type-count font-normal leading-5 text-text-sec">
        <span>편집 용지 A4 {page.width} x {page.height}mm</span>
        <span>여백 위 {page.top} 아래 {page.bottom} 왼쪽 {page.left} 오른쪽 {page.right}mm</span>
        <span>본문 {metrics.body.font} {metrics.body.pt}pt, 장평 {metrics.body.ratio}%, 줄 간격 {metrics.body.lineSpacing}%</span>
      </div>
      <RibbonSep />
      <RibbonBtn label="쪽 나누기" Icon={SeparatorHorizontal} onClick={pageBreak} />
      <RibbonBtn label="쪽 번호" Icon={FileText} active={meta.pageNumbers !== false} onClick={() => setMeta({ pageNumbers: meta.pageNumbers === false })} />
      <RibbonBtn label="결재란" Icon={Lock} active={!!meta.approval?.length} onClick={() => setMeta({ approval: meta.approval?.length ? null : ['담당', '팀장', '과장'] })} />
    </>,
    review: <>
      <RibbonBtn label="공문 검사" Icon={FileCheck2} onClick={runLint} />
      <RibbonBtn label="법령 확인" Icon={Scale} onClick={() => openPanel('law')} />
      <RibbonBtn label="버전 기록" Icon={History} onClick={() => openPanel('history')} />
      <RibbonSep />
      <RibbonBtn label="한글 문서 보기" Icon={Eye} wide onClick={openPreview} />
    </>,
    tools: <>
      <RibbonBtn label="자료 새로 고침" Icon={RefreshCw} wide onClick={refreshAll} />
      <RibbonBtn label="자료 고정" Icon={Lock} onClick={freezeVars} />
      <RibbonBtn label="계산식" Icon={Sigma} onClick={() => openPanel('data')} />
      <RibbonSep />
      <RibbonBtn label="글자 수" Icon={Info} onClick={() => toast(`공백 뺀 ${stats.chars.toLocaleString('ko-KR')}글자, ${stats.pages}쪽`)} />
    </>
  }

  const fmtBar = (
    <div className="no-scrollbar flex h-9 items-center gap-1 overflow-x-auto bg-page px-2">
      <Tool label="되돌리기(Ctrl+Z)" onClick={() => exec('undo')}><Undo2 size={15} /></Tool>
      <Tool label="다시 실행(Ctrl+Y)" onClick={() => exec('redo')}><Redo2 size={15} /></Tool>
      <Sep />
      <Pick label="스타일" value={cur.style} onChange={setStyle} options={STYLES.map((s) => ({ value: s.key, label: s.label }))} className="w-20" />
      <Pick label="글꼴" value={FONTS.includes(cur.font) ? cur.font : ''} onChange={setFont} options={[{ value: '', label: `${metrics.body.font}(본문)` }, ...FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: fontCss(f) } }))]} className="w-32" />
      <Pick label="글자 크기(pt)" value={SIZES.includes(cur.size) ? cur.size : ''} onChange={(v) => v && setSize(Number(v))} options={[{ value: '', label: cur.size ? `${cur.size} pt` : 'pt' }, ...SIZES.map((s) => ({ value: s, label: `${s}.0 pt` }))]} className="w-20" />
      <Sep />
      <Tool label="진하게(Ctrl+B)" active={cur.bold} onClick={() => { exec('bold'); onInput() }}><Bold size={15} /></Tool>
      <Tool label="기울임(Ctrl+I)" active={cur.italic} onClick={() => { exec('italic'); onInput() }}><Italic size={15} /></Tool>
      <Tool label="밑줄(Ctrl+U)" active={cur.underline} onClick={() => { exec('underline'); onInput() }}><Underline size={15} /></Tool>
      <Tool label="취소선" active={cur.strike} onClick={() => { exec('strikeThrough'); onInput() }}><Strikethrough size={15} /></Tool>
      <span className="relative inline-flex">
        <Tool label="글자 색" onClick={() => setPop(pop === 'color' ? null : 'color')}><Type size={15} /></Tool>
        {pop === 'color' && <Swatches list={COLORS} onPick={setColor} />}
      </span>
      <span className="relative inline-flex">
        <Tool label="형광펜" onClick={() => setPop(pop === 'mark' ? null : 'mark')}><Highlighter size={15} /></Tool>
        {pop === 'mark' && <Swatches list={[...MARKS, 'transparent']} onPick={setMark} />}
      </span>
      <Sep />
      <Tool label="왼쪽 정렬" active={cur.align === 'left'} onClick={() => align('left')}><AlignLeft size={15} /></Tool>
      <Tool label="가운데 정렬" active={cur.align === 'center'} onClick={() => align('center')}><AlignCenter size={15} /></Tool>
      <Tool label="오른쪽 정렬" active={cur.align === 'right'} onClick={() => align('right')}><AlignRight size={15} /></Tool>
      <Tool label="양쪽 정렬" active={cur.align === 'justify'} onClick={() => align('justify')}><AlignJustify size={15} /></Tool>
      <Pick label="줄 간격(%)" value={LINE_SPACINGS.includes(cur.lh) ? cur.lh : ''} onChange={(v) => v && setLineHeight(Number(v))} options={[{ value: '', label: `${cur.lh} %` }, ...LINE_SPACINGS.map((s) => ({ value: s, label: `${s} %` }))]} className="w-20" />
      <Sep />
      <Tool label="한 수준 감소(Shift+Tab)" onClick={() => shiftLevel(-1)}><IndentDecrease size={15} /></Tool>
      <Tool label="한 수준 증가(Tab)" onClick={() => shiftLevel(1)}><IndentIncrease size={15} /></Tool>
      <span className="relative inline-flex">
        <Tool label="표 만들기" onClick={() => setPop(pop === 'table' ? null : 'table')}><Table2 size={15} /></Tool>
        {pop === 'table' && (
          <div className="absolute left-0 top-8 z-dropdown rounded-md bg-page p-2 shadow-md" onMouseDown={(e) => e.preventDefault()}>
            <div className="grid grid-cols-8 gap-0.5">
              {Array.from({ length: 64 }).map((_, i) => {
                const r = Math.floor(i / 8) + 1, c = (i % 8) + 1
                return <button key={i} type="button" aria-label={`${r}줄 ${c}칸`} onMouseEnter={() => setTablePick({ r, c })} onClick={() => insertTable(r, c)}
                  className={clsx('h-4 w-4', r <= tablePick.r && c <= tablePick.c ? 'bg-primary' : 'bg-mute')} />
              })}
            </div>
            <p className="mt-1 text-center type-meta text-text-sec">{tablePick.r}줄 x {tablePick.c}칸</p>
          </div>
        )}
      </span>
      <span className="relative inline-flex">
        <Tool label="문자표" onClick={() => setPop(pop === 'symbol' ? null : 'symbol')}><Omega size={15} /></Tool>
        {pop === 'symbol' && (
          <div className="absolute left-0 top-8 z-dropdown grid w-64 grid-cols-8 gap-0.5 rounded-md bg-page p-2 shadow-md" onMouseDown={(e) => e.preventDefault()}>
            {SYMBOLS.map((s) => <button key={s} type="button" onClick={() => { focusBody(); exec('insertText', s); onInput() }} className="h-7 rounded-xs type-body-sm hover:bg-mute">{s}</button>)}
          </div>
        )}
      </span>
    </div>
  )

  const headerActions = (
    <>
      <Button variant="ghost" size="sm" collapse="xl" leftIcon={<Eye size={16} aria-hidden="true" />} onClick={openPreview} className={view === 'preview' ? 'bg-primary-soft text-primary-text' : ''}>한글 문서 보기</Button>
      <Button variant="ghost" size="sm" collapse="lg" leftIcon={<Printer size={16} aria-hidden="true" />} onClick={() => doExport('print')}>인쇄</Button>
      <Button variant="secondary" size="sm" collapse="lg" leftIcon={<FileDown size={16} aria-hidden="true" />} onClick={() => doExport('pdf')}>PDF 저장</Button>
      <Button size="sm" collapse="sm" leftIcon={<FileDown size={16} aria-hidden="true" />} onClick={() => doExport('hwpx')}>한글로 저장</Button>
    </>
  )
  const headerTabs = (
    <>
      {/* 메뉴 */}
      <nav aria-label="메뉴" className="no-scrollbar flex h-8 shrink-0 items-end gap-0.5 overflow-x-auto bg-page px-2">
        {MENUS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMenu(k)} aria-pressed={menu === k}
            className={clsx('relative h-7 shrink-0 whitespace-nowrap rounded-t-xs px-3 type-meta', menu === k ? 'bg-subtle font-bold text-primary-text' : 'text-text-sec hover:text-text-pri')}>
            {l}
            {menu === k && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </nav>
      {/* 기능 상자 */}
      <div className="no-scrollbar flex h-16 shrink-0 items-center gap-0.5 overflow-x-auto bg-subtle px-2">{ribbon[menu]}</div>
      {fmtBar}
      {locked && (
        <div className="flex flex-wrap items-center gap-2 bg-text-pri px-3 py-1.5 type-meta text-text-inverse">
          <Lock size={14} aria-hidden="true" />
          <span className="min-w-0 flex-1">읽기 전용 고정 문서. 작업할 때마다 코드에서 갱신(판 {meta.version}). 고쳐 쓰려면 사본을 만드세요.</span>
          <Button size="sm" variant="secondary" onClick={() => { const nid = duplicate(id); if (nid) navigate(`/docs/doc/${nid}`) }}>사본 만들기</Button>
        </div>
      )}
    </>
  )

  return (
    <EditorFrame fill kind="doc" Icon={FileText} badge="한글" suffix=".hwpx" title={doc.title} onTitle={(t) => update(id, { title: t })} updatedAt={doc.updatedAt} actions={headerActions} tabs={headerTabs}>
      <style>{css}</style>

      {/* 찾기, 바꾸기 */}
      {pop === 'find' && (
        <div className="absolute right-4 top-40 z-modal w-80 rounded-md bg-page p-3 shadow-md">
          <div className="flex items-center justify-between"><p className="type-strong">찾기, 바꾸기</p><button type="button" aria-label="닫기" onClick={() => setPop(null)} className="text-text-meta"><X size={16} /></button></div>
          <input autoComplete="off" spellCheck={false} autoFocus value={find.q} onChange={(e) => setFind({ ...find, q: e.target.value, n: 0 })} onKeyDown={(e) => { if (e.key === 'Enter') findNext() }} placeholder="찾을 글" className="mt-2 h-8 w-full rounded-sm bg-subtle px-2 type-body-sm" />
          <input autoComplete="off" spellCheck={false} value={find.r} onChange={(e) => setFind({ ...find, r: e.target.value })} placeholder="바꿀 글" className="mt-1.5 h-8 w-full rounded-sm bg-subtle px-2 type-body-sm" />
          <div className="mt-2 flex justify-end gap-1.5">
            <button type="button" onClick={findNext} className="h-8 rounded-md bg-subtle px-3 type-body-sm hover:bg-mute">다음 찾기</button>
            <button type="button" onClick={replaceAll} className="h-8 rounded-md bg-text-pri px-3 type-body-sm text-text-inverse">모두 바꾸기</button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 문서 보기 중에도 편집 본문은 남겨 둔다(내보내기가 본문을 읽음) */}
          <>
            <div className={clsx('min-h-0 flex-1 overflow-auto bg-mute', view !== 'edit' && 'hidden')} onMouseDown={(e) => { if (pop && pop !== 'find' && !e.target.closest('.z-dropdown')) setPop(null) }}>
              {ruler && <div className="sticky top-0 z-raised hidden bg-mute pl-5 pt-1 md:block"><HRuler page={page} zoom={z} /></div>}
              <div className="flex w-max min-w-full justify-center px-3 pb-10 pt-3 md:px-6">
                {ruler && <div className="mr-1 hidden pt-0 md:block"><VRuler page={page} zoom={z} pages={stats.pages} /></div>}
                <div style={{ zoom: z }}>
                  <div ref={pageRef} className="hwp-page relative shadow-md"
                    style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${page.height}mm - 1px), ${krds.gray[30]} calc(${page.height}mm - 1px), ${krds.gray[30]} ${page.height}mm)` }}>
                    <div className="hwp-frame" contentEditable={false} dangerouslySetInnerHTML={{ __html: headHtml({ ...meta, preset: presetKey }) }} />
                    <div ref={bodyRef} className="hwp-body" contentEditable={!locked} suppressContentEditableWarning spellCheck={false}
                      onInput={onInput} onKeyDown={onKeyDown} onPaste={onPaste}
                      onClick={(e) => { const chip = e.target.closest?.('.dv[data-var]'); if (chip && !chip.classList.contains('dv-block')) { setPanelOpen(true); setPanel('data'); setEditKey(chip.dataset.var) } }} onBlur={() => saveVersion(id, '편집')}
                      aria-label="문서 본문" role="textbox" aria-multiline="true" />
                    <div className="hwp-frame" contentEditable={false} dangerouslySetInnerHTML={{ __html: footHtml({ ...meta, preset: presetKey }) }} />
                  </div>
                </div>
              </div>
            </div>
            {view === 'preview' && <PreviewPane preview={preview} zoom={z} onBack={() => setView('edit')} onRetry={() => { setPreview(null); setTimeout(openPreview, 0) }} onSave={() => doExport('hwpx')} onPrint={() => doExport('print')} onPdf={() => doExport('pdf')} />}
          </>
          {/* 상태 표시줄 */}
          <footer className="flex h-7 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap bg-subtle px-3 type-meta text-text-sec">
            <span className="tabular-nums">{stats.page}/{stats.pages}쪽</span>
            <span className="hidden sm:inline">1단</span>
            <span className="hidden tabular-nums sm:inline">{stats.para}문단</span>
            <span className="tabular-nums">{stats.chars.toLocaleString('ko-KR')}글자</span>
            <span className="hidden sm:inline">{view === 'preview' ? '한글 문서 보기' : '삽입'}</span>
            <span className="hidden md:inline">{preset.label}</span>
            <span className="hidden xl:inline">{metrics.body.font} {metrics.body.pt}pt</span>
            <span className="ml-auto inline-flex items-center gap-1.5">
              <button type="button" aria-label="축소" onClick={() => setZoom((v) => Math.max(40, v - 10))} className="inline-flex h-5 w-5 items-center justify-center rounded-xs hover:bg-mute"><Minus size={12} /></button>
              <input type="range" min="40" max="200" step="10" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="확대 비율" className="hidden w-24 sm:block" />
              <button type="button" aria-label="확대" onClick={() => setZoom((v) => Math.min(200, v + 10))} className="inline-flex h-5 w-5 items-center justify-center rounded-xs hover:bg-mute"><Plus size={12} /></button>
              <span className="w-9 text-right tabular-nums">{zoom}%</span>
            </span>
          </footer>
        </div>

        {/* 작업 창 */}
        {panelOpen && (
          <aside className="hidden w-80 shrink-0 flex-col bg-page lg:flex" aria-label="작업 창">
            <div className="flex items-center justify-between bg-subtle px-3 py-1.5">
              <span className="type-strong text-text-pri">작업 창</span>
              <button type="button" aria-label="작업 창 닫기" onClick={() => setPanelOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-xs text-text-meta hover:bg-mute"><X size={15} /></button>
            </div>
            <div role="tablist" className="flex flex-wrap gap-1 bg-subtle p-2">
              {PANELS.map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={panel === k} onClick={() => openPanel(k)}
                  className={clsx('h-7 rounded-xs px-2 type-meta', panel === k ? 'bg-text-pri text-text-inverse' : 'text-text-sec hover:bg-mute')}>{l}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {panel === 'shape' && (
                <div className="space-y-5">
                  <section>
                    <h3 className="type-strong text-text-pri">글자 모양</h3>
                    <dl className="mt-2 grid grid-cols-[4.5rem_1fr] items-center gap-y-2 type-meta text-text-sec">
                      <dt>글꼴</dt><dd><Pick label="글꼴" value={FONTS.includes(cur.font) ? cur.font : ''} onChange={(v) => v && setFont(v)} options={[{ value: '', label: '선택' }, ...FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: fontCss(f) } }))]} className="w-full" /></dd>
                      <dt>크기</dt><dd><Pick label="크기" value={SIZES.includes(cur.size) ? cur.size : ''} onChange={(v) => v && setSize(Number(v))} options={[{ value: '', label: cur.size ? `${cur.size}pt` : '선택' }, ...SIZES.map((s) => ({ value: s, label: `${s}pt` }))]} className="w-full" /></dd>
                      <dt>장평</dt><dd className="flex gap-1">{[90, 95, 100, 105].map((v) => <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setRatio(v)} className="h-7 flex-1 rounded-xs bg-subtle hover:bg-mute">{v}%</button>)}</dd>
                      <dt>자간</dt><dd className="flex gap-1">{[-10, -5, 0, 5].map((v) => <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSpacing(v)} className="h-7 flex-1 rounded-xs bg-subtle hover:bg-mute">{v}%</button>)}</dd>
                      <dt>글자 색</dt><dd className="flex flex-wrap gap-1">{COLORS.map((c) => <button key={c} type="button" aria-label={`글자 색 ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setColor(c)} className="h-6 w-6 rounded-xs" style={{ background: c }} />)}</dd>
                      <dt>형광펜</dt><dd className="flex gap-1">{[...MARKS, 'transparent'].map((c) => <button key={c} type="button" aria-label={c === 'transparent' ? '형광펜 지우기' : `형광펜 ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setMark(c)} className="h-6 w-6 rounded-xs" style={{ background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#fff 0 3px,#cdd1d5 3px 4px)' : c }} />)}</dd>
                    </dl>
                  </section>
                  <section>
                    <h3 className="type-strong text-text-pri">문단 모양</h3>
                    <dl className="mt-2 grid grid-cols-[4.5rem_1fr] items-center gap-y-2 type-meta text-text-sec">
                      <dt>스타일</dt><dd><Pick label="스타일" value={cur.style} onChange={setStyle} options={STYLES.map((s) => ({ value: s.key, label: s.label }))} className="w-full" /></dd>
                      <dt>정렬</dt><dd className="flex gap-1">{[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight], ['justify', AlignJustify]].map(([k, Ic]) => <Tool key={k} label={k} active={cur.align === k} onClick={() => align(k)}><Ic size={15} /></Tool>)}</dd>
                      <dt>줄 간격</dt><dd><Pick label="줄 간격" value={LINE_SPACINGS.includes(cur.lh) ? cur.lh : ''} onChange={(v) => v && setLineHeight(Number(v))} options={[{ value: '', label: `${cur.lh}%` }, ...LINE_SPACINGS.map((s) => ({ value: s, label: `${s}%` }))]} className="w-full" /></dd>
                      <dt>개요 단계</dt><dd className="flex gap-1"><Tool label="한 수준 감소" onClick={() => shiftLevel(-1)}><IndentDecrease size={15} /></Tool><Tool label="한 수준 증가" onClick={() => shiftLevel(1)}><IndentIncrease size={15} /></Tool></dd>
                    </dl>
                  </section>
                  <section className="rounded-md bg-subtle p-3 type-meta leading-5 text-text-sec">
                    <p className="type-caption text-text-pri">이 양식의 항목 부호</p>
                    <p className="mt-1">{metrics.levels.map((l, i) => `${i + 1}단계 ${l?.marker || ''}`).join(', ')}</p>
                    <p className="mt-1 text-text-meta">값 출처: kordoc {METRICS_INFO.kordoc} 공문서 엔진 산출 HWPX 실측({METRICS_INFO.generatedAt}). Tab 을 누르면 한 단계 내려가요.</p>
                  </section>
                </div>
              )}
              {panel === 'data' && <DataPanel vals={vals} base={baseVals} overrides={meta.varOverrides || {}} setOverride={setOverride} onInsertVar={insertVar} onInsertCalc={insertCalc} editKey={editKey} setEditKey={setEditKey} locked={locked} />}
              {panel === 'info' && <DocInfo meta={{ ...meta, preset: presetKey }} setMeta={setMeta} />}
              {panel === 'lint' && (
                <div>
                  <h3 className="type-strong text-text-pri">공문 검사</h3>
                  <p className="mt-1 type-meta leading-5 text-text-meta">행정업무운영 편람 표기 규칙(날짜, 시간, 금액, 붙임, 끝 표시 등)과 개조식 문체를 kordoc 으로 검사해요.</p>
                  {lint?.state === 'loading' && <p className="mt-3 type-body-sm text-text-meta">검사하고 있어요.</p>}
                  {lint?.state === 'error' && <p className="mt-3 type-body-sm text-danger-text">{lint.message}</p>}
                  {lint?.state === 'ok' && (
                    <>
                      {!lint.gongmun.length && !lint.munche.length && <p className="mt-3 type-body-sm text-text-sec">걸린 항목이 없어요.</p>}
                      <ul className="mt-3 space-y-2">
                        {[...lint.gongmun, ...lint.munche].map((f, i) => (
                          <li key={i} className="rounded-md bg-subtle p-3">
                            <div className="flex items-start justify-between gap-2"><p className="type-body-sm text-text-pri">{f.message}</p><Badge tone={f.severity === 'error' ? 'danger' : 'warning'}>{f.severity === 'error' ? '고침' : '확인'}</Badge></div>
                            {f.match && <p className="mt-1 type-meta text-text-sec">"{f.match}"</p>}
                            {f.suggest && <p className="mt-1 type-meta text-text-meta">{f.suggest}</p>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {panel === 'law' && (
                <div>
                  <h3 className="type-strong text-text-pri">법령 인용 확인</h3>
                  <p className="mt-1 type-meta text-text-meta">본문의 「법령명」 제N조를 법제처 국가법령정보로 확인해요.</p>
                  <div className="mt-3">
                    {law?.state === 'loading' && <p className="type-body-sm text-text-meta">확인하고 있어요.</p>}
                    {law?.state === 'empty' && <p className="type-body-sm text-text-meta">본문에서 조문 인용을 찾지 못했어요.</p>}
                    {law?.state === 'limited' && <p className="type-body-sm text-danger-text">요청 한도에 닿았어요. 잠시 뒤 다시 시도하세요.</p>}
                    {law?.state === 'ok' && (
                      <ul className="space-y-2">
                        {law.results.map((r, i) => {
                          const [tone, label] = LAW_TONE[r.status] || LAW_TONE.unknown
                          return (
                            <li key={i} className="rounded-md bg-subtle p-3">
                              <div className="flex items-start justify-between gap-2"><p className="min-w-0 type-body-sm text-text-pri">{r.citation}</p><Badge tone={tone}>{label}</Badge></div>
                              {r.title && <p className="mt-1 type-meta text-text-sec">{r.title}</p>}
                              {r.detail && <p className="mt-1 type-meta text-text-meta">{r.detail}</p>}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <p className="mt-4 type-meta text-text-meta">출처: 법제처 국가법령정보(korean-law-mcp, 광진구 류승인 공개)</p>
                </div>
              )}
              {panel === 'history' && (
                <div>
                  <h3 className="type-strong text-text-pri">버전 기록</h3>
                  <ul className="mt-3 space-y-1">
                    {[...(doc.versions || [])].reverse().map((v, i) => (
                      <li key={v.at + i}>
                        <button type="button" onClick={() => restore(v)} className="block w-full rounded-md px-2 py-2 text-left hover:bg-mute">
                          <span className="block type-body-sm text-text-pri">{new Date(v.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                          <span className="block type-meta text-text-meta">{i === 0 ? '현재 버전' : v.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </EditorFrame>
  )
}

function Swatches({ list, onPick }) {
  return (
    <div className="absolute left-0 top-8 z-dropdown flex w-max gap-1 rounded-md bg-page p-2 shadow-md" onMouseDown={(e) => e.preventDefault()}>
      {list.map((c) => <button key={c} type="button" aria-label={c} onClick={() => onPick(c)} className="h-6 w-6 rounded-xs" style={{ background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#fff 0 3px,#cdd1d5 3px 4px)' : c }} />)}
    </div>
  )
}

// 한글 문서 보기: 서버가 만든 HWPX 를 kordoc 조판 엔진으로 그린 SVG(파일과 같은 쪽 나눔, 줄 바꿈)
function PreviewPane({ preview, zoom, onBack, onRetry, onSave, onPrint, onPdf }) {
  const ref = useRef(null)
  useEffect(() => {
    const host = ref.current
    if (!host || preview?.state !== 'ok') return
    host.innerHTML = preview.svg
    const svg = host.querySelector('svg')
    if (!svg) return
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number)
    const w = 794 * zoom
    svg.setAttribute('width', String(w))
    if (vb.length === 4) svg.setAttribute('height', String((w * vb[3]) / vb[2]))
    svg.style.display = 'block'
    svg.style.margin = '0 auto'
  }, [preview, zoom])
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-line-def">
      <div className="sticky left-0 top-0 z-raised flex items-center gap-2 bg-page px-3 py-1.5 type-meta text-text-sec">
        <Eye size={14} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate" title="내보낼 HWPX 파일을 서버에서 실제로 만들어 kordoc 조판 엔진으로 그린 모양입니다">
          <span className="font-bold text-text-pri">한글 문서 보기</span>
          <span className="hidden md:inline">{preview?.state === 'ok' ? `, ${preview.pageCount}쪽, 구조 검사 통과. 표가 쪽을 넘는 자리는 조판 엔진에서 겹쳐 보일 수 있으나 한글은 파일을 열 때 다시 조판` : ''}</span>
        </span>
        <span className="flex shrink-0 gap-1.5">
          <Button variant="ghost" size="sm" collapse="lg" leftIcon={<RefreshCw size={16} aria-hidden="true" />} onClick={onRetry}>다시 그리기</Button>
          <Button variant="ghost" size="sm" collapse="lg" leftIcon={<Printer size={16} aria-hidden="true" />} onClick={onPrint}>인쇄</Button>
          <Button variant="secondary" size="sm" collapse="lg" leftIcon={<FileDown size={16} aria-hidden="true" />} onClick={onPdf}>PDF 저장</Button>
          <Button size="sm" collapse="lg" leftIcon={<FileDown size={16} aria-hidden="true" />} onClick={onSave}>한글로 저장</Button>
          <Button variant="secondary" size="sm" collapse="lg" leftIcon={<FileText size={16} aria-hidden="true" />} onClick={onBack}>편집으로</Button>
        </span>
      </div>
      {preview?.state === 'loading' && <p className="p-10 text-center type-body-sm text-text-meta">한글 문서를 만들고 쪽을 그리고 있어요.</p>}
      {preview?.state === 'error' && <p className="p-10 text-center type-body-sm text-danger-text">{preview.message}</p>}
      <style>{'.hwp-preview svg text{white-space:pre}'}</style>
      <div ref={ref} className="hwp-preview w-max min-w-full px-3 py-6 [&_svg]:shadow-md" />
    </div>
  )
}

// 문서 정보: 양식, 기안문 두문과 결문, 결재란, 공고와 보도자료 머리
function DocInfo({ meta, setMeta }) {
  const field = (group, key, label) => (
    <label key={`${group}.${key}`} className="block">
      <span className="type-meta text-text-sec">{label}</span>
      <input autoComplete="off" spellCheck={false} value={meta[group]?.[key] || ''} onChange={(e) => setMeta({ [group]: { ...(meta[group] || {}), [key]: e.target.value } })}
        className="mt-0.5 h-8 w-full rounded-sm bg-subtle px-2 type-body-sm" />
    </label>
  )
  const m = metricsOf(meta.preset)
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="type-strong text-text-pri">문서 양식</h3>
        <Pick label="양식" value={meta.preset} onChange={(v) => setMeta({ preset: v, head: v === '기안문' && !meta.head ? { org: '동해시', to: '', via: '', title: '' } : meta.head, foot: v === '기안문' && !meta.foot ? { sender: '동해시장' } : meta.foot })} options={PRESETS.map((p) => ({ value: p.key, label: p.label }))} className="w-full" />
        <p className="type-meta leading-5 text-text-meta">A4, 여백 위 {m.page.top} 아래 {m.page.bottom} 왼쪽 {m.page.left} 오른쪽 {m.page.right}mm. 본문 {m.body.font} {m.body.pt}pt, 줄 간격 {m.body.lineSpacing}%. 한글로 저장하면 kordoc 공문서 엔진이 이 값으로 파일을 만들어요.</p>
      </section>
      {meta.preset === '기안문' && (
        <>
          <section className="space-y-2">
            <h3 className="type-strong text-text-pri">두문</h3>
            {field('head', 'org', '행정기관명')}{field('head', 'to', '수신')}{field('head', 'via', '(경유)')}{field('head', 'title', '제목')}
          </section>
          <section className="space-y-2">
            <h3 className="type-strong text-text-pri">결문</h3>
            {field('foot', 'sender', '발신명의')}{field('foot', 'drafter', '기안자(직위 이름)')}{field('foot', 'reviewer', '검토자')}{field('foot', 'approver', '결재권자')}
            {field('foot', 'recipients', '수신자(수신자 참조일 때)')}{field('foot', 'docNum', '시행 번호와 날짜')}{field('foot', 'zip', '우편번호')}{field('foot', 'address', '주소')}
            {field('foot', 'site', '홈페이지')}{field('foot', 'phone', '전화')}{field('foot', 'fax', '전송')}{field('foot', 'email', '공무원 이메일')}{field('foot', 'disclosure', '공개 구분')}
          </section>
        </>
      )}
      <section className="space-y-2">
        <h3 className="type-strong text-text-pri">결재란</h3>
        <input autoComplete="off" spellCheck={false} value={(meta.approval || []).join(', ')} onChange={(e) => setMeta({ approval: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="예) 담당, 팀장, 과장"
          className="h-8 w-full rounded-sm bg-subtle px-2 type-body-sm" />
      </section>
      {meta.noticeHead && <section className="space-y-2"><h3 className="type-strong text-text-pri">공고</h3>{field('noticeHead', 'no', '공고 번호')}{field('noticeHead', 'date', '공고일')}{field('noticeHead', 'sender', '발신명의')}</section>}
      {meta.press && (
        <section className="space-y-2">
          <h3 className="type-strong text-text-pri">보도자료</h3>
          {field('press', 'release', '보도시점')}
          <label className="block"><span className="type-meta text-text-sec">담당 부서, 담당자, 전화</span>
            <input autoComplete="off" spellCheck={false} value={[meta.press.contact?.dept, meta.press.contact?.manager, meta.press.contact?.phone].filter(Boolean).join(', ')} onChange={(e) => { const [dept, manager, phone] = e.target.value.split(',').map((s) => s.trim()); setMeta({ press: { ...meta.press, contact: { dept, manager, phone } } }) }}
              className="mt-0.5 h-8 w-full rounded-sm bg-subtle px-2 type-body-sm" />
          </label>
        </section>
      )}
    </div>
  )
}
