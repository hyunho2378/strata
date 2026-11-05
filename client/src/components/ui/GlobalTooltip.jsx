// 전역 툴팁. 브라우저 기본 말풍선(title 속성, SVG <title>)이 뜨지 않게 가로채 디자인 시스템 말풍선으로 보여 준다.
// 마우스가 올라가는 순간 title 을 data-tip 으로 옮기고(접근 이름이 없으면 aria-label 로 남김), 400ms 뒤 위쪽(공간 없으면 아래)에 띄운다.
// 키보드 포커스에도 뜬다. 누르기, 스크롤, 키 입력, 벗어나기에 닫힌다. 앱 어디서 title 을 써도 같은 모양이 된다.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function adopt(el) {
  if (!el || el.nodeType !== 1) return null
  // SVG 안의 <title> 자식
  const svgTitle = el.namespaceURI === 'http://www.w3.org/2000/svg' ? [...el.children].find((c) => c.tagName.toLowerCase() === 'title') : null
  if (svgTitle) {
    const t = svgTitle.textContent.trim()
    if (t) { el.dataset.tip = t; if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t) }
    svgTitle.remove()
  }
  const t = el.getAttribute('title')
  if (t != null) {
    el.removeAttribute('title')
    if (t.trim()) {
      el.dataset.tip = t.trim()
      const text = (el.innerText || el.textContent || '').trim()
      if (!el.getAttribute('aria-label') && !text) el.setAttribute('aria-label', t.trim())
    }
  }
  return el.dataset?.tip ? el : null
}

function findTip(node) {
  for (let el = node; el && el !== document.body; el = el.parentElement || el.parentNode) {
    if (el.nodeType !== 1) continue
    const got = adopt(el)
    if (got) return got
  }
  return null
}

export default function GlobalTooltip() {
  const [tip, setTip] = useState(null)
  const timer = useRef(null)
  const target = useRef(null)

  useEffect(() => {
    const hide = () => { clearTimeout(timer.current); target.current = null; setTip(null) }
    const show = (el, delay) => {
      clearTimeout(timer.current)
      target.current = el
      timer.current = setTimeout(() => {
        if (target.current !== el || !el.isConnected) return
        const r = el.getBoundingClientRect()
        const above = r.top > 44
        setTip({ text: el.dataset.tip, x: r.left + r.width / 2, y: above ? r.top - 6 : r.bottom + 6, above })
      }, delay)
    }
    const over = (e) => {
      const el = findTip(e.target)
      if (!el) { if (target.current) hide(); return }
      if (el !== target.current) show(el, 400)
    }
    const focus = (e) => { const el = findTip(e.target); if (el && e.target.matches?.(':focus-visible')) show(el, 150) }
    document.addEventListener('pointerover', over, true)
    document.addEventListener('focusin', focus, true)
    document.addEventListener('focusout', hide, true)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', hide, true)
    window.addEventListener('scroll', hide, true)
    // 처음 그려진 화면의 title 도 먼저 옮겨 둔다(첫 마우스 올림 전에 기본 말풍선이 뜨지 않게)
    const sweep = () => document.querySelectorAll('[title]').forEach(adopt)
    const mo = new MutationObserver(() => { cancelAnimationFrame(mo.raf); mo.raf = requestAnimationFrame(sweep) })
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] })
    sweep()
    return () => {
      document.removeEventListener('pointerover', over, true)
      document.removeEventListener('focusin', focus, true)
      document.removeEventListener('focusout', hide, true)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', hide, true)
      window.removeEventListener('scroll', hide, true)
      mo.disconnect()
      clearTimeout(timer.current)
    }
  }, [])

  if (!tip) return null
  const half = 140
  const x = Math.min(Math.max(tip.x, half / 2 + 8), window.innerWidth - half / 2 - 8)
  return createPortal(
    <div role="tooltip" className="pointer-events-none fixed z-toast max-w-tip rounded-md bg-text-pri px-2.5 py-1.5 type-meta text-text-inverse shadow-md"
      style={{ left: x, top: tip.y, transform: `translate(-50%, ${tip.above ? '-100%' : '0'})`, whiteSpace: 'pre-line' }}>
      {tip.text}
    </div>,
    document.body
  )
}
