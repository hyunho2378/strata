// 수치 전환(PRD F7). anime.js v4 animate 로 이전 값에서 새 값까지 센다.
// 첫 표시만 0 에서 카운트업하고 이후 재계산은 짧은 전환으로 바꾼다(DESIGN 14절).
// 움직임 줄이기 설정이면 값을 바로 바꾼다. 화면 낭독기는 최종 값만 읽는다
import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import { motion } from '../../tokens.js'
import useReducedMotion from './useReducedMotion.js'

const ms = (v) => Number.parseInt(v, 10)

export default function AnimatedNumber({ value, format = (n) => n.toLocaleString('ko-KR'), countUp = true, className }) {
  const reduced = useReducedMotion()
  const target = Number.isFinite(value) ? value : 0
  const [shown, setShown] = useState(() => (countUp && !reduced ? 0 : target))
  const state = useRef({ n: countUp && !reduced ? 0 : target })
  const first = useRef(true)

  useEffect(() => {
    if (reduced) { state.current.n = target; setShown(target); return undefined }
    const duration = first.current ? ms(motion.duration.sheet) * 2 : ms(motion.duration.dur)
    first.current = false
    const anim = animate(state.current, {
      n: target,
      duration,
      ease: 'outQuart',
      onUpdate: () => setShown(Math.round(state.current.n))
    })
    return () => { anim.pause() }
  }, [target, reduced])

  return (
    <span className={className}>
      <span aria-hidden="true" className="tabular-nums">{format(shown)}</span>
      <span className="sr-only">{format(target)}</span>
    </span>
  )
}
