# 건물 입체 자료 굽기

국토교통부 GIS건물통합정보를 3D 상황판용 이진 파일로 바꾼다. GDAL 없이 Node 만 쓴다.

1. 브이월드 데이터마켓(https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18)에 로그인한다.
2. 시·도 강원특별자치도, 구분 전체데이터, 형식 SHP 로 조회해 최신 파일(AL_D010_51_YYYYMMDD.zip, 약 112MB)을 내려받아 압축을 푼다.
3. 실행한다.

```bash
npm i proj4 iconv-lite
node extract.cjs ./AL_D010_51_YYYYMMDD ../../client/public/terrain/buildings-nsdi.bin "128.48608,37.01882,129.3841,37.93834"
```

4. `client/src/mock/geoRegion.js` 의 `BUILDINGS` 기준일과 건물 수를 출력값으로 고친다.

다른 시군은 `extract.cjs` 의 `SGG`(시군구 코드)와 범위를 바꾼다. 원본 SHP 와 zip 은 저장소에 올리지 않는다(.gitignore).
