// quality.js 보는 사람의 장치에 맞춘 품질 등급. 시작할 때 한 번 판정하고 실행 중에는 프레임 시간으로 조절한다.
// 판정 근거는 WEBGL_debug_renderer_info 의 그래픽 장치 이름, 최대 텍스처 크기, 화면 픽셀비, 논리 코어 수, 장치 메모리다.
// 아래 점수와 경계값은 이 제품의 운영 기준이다. 장치 성능의 공식 지표가 아니다.
// WebGL2 가 없으면 등급을 low 로 고정한다. 후처리와 그림자를 켤 수 없는 환경이기 때문이다.

export const LEVELS = ['low', 'medium', 'high']

// 등급별 설정. 픽셀비, 그림자, AO, 블룸, SMAA, 바다 반사, 라벨 수, 건물 가시 거리(km)
export const PRESET = {
  high: { pixelRatio: 1.25, movingRatio: 1.0, shadow: true, shadowMap: 2048, ao: true, bloom: true, smaa: true, ocean: 'full', maxLabels: 30, buildingKm: 7.5 },
  medium: { pixelRatio: 1.0, movingRatio: 0.85, shadow: true, shadowMap: 1024, ao: false, bloom: true, smaa: true, ocean: 'calm', maxLabels: 18, buildingKm: 4.0 },
  low: { pixelRatio: 0.75, movingRatio: 0.6, shadow: false, shadowMap: 512, ao: false, bloom: false, smaa: false, ocean: 'static', maxLabels: 10, buildingKm: 2.4 }
}

// 그래픽 장치 이름에서 등급 점수를 읽는다. 이름이 비어 있으면 0 점으로 둔다
function gpuScore(name) {
  const s = (name || '').toLowerCase()
  if (!s) return 0
  if (/swiftshader|llvmpipe|software|basic render/.test(s)) return -4
  if (/apple m[1-9]|rtx\s?[2-9]|radeon rx [5-9]|geforce (gtx 1[6-9]|rtx)|arc a[3-9]/.test(s)) return 2
  if (/apple gpu|radeon pro|geforce|quadro|radeon rx/.test(s)) return 1
  if (/intel.*(iris xe|iris plus)/.test(s)) return 0
  if (/intel.*(uhd|hd graphics)|mali-g[1-5]|adreno [1-5]/.test(s)) return -2
  return 0
}

// 장치 정보를 모아 등급 하나를 고른다. 반환값에는 판정 근거를 그대로 담는다
export function detectTier() {
  const info = {
    webgl2: false, renderer: '', vendor: '', maxTextureSize: 0,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    cores: navigator.hardwareConcurrency || 0,
    memoryGb: navigator.deviceMemory || 0,
    score: 0, tier: 'low', reason: ''
  }
  let gl = null
  try {
    const cv = document.createElement('canvas')
    gl = cv.getContext('webgl2')
  } catch { gl = null }
  if (!gl) {
    info.reason = 'WebGL2 없음. low 고정'
    return info
  }
  info.webgl2 = true
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    if (dbg) {
      info.renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
      info.vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '')
    }
    info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0
  } catch { /* 장치 이름을 막아 둔 브라우저에서는 점수 0 으로 둔다 */ }
  let score = gpuScore(info.renderer)
  if (info.cores >= 8) score += 1
  else if (info.cores && info.cores <= 4) score -= 1
  if (info.memoryGb >= 8) score += 1
  else if (info.memoryGb && info.memoryGb <= 4) score -= 1
  if (info.maxTextureSize >= 16384) score += 1
  else if (info.maxTextureSize && info.maxTextureSize < 8192) score -= 1
  // 픽셀비가 3 이상인 화면은 같은 등급이라도 그릴 픽셀이 많아 한 칸 깎는다
  if (info.dpr >= 3) score -= 1
  info.score = score
  info.tier = score >= 2 ? 'high' : score >= 0 ? 'medium' : 'low'
  info.reason = `장치 ${info.renderer || '이름 비공개'} / 코어 ${info.cores || '모름'} / 메모리 ${info.memoryGb || '모름'}GB / 텍스처 ${info.maxTextureSize} / 픽셀비 ${info.dpr} / 점수 ${score}`
  try { gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* 판정용 임시 컨텍스트만 정리한다 */ }
  return info
}

// 실행 중 조절. 프레임 시간 평균이 45fps 아래로 2초 이어지면 한 단계 낮추고,
// 58fps 위가 6초 이어지면 한 단계 올린다. 올린 직후 3초는 다시 판단하지 않는다(되풀이 방지).
export class FrameMonitor {
  constructor({ down = 45, up = 58, downMs = 2000, upMs = 6000, holdMs = 3000 } = {}) {
    this.cfg = { down, up, downMs, upMs, holdMs }
    this.ema = 16.7
    this.badSince = 0
    this.goodSince = 0
    this.lockUntil = 0
    this.samples = 0
  }

  reset(now) { this.badSince = 0; this.goodSince = 0; this.lockUntil = now + this.cfg.holdMs; this.samples = 0 }

  get fps() { return this.ema > 0 ? Math.round(1000 / this.ema) : 0 }

  // dt 는 바로 앞 프레임과의 간격(ms). 돌려주는 값은 'down' 'up' 또는 null
  sample(now, dt) {
    if (!(dt > 0) || dt > 500) return null
    this.ema = this.ema * 0.9 + dt * 0.1
    this.samples += 1
    if (this.samples < 30 || now < this.lockUntil) return null
    const fps = 1000 / this.ema
    if (fps < this.cfg.down) {
      this.goodSince = 0
      if (!this.badSince) this.badSince = now
      else if (now - this.badSince >= this.cfg.downMs) { this.reset(now); return 'down' }
    } else if (fps > this.cfg.up) {
      this.badSince = 0
      if (!this.goodSince) this.goodSince = now
      else if (now - this.goodSince >= this.cfg.upMs) { this.reset(now); return 'up' }
    } else { this.badSince = 0; this.goodSince = 0 }
    return null
  }
}

export const stepLevel = (level, dir) => {
  const i = LEVELS.indexOf(level)
  const n = Math.min(LEVELS.length - 1, Math.max(0, i + (dir === 'up' ? 1 : -1)))
  return LEVELS[n]
}

export default { LEVELS, PRESET, detectTier, FrameMonitor, stepLevel }
