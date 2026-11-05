# AGENTS.md — 에이전트 실행 구조 & 할루시네이션 방지

## 하네스 엔지니어링 구조

```
PHASE 0 — 초기 세팅 (1개 에이전트 단독)
PHASE 1 — 병렬 구현 (3개 에이전트 동시 실행)
PHASE 2 — 단독 검증 + 서버 연동 (1개 에이전트, PHASE 1 완료 후)
```

PHASE 0 → PHASE 1 → PHASE 2 순서로 실행한다.


---

## PHASE 0 에이전트

### AGENT-SETUP
- 담당: SETUP.md 전체 실행
- 완료 조건
  - client/server 폴더 구조 생성
  - 패키지 설치 완료
  - tailwind.config.js에 DESIGN.md 토큰 반영
  - index.css에 Pretendard CDN 로드
  - .env.example, .gitignore 작성
  - npm run dev로 client (5173) / server (3000) 정상 실행
- 검증
  - 토큰 클래스 (bg-primary, text-text-pri, font-pretendard) 동작 확인
  - Pretendard 폰트 Network 탭에서 로드 확인
  - 라우팅 기본 동작 확인

PHASE 0 완료 후 PHASE 1을 시작한다.

---

## PHASE 1 에이전트 분배

### AGENT-1 (기반 + 데이터 + 라우팅)
담당
- `tailwind.config.js` (DESIGN.md 토큰 그대로 반영. 색상 6단계, 폰트 단일, 브레이크포인트 8단계)
- `index.html` (Pretendard CDN, viewport 메타)
- `src/index.css` (page-enter 애니메이션, focus-visible 글로벌, scrollbar 스타일)
- `src/data/stays.json` (6개 거점 + 객실 더미 데이터)
- `src/data/packages.json` (3종 패키지)
- `src/data/journal.json` (TRAVEL/MAGAZINE/PICK 각 카테고리당 2~3개)
- `src/data/goods.json` (굿즈 6~10개)
- `src/App.jsx` (BrowserRouter + Routes)
- `src/main.jsx`
- `src/store/useAuthStore.js` (Zustand, 로그인 상태/역할/단계)
- `src/store/useReservationStore.js` (예약 진행 상태)
- `src/lib/api.js` (서버 호출 클라이언트, 베이스 URL)
- `src/lib/format.js` (가격 포맷, 날짜 포맷)

완료 조건
- 토큰 색상 클래스 전부 동작 확인 (bg-primary, text-text-strong, border-border-sub 등)
- Pretendard 폰트 로드 확인
- 모든 .json 파일 IA.md 데이터 구조와 일치
- 라우터 13개 경로 전부 등록

### AGENT-2 (페이지 + 레이아웃)
담당
- `src/components/layout/Layout.jsx`
- `src/components/layout/Footer.jsx`
- `src/components/nav/TopNav.jsx`
- `src/components/nav/Logo.jsx`
- `src/components/nav/SearchBar.jsx`
- `src/components/nav/NavMenu.jsx`
- `src/components/nav/IconGroup.jsx`
- `src/pages/HomePage.jsx`
- `src/pages/StaysPage.jsx`
- `src/pages/StayDetailPage.jsx`
- `src/pages/PackagesPage.jsx`
- `src/pages/PackageDetailPage.jsx`
- `src/pages/JournalPage.jsx`
- `src/pages/JournalDetailPage.jsx`
- `src/pages/MembershipPage.jsx`
- `src/pages/PassPage.jsx`
- `src/pages/GoodsPage.jsx`
- `src/pages/CommunityPage.jsx`
- `src/pages/AuthPage.jsx`
- `src/pages/AdminPage.jsx`

완료 조건
- 13개 페이지 전부 렌더링 가능 (빈 상태라도)
- TopNav가 sticky로 모든 페이지에 노출
- 모바일 햄버거 메뉴 동작
- 모바일 ~ 4K까지 가로 스크롤 발생 없음
- /pass, /admin 진입 시 비인증 사용자는 /auth로 리다이렉트

### AGENT-3 (재사용 컴포넌트)
담당
- `src/components/button/Button.jsx`
- `src/components/button/IconButton.jsx`
- `src/components/button/BookmarkButton.jsx`
- `src/components/card/StayCard.jsx`
- `src/components/card/PackageCard.jsx`
- `src/components/card/JournalCard.jsx`
- `src/components/card/GoodsCard.jsx`
- `src/components/card/PassCard.jsx`
- `src/components/Badge.jsx`
- `src/components/Chip.jsx`
- `src/components/StageBadge.jsx`
- `src/components/Input.jsx`
- `src/components/Select.jsx`
- `src/components/DateRangePicker.jsx`
- `src/components/Counter.jsx`
- `src/components/HeroSlider.jsx`
- `src/components/ImageGallery.jsx`
- `src/components/SectionHeader.jsx`
- `src/components/feedback/LoadingSkeleton.jsx`
- `src/components/feedback/LoadingScreen.jsx`
- `src/components/feedback/Toast.jsx`
- `src/components/feedback/EmptyState.jsx`

