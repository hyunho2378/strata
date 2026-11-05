// 봄내 useBodyScrollLock 이식. 오버레이 열림 시 body 스크롤 락, 닫을 때 이전 값 복원.
// 포커스 트랩은 useFocusTrap 이 따로 맡는다.
import { useEffect } from 'react'

export default function useBodyScrollLock(open) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
}
