// 지도 레이어 서서히 나타남과 사라짐(PRD F7). anime.js 로 0~1 값을 움직이고 호출부가 페인트 속성에 반영한다.
// 움직임 줄이기 설정이면 바로 끝 값을 적용한다
import { animate } from 'animejs'
import { motion } from '../../tokens.js'
import { prefersReducedMotion } from './useReducedMotion.js'

export function fadeValue(from, to, onUpdate, onComplete) {
  if (prefersReducedMotion() || from === to) {
    onUpdate(to)
    onComplete?.()
    return { pause() {} }
  }
  const box = { v: from }
  return animate(box, {
    v: to,
    duration: Number.parseInt(motion.duration.dur, 10),
    ease: 'outQuad',
    onUpdate: () => onUpdate(box.v),
    onComplete: () => onComplete?.()
  })
}