완료 조건
- 모든 컴포넌트가 COMPONENTS.md 스펙 그대로 구현
- PATTERNS.md JSX 패턴을 그대로 사용 (임의 변형 금지)
- DESIGN.md 외부 자원 섹션의 아이콘/일러스트 정책 준수
- 각 컴포넌트 단독 동작 확인
- focus-visible 키보드 동작 확인

---

## PHASE 2 에이전트

### AGENT-REVIEW (크로스체크 + 서버 연동)

담당
- PHASE 1 전체 산출물 검증 (아래 CHECKLIST 전 항목)
- 서버 측 NeonDB Drizzle 스키마 작성 (`server/db/schema.js`)
- 서버 라우트 작성
  - `server/routes/stays.js`
  - `server/routes/packages.js`
  - `server/routes/reservations.js`
  - `server/routes/journal.js`
  - `server/routes/pass.js`
  - `server/routes/admin.js`
- `server/index.js` Express 앱 진입점
- `server/middleware/auth.js` 인증 미들웨어
- 클라이언트 `lib/api.js`와 서버 통신 연결
- 시드 데이터 마이그레이션

참고
- PHASE 1 완료 후 실행
- PROGRESS.md 참조

체크 항목: 아래 CHECKLIST 전 항목 통과해야 완료.

---

## CHECKLIST (AGENT-REVIEW 필수 실행)

### 디자인 시스템 위배 검사

- [ ] Pretendard 외 다른 폰트 사용 없음 (system-ui, sans-serif fallback 전부 제거됨)
- [ ] 색상 하드코딩 없음 (HEX 값 직접 입력 금지, tailwind 토큰만 사용)
- [ ] #FFFFFF, #000000 외 다른 흰색/검정 변형값 없음 (정의된 카드/섹션 회색만 허용)
- [ ] 그라데이션 사용 없음 (bg-gradient-*, text-gradient-* 전부 없음)
- [ ] box-shadow 사용 없음
- [ ] scale transform 사용 없음 (이미지 hover zoom 한정 예외만 허용)
- [ ] backdrop-blur 사용 없음
- [ ] 이모티콘 사용 없음 (모든 .jsx, .json, .md 파일)
- [ ] 정의된 폰트 weight 4단계 모두 능동적으로 사용됨
- [ ] 한 페이지에 단일 weight만 적용된 영역 없음
- [ ] Light weight가 본문에 사용된 곳 없음

### 반응형 검사

- [ ] 320px (xs)에서 콘텐츠 잘림 없음
- [ ] 360px, 640px, 768px, 1024px, 1280px, 1536px, 1920px, 2560px 전부 정상
- [ ] 가로 스크롤 발생 없음 (모든 브레이크포인트)
- [ ] 4K (2560px+)에서 콘텐츠가 한쪽으로 늘어지지 않고 max-width로 중앙 정렬됨
- [ ] 페이지 좌우 padding이 브레이크포인트별로 변화함
- [ ] 카드 그리드 컬럼 수가 브레이크포인트별로 변화함

### 타이포그래피 검사

- [ ] 페이지 타이틀이 24px → 28px → 32px → 36px 스케일 적용
- [ ] 섹션 헤딩이 20px → 22px → 24px → 28px 스케일 적용
- [ ] 본문이 15px → 16px → 17px 스케일 적용
- [ ] 자간 본문 -0.01em, 제목 -0.02em
- [ ] 행간 본문 leading-relaxed (1.7), 제목 leading-tight

### 컴포넌트 검사

- [ ] Button primary hover 시 #3B82F6으로 색상 변화
- [ ] Card 이미지 hover 시 1.04 zoom
- [ ] 카드 배지가 좌상단, 북마크가 우상단에 위치
- [ ] StageBadge가 4단계 (방문/연결/관계/정착) 모두 정의됨
- [ ] LoadingScreen 점 애니메이션 동작
- [ ] PassCard html2canvas 캡처 가능
- [ ] focus-visible이 모든 인터랙티브 요소에 적용됨

### TopNav 검사

- [ ] 좌측 로고, 중앙 검색바, 우측 메뉴 + 아이콘 구조
- [ ] sticky top-0 동작
- [ ] 모바일에서 검색바가 햄버거 메뉴로 접힘
- [ ] 활성 라우트 텍스트가 text-primary로 표시됨

### 페이지 흐름 검사

