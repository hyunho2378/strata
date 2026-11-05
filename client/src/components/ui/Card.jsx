// Card. 모든 흰 표면의 단일 출처(UI_PLAYBOOK 3.1). 페이지에서 표면 클래스를 직접 쓰지 않는다.
// 액센트 보더 금지. 강조는 tone 으로 배경 톤만 바꾼다. 카드 안에 카드를 넣지 않는다.
// title  카드 제목(type-h3). desc 는 제목에 없는 정보가 있을 때만(설명 문장 금지).
// meta   제목 옆 짧은 값(건수, 기준). actions 오른쪽 버튼. toolbar 머리 아래 필터 줄.
// padding md(기본) sm lg none(표나 목록이 가장자리까지 닿을 때). media 제목 위 아이콘.
import clsx from 'clsx'

const PAD = { md: 'p-4 lg:p-5', sm: 'p-3 lg:p-4', lg: 'p-5 lg:p-6', none: '' }
const HEAD = { md: 'px-4 pt-4 lg:px-5 lg:pt-5', sm: 'px-3 pt-3 lg:px-4 lg:pt-4', lg: 'px-5 pt-5 lg:px-6 lg:pt-6', none: 'px-4 pt-4 lg:px-5' }
const TONE = { default: 'bg-page shadow-sm', primary: 'bg-primary-soft', danger: 'bg-danger-soft', mute: 'bg-subtle' }

export default function Card({
  title, desc, meta, actions, toolbar, eyebrow, media, children, className, bodyClassName,
  padding = 'md', tone = 'default', as: As = 'section', headingLevel = 2, ...rest
}) {
  const H = `h${headingLevel}`
  const hasHead = title || actions || eyebrow || media
  const hasBody = children != null && children !== false
  return (
    <As className={clsx('min-w-0 rounded-md', padding === 'none' && 'overflow-hidden', TONE[tone], className)} {...rest}>
      {hasHead && (
        <header className={clsx('flex flex-wrap items-center justify-between gap-x-3 gap-y-2', HEAD[padding], (padding === 'none' || !hasBody) && 'pb-3 lg:pb-4', !hasBody && padding !== 'none' && 'pb-4 lg:pb-5')}>
          <div className="min-w-0">
            {media && <div className="mb-3">{media}</div>}
            {eyebrow && <p className="mb-1 type-caption text-text-meta">{eyebrow}</p>}
            <div className="flex flex-wrap items-baseline gap-x-2">
              {title && <H className="type-strong text-text-pri">{title}</H>}
              {meta != null && meta !== false && <span className="type-body-sm text-text-meta tabular-nums">{meta}</span>}
            </div>
            {desc && <p className="mt-1 type-meta text-text-meta">{desc}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {toolbar && <div className={clsx('flex flex-wrap items-center gap-2', padding === 'none' ? 'px-4 pb-3 lg:px-5' : clsx(HEAD[padding].replace(/pt-\S+/g, ''), 'pt-3'))}>{toolbar}</div>}
      {hasBody && <div className={clsx(PAD[padding], (hasHead || toolbar) && padding !== 'none' && 'pt-3 lg:pt-4', bodyClassName)}>{children}</div>}
    </As>
  )
}
