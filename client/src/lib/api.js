// api.js 환경값 한 곳. 서버가 없으면 문서함은 메모리에서 동작한다.
// 백엔드 계약은 docs/API_CONTRACT.md 5절. 서버가 붙으면 이 파일에 fetch 래퍼를 둔다.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
export const API_URL = import.meta.env.VITE_API_URL || ''
export const ORG_NAME = import.meta.env.VITE_ORG_NAME || '동해시'
