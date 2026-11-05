// 화면 한 곳의 렌더 오류가 앱 전체를 흰 화면으로 만들지 않게 막는다.
import { Component } from 'react'
import Button from '../ui/Button.jsx'

export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error('화면 오류', error); if (import.meta.env.DEV) window.__lastErr = String(error?.stack || error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto flex max-w-text flex-col items-center px-4 py-20 text-center">
        <h1 className="type-h2 text-text-pri">화면을 표시하지 못함</h1>
        <p className="mt-2 type-body-sm text-text-sec">새로고침 후에도 같으면 담당자 화면 처음으로 이동</p>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => window.location.reload()}>새로고침</Button>
          <Button variant="secondary" onClick={() => { window.location.href = '/' }}>처음으로</Button>
        </div>
      </div>
    )
  }
}
