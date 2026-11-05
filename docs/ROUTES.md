# ROUTES.md

React Router v6. 권한 가드는 없다. 시연용이라 로그인 없이 들어온다.
담당자 화면은 모두 `components/layout/AdminLayout.jsx` 셸 안에서 열고, 주민 공개 화면만 `components/layout/PublicLayout.jsx` 를 쓴다.

| 경로 | 컴포넌트 | 설명 |
| --- | --- | --- |
| `/` | `pages/console/OverviewScreen.jsx` | 현황판. 첫 화면 |
| `/board` | `pages/console/BoardScreen.jsx` | 상황판. 본문 안 큰 카드에 3D 지도 |
| `/facilities` | `pages/console/FacilitiesScreen.jsx` | 시설 목록과 검색 |
| `/facilities/:id` | `pages/console/FacilitiesScreen.jsx` | 시설 상세. 목록 오른쪽에서 열린다 |
| `/review` | `pages/console/ReviewScreen.jsx` | 판독함. 운영 중단 공지 확인 줄 |
| `/facility/:id/inside` | `pages/facility/InsideScreen.jsx` | 건물 층 보기 |
| `/docs` | `pages/workspace/WorkspaceHome.jsx` | 문서함 |
| `/docs/doc/:id` | `pages/workspace/DocEditor.jsx` | 한글 문서 편집기 |
| `/docs/sheet/:id` | `pages/workspace/SheetEditor.jsx` | 시트 편집기 |
| `/docs/form/:id` | `pages/workspace/FormEditor.jsx` | 설문지 편집기 |
| `/public` | `pages/public/PublicScreen.jsx` | 주민 공개 화면 |
| `/f/:id` | `pages/workspace/FormFillPage.jsx` | 설문 응답 화면 |
| `*` | `pages/public/NotFoundPage.jsx` | 없는 쪽 |

상황판의 고른 시설은 `?f=<시설 번호>` 로 둔다. 다른 화면에서 "상황판에서 보기" 를 누르면 이 주소로 들어온다.
모든 화면은 `lazy` 로 나눈다. 3D 엔진은 상황판과 시설 화면 묶음에만 들어간다.
