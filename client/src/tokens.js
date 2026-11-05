// tokens.js Strata 디자인 토큰 단일 출처
// tailwind.config.js가 이 파일을 import한다. 컴포넌트는 Tailwind 클래스로만 쓴다.
// 이 파일 밖에서 hex와 px를 직접 쓰지 않는다. 사람이 읽는 규칙은 저장소 루트 UI.md 이고,
// UI.md와 이 파일의 값이 다르면 작업을 멈추고 둘을 함께 맞춘다.

// 2026-10-06 KRDS(디지털 정부 디자인 시스템) 전사. 원본: github.com/KRDS-uiux/krds-uiux tokens/transformed_tokens.json
// primitive.color.light 의 값을 그대로 옮기고, 이 제품의 의미 이름(text.pri 등)에 KRDS semantic 대응을 적는다.
// 유채색은 파랑(KRDS primary)과 빨강 두 가지만 쓴다(사용자 지시). 빨강은 KRDS danger(#DE3412, 주황 기운)가 아니라
// KRDS point 계열(#D63D4A)을 쓴다. 주황, 초록, 갈색 계열(warning, success)은 쓰지 않는다.
export const krds = {
  gray: { 0: '#ffffff', 5: '#f4f5f6', 10: '#e6e8ea', 20: '#cdd1d5', 30: '#b1b8be', 40: '#8a949e', 50: '#6d7882', 60: '#58616a', 70: '#464c53', 80: '#33363d', 90: '#1e2124', 95: '#131416' },
  primary: { 5: '#ecf2fe', 10: '#d8e5fd', 20: '#b1cefb', 30: '#86aff9', 40: '#4c87f6', 50: '#256ef4', 60: '#0b50d0', 70: '#083891', 80: '#052561' },
  point: { 5: '#fbeff0', 10: '#f5d6d9', 20: '#ebadb2', 30: '#e0858c', 40: '#d65c66', 50: '#d63d4a', 60: '#ab2b36', 70: '#7a1f26' }
}
const g = krds.gray
const p = krds.primary
const r = krds.point

export const colors = {
  page: g[0],          // background.white
  canvas: g[5],        // background.gray-subtler
  mute: g[10],         // surface.gray-subtle
  subtle: g[5],        // surface.gray-subtler

  text: {
    pri: g[90],        // text.basic
    sec: g[70],        // text.subtle
    meta: g[60],       // 보조 설명(7.0:1)
    ter: g[50],        // 최소 대비 글자(4.6:1). 비활성 대신 쓰지 않는다
    inverse: g[0]
  },

  primary: {
    DEFAULT: p[50],    // border.primary, 주요 행동
    hover: p[60],
    soft: p[10],       // 선택 면. primary-subtler(5) 는 흰 바탕 위 경계가 안 읽혀 한 단계 올린다
    line: p[20],
    text: p[60]        // text.primary
  },

  line: {
    sub: g[10],        // 카드 안 구분선
    def: g[20],        // border.gray-light, divider.gray-light
    strong: g[30]      // border.gray
  },

  // 위험과 부족. KRDS point 계열
  danger:  { DEFAULT: r[50], strong: r[60], soft: r[5], text: r[60] },
  // 이름만 남긴다. 값은 위험 빨강(warning) 과 무채색(success) 이다
  warning: { DEFAULT: r[50], soft: r[5], text: r[60] },
  success: { DEFAULT: g[70], soft: g[10], text: g[80] },

  // 문서함 종류 식별색. UI.md 0장 4번(유채색은 파랑과 빨강 계열만)에 맞춰 파랑 두 단계와 무채색으로 가른다.
  // 아이콘, 배지, 서식 카드 머리에만 쓴다
  kind: { doc: p[50], sheet: p[70], form: g[70] },
  chart: {
    1: p[50],
    2: g[70],
    3: g[50],
    4: g[40],
    heat: { 1: p[20], 2: p[30], 3: p[40], 4: p[50] },
    heatDanger: { 1: r[10], 2: r[30], 3: r[50], 4: r[60] }
  }
}

// prefers-contrast: more 에서 교체하는 값. index.css @media 에서 CSS 변수로 덮는다
export const contrastOverrides = {
  'line-sub': colors.line.def,
  'text-meta': colors.text.sec
}

