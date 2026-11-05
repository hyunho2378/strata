// 시설 대표 그림. 3D 엔진의 renderThumbnail 결과를 받아 상세 화면에 쓴다.
// 지형과 건물이 아직 올라오는 중이면 빈 값이 오므로 몇 번 더 물어본다.
import { useEffect, useState } from 'react'

const TRIES = [600, 1600, 3000]

export default function useFacilityThumb(mapRef, id) {
  const [state, setState] = useState({ id: null, src: null, loading: false })

  useEffect(() => {
    if (!id) { setState({ id: null, src: null, loading: false }); return undefined }
    let live = true
    const timers = []
    setState({ id, src: null, loading: true })
    TRIES.forEach((wait, i) => {
      timers.push(setTimeout(async () => {
        if (!live) return
        let src = null
        try {
          src = await mapRef.current?.renderThumbnail(id, { width: 480, height: 320 })
        } catch {
          src = null
        }
        if (!live) return
        if (src) setState({ id, src, loading: false })
        else if (i === TRIES.length - 1) setState({ id, src: null, loading: false })
      }, wait))
    })
    return () => { live = false; timers.forEach(clearTimeout) }
  }, [mapRef, id])

  return state
}
