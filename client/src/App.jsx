// 경로. 담당자 화면은 모두 같은 셸(AdminLayout) 안에서 열고, 주민 공개 화면만 공개 레이아웃을 쓴다.
// 시연이라 로그인 없이 바로 들어온다. 지도와 문서함은 무거워서 열 때 받는다.
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout.jsx'
import PublicLayout from './components/layout/PublicLayout.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary.jsx'
import Toast from './components/ui/Toast.jsx'
import GlobalTooltip from './components/ui/GlobalTooltip.jsx'
import { LangProvider } from './i18n/LangContext.jsx'

const OverviewScreen = lazy(() => import('./pages/console/OverviewScreen.jsx'))
const BoardScreen = lazy(() => import('./pages/console/BoardScreen.jsx'))
const FacilitiesScreen = lazy(() => import('./pages/console/FacilitiesScreen.jsx'))
const ReviewScreen = lazy(() => import('./pages/console/ReviewScreen.jsx'))
const PublicScreen = lazy(() => import('./pages/public/PublicScreen.jsx'))
const InsideScreen = lazy(() => import('./pages/facility/InsideScreen.jsx'))
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage.jsx'))
const WorkspaceHome = lazy(() => import('./pages/workspace/WorkspaceHome.jsx'))
const DocEditor = lazy(() => import('./pages/workspace/DocEditor.jsx'))
const SheetEditor = lazy(() => import('./pages/workspace/SheetEditor.jsx'))
const FormEditor = lazy(() => import('./pages/workspace/FormEditor.jsx'))
const FormFillPage = lazy(() => import('./pages/workspace/FormFillPage.jsx'))

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toast />
        <GlobalTooltip />
        <ErrorBoundary>
          <Suspense fallback={<div className="min-h-dvh bg-canvas" aria-busy="true" />}>
            <Routes>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<OverviewScreen />} />
                <Route path="/board" element={<BoardScreen />} />
                <Route path="/facilities" element={<FacilitiesScreen />} />
                <Route path="/facilities/:id" element={<FacilitiesScreen />} />
                <Route path="/review" element={<ReviewScreen />} />
                <Route path="/facility/:id/inside" element={<InsideScreen />} />
                <Route path="/docs" element={<WorkspaceHome />} />
                <Route path="/docs/doc/:id" element={<DocEditor />} />
                <Route path="/docs/sheet/:id" element={<SheetEditor />} />
                <Route path="/docs/form/:id" element={<FormEditor />} />
              </Route>
              <Route element={<PublicLayout />}>
                <Route path="/public" element={<PublicScreen />} />
              </Route>
              <Route path="/f/:id" element={<FormFillPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </LangProvider>
  )
}
