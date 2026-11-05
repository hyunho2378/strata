// 필터 줄. 표 카드 머리 아래에 둔다. Select 는 compact(라벨이 버튼 안에 들어감)로 통일.
import clsx from 'clsx'

export default function FilterBar({ children, className }) {
  return <div role="group" aria-label="필터" className={clsx('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
