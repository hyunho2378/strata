// 담당자 메뉴 구조. 업무 순서대로 놓는다: 오늘 현황 확인 → 지도 → 시설 → 판독 대기 → 문서.
import { BookOpenText, Building2, FileScan, FolderOpen, LayoutDashboard, LayoutGrid, MapPinned } from 'lucide-react'

export const MAIN_NAV = [
  { key: 'home', to: '/', end: true, label: '현황판', Icon: LayoutDashboard, match: ['/'], exact: true },
  { key: 'board', to: '/board', label: '상황판', Icon: MapPinned, match: ['/board'] },
  { key: 'facilities', to: '/facilities', label: '시설', Icon: Building2, match: ['/facilities'] },
  { key: 'review', to: '/review', label: '판독함', Icon: FileScan, match: ['/review'], queue: true }
]

// 문서함은 업무 메뉴와 떼어 레일 아래에 둔다. 열면 메뉴 칸 없이 본문 전체를 쓴다
export const DOCS_NAV = [
  { key: 'docs', to: '/docs', label: '문서함', Icon: FolderOpen, match: ['/docs'] }
]

// 주민이 보는 면. 담당자 화면 밖에서 열린다
export const PUBLIC_NAV = [
  { key: 'public', to: '/public', label: '주민 공개 화면', Icon: BookOpenText, match: ['/public'] }
]

export const RAIL_GROUPS = [
  { key: 'work', label: '담당 업무', Icon: LayoutGrid, items: MAIN_NAV },
  { key: 'public', label: '공개 화면', Icon: BookOpenText, items: PUBLIC_NAV },
  { key: 'docs', label: '문서함', Icon: FolderOpen, items: DOCS_NAV, direct: true }
]

export function groupOf(pathname) {
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'docs'
  if (pathname === '/public') return 'public'
  return 'work'
}

export function sectionOf(pathname) {
  return [...MAIN_NAV, ...DOCS_NAV, ...PUBLIC_NAV].find((m) => (m.exact ? pathname === m.to : m.match.some((p) => pathname === p || pathname.startsWith(p + '/'))))
}
