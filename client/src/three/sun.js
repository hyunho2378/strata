// sun.js 동해 장면의 태양 위치. 외부 라이브러리 없이 천문 근사식을 직접 구현한다.
// 내부 표준은 북쪽 0도, 동쪽 90도, 남쪽 180도, 서쪽 270도의 방위각(도)과 고도(도)다.
// 날짜를 바꾸면 그 날짜의 적위를 다시 계산한다. 계절별 일출 방위가 북동과 남동 사이로 움직인다.
// 계산값은 대기 굴절을 넣지 않은 기하학적 위치이므로 공표 일출 시각과는 구분한다.

const RAD = Math.PI / 180
const OBLIQUITY = 23.4397 * RAD   // 지구 자전축 기울기
const PERIHELION = 102.9372 * RAD // 근일점 황경

// 2000년 1월 1일 정오(UT)를 기준으로 한 경과일
const toDays = (date) => date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545

const solarMeanAnomaly = (d) => RAD * (357.5291 + 0.98560028 * d)

const eclipticLongitude = (M) => {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  return M + C + PERIHELION + Math.PI
}

const declination = (L) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(L))
const rightAscension = (L) => Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L))
const siderealTime = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw

// 태양 고도와 방위각. date 는 Date, lat 과 lon 은 도 단위
export function solarPosition(date, lat = 37.5247, lon = 129.1142) {
  const lw = RAD * -lon
  const phi = RAD * lat
  const d = toDays(date instanceof Date ? date : new Date(date))
  const M = solarMeanAnomaly(d)
  const L = eclipticLongitude(M)
  const dec = declination(L)
  const ra = rightAscension(L)
  const H = siderealTime(d, lw) - ra
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  // 남쪽 기준 방위를 북쪽 기준 도 값으로 바꿔 저장한다. 두 관례를 섞지 않는다
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  const azimuth = ((azSouth / RAD + 180) % 360 + 360) % 360
  return { altitudeDeg: altitude / RAD, azimuthDeg: azimuth, declinationDeg: dec / RAD }
}

// 엔진 축(x 동쪽, y 위쪽, z 남쪽)에 맞춘 태양 방향 단위벡터
export function sunDirection(date, lat, lon) {
  const { altitudeDeg, azimuthDeg } = solarPosition(date, lat, lon)
  const h = altitudeDeg * RAD
  const A = azimuthDeg * RAD
  return {
    x: Math.cos(h) * Math.sin(A),
    y: Math.sin(h),
    z: -Math.cos(h) * Math.cos(A),
    altitudeDeg,
    azimuthDeg
  }
}

// 하늘과 바다가 함께 쓰는 광원 등급. 고도에 따라 색온도와 세기를 정한다
export function sunGrade(altitudeDeg) {
  const a = altitudeDeg
  const day = Math.max(0, Math.min(1, (a - 2) / 18))          // 낮의 중성 노출
  const dawn = Math.max(0, Math.min(1, 1 - Math.abs(a - 3) / 9)) // 일출과 일몰의 따뜻한 빛
  const night = Math.max(0, Math.min(1, (-a - 2) / 6))
  return { day, dawn, night, intensity: 0.15 + 2.5 * day + 0.9 * dawn }
}
