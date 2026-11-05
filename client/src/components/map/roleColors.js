// 역할 색. 3D 담당의 client/src/three/palette.js 가 단일 출처다. 아직 없으면 회색 임시값을 쓴다.
import { krds } from '../../tokens.js'

const MODS = import.meta.glob('../../three/palette.js')
const FALLBACK = [krds.gray[80], krds.gray[70], krds.gray[60], krds.gray[50], krds.gray[40], krds.gray[30], krds.gray[20], krds.gray[10], krds.gray[5]]

export async function loadRoleColors(roleIds = []) {
  const loader = MODS['../../three/palette.js']
  let map = null
  if (loader) {
    try {
      const m = await loader()
      map = m.ROLE_COLORS || m.roleColors || m.ROLE_COLOR || m.default || null
    } catch { map = null }
  }
  const out = {}
  roleIds.forEach((id, i) => {
    const v = map && (map[id] ?? map[i])
    out[id] = typeof v === 'number' ? `#${v.toString(16).padStart(6, '0')}` : (typeof v === 'string' ? v : FALLBACK[i % FALLBACK.length])
  })
  return out
}
