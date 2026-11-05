// 담당자 레이아웃. 회색 바탕 위에 1열 아이콘 레일, 맨 위 한 줄 상단 띠, 그 아래 둥근 흰 판이다.
// 흰 판 안에 2열 메뉴 칸과 본문이 들어간다. 1024 이상은 메뉴 칸을 펴 두고 768 미만은 서랍으로 연다.
// 본문만 흰 판 안에서 스크롤한다. 레일과 상단 띠와 메뉴 칸은 움직이지 않는다.
import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import useMediaQuery from '../../hooks/useMediaQuery.js'
import useAdminUi from '../../store/useAdminUi.js'
import ErrorBoundary from './ErrorBoundary.jsx'
import Drawer from '../ui/Drawer.jsx'
import { NavPanel, Rail } from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import { groupOf } from './navConfig.js'
import { dotDate, useStrata } from '../../lib/strataData.js'

export default function AdminLayout() {
  const sidebarOpen = useAdminUi((s) => s.sidebarOpen)
  const setSidebarOpen = useAdminUi((s) => s.setSidebarOpen)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isWide = useMediaQuery('(min-width: 1024px)')
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data } = useStrata()
  const [group, setGroup] = useState(() => groupOf(pathname))
  const [panelOpen, setPanelOpen] = useState(isWide)
  const mainRef = useRef(null)

  useEffect(() => { if (isDesktop) setSidebarOpen(false) }, [isDesktop, setSidebarOpen])
  // 상황판은 지도가 주인공이라 메뉴 칸을 접어 둔다. 레일 아이콘과 위쪽 바 단추로 다시 편다
  useEffect(() => { setPanelOpen(isWide && !pathname.startsWith('/board')) }, [isWide, pathname])
  useEffect(() => { setGroup(groupOf(pathname)) }, [pathname])
  useEffect(() => { mainRef.current?.scrollTo(0, 0) }, [pathname])

  const onGroup = (key, first) => {
    setGroup(key)
    setPanelOpen(key !== 'docs')
    if (first && groupOf(pathname) !== key) navigate(first.to)
  }

  const basis = (data.sources || [])[0]?.date || (data.generatedAt ? dotDate(data.generatedAt) : '')

  return (
    <div className="flex h-dvh overflow-hidden bg-mute">
      {isDesktop && <aside className="shrink-0"><Rail group={group} onGroup={onGroup} /></aside>}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar isDesktop={isDesktop} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} basisDate={basis} />
        <div className="flex min-h-0 flex-1 overflow-hidden bg-page shadow-sm md:mr-2 md:rounded-t-lg">
          {isDesktop && panelOpen && group !== 'docs' && (
            <aside className="w-40 shrink-0 overflow-y-auto bg-subtle">
              <NavPanel group={group} />
            </aside>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <main ref={mainRef} className="admin-surface relative min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
                <ErrorBoundary key={pathname}>
                  <Outlet />
                </ErrorBoundary>
              </Suspense>
            </main>
          </div>
        </div>
      </div>
      <Drawer open={sidebarOpen} side="left" onClose={() => setSidebarOpen(false)} title="담당자 메뉴">
        <NavPanel showAll onNavigate={() => setSidebarOpen(false)} />
      </Drawer>
    </div>
  )
}
