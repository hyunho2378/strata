// thumbnail.js 시설 건물을 비스듬히 본 정지 이미지. 장소 상세 화면의 대표 이미지로 쓴다.
// 메인 렌더를 방해하지 않도록 별도 렌더 타깃과 별도 카메라로 한 번만 그리고 바로 되돌린다.
// 후처리(composer)는 쓰지 않는다. 화면용 버퍼 크기를 건드리지 않기 위해서다.
import * as THREE from 'three'

// 반환값은 image/webp dataURL
export function renderOffscreen({ renderer, scene, center, width = 480, height = 320, dist = 0.42, polar = 58, azimuth = -35, fov = 32 }) {
  const w = Math.max(64, Math.round(width))
  const h = Math.max(64, Math.round(height))
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, samples: 4 })
  rt.texture.colorSpace = THREE.SRGBColorSpace
  const cam = new THREE.PerspectiveCamera(fov, w / h, 0.01, 900)
  const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, (polar * Math.PI) / 180, (azimuth * Math.PI) / 180))
  cam.position.copy(center).add(off)
  cam.lookAt(center)
  cam.updateMatrixWorld()

  const prevTarget = renderer.getRenderTarget()
  const prevRatio = renderer.getPixelRatio()
  const prevSize = new THREE.Vector2()
  renderer.getSize(prevSize)
  try {
    renderer.setRenderTarget(rt)
    renderer.clear()
    renderer.render(scene, cam)
    const buf = new Uint8Array(w * h * 4)
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    const img = g.createImageData(w, h)
    // 렌더 타깃은 아래에서 위로 쌓이므로 행 순서를 뒤집는다
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4
      img.data.set(buf.subarray(src, src + w * 4), y * w * 4)
    }
    g.putImageData(img, 0, 0)
    return cv.toDataURL('image/webp', 0.9)
  } finally {
    renderer.setRenderTarget(prevTarget)
    renderer.setPixelRatio(prevRatio)
    renderer.setSize(prevSize.x, prevSize.y, false)
    rt.dispose()
  }
}

export default { renderOffscreen }
