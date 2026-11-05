// PATTERNS.md 16번. 일러스트는 primary 단색 SVG 만(DESIGN.md 아이콘과 일러스트 절).
// 플레이북 3.5. 비어 있음과 오류를 같은 표면에서 그린다. 오류는 서버 응답이 없었다는 뜻이라
// 빈 결과로 위장하지 않고 role=alert 로 알리며 재시도 수단을 함께 둔다.
import clsx from 'clsx'
import { RotateCw } from 'lucide-react'
import { useLang } from '../../i18n/LangContext.jsx'
import Button from './Button.jsx'

export default function EmptyState({ tone = 'empty', title, desc, action, onRetry, image, className, compact = false }) {
  const { t } = useLang()
  const isError = tone === 'error'
  const src = image || (import.meta.env.BASE_URL + 'images/illustrations/empty.svg')
  return (
    <div
      className={clsx(compact ? 'py-8' : 'py-16', 'flex flex-col items-center text-center', className)}
      role={isError ? 'alert' : undefined}
    >
      {!compact && <img src={src} alt="" className="w-24 h-24" />}
      <p className={clsx(compact ? 'type-body-strong' : 'mt-4 type-h3', 'text-text-pri')}>{title || (isError ? t('common.error.loadTitle') : '')}</p>
      {(desc || isError) && (
        <p className="mt-1 max-w-text type-body-sm text-text-meta">{desc || t('common.error.loadDesc')}</p>
      )}
      {(action || onRetry) && (
        <div className="mt-5">
          {action || (
            <Button variant="secondary" onClick={onRetry} leftIcon={<RotateCw size={16} aria-hidden="true" />}>
              {t('common.action.retry')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
