// useNow.js 1초 틱. 지금 시각을 돌려준다
import { useEffect, useState } from 'react'

export default function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
