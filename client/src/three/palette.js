// palette.js 3D 장면 전용 색. 화면 UI 색은 tokens.js 를 그대로 쓰고, 역할 9종 색만 여기서 정의한다.
// 역할 색은 UI 규칙의 유채색 제한에서 제외된 3D 전용 색이다. 탁한 색을 쓰지 않고 채도를 높게 유지한다.
import { colors, krds } from '../tokens.js'

// 계약서 2장의 역할 9종 순서. 층 쌓는 순서가 이 순서다
export const ROLE_ORDER = ['shelter', 'evac', 'housing', 'water', 'medical', 'sports', 'care', 'admin', 'transit']

export const ROLE_LABEL = {
  shelter: '쉼터', evac: '대피', housing: '임시주거', water: '급수', medical: '응급',
  sports: '체육', care: '돌봄', admin: '행정', transit: '통행'
}

// 쉼터 청록, 대피 주황, 임시주거 보라, 급수 파랑, 응급 빨강, 체육 녹색, 돌봄 분홍, 행정 남색, 통행 황색
export const ROLE_COLOR = {
  shelter: '#0fb9a9',
  evac: '#ff7a18',
  housing: '#8b4dff',
  water: '#2574f5',
  medical: '#e0263c',
  sports: '#16a34a',
  care: '#f0509e',
  admin: '#1b357f',
  transit: '#f5c211'
}

export const roleIndex = (id) => ROLE_ORDER.indexOf(id)

// 장면 재질과 대기 색. 일반 도시는 중성 회색을 유지한다
export const RENDER = {
  buildingRoof: '#f2f4f5',
  buildingWall: '#e2e5e8',
  buildingRough: 0.86,
  buildingRoughWet: 0.34,
  terrain: colors.page,
  // 낮 장면의 차분한 바다. 해안 발광 띠를 쓰지 않고 수심 차이만 남긴다
  seaDeep: '#5d87ab',
  seaShallow: '#91b6ce',
  seaFoam: '#dbe6ee',
  fogDay: '#dfe7ee',
  fogCold: '#e8eef4',
  fogRain: '#aab3bb',
  focusInk: colors.text.pri,
  anchor: krds.primary[50],
  floodTint: '#1b5f86',
  // 공공시설로 확인된 건물과 선택 시설 건물. 일반 건물은 무채색을 유지한다
  publicBuilding: '#4d8bff',
  focusBuilding: '#17429e'
}

export default { ROLE_ORDER, ROLE_LABEL, ROLE_COLOR, RENDER, roleIndex }
