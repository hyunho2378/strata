// 담당자 상단 띠. 회색 바탕 위 한 줄이다.
// 왼쪽은 메뉴 칸 폭만큼 뒤로, 앞으로, 메뉴 칸 접기. 그 오른쪽은 현재 위치. 맨 오른쪽은 자료 기준 칩.
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, ChevronRight, Menu, PanelLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAdminUi from '../../store/useAdminUi.js'
import Badge from '../ui/Badge.jsx'
import { sectionOf } from './navConfig.js'

const ICON_BTN = 'pressable inline-flex h-8 w-8 items-center justify-center rounded-md text-text-meta transition-colors duration-fast hover:bg-page hover:text-text-pri'

export default function Topbar({ isDesktop, panelOpen, onTogglePanel, basisDate }) {
  const topbar = useAdminUi((s) => s.topbar)
  const setSidebarOpen = useAdminUi((s) => s.setSidebarOpen)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = sectionOf(pathname)
  const Icon = section?.Icon
  const sub = section && topbar.title && topbar.title !== section.label ? topbar.title : null
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 pr-3 md:pr-4">
      {isDesktop ? (
        <div className={clsx('flex shrink-0 items-center gap-0.5 pl-3', panelOpen ? 'w-56' : 'w-auto')}>
          <button type="button" aria-label="뒤로" className={ICON_BTN} onClick={() => navigate(-1)}><ArrowLeft size={16} aria-hidden="true" /></button>
          <button type="button" aria-label="앞으로" className={ICON_BTN} onClick={() => navigate(1)}><ArrowRight size={16} aria-hidden="true" /></button>
          <button type="button" aria-label={panelOpen ? '메뉴 칸 접기' : '메뉴 칸 펴기'} aria-pressed={panelOpen} className={ICON_BTN} onClick={onTogglePanel}><PanelLeft size={16} aria-hidden="true" /></button>
        </div>
      ) : (
        <button type="button" aria-label="메뉴 열기" className={clsx(ICON_BTN, 'ml-2 h-11 w-11')} onClick={() => setSidebarOpen(true)}>
          <Menu size={20} aria-hidden="true" />
        </button>
      )}
      <p className="flex min-w-0 flex-1 items-center gap-1.5 type-meta text-text-sec">
        {Icon && <Icon size={14} aria-hidden="true" className="shrink-0 text-text-meta" />}
        <span className="truncate">{section?.label || topbar.title}</span>
        {sub && <><ChevronRight size={12} aria-hidden="true" className="shrink-0 text-text-meta" /><span className="truncate text-text-pri">{sub}</span></>}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {basisDate && <span className="hidden sm:inline-flex"><Badge tone="neutral">{'자료 ' + basisDate + ' 기준'}</Badge></span>}
        <span className="hidden lg:inline-flex"><Badge tone="primary">공개 자료</Badge></span>
      </div>
    </header>
  )
}
