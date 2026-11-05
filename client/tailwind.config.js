import { colors, spacing, radius, shadow, screens, zIndex, layout, motion } from './src/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens,
    // UI.md 4장과 5장. 기본 스케일을 덮어 rounded-full, rounded-xl, shadow-2xl 같은 단계가 아예 생기지 않게 한다
    borderRadius: radius,
    boxShadow: { ...shadow, card: shadow.sm, float: shadow.md },
    extend: {
      fontFamily: { pretendard: ['"Pretendard GOV Variable"', '"Pretendard GOV"', '"Pretendard Variable"', 'sans-serif'] },
      colors,
      spacing,
      zIndex,
      maxWidth: {
        page: layout.pageMax,
        wide: layout.wideMax,
        chat: layout.chatMax,
        composer: layout.composerMax,
        text: layout.textMax,
        dialog: layout.dialog,
        'dialog-wide': layout.dialogWide,
        form: layout.formMax,
        tip: layout.tip,
        toast: layout.toast
      },
      transitionDuration: motion.duration,
      // DESIGN.md 모션 표 이름(ease-out / ease-in-out / ease-drawer / ease-spring)
      transitionTimingFunction: {
        out: motion.easing.out,
        'in-out': motion.easing.inOut,
        drawer: motion.easing.drawer,
        spring: motion.easing.spring
      }
    }
  },
  // 콘텐츠 폭 기준 반응형(container query). 사이드바가 열리고 닫히면 창 폭과 본문 폭이 달라지므로,
  // 카드 격자처럼 본문 폭에 따라 바뀌어야 하는 배치는 md:, lg: 대신 cq-md:, cq-xl: 을 쓴다. 기준 상자는 .cq(PageShell 본문)
  plugins: [
    function ({ addVariant, addUtilities }) {
      addUtilities({ '.cq': { 'container-type': 'inline-size' } })
      const CQ = { sm: 480, md: 640, lg: 840, xl: 1040, '2xl': 1280 }
      for (const [k, v] of Object.entries(CQ)) addVariant(`cq-${k}`, `@container (min-width: ${v}px)`)
    }
  ]
}
