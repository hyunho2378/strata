// prefers-reduced-motion 구독. 움직임 줄이기 설정이면 true. anime.js 호출부가 이 값으로 즉시 적용을 고른다
import useMediaQuery from '../../hooks/useMediaQuery.js'

export default function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
