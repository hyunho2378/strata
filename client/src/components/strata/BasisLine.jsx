// 숫자 바로 아래에 붙이는 기준 표기. 자료 기준일과 출처 가운데 해당하는 것만 넘긴다.
import clsx from 'clsx'

export default function BasisLine({ basis, source, className }) {
  const parts = []
  if (basis) parts.push(basis)
  if (source) parts.push('출처 ' + source)
  if (!parts.length) return null
  return <p className={clsx('type-meta text-text-meta', className)}>{parts.join(', ')}</p>
}
