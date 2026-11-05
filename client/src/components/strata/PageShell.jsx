// 담당자 페이지 공통 골격. 본문은 container query 기준 상자(.cq)라 카드 격자는 cq-md:, cq-xl: 로 본문 폭에 맞춘다.
// 화면 머리는 작은 날짜 줄, 굵은 제목, 오른쪽 행동으로 짠다. 모든 화면이 이 골격을 쓴다.
import clsx from 'clsx'
import { useTopbar } from '../../store/useAdminUi.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
export const todayLabel = (d = new Date()) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`

export default function PageShell({ title, eyebrow, desc, actions = null, hideHeader = false, children, className, full = false }) {
  useTopbar({ title, actions: null })
  return (
    <div className={clsx(full ? 'cq flex h-full w-full flex-col p-2' : 'cq mx-auto w-full max-w-wide px-4 md:px-6 lg:px-8 pt-4 pb-8 lg:pt-6 lg:pb-10', className)}>
      {!hideHeader && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 lg:mb-6">
          <div className="min-w-0">
            {eyebrow && <p className="type-body-sm text-text-meta">{eyebrow}</p>}
            <h1 className="type-h2 text-text-pri">{title}</h1>
            {desc && <p className="mt-1 type-body-sm text-text-sec">{desc}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