- [ ] 홈 → 거점 클릭 → 거점 상세 → 예약 진입 흐름
- [ ] 홈 → 패키지 클릭 → 패키지 상세 → 결제 진입 흐름
- [ ] 비로그인 시 /pass 접근 → /auth로 리다이렉트
- [ ] 가입 시 역할 선택 (nomad/senior/corporate/operator) 동작
- [ ] 로그인 사용자 마이 G-Pass에서 단계 배지 표시

### AI/API 응답 검사 (서버 연동 후)

- [ ] 서버 라우트 6개 전부 동작 (stays, packages, reservations, journal, pass, admin)
- [ ] CORS 설정으로 client → server 통신 정상
- [ ] NeonDB 연결 성공 (DATABASE_URL 환경변수)
- [ ] Drizzle 스키마와 IA.md 테이블 정의 일치
- [ ] 시드 데이터 입력 후 GET 요청 정상 응답

### 할루시네이션 방지 검사

- [ ] DESIGN.md에 없는 색상값 사용 없음
- [ ] DESIGN.md에 없는 폰트 사이즈 사용 없음
- [ ] DESIGN.md 외부 자원 섹션 외 아이콘 라이브러리 도입 없음 (사용자 승인 없이 보조 라이브러리 추가 금지)
- [ ] 일러스트 사용 위치가 EmptyState/Auth/Onboarding/Error 페이지로 한정됨
- [ ] 일러스트 메인 컬러가 #60A5FA 또는 흑백으로 통일됨 (다색 일러스트 없음)
- [ ] COMPONENTS.md에 없는 컴포넌트 임의 추가 없음
- [ ] PATTERNS.md JSX 패턴 임의 변형 없음
- [ ] IA.md 페이지 구조 임의 변경 없음
- [ ] IA.md URL 구조 임의 변경 없음
- [ ] data JSON 파일 임의 추가 항목 없음

### 데이터 정합성 검사

- [ ] 모든 stay id가 unique
- [ ] 모든 package id가 unique
- [ ] 모든 journal id가 unique
- [ ] reservation의 stay_id 또는 package_id 중 하나는 반드시 존재
- [ ] profile.role이 enum 4개 (nomad, senior, corporate, operator) 안에서만 사용
- [ ] profile.stage가 enum 4개 (visit, connect, relationship, settlement) 안에서만 사용

### 접근성 검사

- [ ] 모든 인터랙티브 요소에 aria-label 또는 텍스트 라벨
- [ ] 이미지에 alt 속성
- [ ] 폼 input에 label association
- [ ] focus-visible outline 명확하게 보임
- [ ] 텍스트 색상 대비 4.5:1 이상

---

## 커밋 규칙

```
[A0] chore: 초기 세팅 (folder, packages, config)
[A1] feat: 기반 + 데이터 + 라우팅 (tailwind, data, App, store)
[A2] feat: 페이지 + 레이아웃 (pages, nav, footer)
[A3] feat: 재사용 컴포넌트 (button, card, badge, feedback)
[AR] fix: REVIEW 수정사항 반영
[AR] feat: 서버 연동 (express, neondb, drizzle, routes)
```

각 PHASE 완료 시 PROGRESS.md를 업데이트하고 커밋한다.

---

## 컨텍스트 관리

컨텍스트 85% 도달 시
1. PROGRESS.md 업데이트
2. PROGRESS.md 업데이트 (완료 / 진행중 / 다음 작업 명시)

이 규칙을 어기면 다음 세션에서 진행 상황을 잃어버린다. 절대 누락 금지.

---

## 불확실할 때

가장 합리적인 결정을 내리고 계속 진행한다. 멈추거나 묻지 않는다. 결정 내용을 주석으로 남기고 실행한다.

---

## 에이전트 간 충돌 회피

PHASE 1 세 에이전트가 같은 파일을 동시 수정하지 않도록 담당 영역이 분리되어 있다.

- AGENT-1: tailwind.config.js, index.css, data/, App.jsx, main.jsx, store/, lib/
- AGENT-2: pages/, components/layout/, components/nav/
- AGENT-3: components/ (layout, nav 외 모든 하위)

영역 침범 시 PROGRESS.md에 한 줄 기록하고 계속 진행한다.

---

## 검증 결과 기록

PHASE 2 REVIEW 종료 시 PROGRESS.md에 다음 형식으로 기록한다.

```
## REVIEW 결과 (YYYY-MM-DD)

### 통과 항목
- [x] 디자인 시스템 위배 검사 0건
- [x] 반응형 320~2560 전부 정상
- ...

### 미통과 항목 + 수정 내역
- [ ] (예시) StaysPage 4xl에서 우측 여백 누락 → padding-x 96px 추가 완료

### 후속 권고
- 사용자 검토 요청 항목 N개
```