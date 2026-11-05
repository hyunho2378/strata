// 대표 이미지 자리. 3D 엔진이 만든 그림(src)이 오면 그 그림을 쓰고,
// 만드는 동안에는 자리를 잡아 두고, 만들지 못하면 분류 아이콘 면으로 둔다.
import clsx from 'clsx'
import { Building2, Dumbbell, GraduationCap, Landmark, Pill, Stethoscope, Tent, Users, Waves } from 'lucide-react'
import Skeleton from '../ui/Skeleton.jsx'

const BY_TYPE = [
  [/경로당|마을회관/, Users],
  [/학교|유치원/, GraduationCap],
  [/병원|의원|보건|응급/, Stethoscope],
  [/약국/, Pill],
  [/체육|수영|운동/, Dumbbell],
  [/청사|행정|주민센터|경찰|소방/, Landmark],
  [/대피|방위/, Tent],
  [/급수|해일/, Waves]
]

export function facilityIcon(facility) {
  const text = [facility?.type, facility?.name].filter(Boolean).join(' ')
  const hit = BY_TYPE.find(([re]) => re.test(text))
  return hit ? hit[1] : Building2
}

export default function FacilityThumb({ facility, size = 'md', className, src = null, loading = false }) {
  const Icon = facilityIcon(facility)
  const big = size === 'lg'
  const box = clsx('overflow-hidden rounded-md bg-subtle', big ? 'h-32' : 'h-12 w-12', className)

  if (loading && !src) return <Skeleton className={box} />
  if (src) {
    return (
      <div className={box}>
        <img src={src} alt={`${facility?.name || '시설'} 대표 그림`} className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className={clsx(box, 'flex items-center justify-center')} aria-hidden="true">
      <Icon size={big ? 32 : 20} className="text-text-meta" />
    </div>
  )
}