// 타이포. index.css @layer components 의 .type-* 클래스가 이 값을 그대로 쓴다
// 8단계. "죄다 얇아서 위계가 안 보인다"는 피드백으로 웨이트 사다리를 400 / 600 / 700 / 800 넷으로 벌렸다.
// 인접해 놓이는 짝은 최소 200 차이가 난다. 라벨(caption 600) 대 값(kpi 800), 카드 타이틀(h3 700) 대 본문(body 400),
// 델타(caption 600) 대 보조 문구(meta 400) 다. 큰 활자는 크기 하한을 올리고 자간을 좁혀 덩어리감을 줬다.
// 서체는 KRDS 표준 Pretendard GOV. 굵기는 KRDS 대로 400 과 700 두 가지만 쓴다
// UI 규칙 2.2: 800 display kpi / 700 h1 h2 h3 / 600 caption strong 버튼 탭 표 헤더 / 400 본문. 500 금지
export const typography = {
  display: { size: 'clamp(30px, 2vw + 21px, 42px)', weight: 800, tracking: '-0.035em', leading: 1.14 },
  h1:      { size: 'clamp(24px, 1vw + 19px, 32px)', weight: 700, tracking: '-0.025em', leading: 1.2 },
  h2:      { size: 'clamp(18px, 0.5vw + 16px, 22px)', weight: 700, tracking: '-0.02em', leading: 1.25 },
  h3:      { size: 'clamp(17px, 0.3vw + 15.5px, 19px)', weight: 700, tracking: '-0.02em', leading: 1.3 },
  kpi:     { size: 'clamp(28px, 1.2vw + 22px, 40px)', weight: 800, tracking: '-0.03em', leading: 1.05 },
  body:    { size: 'clamp(15px, 0.2vw + 14px, 17px)', weight: 400, tracking: '-0.01em', leading: 1.7 },
  bodySm:  { size: 'clamp(13px, 0.15vw + 12.5px, 14px)', weight: 400, tracking: '-0.005em', leading: 1.55 },
  strong:  { size: 'clamp(13px, 0.15vw + 12.5px, 14px)', weight: 600, tracking: '-0.005em', leading: 1.55 },
  bodyStrong: { size: 'clamp(15px, 0.2vw + 14px, 17px)', weight: 600, tracking: '-0.01em', leading: 1.7 },
  caption: { size: 'clamp(11px, 0.1vw + 10.5px, 12px)', weight: 600, tracking: '0', leading: 1.4 },
  meta:    { size: '12px', weight: 400, tracking: '0.01em', leading: 1.4 },
  // 알림 카운트 전용. 벨 아이콘을 가리지 않으려면 배지가 16px 이어야 하고 그 안에 들어가는 유일한 크기다
  count:   { size: '10px', weight: 700, tracking: '0.01em', leading: 1 }
}

export const spacing = {
  0.5: '2px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px',
  8: '32px', 10: '40px', 12: '48px', 14: '56px', 16: '64px', 20: '80px', 24: '96px',
  // 레이아웃 고정 치수
  nav: '64px',
  'nav-m': '56px',
  topbar: '56px',
  sidebar: '240px',
  rail: '64px',
  'chat-rail': '56px',
  'source-col': '340px',
  'source-col-md': '320px',
  // UI.md 3장. 지도 화면 패널 치수
  'map-panel': '288px',
  'map-aside': '360px',
  'map-aside-lg': '384px'
}

// UI.md 4장. 4의 배수 네 단계만 쓴다. rounded-full 과 rounded-xl 은 만들지 않는다.
// xs 4 배지와 표식(8px 정사각형에 주면 원이 된다) / sm 8 버튼 칩 입력 목록 행
// md 12 카드 드롭다운 토스트 / lg 16 지도 위 패널 모달 시트
export const radius = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  DEFAULT: '8px'
}

// UI.md 5장 무보더 원칙. 깊이는 이 3단으로만.
// sm 바탕 위 카드, md 지도 위 패널과 드롭다운과 토스트, lg 가운데 모달과 아래 시트.
// card 는 sm 별칭, float 는 md 별칭으로 tailwind.config 에서 매핑한다(기존 컴포넌트가 두 이름을 쓴다)
export const shadow = {
  none: 'none',
  sm: '0 2px 10px rgba(20,23,46,0.07)',
  md: '0 8px 28px rgba(20,23,46,0.12)',
  lg: '0 16px 48px rgba(20,23,46,0.18)'
}

export const screens = {
  xs: '320px',
  sm: '390px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1440px',
  '3xl': '1920px',
  '4xl': '2560px',
  '5xl': '3840px'
}

export const layout = {
  pageMax: '1400px',
  wideMax: '1600px',
  dialog: '560px',
  formMax: '640px',
  dialogWide: '760px',
  tip: '280px',
  toast: '380px',
  chatMax: '1140px',
  composerMax: '680px',
  textMax: '720px',
  // 페이지 좌우 패딩. Tailwind 클래스 px-4 md:px-6 lg:px-8 xl:px-10 3xl:px-16
  pagePx: { xs: 16, md: 24, lg: 32, xl: 40, '3xl': 64 }
}

// DESIGN_DELTA.md 변경 4. UI 전환 상한 300ms 미만. 기존 page 320 은 dur 280 으로 내렸다
export const motion = {
  duration: {
    press: '120ms',   // press 피드백
    fast: '160ms',    // 색 배경 hover, 탭 인디케이터
    pop: '180ms',     // 드롭다운 팝 진입 퇴장
    dur: '280ms',     // 진입 페이지 전환
    sheet: '360ms'    // 드로어 시트
  },
  easing: {
    out: 'cubic-bezier(0.23,1,0.32,1)',      // 진입 퇴장 기본
    inOut: 'cubic-bezier(0.77,0,0.175,1)',   // 화면 내 이동
    drawer: 'cubic-bezier(0.32,0.72,0,1)',   // 시트 드로어
    spring: 'cubic-bezier(0.32,1.32,0.5,1)'  // 모멘텀 결과 전용. 일반 UI 금지
  },
  press: 'scale(0.97)',
  skeleton: { duration: '1.4s', from: colors.line.def, to: colors.text.ter }
}

export const zIndex = {
  base: '0',
  raised: '10',
  nav: '40',
  dropdown: '50',
  drawer: '60',
  modal: '70',
  toast: '80'
}

export const icon = {
  sizes: [16, 20, 24, 32, 48],
  stroke: 1.75
}
