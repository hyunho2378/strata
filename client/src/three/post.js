// post.js 후처리. three.js 기본 EffectComposer 한 경로만 쓴다.
// 순서는 RenderPass, 반해상도 AO, 선택 블룸, OutputPass 다. 톤매핑은 마지막 OutputPass 에서 한 번만 한다.
// 렌더 타깃으로 그리는 동안 재질 단계의 톤매핑은 꺼지므로 ACES 가 두 번 적용되지 않는다.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'

export function makeComposer({ renderer, scene, camera, width, height, quality = 'high' }) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    colorSpace: THREE.NoColorSpace,
    // SMAA를 쓰므로 비싼 HDR MSAA를 중복 적용하지 않는다
    samples: 0
  })
  const composer = new EffectComposer(renderer, target)
  composer.setSize(width, height)

  const render = new RenderPass(scene, camera)
  composer.addPass(render)

  // 접촉 음영. 반해상도로 돌려 프레임 예산을 지킨다
  let ao = null
  try {
    ao = new GTAOPass(scene, camera, Math.round(width / 2), Math.round(height / 2))
    ao.output = GTAOPass.OUTPUT.Default
    // 길이 단위가 km 다. 반경 0.012 는 12m 로 건물 기단과 접합부만 잡는다. 더 키우면 도시 전체가 어두워진다
    ao.blendIntensity = quality === 'high' ? 0.45 : 0.3
    ao.updateGtaoMaterial?.({ radius: 0.012, distanceExponent: 1.0, thickness: 0.05, scale: 1.0, samples: quality === 'high' ? 16 : 8 })
    // 합성 단계는 화면 좌표로 샘플하므로 내부 버퍼만 절반으로 유지한다
    const half = (w, h) => GTAOPass.prototype.setSize.call(ao, Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)))
    ao.setSize = half
    composer.addPass(ao)
  } catch (err) {
    ao = null
    console.warn('AO 패스를 건너뛴다', err?.message || err)
  }

  // 블룸은 역할 층의 얇은 발광면과 햇빛 반사에만 닿도록 문턱을 높게 둔다
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.72, 0.86)
  bloom.enabled = quality === 'high'
  composer.addPass(bloom)

  const output = new OutputPass()
  composer.addPass(output)

  // 계단 현상 정리. 렌더 타깃 MSAA 만으로는 건물 모서리와 지형 경계에서 자글거림이 남는다
  let smaa = null
  try {
    smaa = new SMAAPass(width, height)
    composer.addPass(smaa)
  } catch (err) {
    smaa = null
    console.warn('SMAA 패스를 건너뛴다', err?.message || err)
  }

  return { composer, passes: { render, ao, bloom, output, smaa }, target }
}

// 장치와 장면에 맞춘 픽셀비. 기본 1에서 1.5, 정지 캡처만 2
export function pickPixelRatio({ moving = false, quality = 'high', capture = false } = {}) {
  const dpr = window.devicePixelRatio || 1
  if (capture) return Math.min(dpr, 2)
  if (quality === 'low') return 1
  // 이동 중에도 1.25 아래로는 내리지 않는다. 더 내리면 가까운 장면에서 건물 모서리가 자글거린다
  return Math.min(dpr, moving ? 1 : 1.25)
}
