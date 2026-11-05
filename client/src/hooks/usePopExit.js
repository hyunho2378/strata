// 봄내 usePopExit 이식. 닫힘 시 durPop 동안 마운트를 유지해 .pop-panel-exit 를 역재생한 뒤 제거한다.
// instant(키보드 개시) 또는 reduced-motion 이면 즉시 제거. Select MultiSelect LangSwitch 드롭다운 공용.
import { useEffect, useRef, useState } from 'react'
import { motion } from '../tokens.js'

export default function usePopExit(open, instant = false) {
  const [mounted, setMounted] = useState(open)
  const timer = useRef(0)

  useEffect(() => {
    if (open) {
      clearTimeout(timer.current)
      setMounted(true)
      return undefined
    }
    if (!mounted) return undefined
    if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMounted(false)
      return undefined
    }
    timer.current = setTimeout(() => setMounted(false), parseInt(motion.duration.pop, 10))
    return () => clearTimeout(timer.current)
  }, [open, mounted, instant])

  return { mounted, closing: mounted && !open }
}
