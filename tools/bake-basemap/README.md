# 3D 바탕 지도와 지명 굽기

`bake.js` 는 브라우저에서 돈다. OpenFreeMap 벡터 타일(OpenStreetMap 기여자, ODbL)을 받아 KRDS 회색과 파랑으로 다시 그린 이미지와 지명 목록을 돌려준다.

1. 아무 브라우저 탭의 개발자 도구 콘솔에서 `bake.js` 의 `bake` 함수를 붙여 넣는다.
2. 광역: `await bake({ bbox: [128.48608, 37.01882, 129.3841, 37.93834], zoom: 12, width: 3200, height: 3680 })`
3. 동해시 상세: `await bake({ bbox: [128.95, 37.4, 129.22, 37.64], zoom: 14, width: 4096, height: 4096, detail: true })`
4. 돌려받은 `b64` 를 `client/public/terrain/basemap-region.webp`, `basemap-detail.webp` 로 저장하고, `places` 를 합쳐 `client/src/mock/geoPlaces.js` 를 만든다(종류, 이름, 경도, 위도, 값).

범위는 `client/src/mock/geoRegion.js` 의 `BASEMAP` 과 같아야 한다.
