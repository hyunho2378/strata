// StrataMap 동해 3D 지도. client/src/three/Region3D.js 를 만들고 계약(docs/CONTRACT.md 3장) 메서드만 부른다.
// 메서드가 아직 없을 수 있으므로 있을 때만 부른다.
// 층 나누기와 대표 그림 만들기처럼 화면이 시키는 동작은 ref 로 내준다.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Region3D from '../../three/Region3D.js'
import { prefersReducedMotion } from '../motion/useReducedMotion.js'

const call = (obj, name, ...args) => {
  if (obj && typeof obj[name] === 'function') return obj[name](...args)
  return undefined
}

const StrataMap = forwardRef(function StrataMap({
  facilities = [], roleFilter = [], time, hazard = 'none', focusId = null, alternatives = null,
  quality = 'auto', viewMode = '3d', onPick, onReady
}, ref) {
  const boxRef = useRef(null)
  const sceneRef = useRef(null)
  const cbRef = useRef({})
  const propsRef = useRef({})
  const [failed, setFailed] = useState(false)
  cbRef.current = { onPick, onReady }
  propsRef.current = { facilities, roleFilter, time, hazard, quality, viewMode, focusId, alternatives }

  useImperativeHandle(ref, () => ({
    explodeBuilding: (id) => call(sceneRef.current, 'explodeBuilding', id) || null,
    collapseBuilding: () => call(sceneRef.current, 'collapseBuilding'),
    renderThumbnail: (id, opt) => call(sceneRef.current, 'renderThumbnail', id, opt) || null,
    getQuality: () => call(sceneRef.current, 'getQuality') || null,
    isReady: () => !!sceneRef.current
  }), [])

  useEffect(() => {
    let scene = null
    try {
      scene = new Region3D(boxRef.current, {
        theme: 'light',
        reducedMotion: prefersReducedMotion(),
        onProgress: (p, err) => { if (p < 0) { setFailed(true); console.error('지도 로드 오류', err) } },
        // 지형과 건물이 다 올라오기 전에 들어온 지시는 묻힌다. 준비가 끝나면 지금 상태를 한 번 더 건다
        onReady: () => {
          const s = sceneRef.current
          const v = propsRef.current
          call(s, 'setFacilities', v.facilities)
          call(s, 'setRoleFilter', v.roleFilter)
          call(s, 'setQuality', v.quality)
          call(s, 'setViewMode', v.viewMode)
          if (v.time != null) { call(s, 'setTime', v.time); call(s, 'setSunDate', new Date(v.time)) }
          if (v.focusId) call(s, 'focusFacility', v.focusId)
          cbRef.current.onReady?.()
        },
        onPick: (e) => cbRef.current.onPick?.(e && e.type ? e : { type: 'none' })
      })
    } catch (err) {
      setFailed(true)
      console.error('지도 생성 오류', err)
    }
    sceneRef.current = scene
    return () => { call(scene, 'dispose'); sceneRef.current = null }
  }, [])

  useEffect(() => { call(sceneRef.current, 'setFacilities', facilities) }, [facilities])
  useEffect(() => { call(sceneRef.current, 'setRoleFilter', roleFilter) }, [roleFilter])
  useEffect(() => { call(sceneRef.current, 'setTime', time) }, [time])
  useEffect(() => { call(sceneRef.current, 'setHazard', hazard) }, [hazard])
  useEffect(() => { call(sceneRef.current, 'setQuality', quality) }, [quality])
  useEffect(() => { call(sceneRef.current, 'setViewMode', viewMode) }, [viewMode])
  useEffect(() => { call(sceneRef.current, 'setSunDate', new Date(time)) }, [time])
  useEffect(() => {
    if (focusId) call(sceneRef.current, 'focusFacility', focusId)
    else call(sceneRef.current, 'clearFocus')
  }, [focusId])
  useEffect(() => { if (alternatives) call(sceneRef.current, 'showAlternatives', alternatives) }, [alternatives])

  return (
    <div className="absolute inset-0">
      <div ref={boxRef} className="h-full w-full" role="region" aria-label="동해시 공공시설 3D 지도" />
      {failed && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-page px-4 py-3 type-body-sm text-text-sec shadow-md">
          지도를 불러오지 못했어요.
        </p>
      )}
    </div>
  )
})

export default StrataMap
