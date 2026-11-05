// useAdminUi.js 관리자 면 공통 UI 상태. 기간 탭은 전역이라 화면을 옮겨도 유지된다.
import { useLayoutEffect } from 'react'
import { create } from 'zustand'

export const useAdminUi = create((set) => ({
  range: '7d',                       // '7d' | '30d' | 'quarter'
  setRange: (range) => set({ range }),
  sidebarOpen: false,                // 768 미만 드로어
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  topbar: { title: '', actions: null },
  setTopbar: (topbar) => set({ topbar }),
  desktopBannerDismissed: false,     // 데스크톱 권장 배너. 세션 내 한 번만
  dismissDesktopBanner: () => set({ desktopBannerDismissed: true }),
  // 사이드바 그룹 접힘. 메뉴가 16개라 240 레일에서 세로로 넘친다
  collapsed: {},                     // { [groupKey]: true }
  toggleGroup: (key) => set((s) => ({ collapsed: { ...s.collapsed, [key]: !s.collapsed[key] } }))
}))

// 페이지가 Topbar 슬롯을 등록한다. actions 는 매 렌더 새 JSX 라 의존성에서 뺀다(무한 루프 방지).
export function useTopbar({ title, actions = null }) {
  const setTopbar = useAdminUi((s) => s.setTopbar)
  useLayoutEffect(() => { setTopbar({ title, actions }) }, [title, setTopbar])   // eslint-disable-line react-hooks/exhaustive-deps
}

export default useAdminUi
