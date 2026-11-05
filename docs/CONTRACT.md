# Strata 작업 계약서 (병렬 작업 기준)

Strata: 동해시 공공시설 기능연속성 관리 플랫폼. 3D 지도가 주 화면이다.
기획: ../../01. 주제 리서치/Strata_기획서.md, 3D 설계: ../../01. 주제 리서치/해커톤_별첨/v4_3d.md, AI 설계: ../../01. 주제 리서치/해커톤_별첨/v4_ai.md

## 0. 공통 규칙

- 코드, 주석, 문서, 화면 어디에도 이전 프로젝트 이름을 쓰지 않는다. 금지 단어 목록은 저장소 밖 작업 메모에 둔다.
- JavaScript JSX만. TypeScript 금지. localStorage, sessionStorage 금지. 이모지 금지. 아이콘은 lucide-react.
- 색, 간격, 글꼴은 client/src/tokens.js 경유. 3D 색은 client/src/three/palette.js(3D 담당 소유)에서 tokens.js 값을 읽는다.
- 화면 문구는 한국어, 서술 문장은 마침표로 끝낸다. 가운뎃점, 줄표 금지.
- 시스템 기본 UI(select, date input, alert, confirm) 금지. 가운데 모달만. rounded-full 금지. 유채색 UI는 파랑과 빨강 계열만(3D 역할 색은 예외로 palette.js에 정의).
- 개인 담당자 이름과 전화번호는 데이터와 화면에 넣지 않는다. 부서명만.

## 1. 파일 소유

| 담당 | 소유(수정 가능) | 읽기만 |
| --- | --- | --- |
| A 데이터 | client/scripts/**, client/src/data/** | 나머지 전부 |
| B 3D 엔진 | client/src/three/** | 나머지 전부 |
| C 화면과 정리 | 위 두 곳을 제외한 저장소 전체(client/src/**, client/api/**, docs/**, README.md, package.json, index.html, vite.config.js, server/**, tools/**) | client/src/three/**, client/src/data/**, client/scripts/** |

- 남의 영역 파일이 필요하면 고치지 말고 이 문서의 계약을 따른다. 계약에 없는 것이 필요하면 작업 끝 보고에 적는다.
- 빌드(vite build)는 통합 단계에서만 한다. 각자 확인은 개발 서버로 한다. 포트: B 5181, C 5182.

## 2. 데이터 계약: client/src/data/strata.json

```json
{
  "generatedAt": "2026-10-19T00:00:00+09:00",
  "basis": "자료 기준일 문구",
  "sources": [{ "id": "safekorea", "label": "국민안전24 안전지도", "date": "2026. 10. 18." }],
  "roles": [
    { "id": "shelter", "label": "쉼터" },
    { "id": "evac", "label": "대피" },
    { "id": "housing", "label": "임시주거" },
    { "id": "water", "label": "급수" },
    { "id": "medical", "label": "응급" },
    { "id": "sports", "label": "체육" },
    { "id": "care", "label": "돌봄" },
    { "id": "admin", "label": "행정" },
    { "id": "transit", "label": "통행" }
  ],
  "facilities": [
    {
      "id": "F001",
      "name": "이로경로당",
      "type": "경로당",
      "lon": 129.0560678, "lat": 37.4929538,
      "addr": "강원특별자치도 동해시 월평로 47-1",
      "dong": "북삼동",
      "roles": [
        { "role": "shelter", "sub": "cold", "subLabel": "한파쉼터", "cap": 30, "deptDisaster": "안전과", "deptWelfare": "가족과", "modified": "2026-01-21", "season": "20241115~20250315", "source": "safekorea" }
      ],
      "status": "open",
      "events": [
        { "id": "E001", "kind": "공사", "cause": "그린리모델링", "notice": "2026-07-30", "start": "2026-09-01", "end": "2026-11-30", "certainty": "예정", "roles": ["shelter"], "source": "나라장터 공고", "url": "" }
      ],
      "alternatives": [
        { "role": "shelter", "facilityId": "F002", "distM": 433, "climbM": 10 }
      ]
    }
  ],
  "stats": { "facilities": 0, "multiRole": 0, "threePlus": 0 }
}
```

- status: open(개방), closed(중단), check(확인 필요: 대장과 공지가 다르거나 공고만 있고 착공 미확인).
- events.start/end가 없으면 notice와 공사 기간 문구로 추정하고 certainty는 "예정". 확정 일자는 "확정".
- 역할 9종 id는 위 순서로 고정한다. 층 쌓는 순서도 이 순서다.

## 3. 3D 엔진 계약: client/src/three/Region3D.js (기존 클래스 확장)

생성자 옵션에 onPick 유지. 아래 공개 메서드를 추가한다. C는 이것만 호출한다.

| 메서드 | 설명 |
| --- | --- |
| setFacilities(facilities) | strata.json facilities 배열을 받아 시설 위에 역할 층(판)을 쌓는다 |
| setRoleFilter(roleIds) | 보일 역할 id 배열. 빈 배열이면 전부 |
| setTime(ms) | 시간축 시각. 해당 시각에 events가 걸린 역할 층은 소등(빈 자리) |
| focusFacility(id) | 카메라를 시설로 이동하고 선택 강조 |
| clearFocus() | 동해 전역 보기로 |
| showAlternatives(links) | [{ fromId, toId, role }] 대체 시설 호 |
| setHazard(kind) | 'none' 'cold' 'rain' 'tsunami' 특보 연출 |
| setSunDate(date) | 태양 위치(동해 위도 기준 실제 계산) |
| setQuality(level) | 'high' 'low' |
| onPick 콜백 | { type: 'facility', id } 또는 { type: 'none' } |
| onReady 콜백 | 지형과 건물 로드 완료 |

React 래퍼는 C가 client/src/components/map/StrataMap.jsx로 만든다(Region3D를 생성하고 위 메서드만 호출).

## 4. 화면 구조(C)

- / : 동해 3D 지도(주 화면, 전체 화면). 로그인 없이 들어온다(시연용).
- 왼쪽: 역할 9종 필터와 범례, 통계.
- 오른쪽: 시설 상세(역할 층, 운영 상태, 운영 중단 일정, 대체 시설, 담당 부서, 문서 만들기 버튼).
- 아래: 시간축(날짜 이동, 재생), 특보 선택.
- 위: 시설 검색, 장면 이동(대표 장면).
- /facility/:id/inside : 시설 속 보기(단면 투시도 이미지 위 공간 영역). 이미지는 client/public/inside/<id>.webp, 영역은 client/src/data/inside.json(A가 만든다. 없으면 C가 빈 상태 화면).
- /docs : 문서함(HWPX). 기존 문서 편집기 재사용.
- /public : 주민 공개 화면(시설별 지금 이용 가능 여부와 대체 시설).
