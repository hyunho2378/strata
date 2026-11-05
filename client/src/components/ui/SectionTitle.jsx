// 페이지 안 섹션 제목. 카드 밖 구획에만 쓴다. 카드 제목은 Card title.
// size md(type-h2 700, 담당자 면) lg(type-h1 700, 소개 면처럼 카드 제목과 크기 차이가 커야 할 때)
import clsx from 'clsx'

export default function SectionTitle({ id, title, desc, eyebrow, actions, level = 2, size = 'md', descSize = 'meta', className }) {
  const H = `h${level}`
  return (
    <div className={clsx(size === 'lg' ? 'mb-5' : 'mb-3', 'flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 type-caption text-primary-text">{eyebrow}</p>}
        <H id={id} className={clsx(size === 'lg' ? 'type-h1' : 'type-h2', 'text-text-pri')}>{title}</H>
        {desc && <p className={clsx('mt-1 max-w-text', descSize === 'body' ? 'type-body text-text-sec' : 'type-meta text-text-meta')}>{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
