// mapTheme.js 지도 바탕 스타일 주소와 겹침 레이어 색. 색은 전부 tokens.js 에서 가져온다(hex 직접 입력 금지).
// 바탕 타일: OpenFreeMap(키 불필요, OpenMapTiles 스키마, 저작권 OpenStreetMap 기여자). 2026. 10. 6. 응답 200 확인
import { colors } from '../../tokens.js'

export const STYLE_URL = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  fallback: 'https://tiles.openfreemap.org/styles/liberty'
}

// 부족분 단계 색. 0 은 중립 회색, 1~4 는 heatDanger. 단계 기준은 lib/geo.js SEVERITY_STEPS
export const SEVERITY_COLOR = [
  colors.chart[4],
  colors.chart.heatDanger[1],
  colors.chart.heatDanger[2],
  colors.chart.heatDanger[3],
  colors.chart.heatDanger[4]
]
// 대피 대상 구역 밖 마을 점
SEVERITY_COLOR.out = colors.line.def

// 행정동 고령화율 단계(65세 이상 비율, %). step 식 인자 순서 그대로
export const AGING_STEPS = [
  { min: 0, label: '25% 미만', color: colors.chart.heat[1], swatch: 'bg-chart-heat-1' },
  { min: 25, label: '25~35%', color: colors.chart.heat[2], swatch: 'bg-chart-heat-2' },
  { min: 35, label: '35~45%', color: colors.chart.heat[3], swatch: 'bg-chart-heat-3' },
  { min: 45, label: '45% 이상', color: colors.chart.heat[4], swatch: 'bg-chart-heat-4' }
]
export const agingStops = () => AGING_STEPS.flatMap((s, i) => (i === 0 ? [s.color] : [s.min, s.color]))
// 범례 견본 Tailwind 클래스(같은 순서). 색만으로 구분하지 않도록 범례에 수치 구간 글자를 같이 쓴다
export const SEVERITY_SWATCH = ['bg-chart-4', 'bg-chart-heatDanger-1', 'bg-chart-heatDanger-2', 'bg-chart-heatDanger-3', 'bg-chart-heatDanger-4']

export const OVERLAY = {
  light: {
    dongLine: colors.chart[4],
    cityLine: colors.text.sec,
    label: colors.text.sec,
    halo: colors.page,
    fire: colors.text.pri,
    vehicle: colors.primary.DEFAULT,
    vehicleOff: colors.text.meta,
    shelter: colors.primary.DEFAULT,
    stroke: colors.page,
    highlight: colors.primary.DEFAULT,
    hillShadow: colors.text.sec,
    hillLight: colors.page,
    forest: colors.text.ter,
    building: colors.line.def,
    danger: colors.danger.DEFAULT,
    warn: colors.chart.heatDanger[2],
    shelterOff: colors.text.meta,
    ltc: colors.chart[2],
    agingLow: colors.chart.heat[1]
  },
  dark: {
    dongLine: colors.text.meta,
    cityLine: colors.text.ter,
    label: colors.line.def,
    halo: colors.text.pri,
    fire: colors.line.def,
    vehicle: colors.primary.line,
    vehicleOff: colors.text.ter,
    shelter: colors.primary.line,
    stroke: colors.text.pri,
    highlight: colors.primary.line,
    hillShadow: colors.text.pri,
    hillLight: colors.text.ter,
    forest: colors.text.ter,
    building: colors.text.sec,
    danger: colors.danger.DEFAULT,
    warn: colors.chart.heatDanger[2],
    shelterOff: colors.text.ter,
    ltc: colors.line.def,
    agingLow: colors.chart.heat[1]
  }
}
