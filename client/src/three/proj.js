// proj.js 3D 상황판 좌표계. 경위도를 동해 중심 기준 평면(km)으로 바꾼다.
// x 는 동쪽, z 는 남쪽(북쪽이 화면 위), y 는 위. 길이 단위는 km, 높이만 과장 배율을 곱한다.
export const ORIGIN = [129.05, 37.5]
const KM_LON = 111.32 * Math.cos((ORIGIN[1] * Math.PI) / 180)
const KM_LAT = 110.574
// 지형과 건물과 침수 수위는 같은 실척 1배를 쓴다
export const EXAG = 1.0

export const toXZ = (lon, lat) => [(lon - ORIGIN[0]) * KM_LON, -(lat - ORIGIN[1]) * KM_LAT]
export const toLonLat = (x, z) => [ORIGIN[0] + x / KM_LON, ORIGIN[1] - z / KM_LAT]
