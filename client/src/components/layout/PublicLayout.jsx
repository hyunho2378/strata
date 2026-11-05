// 주민 공개 면 레이아웃. 담당자 화면과 같은 토큰과 같은 여백을 쓰고 위쪽 메뉴만 다르다.
// 테두리를 쓰지 않고 면 색으로 머리글과 바닥글을 가른다.
import { Link, NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { Layers3 } from 'lucide-react'

const NAV = [['/public', '시설 찾기']]

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-nav h-nav-m bg-page md:h-nav">
        <div className="mx-auto flex h-full w-full max-w-page items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
          <Link to="/public" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-text-inverse"><Layers3 size={18} aria-hidden="true" /></span>
            <span className="type-body-strong text-text-pri">동해시 공공시설 안내</span>
          </Link>
          <nav aria-label="공개 메뉴" className="flex items-center gap-1">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end className={({ isActive }) => clsx('inline-flex min-h-11 items-center rounded-sm px-3 type-body-sm', isActive ? 'text-text-pri' : 'text-text-sec hover:text-text-pri')}>{label}</NavLink>
            ))}
            <Link to="/" className="pressable ml-1 inline-flex min-h-11 items-center rounded-sm bg-primary px-3 type-strong text-text-inverse hover:bg-primary-hover">담당자 화면</Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col"><Outlet /></main>
      <footer className="bg-mute">
        <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-3 px-4 py-6 type-meta text-text-meta md:px-6 lg:px-8">
          <p>동해시 공공시설 기능연속성 안내. 공개 자료를 모아 보여 주는 시연 화면이에요.</p>
        </div>
      </footer>
    </div>
  )
}
