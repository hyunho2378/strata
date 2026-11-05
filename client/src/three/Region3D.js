// Region3D.js 서비스 주 화면의 3D 장면. three.js 로 동해시와 접경 시군(강릉시 옥계면 포함, 삼척시, 정선군, 태백시)을 읍면동 조각으로 쪼개 세운다.
// 조각마다 실제 고도(AWS Terrain Tiles)로 만든 지형과 옆면을 갖고, 각자 떠오르거나 벌어진다.
// 동해시 행정동 조각은 데이터(부족분, 고령화율)에 따라 색과 솟는 높이가 달라지고, 그 위에 마을 기둥, 대피소, 산불 방향 화살표가 놓인다.
// React 와는 이 클래스의 메서드로만 이야기한다(Map3D.jsx). 모든 길이는 km.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { colors, krds } from '../tokens.js'
import { BASEMAP, BUILDINGS, DEM_META, REGION_BBOX, REGION_PIECES } from '../mock/geoRegion.js'
import { PLACES } from '../mock/geoPlaces.js'
import { DONG_GEO } from '../mock/geoDonghae.js'
import { SEVERITY_COLOR } from '../components/map/mapTheme.js'
import { BASE_Y, makeDem, topOf } from './terrainBuild.js'
import { EXAG, ORIGIN, toLonLat, toXZ } from './proj.js'
import TerrainWorker from './terrain.worker.js?worker'
import { renderLocal } from './localBasemap.js'
import { ROLE_ORDER, RENDER, ROLE_COLOR } from './palette.js'
import { solarPosition, sunDirection, sunGrade } from './sun.js'
import { buildCoastMask, makeOceanMaterial } from './ocean.js'
import RoleLayers from './roleLayers.js'
import Arcs from './arcs.js'
import Hazard, { TSUNAMI_LEVEL_M } from './hazard.js'
import { makeComposer } from './post.js'
import FloorSlabs, { floorPlan } from './floorSlabs.js'
import FacilityPins from './facilityPins.js'
import { renderOffscreen } from './thumbnail.js'
import { LEVELS, PRESET, FrameMonitor, detectTier, stepLevel } from './quality.js'

// 동해 대표 계산점(태양 위치 기준). 한국 표준시를 쓴다
const SUN_AT = { lat: 37.5247, lon: 129.1142 }
const DEFAULT_SUN_DATE = new Date('2026-10-19T09:20:00+09:00')

const DONGHAE = '51170'
// 조각 안쪽 점 간격(km). 가까운 동해시는 촘촘하게, 먼 곳은 성기게
const SPACING = { 51170: 0.08, 51150: 0.5, 51230: 0.5, 51770: 0.7, 51190: 0.7 }
const SGG_LABEL = { 51150: '강릉시', 51230: '삼척시', 51770: '정선군', 51190: '태백시' }
// 동해시 생활권 범위(북평, 천곡, 발한, 묵호, 망상 해안 시가지). 첫 화면과 전체 보기와 패닝 범위를 여기로 한정한다
const CITY_BBOX = [129.068, 37.452, 129.155, 37.578]
// 첫 화면 중심: 동해시청 일대(천곡동)
const CITY_CENTER = [129.1142, 37.5247]
const MAX_DIST = 13     // 최대 줌아웃 거리(km). 정선과 강릉 산악까지 물러나지 않는다
const MIN_DIST = 0.08   // 최소 거리(km). 건물 한 동 단위
const CITY_XZ = (() => {
  const [x0, z1] = toXZ(CITY_BBOX[0], CITY_BBOX[1])
  const [x1, z0] = toXZ(CITY_BBOX[2], CITY_BBOX[3])
  const m = 0.6
  return { x0: x0 - m, x1: x1 + m, z0: z0 - m, z1: z1 + m }
})()
const REST_EXPLODE = 0      // 평소 벌어짐. 중심에서 30km 떨어진 조각이 0.6km 밀려나고, 이웃한 조각 사이는 0.1~0.3km 벌어진다
const WIDE_EXPLODE = 0.045     // 펼치기
const LIFT_MAX = 0             // 행정동 조각은 솟지 않는다. 부족은 건물 색과 땅 위 원으로 보인다
const PERSON_KM = 0.02         // 기둥 높이, 1명당
const FIRE_Y = 1.25            // 산불 화살표는 솟은 조각 위로 띄운다

const THEME = {
  light: {
    bg: colors.canvas, land: colors.mute, sea: colors.primary.soft, seaEdge: colors.primary.line, plain: '#f1f3f5', far: '#dde3e8',
    line: colors.line.strong, label: colors.text.pri, labelFar: colors.text.meta, ink: colors.text.pri, shelter: colors.primary.DEFAULT,
    highlight: colors.primary.DEFAULT, hemiSky: colors.page, hemiGround: colors.line.def, sun: colors.page,
    building: '#f2f4f5', buildingFar: '#e6e9ec', buildingScope: colors.primary.soft
  },
  dark: {
    bg: colors.text.pri, land: colors.text.sec, sea: krds.primary[80], seaEdge: krds.primary[70], plain: colors.line.strong, far: colors.text.ter,
    line: colors.text.ter, label: colors.page, labelFar: colors.line.strong, ink: colors.page, shelter: colors.primary.line,
    highlight: colors.primary.line, hemiSky: colors.line.def, hemiGround: colors.text.sec, sun: colors.page,
    building: colors.line.def, buildingFar: colors.text.ter, buildingScope: colors.primary.line
  }
}
const AGING = [[0, colors.chart.heat[1]], [25, colors.chart.heat[1]], [35, colors.chart.heat[2]], [45, colors.chart.heat[3]]]

const colorDist = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)
const ease = (t) => 1 - (1 - t) ** 3
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2)

function pointInPoly(lon, lat, coordinates) {
  for (const poly of coordinates) {
    let inside = false
    for (const r of poly) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j]
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
      }
    }
    if (inside) return true
  }
  return false
}

async function loadDem() {
  const res = await fetch(import.meta.env.BASE_URL + 'terrain/region-dem.png')
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  const cv = new OffscreenCanvas(bmp.width, bmp.height)
  const g = cv.getContext('2d', { willReadFrequently: true })
  g.drawImage(bmp, 0, 0)
  const px = g.getImageData(0, 0, bmp.width, bmp.height).data
  const out = new Float32Array(bmp.width * bmp.height)
  for (let i = 0; i < out.length; i++) out[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / DEM_META.scale
  return out
}

export default class Region3D {
  constructor(box, { theme = 'light', reducedMotion = false, onHover, onPick, onProgress, onReady, onBuildings, onQuality } = {}) {
    this.box = box
    // 개발 서버에서만 실측 검수용 참조를 연다. 화면과 데이터에는 영향을 주지 않는다
    if (import.meta.env.DEV) box.__strataScene = this
    this.theme = theme
    this.reduced = reducedMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    this.cb = { onHover, onPick, onProgress, onReady, onBuildings, onQuality }
    this.pieces = new Map()         // code -> piece state
    this.pillars = new Map()        // village code -> 땅 위 원과 숫자 표식
    this.buildingMeshes = new Map() // piece code -> 건물 덩어리
    this.buildingMats = []
    this.labelEls = []
    this.markerInfo = []
    this.dirty = true
    this.explodeTarget = REST_EXPLODE
    this.explode = REST_EXPLODE
    this.introStart = performance.now()
    this.tweens = []
    // 바탕 지도 이미지(광역 + 동해시 상세). 불러오기 전에는 흰색 한 칸이라 지형만 보인다
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    white.needsUpdate = true
    const bbXZ = (bb) => { const [x0, zN] = toXZ(bb[0], bb[3]); const [x1, zS] = toXZ(bb[2], bb[1]); return new THREE.Vector4(x0, zN, x1 - x0, zS - zN) }
    this.texUniforms = {
      uRegionTex: { value: white }, uDetailTex: { value: white },
      uRegionBox: { value: bbXZ(BASEMAP.region.bbox) }, uDetailBox: { value: bbXZ(BASEMAP.detail.bbox) },
      uTexAmount: { value: 0 },
      uLocalTex: { value: white }, uLocalBox: { value: new THREE.Vector4(0, 0, 1, 1) }, uLocalAmt: { value: 0 }
    }
    this.layers = { shortage: true, dongs: true, fire: true, shelters: true, vehicles: false, ltc: false, aging: false }
    this.data = { villages: [], vehicles: [], shelters: [], ltc: [], fire: null, selected: null, dongStats: {}, colorMode: 'shortage' }
    this.hoverCode = null
    this.selectedPiece = null
    this.padding = { left: 0, right: 0, top: 0, bottom: 0 }

    const w = box.clientWidth || 800
    const h = box.clientHeight || 600
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false })
    // 장치 등급 판정. 시작 등급은 여기서 정하고 실행 중에는 프레임 시간으로 올리고 내린다
    this.gpu = detectTier()
    this.qualityMode = 'auto'
    this.quality = this.gpu.webgl2 ? this.gpu.tier : 'low'
    this.frameMon = new FrameMonitor()
    this.maxLabels = PRESET[this.quality].maxLabels
    this.buildingKm = PRESET[this.quality].buildingKm
    this.oceanDetail = PRESET[this.quality].ocean
    this.viewMode = '3d'
    this.renderer.setPixelRatio(this.wantPixelRatio())
    this.renderer.setSize(w, h)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // 톤매핑은 후처리 마지막 단계에서 한 번만 적용된다(렌더 타깃에 그리는 동안 재질 단계는 꺼진다)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    // 밝은 낮 장면. 지면과 건물이 흰 계열로 읽히는 노출이다
    this.renderer.toneMappingExposure = 1.12
    this.renderer.info.autoReset = false
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    box.appendChild(this.renderer.domElement)
    this.labels = new CSS2DRenderer()
    this.labels.setSize(w, h)
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '0', isolation: 'isolate', overflow: 'hidden' })
    box.appendChild(this.labels.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.01, 900)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    // 기울기는 15도에서 73도 사이, 줌은 커서 위치 기준, 관성은 부드럽게 둔다
    this.controls.minPolarAngle = (15 * Math.PI) / 180
    this.controls.maxPolarAngle = (73 * Math.PI) / 180
    this.controls.minDistance = MIN_DIST
    this.controls.maxDistance = MAX_DIST
    this.controls.zoomToCursor = true
    this.controls.zoomSpeed = 0.75
    this.controls.rotateSpeed = 0.55
    this.controls.panSpeed = 0.9
    this.controls.screenSpacePanning = false
    this.controls.addEventListener('change', () => { this.dirty = true; this.labelsDirty = true; this.movedAt = performance.now(); this.scheduleLocal() })

    this.root = new THREE.Group()
    this.scene.add(this.root)
    this.arrowGroup = new THREE.Group()
    this.scene.add(this.arrowGroup)
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    this.applyTheme(theme, true)
    this.buildSky()
    this.buildSea()
    this.setupLights()
    this.sunDate = DEFAULT_SUN_DATE
    this.applySun()
    this.facilityBuilding = new Map()   // 시설 id -> { code, bi, roofY }
    this.roleLayers = new RoleLayers({
      parent: this.scene,
      heightAt: (lon, lat) => this.heightAt(lon, lat),
      toXZ,
      // 역할 층은 그 시설의 실제 건물 지붕 위에 올린다
      roofAt: (f) => this.facilityBuilding.get(f.id)?.roofY ?? null
    })
    this.arcs = new Arcs({ parent: this.scene })
    // 건물 층 분리와 공공시설 핀
    this.slabs = new FloorSlabs({ parent: this.scene })
    this.pins = new FacilityPins({
      parent: this.scene,
      toXZ,
      heightAt: (lon, lat) => this.heightAt(lon, lat),
      roofAt: (f) => this.facilityBuilding.get(f.id)?.roofY ?? null,
      onPick: (p) => { this.selectFacilityBuilding(p.id); this.cb.onPick?.(p) }
    })
    this.hazard = new Hazard({ parent: this.scene, toXZ, exag: EXAG })
    this.hazardKind = 'none'
    this.timeMs = null
    this.focusId = null
    this.buildComposer(w, h)
    this.applyQuality(this.quality)
    this.bindEvents()
    this.setView(this.cityView(), true)
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
    this.loadBasemap()
    this.load()
  }

  // ---------- 준비 ----------
  setupLights() {
    const t = THEME[this.theme]
    this.hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, 0.85)
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.00008
    this.sun.shadow.normalBias = 0.004
    this.sunTarget = new THREE.Object3D()
    this.sun.target = this.sunTarget
    // 차가운 주변광. 일출에는 따뜻한 태양광과 분리된다
    this.fill = new THREE.DirectionalLight(0xbcd6f2, 0.28)
    this.fill.position.set(-40, 24, 60)
    this.scene.add(this.hemi, this.sun, this.sunTarget, this.fill)
  }

  // 하늘. Preetham 계열 Sky 한 장을 태양 방향과 함께 갱신한다
  buildSky() {
    this.sky = new Sky()
    // 카메라 멀리 평면 안에 들어오도록 크기를 제한하고 매 프레임 카메라를 따라간다
    this.sky.scale.setScalar(600)
    this.sky.material.uniforms.turbidity.value = 4.2
    this.sky.material.uniforms.rayleigh.value = 1.6
    this.sky.material.uniforms.mieCoefficient.value = 0.006
    this.sky.material.uniforms.mieDirectionalG.value = 0.84
    this.scene.add(this.sky)
    this.scene.background = null
  }

  buildComposer(w, h) {
    try {
      const made = makeComposer({ renderer: this.renderer, scene: this.scene, camera: this.camera, width: w, height: h, quality: this.quality })
      this.composer = made.composer
      this.passes = made.passes
      // 선형 깊이 버퍼로 AO 와 바다와 지형을 같은 깊이 기준에서 합성한다
      if (this.passes.ao) this.passes.ao.enabled = true
      this.aoWanted = true
    } catch (err) {
      this.composer = null
      console.warn('후처리를 건너뛴다', err?.message || err)
    }
  }

  // 태양 하나를 하늘과 방향광과 바다가 함께 쓴다
  applySun() {
    const d = sunDirection(this.sunDate, SUN_AT.lat, SUN_AT.lon)
    const dir = new THREE.Vector3(d.x, d.y, d.z).normalize()
    this.sunDir = dir
    const g = sunGrade(d.altitudeDeg)
    const center = this.controls?.target || new THREE.Vector3()
    this.sun.position.copy(center).add(dir.clone().multiplyScalar(40))
    this.sunTarget.position.copy(center)
    this.sun.intensity = g.intensity
    // 낮은 태양은 따뜻하게, 높은 태양은 중성으로
    this.sun.color.copy(new THREE.Color('#ffffff').lerp(new THREE.Color('#ffb067'), Math.min(1, g.dawn)))
    this.hemi.intensity = 0.35 + 0.6 * g.day + 0.25 * g.dawn
    if (this.sky) {
      this.sky.material.uniforms.sunPosition.value.copy(dir)
      this.sky.material.uniforms.rayleigh.value = this.hazardKind === 'cold' ? 2.4 : this.hazardKind === 'rain' ? 0.6 : 1.6 + g.dawn * 1.4
      this.sky.material.uniforms.turbidity.value = this.hazardKind === 'rain' ? 12 : this.hazardKind === 'cold' ? 2.6 : 4.2
      this.sky.material.uniforms.mieCoefficient.value = 0.004 + g.dawn * 0.012
    }
    if (this.oceanUniforms) {
      this.oceanUniforms.uSunDir.value.copy(dir)
      this.oceanUniforms.uSunColor.value.copy(this.sun.color).multiplyScalar(0.7 + 0.6 * g.day)
      this.oceanUniforms.uSkyHigh.value.copy(new THREE.Color('#2f6fb8').lerp(new THREE.Color('#c98a4e'), g.dawn * 0.7))
      this.oceanUniforms.uSkyLow.value.copy(new THREE.Color('#cfe0ef').lerp(new THREE.Color('#f0c39a'), g.dawn * 0.8))
    }
    this.renderer.shadowMap.needsUpdate = true
    this.dirty = true
    return { altitudeDeg: d.altitudeDeg, azimuthDeg: d.azimuthDeg }
  }

  applyTheme(theme, first = false) {
    this.theme = theme
    const t = THEME[theme]
    // 배경은 Sky 가 맡고 장면에는 얇은 거리 안개 한 겹만 남긴다
    // 가까이 보는 생활권은 선명하게, 경계 밖 산줄기는 거리가 멀어질수록 대비를 잃는다
    this.scene.fog = new THREE.Fog(new THREE.Color(RENDER.fogDay), 4, 42)
    if (first) return
    this.hemi.color.set(t.hemiSky); this.hemi.groundColor.set(t.hemiGround)
    this.buildSea()
    this.applySun?.()
    for (const p of this.pieces.values()) { p.lineMat.color.set(t.line); this.paintPiece(p, true) }
    for (const l of this.labelEls) l.refresh?.()
    this.paintBuildings()
    this.dirty = true
  }

  // 바다 판. 위쪽 무늬는 캔버스로 그린다(바다는 파랑, 육지 자리는 회색). 육지 조각이 떠오르면 이 판이 바닥이 된다
  buildSea() {
    if (this.sea) { this.scene.remove(this.sea); this.sea.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.() }) }
    const t = THEME[this.theme]
    const [w, s, e, n] = REGION_BBOX
    const m = 0.05
    const [x0, z0] = toXZ(w - m, n + m)
    const [x1, z1] = toXZ(e + m, s - m)
    const W = x1 - x0, D = z1 - z0
    const px = 2048
    const cv = document.createElement('canvas')
    cv.width = px; cv.height = Math.round((px * D) / W)
    const g = cv.getContext('2d')
    g.fillStyle = t.sea; g.fillRect(0, 0, cv.width, cv.height)
    g.fillStyle = t.land
    const tx = (lon) => (((toXZ(lon, 0)[0]) - x0) / W) * cv.width
    const ty = (lat) => (((toXZ(0, lat)[1]) - z0) / D) * cv.height
    for (const p of REGION_PIECES) {
      for (const poly of p.coordinates) {
        g.beginPath()
        for (const r of poly) { r.forEach(([lon, lat], i) => (i ? g.lineTo(tx(lon), ty(lat)) : g.moveTo(tx(lon), ty(lat)))); g.closePath() }
        g.fill('evenodd')
      }
    }
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    // 바다 상면은 수심색과 두 겹 노멀과 프레넬과 태양 정반사를 가진 셰이더로 그린다
    const mask = buildCoastMask(REGION_PIECES, toXZ, { x0, z0, w: W, d: D }, 2048)
    const ocean = makeOceanMaterial({ maskTexture: mask, box: { x0, z0, w: W, d: D } })
    this.oceanUniforms = ocean.uniforms
    const top = ocean.material
    const side = new THREE.MeshBasicMaterial({ color: new THREE.Color(RENDER.seaDeep) })
    const geo = new THREE.BoxGeometry(W, 0.9, D)
    this.sea = new THREE.Mesh(geo, [side, side, top, side, side, side])
    this.sea.position.set((x0 + x1) / 2, -0.02 - 0.45, (z0 + z1) / 2)
    this.scene.add(this.sea)
  }

  async load() {
    try {
      const data = await loadDem()
      this.dem = makeDem(data, DEM_META)
      const worker = new TerrainWorker()
      this.worker = worker
      const total = REGION_PIECES.length
      worker.onmessage = (e) => {
        const m = e.data
        if (m.type === 'piece') {
          this.addPiece(m.piece)
          this.cb.onProgress?.(m.n / total)
        } else if (m.type === 'done') {
          this.ready = true
          // 지형이 온 뒤에 역할 층의 높이를 다시 잡는다
          if (this.facilities?.length) this.roleLayers.setFacilities(this.facilities)
          if (this.hazardKind && this.hazardKind !== 'none') this.setHazard(this.hazardKind)
          this.markSggLabels()
          this.buildPlaceLabels()
          this.refreshData()
          this.updateLocal()

        } else if (m.type === 'buildings') {
          this.addBuildings(m.b)
        } else if (m.type === 'buildingsDone' || m.type === 'buildingsError') {
          if (m.type === 'buildingsError') console.error('건물 입체 오류', m.message)
          this.buildingsTotal = m.total || 0
          // 건물이 다 온 뒤에 시설과 건물을 짝짓고 역할 층을 지붕 높이로 다시 올린다
          this.matchFacilityBuildings()
          if (this.facilities?.length) {
            this.roleLayers.setFacilities(this.facilities)
            if (this.timeMs != null) this.roleLayers.setTime(this.timeMs)
          }
          this.cb.onReady?.()
          this.cb.onBuildings?.(m.type === 'buildingsDone' ? { total: m.total } : { error: m.message })
          this.paintBuildings()
          worker.terminate()
          this.worker = null
        }
      }
      worker.postMessage({ data, meta: DEM_META, pieces: REGION_PIECES, spacing: SPACING, first: [DONGHAE], buildings: { url: BUILDINGS.url, bbox: BUILDINGS.bbox } })
    } catch (err) {
      this.cb.onProgress?.(-1, err)
    }
  }

  heightAt(lon, lat) { return this.dem ? (this.dem.sample(lon, lat) / 1000) * EXAG : 0 }

  // ---------- 바탕 지도 ----------
  // 지형 윗면 재질. 조각 안 위치(세계 좌표)로 광역 이미지와 동해시 상세 이미지를 읽어 입힌다. 상세 이미지 가장자리는 부드럽게 섞는다
  makeTopMaterial(color) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, color, side: THREE.DoubleSide })
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.texUniforms)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vTexXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTexXZ = position.xz;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vTexXZ;\nuniform sampler2D uRegionTex;\nuniform sampler2D uDetailTex;\nuniform vec4 uRegionBox;\nuniform vec4 uDetailBox;\nuniform float uTexAmount;\nuniform sampler2D uLocalTex;\nuniform vec4 uLocalBox;\nuniform float uLocalAmt;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 uvR = (vTexXZ - uRegionBox.xy) / uRegionBox.zw;
        vec3 baseTex = texture2D(uRegionTex, clamp(uvR, 0.0, 1.0)).rgb;
        vec2 uvD = (vTexXZ - uDetailBox.xy) / uDetailBox.zw;
        float eD = min(min(uvD.x, uvD.y), min(1.0 - uvD.x, 1.0 - uvD.y));
        float wD = smoothstep(0.0, 0.03, eD);
        vec3 detTex = texture2D(uDetailTex, clamp(uvD, 0.0, 1.0)).rgb;
        vec3 tex = mix(baseTex, detTex, wD);
        vec2 uvL = (vTexXZ - uLocalBox.xy) / uLocalBox.zw;
        float eL = min(min(uvL.x, uvL.y), min(1.0 - uvL.x, 1.0 - uvL.y));
        float wL = smoothstep(0.0, 0.06, eL) * uLocalAmt;
        tex = mix(tex, texture2D(uLocalTex, clamp(uvL, 0.0, 1.0)).rgb, wL);
        // 밝은 낮 지면. 굽은 바탕 지도가 어두워 한 단계 띄우고 대비를 낮춘다
        tex = mix(tex, vec3(1.0), 0.22);
        diffuseColor.rgb *= mix(vec3(1.0), tex, uTexAmount);`)
    }
    return mat
  }

  loadBasemap() {
    const loader = new THREE.TextureLoader()
    const aniso = this.renderer.capabilities.getMaxAnisotropy()
    const get = (url) => new Promise((res) => loader.load(url, (t) => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, aniso); res(t) }, undefined, () => res(null)))
    Promise.all([get(BASEMAP.region.url), get(BASEMAP.detail.url)]).then(([r, d]) => {
      if (!this.texUniforms) return
      if (r) this.texUniforms.uRegionTex.value = r
      if (d) this.texUniforms.uDetailTex.value = d
      this.texUniforms.uTexAmount.value = r || d ? 1 : 0
      this.dirty = true
    })
  }

  // ---------- 가까이 볼 때 바탕 ----------
  // 카메라 거리 10km 안이면 카메라가 보는 곳 둘레를 골목 단위로 다시 그린다(0.35초 멈춘 뒤)
  scheduleLocal() {
    clearTimeout(this.localTimer)
    this.localTimer = setTimeout(() => this.updateLocal(), 350)
  }

  async updateLocal() {
    if (!this.ready) return
    const dist = this.camera.position.distanceTo(this.controls.target)
    if (dist > MAX_DIST + 1) {
      if (this.texUniforms.uLocalAmt.value) { this.texUniforms.uLocalAmt.value = 0; this.dirty = true }
      this.setRoadLabels([])
      this.localKey = null
      return
    }
    // 카메라가 멈추면 그 둘레의 그림자도 같이 옮긴다
    this.enableNearShadow(this.controls.target.x, this.controls.target.z, Math.min(2.6, Math.max(0.7, dist * 0.55)))
    const size = Math.min(12, Math.max(2.4, dist * 2.2))
    const [lon, lat] = toLonLat(this.controls.target.x, this.controls.target.z)
    const L = this.localState
    if (L && Math.hypot(L.x - this.controls.target.x, L.z - this.controls.target.z) < L.size * 0.22 && Math.abs(L.size - size) / L.size < 0.45) {
      this.texUniforms.uLocalAmt.value = 1; this.dirty = true
      return
    }
    const half = size / 2
    const [w, n] = toLonLat(this.controls.target.x - half, this.controls.target.z - half)
    const [e, s] = toLonLat(this.controls.target.x + half, this.controls.target.z + half)
    this.localAbort?.abort()
    const ctl = new AbortController()
    this.localAbort = ctl
    const out = await renderLocal([w, s, e, n], 2048, ctl.signal)
    if (!out || ctl.signal.aborted || !this.texUniforms) return
    const tex = new THREE.CanvasTexture(out.canvas)
    tex.flipY = false
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    const old = this.texUniforms.uLocalTex.value
    this.texUniforms.uLocalTex.value = tex
    const [x0, zN] = toXZ(w, n); const [x1, zS] = toXZ(e, s)
    this.texUniforms.uLocalBox.value.set(x0, zN, x1 - x0, zS - zN)
    this.texUniforms.uLocalAmt.value = 1
    if (old && old !== tex && old.isCanvasTexture) old.dispose()
    this.localState = { x: this.controls.target.x, z: this.controls.target.z, size, lon, lat }
    this.setRoadLabels(out.roads)
    this.dirty = true
  }

  // 길 이름표. 지명과 같은 겹침 규칙을 쓴다
  setRoadLabels(roads) {
    for (const L of this.roadLabels || []) L.obj.parent?.remove(L.obj)
    this.roadLabels = []
    const t = THEME[this.theme]
    for (const r of roads) {
      const piece = this.pieceAt(r.lon, r.lat)
      if (!piece) continue
      const el = document.createElement('span')
      el.className = 'type-caption'
      Object.assign(el.style, { whiteSpace: 'nowrap', color: t.labelFar, fontSize: '11px', textShadow: this.theme === 'dark' ? '0 0 3px rgba(0,0,0,0.9)' : '0 0 3px rgba(255,255,255,1), 0 0 6px rgba(255,255,255,0.9)' })
      el.textContent = r.name
      const obj = new CSS2DObject(el)
      const [x, z] = toXZ(r.lon, r.lat)
      obj.position.set(x, this.heightAt(r.lon, r.lat) + 0.03, z)
      obj.visible = false
      piece.group.add(obj)
      this.roadLabels.push({ obj, prio: 35 + Math.min(20, r.len / 400), near: 9, w: r.name.length * 11 + 14, h: 18 })
    }
    this.labelsDirty = true
  }

  // ---------- 조각 ----------
  addPiece(r) {
    const meta = REGION_PIECES.find((p) => p.code === r.code)
    const t = THEME[this.theme]
    const isDong = meta.sgg === DONGHAE
    const dongCode = isDong ? DONG_GEO.find((d) => d.admCd === meta.code)?.code : null
    const topGeo = new THREE.BufferGeometry()
    topGeo.setAttribute('position', new THREE.BufferAttribute(r.pos, 3))
    topGeo.setAttribute('color', new THREE.BufferAttribute(r.col, 3))
    topGeo.setIndex(new THREE.BufferAttribute(r.idx, 1))
    topGeo.computeVertexNormals()
    topGeo.computeBoundingBox(); topGeo.computeBoundingSphere()
    // 동해시 조각은 바탕 지도와 도로가 입혀진 재질, 경계 밖은 대비 낮은 단색이다
    const topMat = isDong
      ? this.makeTopMaterial(new THREE.Color(t.plain))
      : new THREE.MeshStandardMaterial({ color: new THREE.Color(t.far), roughness: 1, metalness: 0, side: THREE.DoubleSide })
    const top = new THREE.Mesh(topGeo, topMat)
    const wallGeo = new THREE.BufferGeometry()
    wallGeo.setAttribute('position', new THREE.BufferAttribute(r.wallPos, 3))
    wallGeo.setAttribute('color', new THREE.BufferAttribute(r.wallCol, 3))
    wallGeo.setIndex(new THREE.BufferAttribute(r.wallIdx, 1))
    wallGeo.computeVertexNormals()
    const wallMat = new THREE.MeshStandardMaterial({ vertexColors: isDong, roughness: 1, metalness: 0, color: new THREE.Color(isDong ? t.plain : t.far), side: THREE.DoubleSide })
    const wall = new THREE.Mesh(wallGeo, wallMat)
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(r.line, 3))
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(t.line), transparent: true, opacity: 0.9 })
    const lines = new THREE.LineSegments(lineGeo, lineMat)
    // 경계 밖 조각의 윤곽선은 그리지 않는다. 원거리 얇은 선이 자글거림의 주 원인이다
    lines.visible = isDong
    const group = new THREE.Group()
    group.add(top, wall, lines)
    this.root.add(group)
    const [cx, cz] = toXZ(meta.centroid[0], meta.centroid[1])
    const [c0x, c0z] = toXZ(129.1, 37.52)
    const p = {
      code: r.code, meta, group, top, wall, lines, lineMat, topMat, wallMat, isDong, dongCode,
      cx, cz, ox: cx - c0x, oz: cz - c0z, lift: 0, liftTarget: 0, hover: 0, intro: 0,
      delay: Math.hypot(cx - c0x, cz - c0z) * 0.012, tint: new THREE.Color(isDong ? t.plain : t.far), tintTarget: new THREE.Color(isDong ? t.plain : t.far)
    }
    top.userData.piece = p
    this.pieces.set(r.code, p)
    // 이름표는 동해시 행정동만 둔다. 주변 시군 이름은 화면에서 뺀다
    if (isDong) this.addLabel(p)
    this.applyPiecePos(p)
    this.dirty = true
  }

  // 조각 이름표. 동해시 행정동은 항상, 다른 시군은 시군 이름 하나만(가까이 가면 읍면동 이름도)
  addLabel(p) {
    const el = document.createElement('div')
    const span = document.createElement('span')
    span.textContent = p.meta.name
    el.appendChild(span)
    const refresh = () => {
      const t = THEME[this.theme]
      span.style.color = p.isDong ? t.label : t.labelFar
    }
    span.className = p.isDong ? 'type-caption' : 'type-caption'
    span.style.fontWeight = p.isDong ? '700' : '400'
    span.style.textShadow = this.theme === 'dark' ? 'none' : '0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8)'
    refresh()
    const obj = new CSS2DObject(el)
    const [lon, lat] = p.meta.centroid
    // 조각 안 좌표는 세계 좌표 그대로이고 그룹은 이동량만 갖는다
    obj.position.set(p.cx, this.heightAt(lon, lat) + 0.25, p.cz)
    p.group.add(obj)
    p.label = obj
    p.labelEl = el
    this.labelEls.push({ p, el, refresh })
  }

  applyPiecePos(p) {
    const e = this.explode
    p.group.position.set(p.ox * e, p.lift + (1 - p.intro) * -3, p.oz * e)
  }

  // 조각 색. 동해시는 데이터 색, 그 밖은 중립 회색
  paintPiece(p, instant = false) {
    const t = THEME[this.theme]
    const st = p.dongCode ? this.data.dongStats[p.dongCode] : null
    const base = new THREE.Color(p.isDong ? t.plain : t.far)
    let side = base.clone().multiplyScalar(0.9)
    let top = base.clone()
    if (p.isDong && st) {
      let data = null
      if (this.layers.aging) {
        let col = AGING[0][1]
        for (const [min, cc] of AGING) if (st.aging >= min) col = cc
        data = new THREE.Color(col)
      } else if (this.data.colorMode === 'shortage' && this.layers.shortage && st.level > 0) {
        data = new THREE.Color(SEVERITY_COLOR[st.level])
      }
      // 윗면은 바탕 지도가 읽히도록 18%만 물들이고, 옆면이 데이터 색을 진하게 진다
      if (data) top = base.clone().lerp(data, 0.1)
    }
    p.tintTarget.copy(top)
    p.sideTarget = side
    if (instant) { p.tint.copy(top); p.topMat.color.copy(top); p.wallMat.color.copy(side) }
    this.dirty = true
  }

  // ---------- 건물 ----------
  addBuildings(b) {
    const p = this.pieces.get(b.code)
    if (!p) return
    // 동해시 경계 밖 건물은 세우지 않는다. 드로우콜과 삼각형을 생활권에만 쓴다
    if (!p.isDong) return
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(b.pos, 3))
    geo.setIndex(new THREE.BufferAttribute(b.idx, 1))
    const col = new Uint8Array(b.bid.length * 3).fill(255)
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true))
    geo.computeBoundingSphere()
    // 면 방향 음영은 화면에서 계산(flatShading). 꼭짓점을 건물마다 윗고리 아랫고리만 둬서 메모리를 아낀다
    // 재질은 무광 중성 회색의 MeshStandardMaterial. 건물은 공간의 기준점이므로 역할 색으로 칠하지 않는다
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: RENDER.buildingRough, metalness: 0 })
    this.buildingMats.push(mat)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    mesh.userData.buildings = { code: b.code }
    p.group.add(mesh)
    // 건물마다 꼭짓점이 어디서 어디까지인지 기록해 둔다. 시설 좌표가 어느 건물 안인지 찾는 데 쓴다
    const starts = new Uint32Array(b.count)
    const lens = new Uint32Array(b.count)
    let cur = -1
    for (let k = 0; k < b.bid.length; k++) {
      const id = b.bid[k]
      if (id !== cur) { cur = id; starts[id] = k }
      lens[id] = k - starts[id] + 1
    }
    // code 를 기록에 같이 둔다. 시설과 건물을 짝지을 때 조각 코드로 되찾는다
    const rec = { code: b.code, mesh, geo, col, bid: b.bid, info: b.info, count: b.count, piece: p, pos: b.pos, starts, lens }
    this.buildingMeshes.set(b.code, rec)
    // 건물을 집을 때 교차한 메쉬에서 바로 기록을 찾기 위해 되돌린다
    mesh.userData.B = rec
    this.dirty = true
  }

  // 건물 한 동의 지붕 고리(앞에 쌓인 절반)에 점이 들어있는지 본다
  pointInBuilding(B, bi, x, z) {
    const m = B.lens[bi] / 2
    const s = B.starts[bi]
    let inside = false
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const xi = B.pos[(s + i) * 3], zi = B.pos[(s + i) * 3 + 2]
      const xj = B.pos[(s + j) * 3], zj = B.pos[(s + j) * 3 + 2]
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
    }
    return inside
  }

  roofYOf(B, bi) {
    const m = B.lens[bi] / 2
    const s = B.starts[bi]
    let y = -Infinity
    for (let i = 0; i < m; i++) y = Math.max(y, B.pos[(s + i) * 3 + 1])
    return Number.isFinite(y) ? y : 0
  }

  // 시설 좌표에 해당하는 실제 건물을 찾는다. 점이 윤곽 안에 들어오면 그 건물, 아니면 120m 안 가장 가까운 건물이다
  matchFacilityBuildings() {
    this.facilityBuilding = new Map()
    this.publicBids = new Map()
    if (!this.facilities?.length || !this.buildingMeshes.size) return 0
    const fac = []
    for (const f of this.facilities) {
      if (typeof f.lon !== 'number' || typeof f.lat !== 'number') continue
      const [x, z] = toXZ(f.lon, f.lat)
      fac.push({ f, x, z, best: null })
    }
    for (const B of this.buildingMeshes.values()) {
      for (let bi = 0; bi < B.count; bi++) {
        const [cx, cz] = toXZ(B.info[bi * 5], B.info[bi * 5 + 1])
        for (const q of fac) {
          const d = Math.hypot(cx - q.x, cz - q.z)
          if (d > 0.12) continue
          const score = this.pointInBuilding(B, bi, q.x, q.z) ? -1 : d
          if (!q.best || score < q.best.score) q.best = { score, code: B.code, bi, B }
        }
      }
    }
    let n = 0
    this.bidFacility = new Map()
    for (const q of fac) {
      if (!q.best) continue
      this.facilityBuilding.set(q.f.id, { code: q.best.code, bi: q.best.bi, roofY: this.roofYOf(q.best.B, q.best.bi) })
      this.bidFacility.set(`${q.best.code}-${q.best.bi}`, q.f.id)
      let set = this.publicBids.get(q.best.code)
      if (!set) { set = new Set(); this.publicBids.set(q.best.code, set) }
      set.add(q.best.bi)
      n += 1
    }
    return n
  }

  // 건물 색: 대피 대상 마을 집결지 반경 안 건물을 그 마을의 부족 단계 색으로 칠한다(실제 대상자 거주 위치가 아니다).
  // 장기요양 레이어가 켜져 있으면 노유자시설(요양원 등) 건물을 따로 칠한다
  paintBuildings() {
    if (!this.buildingMeshes.size) return
    const t = THEME[this.theme]
    const villages = (this.data.villages || []).filter((v) => v.inScope)
    const R = 0.55 // km
    const c8 = (c) => { const k = new THREE.Color(c); return [Math.round(k.r * 255), Math.round(k.g * 255), Math.round(k.b * 255)] }
    const base = c8(t.building), far = c8(t.buildingFar), care = c8(colors.chart[2])
    const pubCol = c8(RENDER.publicBuilding), focCol = c8(RENDER.focusBuilding)
    const dimCol = c8('#e9ecee'), selCol = c8(RENDER.focusBuilding)
    const focus = this.focusId ? this.facilityBuilding?.get(this.focusId) : null
    const keep = this.dimOthers || null
    const selKey = this.selectedBid || null
    const levelCol = [1, 2, 3, 4].map((l) => c8(new THREE.Color(SEVERITY_COLOR[l]).lerp(new THREE.Color(colors.page), 0.25)))
    const vxz = villages.map((v) => ({ v, xz: toXZ(v.lngLat[0], v.lngLat[1]) }))
    const showData = this.layers.shortage !== false
    const showCare = !!this.layers.ltc
    for (const B of this.buildingMeshes.values()) {
      const per = new Array(B.count)
      const pub = this.publicBids?.get(B.code)
      for (let i = 0; i < B.count; i++) {
        const use = B.info[i * 5 + 3]
        // 공공시설로 확인된 건물은 강조색, 선택한 시설은 한 단계 진한 색이다
        if (pub?.has(i)) { per[i] = focus && focus.code === B.code && focus.bi === i ? focCol : pubCol; continue }
        if (showCare && use === 2) { per[i] = care; continue }
        let best = null
        if (showData && B.piece.isDong) {
          const [x, z] = toXZ(B.info[i * 5], B.info[i * 5 + 1])
          let bd = R
          for (const q of vxz) { const d = Math.hypot(q.xz[0] - x, q.xz[1] - z); if (d < bd) { bd = d; best = q.v } }
        }
        per[i] = best && best.level > 0 ? levelCol[best.level - 1] : B.piece.isDong ? base : far
      }
      // 층 분리 중에는 고른 건물 하나만 남기고 주변 건물은 흐리게 둔다
      if (keep) for (let i = 0; i < B.count; i++) { if (`${B.code}-${i}` !== keep) per[i] = dimCol }
      if (selKey) { const [sc, sb] = [selKey.slice(0, selKey.lastIndexOf('-')), Number(selKey.slice(selKey.lastIndexOf('-') + 1))]; if (sc === B.code && per[sb]) per[sb] = selCol }
      const c = B.col
      for (let k = 0; k < B.bid.length; k++) { const col = per[B.bid[k]]; c[k * 3] = col[0]; c[k * 3 + 1] = col[1]; c[k * 3 + 2] = col[2] }
      B.geo.attributes.color.needsUpdate = true
    }
    this.dirty = true
  }

  // ---------- 데이터 ----------
  setLayers(layers) { this.layers = { ...this.layers, ...layers }; this.refreshData() }
  buildingStats() { let n = 0; for (const B of this.buildingMeshes.values()) n += B.count; return n }
  setData(patch) { this.data = { ...this.data, ...patch }; this.refreshData() }
  setExplode(on) { this.explodeTarget = on ? WIDE_EXPLODE : REST_EXPLODE; this.dirty = true }

  pieceAt(lon, lat) {
    for (const p of this.pieces.values()) if (pointInPoly(lon, lat, p.meta.coordinates)) return p
    return null
  }

  refreshData() {
    if (!this.ready) return
    const { villages, dongStats, selected } = this.data
    // 동해시 조각이 솟는 높이: 행정동 미이송 합계에 비례
    const maxTotal = Math.max(1, ...Object.values(dongStats).map((s) => s.shortage || 0))
    for (const p of this.pieces.values()) {
      const st = p.dongCode ? dongStats[p.dongCode] : null
      p.liftBase = st && this.layers.shortage ? (st.shortage / maxTotal) * LIFT_MAX : 0
      this.paintPiece(p)
      p.lines.visible = this.layers.dongs !== false && p.isDong
      if (p.label) p.label.visible = this.layers.dongs !== false && p.isDong
    }
    this.updateLift()
    this.syncPillars(villages, selected)
    this.paintBuildings()
    this.syncMarkers()
    this.syncFire()
    this.dirty = true
  }

  updateLift() {
    for (const p of this.pieces.values()) {
      const sel = this.selectedPiece === p.code ? 0.35 : 0
      const hov = this.hoverCode === p.code ? 0.22 : 0
      p.liftTarget = (p.liftBase || 0) + sel + hov
    }
  }

  // 마을 표식. 막대 대신 땅에 깔린 원(반지름은 대기 인원의 제곱근에 비례)과 그 위에 뜬 숫자. 조각 그룹의 자식이라 조각과 같이 움직인다
  syncPillars(villages, selected) {
    const t = THEME[this.theme]
    const seen = new Set()
    for (const v of villages) {
      seen.add(v.code)
      let s = this.pillars.get(v.code)
      const piece = this.pieceAt(v.lngLat[0], v.lngLat[1])
      if (!piece) continue
      const [x, z] = toXZ(v.lngLat[0], v.lngLat[1])
      const ground = this.heightAt(v.lngLat[0], v.lngLat[1])
      if (!s) {
        const fillMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 })
        const lineMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5 })
        const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), fillMat)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 96).rotateX(-Math.PI / 2), lineMat)
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24).rotateX(-Math.PI / 2), lineMat)
        fill.renderOrder = 3; ring.renderOrder = 4; dot.renderOrder = 4
        const mesh = new THREE.Group()
        mesh.add(fill, ring)
        fill.userData.village = v.code; ring.userData.village = v.code
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'pressable inline-flex h-6 items-center rounded-sm px-2 type-caption tabular-nums shadow-sm'
        el.style.pointerEvents = 'auto'
        el.addEventListener('click', (ev) => { ev.stopPropagation(); this.cb.onPick?.({ kind: 'village', code: v.code }) })
        const label = new CSS2DObject(el)
        s = { mesh, fill, ring, dot, fillMat, lineMat, el, label, h: 0, hTarget: 0, piece: null }
        this.pillars.set(v.code, s)
      }
      if (s.piece !== piece) { s.piece?.group.remove(s.mesh, s.dot, s.label); piece.group.add(s.mesh, s.dot, s.label); s.piece = piece }
      s.mesh.position.set(x, ground + 0.025, z)
      s.dot.position.set(x, ground + 0.03, z)
      s.ground = ground
      const isSel = selected === v.code
      s.hTarget = v.radiusKm ?? (v.inScope ? 0.16 + 0.045 * Math.sqrt(Math.max(0, v.waiting)) : 0.06)
      const col = new THREE.Color(isSel ? t.highlight : v.inScope ? (v.level > 0 ? SEVERITY_COLOR[v.level] : t.highlight) : colors.text.ter)
      s.fillMat.color.copy(col); s.lineMat.color.copy(col)
      s.fillMat.opacity = v.inScope ? (isSel ? 0.16 : 0.07) : 0.05
      s.v = v
      s.el.textContent = `${v.waiting}명`
      s.el.setAttribute('aria-label', v.ariaLabel)
      s.el.setAttribute('aria-pressed', isSel ? 'true' : 'false')
      s.el.classList.toggle('bg-text-pri', isSel)
      s.el.classList.toggle('text-text-inverse', isSel)
      s.el.classList.toggle('bg-page', !isSel)
      s.el.classList.toggle('text-text-pri', !isSel)
      const on = this.layers.shortage !== false
      s.mesh.visible = on
      s.dot.visible = false
      s.label.visible = on && v.inScope && (v.waiting > 0 || isSel)
    }
    for (const [code, s] of this.pillars) {
      if (seen.has(code)) continue
      s.piece?.group.remove(s.mesh, s.dot, s.label)
      s.mesh.traverse((o) => o.geometry?.dispose()); s.fillMat.dispose(); s.lineMat.dispose()
      this.pillars.delete(code)
    }
  }

  // 대피소, 차량, 장기요양시설 표식. 화면에서 크기가 변하지 않는 작은 점(가까이 가도 건물을 가리지 않는다)
  syncMarkers() {
    const t = THEME[this.theme]
    for (const m of this.markerInfo || []) m.parent?.remove(m)
    this.markerInfo = []
    const dot = (fill, ring, size, tip) => {
      const el = document.createElement('span')
      el.title = tip
      Object.assign(el.style, { display: 'block', width: `${size}px`, height: `${size}px`, borderRadius: '999px', background: fill, border: `2px solid ${ring}`, boxShadow: '0 1px 2px rgba(0,0,0,0.25)', pointerEvents: 'auto', cursor: 'default' })
      el.addEventListener('pointerenter', (e) => { const r = this.box.getBoundingClientRect(); this.cb.onHover?.({ kind: 'tip', tip, x: e.clientX - r.left, y: e.clientY - r.top }) })
      el.addEventListener('pointerleave', () => this.cb.onHover?.(null))
      return el
    }
    const add = (list, on, make) => {
      if (!on) return
      for (const it of list) {
        const piece = this.pieceAt(it.lngLat[0], it.lngLat[1])
        if (!piece) continue
        const [x, z] = toXZ(it.lngLat[0], it.lngLat[1])
        const obj = new CSS2DObject(make(it))
        obj.position.set(x, this.heightAt(it.lngLat[0], it.lngLat[1]) + 0.03, z)
        piece.group.add(obj)
        this.markerInfo.push(obj)
      }
    }
    const shelterColor = (s) => (s === 'over' ? colors.danger.DEFAULT : s === 'near' ? colors.chart.heatDanger[2] : s === 'blocked' ? colors.text.ter : t.shelter)
    add(this.data.shelters, this.layers.shelters, (s) => dot(colors.page, shelterColor(s.state), 12, s.tip))
    add(this.data.vehicles, this.layers.vehicles, (v) => dot(v.available ? t.shelter : colors.page, v.available ? colors.page : colors.text.ter, 10, v.tip))
    add(this.data.ltc, this.layers.ltc, (x) => dot(x.kind === 'residential' ? colors.chart[2] : colors.page, colors.chart[2], 10, x.tip))
    this.dirty = true
  }

  // 산불 확산 가정: 땅에 덮이는 반투명 띠, 띠 위에 떠 있는 굵은 화살표, 발화 지점에서 퍼지는 고리
  syncFire() {
    for (const m of [...this.arrowGroup.children]) { this.arrowGroup.remove(m); m.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.() }) }
    this.fireRings = []
    const fire = this.data.fire
    if (!fire || this.layers.fire === false) return
    const t = THEME[this.theme]
    const ink = new THREE.Color(t.ink)
    // 1) 띠: 지형을 따라 덮는 반투명 면과 테두리
    const ring = fire.zone.geometry.coordinates[0].map(([lon, lat]) => toXZ(lon, lat))
    const { pts, keep } = topOf([ring], 0.25)
    const pos = []
    for (const [x, z] of pts) { const [lon, lat] = toLonLat(x, z); pos.push(x, this.heightAt(lon, lat) + 0.06, z) }
    const zg = new THREE.BufferGeometry()
    zg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    zg.setIndex(keep)
    const zone = new THREE.Mesh(zg, new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }))
    zone.renderOrder = 2
    this.arrowGroup.add(zone)
    const edge = []
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, z0] = ring[i], [x1, z1] = ring[i + 1]
      const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.2))
      for (let k = 0; k < n; k++) { const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n; const [lon, lat] = toLonLat(x, z); edge.push(new THREE.Vector3(x, this.heightAt(lon, lat) + 0.1, z)) }
    }
    edge.push(edge[0].clone())
    const el = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edge), new THREE.LineDashedMaterial({ color: ink, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.75 }))
    el.computeLineDistances()
    this.arrowGroup.add(el)
    // 2) 화살표: 발화 지점에서 띠 끝까지 지형 위로 부드럽게 뜬 관
    const [a] = fire.line.geometry.coordinates
    const tip = fire.head.geometry.coordinates[0][0]
    const A = toXZ(a[0], a[1]), B = toXZ(tip[0], tip[1])
    const ctrl = []
    const N = 16
    let maxH = 0
    for (let i = 0; i <= N; i++) { const x = A[0] + ((B[0] - A[0]) * i) / N, z = A[1] + ((B[1] - A[1]) * i) / N; const [lon, lat] = toLonLat(x, z); maxH = Math.max(maxH, this.heightAt(lon, lat)) }
    for (let i = 0; i <= N; i++) {
      const k = i / N
      const x = A[0] + (B[0] - A[0]) * k, z = A[1] + (B[1] - A[1]) * k
      ctrl.push(new THREE.Vector3(x, maxH + FIRE_Y * 0.55 + Math.sin(k * Math.PI) * 0.6, z))
    }
    const curve = new THREE.CatmullRomCurve3(ctrl)
    const body = curve.getPoints(80)
    const headLen = 0.9
    const total = curve.getLength()
    const cut = Math.max(0.1, 1 - headLen / total)
    const bodyCurve = new THREE.CatmullRomCurve3(body.slice(0, Math.floor(body.length * cut)))
    const mat = new THREE.MeshStandardMaterial({ color: ink, roughness: 0.4, metalness: 0.05, transparent: true, opacity: 0.88 })
    this.arrowGroup.add(new THREE.Mesh(new THREE.TubeGeometry(bodyCurve, 120, 0.09, 12, false), mat))
    const end = curve.getPointAt(1), before = curve.getPointAt(cut)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, before.distanceTo(end), 24), mat)
    head.position.copy(before.clone().add(end).multiplyScalar(0.5))
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(before).normalize())
    this.arrowGroup.add(head)
    // 3) 발화 지점: 땅에 박힌 점과 퍼지는 고리 셋
    const [ox, oz] = toXZ(fire.origin[0], fire.origin[1])
    const oy = this.heightAt(fire.origin[0], fire.origin[1])
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({ color: ink }))
    dot.position.set(ox, oy + 0.16, oz)
    this.arrowGroup.add(dot)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8).translate(0, 0.5, 0), mat)
    stem.position.set(ox, oy, oz); stem.scale.y = ctrl[0].y - oy
    this.arrowGroup.add(stem)
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }))
      r.position.set(ox, oy + 0.08, oz)
      r.userData.phase = i / 3
      this.arrowGroup.add(r)
      this.fireRings.push(r)
    }
    // 4) 이름표
    const lab = document.createElement('span')
    lab.className = 'pointer-events-none inline-flex h-6 items-center rounded-sm bg-text-pri px-2 type-caption text-text-inverse shadow-sm'
    lab.textContent = '산불 확산 가정 방향'
    const lo = new CSS2DObject(lab)
    lo.position.copy(curve.getPointAt(0.45)).add(new THREE.Vector3(0, 0.45, 0))
    this.arrowGroup.add(lo)
    const og = document.createElement('span')
    og.className = 'pointer-events-none type-caption'
    og.style.fontWeight = '700'; og.style.color = t.label
    og.style.textShadow = this.theme === 'dark' ? 'none' : '0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8)'
    og.textContent = fire.label
    const oo = new CSS2DObject(og)
    oo.position.set(ox, oy + 0.55, oz)
    this.arrowGroup.add(oo)
    this.dirty = true
  }

  // ---------- 카메라 ----------
  // 첫 화면. 동해시청 일대를 2km 안쪽에서 내려다본다. 공공시설 건물과 역할 층이 바로 읽히는 거리다
  cityView() {
    const [x, z] = toXZ(CITY_CENTER[0], CITY_CENTER[1])
    const y = this.heightAt(CITY_CENTER[0], CITY_CENTER[1])
    return { x, y: y + 0.02, z, dist: 2.1, polar: (57 * Math.PI) / 180, azimuth: (90 * Math.PI) / 180 }
  }

  // 경위도 범위를 화면에 담는 카메라. 방위 -12도, 기울기 56도
  viewForBounds(bb, fudge = 1) {
    const [x0, z1] = toXZ(bb[0], bb[1]); const [x1, z0] = toXZ(bb[2], bb[3])
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0)
    const vf = (this.camera.fov * Math.PI) / 180
    const polar = (56 * Math.PI) / 180
    // 떠 있는 패널을 뺀 실제로 보이는 영역의 가로세로비
    const W = this.box.clientWidth || 1000, H = this.box.clientHeight || 700
    const uw = Math.max(240, W - (this.padding.left || 0) - (this.padding.right || 0))
    const uh = Math.max(240, H - (this.padding.top || 0) - (this.padding.bottom || 0))
    const half = 2 * Math.tan(vf / 2)
    // 땅의 앞뒤 길이는 기울어진 화면에서 cos(기울기)배로 줄어 보인다. 지형 높이만큼 여유를 더한다
    // 화면 높이 H 픽셀이 거리 L 에서 half*L km 를 덮는다. 보이는 영역(uw x uh)에 범위가 들어가는 L 을 구한다
    const needV = ((d * Math.cos(polar) + 3) * H) / (half * uh)
    const needH = (w * H) / (half * uw)
    const [lon, lat] = toLonLat(cx, cz)
    // 줌아웃은 시가지가 담기는 거리까지만 허용한다
    const want = Math.max(needV, needH) * 1.2 * fudge
    return { x: cx, y: this.heightAt(lon, lat) * 0.6, z: cz, dist: Math.min(MAX_DIST, Math.max(MIN_DIST, want)), polar, azimuth: (-12 * Math.PI) / 180 }
  }

  setView(v, instant = false) {
    v = { ...v, dist: Math.min(MAX_DIST, Math.max(MIN_DIST, v.dist)) }
    const apply = (s) => {
      const sp = new THREE.Spherical(s.dist, s.polar, s.azimuth)
      const off = new THREE.Vector3().setFromSpherical(sp)
      this.controls.target.set(s.x, s.y, s.z)
      this.camera.position.copy(this.controls.target).add(off)
      this.camera.lookAt(this.controls.target)
      this.controls.update()
      this.dirty = true
    }
    if (instant || this.reduced) { apply(v); return }
    const from = this.currentView()
    this.tween(900, (k) => {
      const e = easeIO(k)
      apply({
        x: from.x + (v.x - from.x) * e, y: from.y + (v.y - from.y) * e, z: from.z + (v.z - from.z) * e,
        dist: from.dist + (v.dist - from.dist) * e, polar: from.polar + (v.polar - from.polar) * e, azimuth: from.azimuth + (v.azimuth - from.azimuth) * e
      })
    })
  }

  currentView() {
    const off = this.camera.position.clone().sub(this.controls.target)
    const sp = new THREE.Spherical().setFromVector3(off)
    return { x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z, dist: sp.radius, polar: sp.phi, azimuth: sp.theta }
  }

  fitBounds(bb) { this.setView(this.viewForBounds(bb, 1.25)) }
  // 전체 보기는 동해시 시가지까지다. 주변 시군 산악은 보여주지 않는다
  fitRegion() { this.setView(this.viewForBounds(CITY_BBOX, 0.8)); void REGION_BBOX }
  flyToLonLat(lon, lat, dist = 12) {
    const [x, z] = toXZ(lon, lat)
    const cur = this.currentView()
    this.setView({ x, y: this.heightAt(lon, lat) * 0.5, z, dist, polar: Math.min(cur.polar, (60 * Math.PI) / 180), azimuth: cur.azimuth })
  }

  // 지도 위에 떠 있는 패널 폭만큼 장면 중심을 옮긴다
  setPadding(p) {
    this.padding = p
    this.applyViewOffset()
  }
  applyViewOffset() {
    const w = this.box.clientWidth, h = this.box.clientHeight
    if (!w || !h) return
    const dx = ((this.padding.left || 0) - (this.padding.right || 0)) / 2
    const dy = ((this.padding.top || 0) - (this.padding.bottom || 0)) / 2
    this.camera.setViewOffset(w, h, -dx, -dy, w, h)
    this.dirty = true
  }

  tween(ms, fn, done) {
    this.tweens.push({ t0: performance.now(), ms, fn, done })
    this.dirty = true
  }

  // ---------- 입력 ----------
  bindEvents() {
    const el = this.renderer.domElement
    this.onMove = (e) => {
      const r = el.getBoundingClientRect()
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      this.pendingMove = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    this.onLeave = () => { this.pendingMove = null; this.setHover(null); this.cb.onHover?.(null) }
    this.downAt = null
    this.onDown = (e) => { this.downAt = [e.clientX, e.clientY] }
    this.onUp = (e) => {
      if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 5) return
      const r = el.getBoundingClientRect()
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      const hit = this.pick()
      // 역할 판을 집으면 시설 선택으로 돌린다. 빈 곳은 { type: 'none' }
      const plate = this.roleLayers?.pick(this.raycaster)
      if (plate) { this.selectFacilityBuilding(plate.facilityId); this.cb.onPick?.({ type: 'facility', id: plate.facilityId, role: plate.role }); return }
      // 건물 집기. 공공시설로 짝지어진 건물이면 시설로, 아니면 일반 건물로 돌린다
      const b = this.pickBuilding()
      if (b) {
        this.selectedBid = b.buildingId
        this.paintBuildings()
        const fid = this.bidFacility?.get(b.buildingId)
        if (fid) this.cb.onPick?.({ type: 'facility', id: fid, buildingId: b.buildingId, floors: b.floors, heightM: b.heightM })
        else this.cb.onPick?.({ type: 'building', buildingId: b.buildingId, floors: b.floors, heightM: b.heightM })
        return
      }
      if (this.facilities) { this.selectedBid = null; this.paintBuildings(); this.cb.onPick?.({ type: 'none' }); return }
      if (!hit) this.cb.onPick?.({ type: 'none' })
      if (hit?.village) this.cb.onPick?.({ kind: 'village', code: hit.village })
      else if (hit?.piece) { this.selectedPiece = hit.piece.code; this.updateLift(); this.cb.onPick?.({ kind: 'piece', code: hit.piece.code, dongCode: hit.piece.dongCode, name: hit.piece.meta.name, lonlat: hit.piece.meta.centroid }) }
    }
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerleave', this.onLeave)
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.box)
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const objs = []
    for (const s of this.pillars.values()) if (s.mesh.visible) objs.push(s.fill)
    for (const p of this.pieces.values()) objs.push(p.top)
    const hits = this.raycaster.intersectObjects(objs, false)
    for (const h of hits) {
      const o = h.object
      if (o.userData.village) return { village: o.userData.village, point: h.point }
      if (o.userData.tip) return { tip: o.userData.tip, point: h.point }
      if (o.userData.piece) return { piece: o.userData.piece, point: h.point }
    }
    return null
  }

  // 건물 한 동 집기. 교차한 삼각형의 꼭짓점 번호로 건물 번호를 찾는다
  pickBuilding() {
    const objs = []
    for (const B of this.buildingMeshes.values()) if (B.mesh.visible) objs.push(B.mesh)
    if (!objs.length) return null
    const hits = this.raycaster.intersectObjects(objs, false)
    const h = hits[0]
    if (!h || !h.face) return null
    const B = h.object.userData.B
    if (!B) return null
    const bi = B.bid[h.face.a]
    return {
      B, bi, buildingId: `${B.code}-${bi}`,
      lon: B.info[bi * 5], lat: B.info[bi * 5 + 1],
      floors: B.info[bi * 5 + 2], use: B.info[bi * 5 + 3], heightM: B.info[bi * 5 + 4],
      point: h.point
    }
  }

  // 'code-bi' 문자열이나 시설 id 를 건물 기록으로 바꾼다
  resolveBuilding(key) {
    if (!key) return null
    let code = null, bi = null
    const link = this.facilityBuilding?.get(key)
    if (link) { code = link.code; bi = link.bi }
    else if (typeof key === 'string' && key.includes('-')) {
      const at = key.lastIndexOf('-')
      code = key.slice(0, at); bi = Number(key.slice(at + 1))
    }
    const B = code != null ? this.buildingMeshes.get(code) : null
    if (!B || !(bi >= 0) || bi >= B.count) return null
    return { B, bi, code, buildingId: `${code}-${bi}` }
  }

  // 건물 지붕 윤곽(km). 꼭짓점은 윗고리 절반이다
  ringOf(B, bi) {
    const m = B.lens[bi] / 2
    const s = B.starts[bi]
    const ring = []
    for (let i = 0; i < m; i++) ring.push([B.pos[(s + i) * 3], B.pos[(s + i) * 3 + 2]])
    return ring
  }

  baseYOf(B, bi) {
    const m = B.lens[bi] / 2
    const s = B.starts[bi] + m
    let y = Infinity
    for (let i = 0; i < m; i++) y = Math.min(y, B.pos[(s + i) * 3 + 1])
    return Number.isFinite(y) ? y : 0
  }

  // 원래 건물을 잠시 낮추어 슬래브와 겹치지 않게 한다
  flattenBuilding(B, bi, on) {
    const m = B.lens[bi] / 2
    const s = B.starts[bi]
    if (on) {
      if (!this.flatSave) this.flatSave = []
      for (let i = 0; i < m; i++) {
        const a = (s + i) * 3 + 1
        this.flatSave.push([a, B.pos[a]])
        B.pos[a] = B.pos[(s + m + i) * 3 + 1]
      }
    } else if (this.flatSave) {
      for (const [a, y] of this.flatSave) B.pos[a] = y
      this.flatSave = null
    }
    B.geo.attributes.position.needsUpdate = true
    B.geo.computeBoundingSphere()
  }

  // 시설 id 로 그 건물을 선택 강조한다
  selectFacilityBuilding(id) {
    const link = this.facilityBuilding?.get(id)
    this.selectedBid = link ? `${link.code}-${link.bi}` : null
    this.pins?.setFocus(id)
    this.paintBuildings()
    this.dirty = true
    return this.selectedBid
  }

  // 선택 건물을 층 단위 슬래브로 나눠 위아래로 벌린다. 인자는 시설 id 또는 건물 id('code-bi')
  explodeBuilding(idOrBuildingId) {
    const found = this.resolveBuilding(idOrBuildingId)
    if (!found) return null
    if (this.slabs.active) {
      const old = this.resolveBuilding(this.slabs.key)
      this.tweens = []
      if (old) this.flattenBuilding(old.B, old.bi, false)
      this.slabs.clear()
    }
    const { B, bi, buildingId } = found
    const facilityId = this.bidFacility?.get(buildingId) || (this.facilityBuilding?.has(idOrBuildingId) ? idOrBuildingId : null)
    const facility = facilityId ? this.facilities?.find((f) => f.id === facilityId) || null : null
    const ring = this.ringOf(B, bi)
    const roofY = this.roofYOf(B, bi)
    const groundY = this.baseYOf(B, bi)
    const plan = floorPlan({ name: facility?.name || '', floors: B.info[bi * 5 + 2], heightM: B.info[bi * 5 + 4], facility })
    const n = this.slabs.show({
      key: buildingId, ring, groundY, roofY, plan,
      plateAt: facilityId ? (role) => this.roleLayers.slotPosition(facilityId, role) : null
    })
    if (!n) return null
    this.flattenBuilding(B, bi, true)
    this.selectedBid = buildingId
    this.dimOthers = buildingId
    this.paintBuildings()
    const [cx, cz] = [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length]
    this.enableNearShadow(cx, cz, 0.4)
    const apply = (k) => { this.slabs.setProgress(k); this.dirty = true }
    if (this.reduced) apply(1)
    else this.tween(700, (k) => apply(easeIO(k)))
    // 층이 화면에 담길 만큼 카메라를 물린다
    const stack = (plan.above + plan.below) * 0.0037 + 0.1
    this.setView({ x: cx, y: groundY + stack * 0.5, z: cz, dist: Math.max(0.2, stack * 3.2), polar: (66 * Math.PI) / 180, azimuth: (-35 * Math.PI) / 180 }, this.reduced)
    this.dirty = true
    return { buildingId, facilityId, floorsAbove: plan.above, floorsBelow: plan.below, slabs: n, marks: plan.marks }
  }

  // 벌린 층을 다시 한 동으로 돌린다
  collapseBuilding() {
    if (!this.slabs.active) return false
    const found = this.resolveBuilding(this.slabs.key)
    const done = () => {
      this.slabs.clear()
      if (found) this.flattenBuilding(found.B, found.bi, false)
      this.dimOthers = null
      this.paintBuildings()
      this.dirty = true
    }
    if (this.reduced) done()
    else this.tween(420, (k) => { this.slabs.setProgress(1 - easeIO(k)); this.dirty = true }, done)
    return true
  }

  // 시설 건물을 비스듬히 본 정지 이미지. 별도 렌더 타깃을 써서 메인 렌더를 방해하지 않는다
  async renderThumbnail(facilityId, { width = 480, height = 320, dist = null } = {}) {
    const f = this.facilities?.find((x) => x.id === facilityId) || this.roleLayers?.facilityAt(facilityId)?.facility
    if (!f) return null
    let [x, z] = toXZ(f.lon, f.lat)
    const link = this.facilityBuilding?.get(facilityId)
    const roof = link ? link.roofY : this.heightAt(f.lon, f.lat)
    // 건물을 찾았으면 그 동의 가운데를 바라본다. 시설 좌표는 출입구 쪽에 찍혀 있어 건물이 가장자리로 밀린다
    const found = link ? this.resolveBuilding(facilityId) : null
    if (found) {
      const ring = this.ringOf(found.B, found.bi)
      if (ring?.length) {
        x = ring.reduce((a, pt) => a + pt[0], 0) / ring.length
        z = ring.reduce((a, pt) => a + pt[1], 0) / ring.length
      }
    }
    const center = new THREE.Vector3(x, roof * 0.6 + this.heightAt(f.lon, f.lat) * 0.4, z)
    // 역할 층 판이 건물을 덮으면 대표 그림이 색 띠만 남는다. 그리는 동안만 판을 숨긴다
    const hide = [this.roleLayers?.group, this.arcs?.group].filter(Boolean)
    const was = hide.map((g) => g.visible)
    hide.forEach((g) => { g.visible = false })
    // 높은 동일수록 멀리서 본다. 거리를 고정하면 고층 건물은 화면에 다 담기지 않는다
    const rise = Math.max(0, roof - this.heightAt(f.lon, f.lat))
    const far = dist ?? Math.max(0.07, rise * 2.4)
    let url = null
    try {
      url = renderOffscreen({
        renderer: this.renderer, scene: this.scene, center, width, height,
        dist: far, polar: 62, azimuth: -35
      })
    } finally {
      hide.forEach((g, i) => { g.visible = was[i] })
    }
    this.dirty = true
    return url
  }

  // '3d' 는 기울인 원근 보기, '2d' 는 정사영으로 위에서 내려다보는 평면 보기다
  setViewMode(mode) {
    const next = mode === '2d' ? '2d' : '3d'
    if (next === this.viewMode) return this.viewMode
    const v = this.currentView()
    this.viewMode = next
    if (next === '2d') {
      this.persp = this.camera
      this.ortho ||= new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 900)
      this.ortho.up.set(0, 0, -1)
      this.ortho.zoom = 1
      this.ortho.position.set(v.x, v.y + Math.max(2, v.dist * 2), v.z)
      this.controls.target.set(v.x, v.y, v.z)
      this.orthoHalf = Math.max(0.1, v.dist * 0.45)
      this.useCamera(this.ortho)
      this.controls.enableRotate = false
      this.controls.minZoom = 0.25
      this.controls.maxZoom = 24
      if (this.sky) this.sky.visible = false
      this.fogSave = this.scene.fog
      this.scene.fog = null
    } else {
      this.useCamera(this.persp || this.camera)
      this.controls.enableRotate = true
      if (this.sky) this.sky.visible = true
      if (this.fogSave) this.scene.fog = this.fogSave
      this.setView({ ...v, polar: (57 * Math.PI) / 180 }, true)
    }
    this.applyQuality(this.quality)
    this.labelsDirty = true
    this.dirty = true
    return this.viewMode
  }

  useCamera(cam) {
    this.camera = cam
    this.controls.object = cam
    if (this.passes?.render) this.passes.render.camera = cam
    if (this.passes?.ao) this.passes.ao.camera = cam
    this.resize()
    this.controls.update()
    this.dirty = true
  }

  // 등급에 맞춘 픽셀비. 이동 중에는 한 단계 낮춘다
  wantPixelRatio(moving = false) {
    const p = PRESET[this.quality] || PRESET.high
    return Math.min(window.devicePixelRatio || 1, moving ? p.movingRatio : p.pixelRatio)
  }

  // 등급 하나를 장면 전체에 적용한다
  applyQuality(level) {
    const want = this.gpu?.webgl2 === false ? 'low' : LEVELS.includes(level) ? level : 'high'
    this.quality = want
    const p = PRESET[want]
    if (this.passes) {
      if (this.passes.bloom) this.passes.bloom.enabled = p.bloom
      if (this.passes.ao) this.passes.ao.enabled = p.ao && !!this.aoWanted && this.viewMode === '3d'
      if (this.passes.smaa) this.passes.smaa.enabled = p.smaa
    }
    this.renderer.shadowMap.enabled = p.shadow
    this.sun.shadow.mapSize.set(p.shadowMap, p.shadowMap)
    this.sun.shadow.map?.dispose?.()
    this.sun.shadow.map = null
    if (!p.shadow) this.sun.castShadow = false
    this.oceanDetail = p.ocean
    if (this.oceanUniforms?.uReflection) this.oceanUniforms.uReflection.value = want === 'high' ? 1 : want === 'medium' ? 0.45 : 0
    if (this.oceanUniforms && p.ocean === 'static') { this.oceanUniforms.uChop.value = 0.02; this.oceanUniforms.uFoamOn.value = 0.05 }
    this.maxLabels = p.maxLabels
    this.buildingKm = p.buildingKm
    this.renderer.setPixelRatio(this.wantPixelRatio())
    this.renderer.shadowMap.needsUpdate = true
    this.labelsDirty = true
    this.resize()
    return this.quality
  }

  setHover(code) {
    if (this.hoverCode === code) return
    this.hoverCode = code
    this.updateLift()
    this.dirty = true
  }

  resize() {
    const w = this.box.clientWidth, h = this.box.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.composer?.setSize(w, h)
    this.labels.setSize(w, h)
    if (this.camera.isOrthographicCamera) {
      const half = this.orthoHalf || 1
      const a = w / h
      this.camera.left = -half * a; this.camera.right = half * a
      this.camera.top = half; this.camera.bottom = -half
    } else this.camera.aspect = w / h
    this.camera.clearViewOffset()
    this.applyViewOffset()
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  // ---------- 매 프레임 ----------
  loop() {
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const now = performance.now()
    let busy = false
    if (this.controls.update()) busy = true
    this.clampTarget()
    // 진행 중인 트윈
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (now - tw.t0) / tw.ms)
      tw.fn(k)
      if (k >= 1) { tw.done?.(); return false }
      return true
    })
    if (this.tweens.length) busy = true
    // 펼침 정도
    const de = this.explodeTarget - this.explode
    if (Math.abs(de) > 0.0003) { this.explode += de * 0.1; busy = true } else this.explode = this.explodeTarget
    // 조각: 등장, 솟음, 색
    const introMs = 1500
    for (const p of this.pieces.values()) {
      const k = this.reduced ? 1 : Math.max(0, Math.min(1, (now - this.introStart - p.delay * 1000 - 200) / introMs))
      const ik = ease(k)
      if (ik !== p.intro) { p.intro = ik; busy = true }
      const dl = p.liftTarget - p.lift
      if (Math.abs(dl) > 0.002) { p.lift += dl * 0.14; busy = true } else p.lift = p.liftTarget
      if (colorDist(p.tint, p.tintTarget) > 0.006) { p.tint.lerp(p.tintTarget, 0.16); p.topMat.color.copy(p.tint); busy = true }
      if (p.sideTarget && colorDist(p.wallMat.color, p.sideTarget) > 0.006) { p.wallMat.color.lerp(p.sideTarget, 0.16); busy = true }
      this.applyPiecePos(p)
      if (p.label && !p.isDong) {
        // 시군 이름은 가장 큰 조각 하나에만 항상, 나머지 읍면동 이름은 가까이 갔을 때만
        const near = this.camera.position.distanceTo(this.controls.target) < 45
        p.label.visible = this.layers.dongs !== false && (p.showSgg || near)
      }
    }
    // 발화 지점 고리: 2.4초마다 퍼진다
    if (this.fireRings?.length && !this.reduced) {
      for (const r of this.fireRings) {
        const k = ((now / 2400) + r.userData.phase) % 1
        r.scale.setScalar(1 + k * 5)
        r.material.opacity = 0.55 * (1 - k)
      }
      busy = true
    }
    // 마을 원 크기 변화
    for (const s of this.pillars.values()) {
      const d = s.hTarget - s.h
      if (Math.abs(d) > 0.002) { s.h += d * 0.18; busy = true } else s.h = s.hTarget
      const e = this.reduced ? 1 : ease(Math.max(0, Math.min(1, (now - this.introStart - 900) / 900)))
      const r = Math.max(0.001, s.h * e)
      s.mesh.scale.set(r, 1, r)
      s.label.position.set(s.mesh.position.x, s.ground + 0.32, s.mesh.position.z)
      if (e < 1) busy = true
    }
    // 호버
    if (this.pendingMove) {
      const hit = this.pick()
      const piece = hit?.piece || null
      const code = piece?.code || null
      this.setHover(code)
      this.renderer.domElement.style.cursor = hit ? 'pointer' : ''
      if (hit?.village) this.cb.onHover?.({ kind: 'village', code: hit.village, x: this.pendingMove.x, y: this.pendingMove.y })
      else if (hit?.tip) this.cb.onHover?.({ kind: 'tip', tip: hit.tip, x: this.pendingMove.x, y: this.pendingMove.y })
      else if (piece) this.cb.onHover?.({ kind: 'piece', code: piece.code, dongCode: piece.dongCode, name: piece.meta.name, sggName: piece.meta.sggName, x: this.pendingMove.x, y: this.pendingMove.y })
      else this.cb.onHover?.(null)
      this.pendingMove = null
    }
    if (this.labelsDirty && now - (this.lastLabelAt || 0) > 120) { this.lastLabelAt = now; this.updatePlaceLabels(); this.dirty = true }
    // 바다와 역할 층과 특보 연출은 같은 상대 시간을 쓴다
    const dist = this.camera.position.distanceTo(this.controls.target)
    if (this.sky) this.sky.position.copy(this.camera.position)
    if (this.oceanUniforms) {
      // 낮은 등급에서는 수면을 멈춰 매 프레임 다시 그리지 않게 한다
      if (this.oceanDetail !== 'static') { this.oceanUniforms.uTime.value = now / 1000; busy = true }
      this.oceanUniforms.uFogNear.value = Math.max(8, dist * 0.9)
      this.oceanUniforms.uFogFar.value = Math.max(60, dist * 6)
    }
    // 등급별 건물 가시 거리. 멀리 떨어진 조각의 건물은 그리지 않는다
    if (now - (this.cullAt || 0) > 400) {
      this.cullAt = now
      const t = this.controls.target
      for (const B of this.buildingMeshes.values()) {
        const on = Math.hypot(B.piece.cx - t.x, B.piece.cz - t.z) < this.buildingKm + dist * 0.35
        if (B.mesh.visible !== on) { B.mesh.visible = on; this.dirty = true }
      }
    }
    if (this.roleLayers) {
      this.roleLayers.group.visible = dist < 1.2 && this.viewMode === '3d'
      if (this.roleLayers.update(now, dist)) busy = true
    }
    if (this.arcs?.update(now)) busy = true
    if (this.hazard?.update(now, this.controls.target)) busy = true
    // 이동 중에는 픽셀비를 한 단계 낮춘다
    const moving = this.controls.enableDamping && (this.tweens.length > 0 || this.movedAt > now - 160)
    const want = this.wantPixelRatio(moving)
    if (Math.abs(want - this.renderer.getPixelRatio()) > 0.05) { this.renderer.setPixelRatio(want); this.resize() }
    if (busy || this.dirty) {
      this.dirty = busy
      this.renderer.info.reset()
      if (this.composer) this.composer.render()
      else this.renderer.render(this.scene, this.camera)
      this.labels.render(this.scene, this.camera)
      // 표시 후 환산한 수치다. 임의의 목표값이 아니라 실제 프레임 시간이다
      const dt = now - (this.lastFrameAt || now)
      this.lastFrameAt = now
      if (dt > 0 && dt < 500) this.frameAvg = this.frameAvg ? this.frameAvg * 0.9 + dt * 0.1 : dt
      this.fps = this.frameAvg ? Math.round(1000 / this.frameAvg) : 0
      // 실행 중 조절. 45fps 아래가 2초 이어지면 한 단계 낮추고 58fps 위가 6초 이어지면 올린다
      if (this.qualityMode === 'auto') {
        const dir = this.frameMon.sample(now, dt)
        if (dir) {
          const next = stepLevel(this.quality, dir)
          if (next !== this.quality) { this.applyQuality(next); this.qualityNote = `${dir === 'down' ? '낮춤' : '올림'} ${next} (${this.frameMon.fps}fps)`; this.cb.onQuality?.(this.getQuality()) }
        }
      }
    }
  }

  // ---------- 계약서 3장 공개 메서드 ----------
  // strata.json facilities 배열을 받아 시설 위에 역할 층을 쌓는다
  setFacilities(facilities) {
    this.facilities = Array.isArray(facilities) ? facilities : []
    if (this.buildingMeshes.size) { this.matchFacilityBuildings(); this.paintBuildings() }
    this.roleLayers.setFacilities(this.facilities)
    if (this.timeMs != null) this.roleLayers.setTime(this.timeMs)
    this.pins.setFacilities(this.facilities)
    this.labelsDirty = true
    this.dirty = true
    return this.roleLayers.items.length
  }

  // 보일 역할 id 배열. 빈 배열이면 전부
  setRoleFilter(roleIds) {
    this.roleFilter = Array.isArray(roleIds) ? roleIds : []
    this.roleLayers.setRoleFilter(this.roleFilter)
    this.dirty = true
  }

  // 시간축 시각. 이벤트 구간에 걸린 역할 층은 0.4초 동안 소등해 빈 자리를 남긴다
  setTime(ms) {
    this.timeMs = typeof ms === 'number' ? ms : Date.parse(ms)
    this.roleLayers.setTime(this.timeMs)
    this.dirty = true
  }

  // 시설로 카메라를 이동하고 선택 강조. 동작 줄이기에서는 직전환
  focusFacility(id) {
    const e = this.roleLayers.facilityAt(id)
    if (!e) return false
    this.focusId = id
    this.roleLayers.setFocus(id)
    this.selectFacilityBuilding(id)
    const f = e.facility
    const [x, z] = toXZ(f.lon, f.lat)
    const roof = this.facilityBuilding.get(id)?.roofY
    const y = typeof roof === 'number' ? roof : this.heightAt(f.lon, f.lat)
    const dist = 0.55
    const polar = (58 * Math.PI) / 180
    const azimuth = (-35 * Math.PI) / 180
    // 시설을 화면 가운데보다 조금 위에 둔다. 카메라가 보는 점을 시설 앞쪽으로 당긴다
    const off = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, polar, azimuth))
    const back = new THREE.Vector3(off.x, 0, off.z).normalize().multiplyScalar(dist * 0.18)
    this.setView({ x: x + back.x, y: y + 0.02, z: z + back.z, dist, polar, azimuth }, this.reduced)
    this.enableNearShadow(x, z, 0.8)
    this.paintBuildings()
    this.dirty = true
    return true
  }

  // 패닝 범위를 동해시 시가지 박스 안으로 묶는다. 바깥으로 밀면 카메라도 같은 양만큼 되돌린다
  clampTarget() {
    const b = CITY_XZ
    const t = this.controls.target
    const nx = Math.min(b.x1, Math.max(b.x0, t.x))
    const nz = Math.min(b.z1, Math.max(b.z0, t.z))
    if (nx !== t.x || nz !== t.z) {
      this.camera.position.x += nx - t.x
      this.camera.position.z += nz - t.z
      t.x = nx
      t.z = nz
    }
  }

  clearFocus() {
    this.focusId = null
    this.roleLayers.setFocus(null)
    if (this.slabs?.active) this.collapseBuilding()
    this.selectedBid = null
    this.pins?.setFocus(null)
    this.arcs.clear()
    this.disableNearShadow()
    this.paintBuildings()
    this.setView(this.cityView(), this.reduced)
    this.dirty = true
  }

  // 그림자는 선택 시설 주변 생활권에만 켜진다. 도시 전체을 그림자 패스에 넣지 않는다
  enableNearShadow(x, z, halfKm) {
    const c = this.sun.shadow.camera
    c.left = -halfKm; c.right = halfKm; c.top = halfKm; c.bottom = -halfKm
    // 길이 단위가 km 이므로 깊이 범위를 광원 주변으로 좁힌다. 넓으면 정밀도가 모자라 그림자 얼룩이 생긴다
    c.near = Math.max(1, 40 - halfKm * 3 - 2); c.far = 40 + halfKm * 3 + 2
    c.updateProjectionMatrix()
    this.sun.shadow.bias = -0.00002
    this.sun.shadow.normalBias = Math.max(0.004, halfKm * 0.004)
    this.sunTarget.position.set(x, this.heightAt(...toLonLat(x, z)), z)
    this.sun.position.copy(this.sunTarget.position).add(this.sunDir.clone().multiplyScalar(40))
    this.sun.castShadow = true
    for (const B of this.buildingMeshes.values()) B.mesh.castShadow = Math.hypot(B.piece.cx - x, B.piece.cz - z) < 4
    for (const p of this.pieces.values()) p.top.receiveShadow = true
    this.renderer.shadowMap.needsUpdate = true
  }

  disableNearShadow() {
    for (const B of this.buildingMeshes.values()) B.mesh.castShadow = false
    this.sun.castShadow = false
    this.renderer.shadowMap.needsUpdate = true
  }

  // links: [{ fromId, toId, role }] 같은 역할 색의 베지어 튜브 호. 대체 후보 관계만 뜻한다
  showAlternatives(links) {
    const made = []
    for (const L of links || []) {
      const from = this.roleLayers.slotPosition(L.fromId, L.role)
      const to = this.roleLayers.slotPosition(L.toId, L.role)
      if (!from || !to) continue
      made.push({ ...L, from, to })
    }
    const n = this.arcs.show(made, performance.now())
    this.dirty = true
    return n
  }

  // 'none' 'cold' 'rain' 'tsunami'. 해일 수위는 상수로 둔 시연 연출이다
  setHazard(kind) {
    this.hazardKind = kind || 'none'
    this.hazard.setDem(this.dem, DEM_META)
    this.hazard.set(this.hazardKind)
    // 노면과 지붕의 젖은 거칠기
    const rough = this.hazardKind === 'rain' ? RENDER.buildingRoughWet : RENDER.buildingRough
    for (const m of this.buildingMats) { m.roughness = rough; m.needsUpdate = true }
    for (const p of this.pieces.values()) { p.topMat.roughness = this.hazardKind === 'rain' ? 0.45 : 0.92; p.topMat.needsUpdate = true }
    if (this.oceanUniforms) {
      this.oceanUniforms.uChop.value = this.hazardKind === 'tsunami' ? 0.2 : this.hazardKind === 'rain' ? 0.1 : 0.05
      // 평상에는 해안 거품을 거의 끄고 해일 특보에만 바다를 강조한다
      this.oceanUniforms.uFoamOn.value = this.hazardKind === 'tsunami' ? 1.3 : 0.12
      this.oceanUniforms.uFogColor.value.set(this.hazardKind === 'rain' ? RENDER.fogRain : this.hazardKind === 'cold' ? RENDER.fogCold : RENDER.fogDay)
    }
    if (this.scene.fog) this.scene.fog.color.set(this.hazardKind === 'rain' ? RENDER.fogRain : this.hazardKind === 'cold' ? RENDER.fogCold : RENDER.fogDay)
    this.applySun()
    this.dirty = true
    return { kind: this.hazardKind, levelM: this.hazardKind === 'tsunami' ? TSUNAMI_LEVEL_M : null }
  }

  // 태양 위치. 동해 위도 기준의 실제 계산이다
  setSunDate(date) {
    const selected = date instanceof Date ? new Date(date) : new Date(date)
    // 운영 날짜 시간축은 날짜만 바꾸므로 조명은 한국 표준시 정오로 고정한다. 야간 조명 때문에 시설이 어두워지지 않는다
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(selected)
    this.sunDate = new Date(`${day}T12:00:00+09:00`)
    return this.applySun()
  }

  // 'auto' 면 장치 등급과 프레임 시간에 맡기고, 'high' 'medium' 'low' 는 그 등급으로 고정한다
  setQuality(level) {
    if (level === 'auto') {
      this.qualityMode = 'auto'
      this.frameMon.reset(performance.now())
      this.applyQuality(this.gpu.webgl2 ? this.gpu.tier : 'low')
    } else {
      this.qualityMode = 'manual'
      this.applyQuality(level === 'low' ? 'low' : level === 'medium' ? 'medium' : 'high')
    }
    this.dirty = true
    return this.quality
  }

  // 지금 등급과 판정 근거
  getQuality() {
    return {
      mode: this.qualityMode, level: this.quality, startTier: this.gpu.tier, webgl2: this.gpu.webgl2,
      renderer: this.gpu.renderer, score: this.gpu.score, reason: this.gpu.reason,
      fps: this.frameMon.fps, preset: PRESET[this.quality], viewMode: this.viewMode
    }
  }

  // 화면공간 AO 는 로그 깊이 버퍼와 같이 쓰면 깊이 복원이 어긋나므로 선택으로 둔다
  setAmbientOcclusion(on) {
    this.aoWanted = !!on
    if (this.passes?.ao) this.passes.ao.enabled = !!on && this.quality === 'high'
    this.dirty = true
    return !!this.passes?.ao?.enabled
  }

  stats() {
    return {
      fps: this.fps || 0,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      plates: this.roleLayers?.items.length || 0,
      quality: this.quality,
      qualityMode: this.qualityMode,
      viewMode: this.viewMode,
      slabs: this.slabs?.slabs.length || 0,
      sun: solarPosition(this.sunDate, SUN_AT.lat, SUN_AT.lon)
    }
  }

  // 주변 시군 이름표는 쓰지 않는다. 화면에는 동해시 행정동과 선택 시설과 주요 공공시설 이름만 남긴다
  markSggLabels() {
    for (const p of this.pieces.values()) { if (!p.isDong) p.showSgg = false }
    void SGG_LABEL
  }

  // ---------- 지명 ----------
  // 지명, 산봉우리, 주요 시설 이름표. 카메라 거리와 겹침을 보고 보이는 것만 켠다
  buildPlaceLabels() {
    const names = new Set([...this.pieces.values()].map((p) => p.meta.name))
    const list = []
    for (const [k, name, lon, lat, v] of PLACES) {
      // 동해시 시가지 밖 지명은 쓰지 않는다. 산 정상과 주변 시군 이름도 올리지 않는다
      if (lon < CITY_BBOX[0] || lon > CITY_BBOX[2] || lat < CITY_BBOX[1] || lat > CITY_BBOX[3]) continue
      if (k === 'm') continue
      if (k === 'p' && names.has(name)) continue
      if (k === 'p' && !['town', 'suburb', 'quarter'].includes(v)) continue
      if (k === 'i' && !['hospital', 'townhall', 'fire_station', 'station'].includes(v)) continue
      const piece = this.pieceAt(lon, lat)
      if (!piece) continue
      const el = document.createElement('div')
      const span = document.createElement('span')
      span.className = 'type-caption'
      span.style.whiteSpace = 'nowrap'
      el.appendChild(span)
      const t = THEME[this.theme]
      const halo = this.theme === 'dark' ? '0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)' : '0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8)'
      span.style.textShadow = halo
      let prio = 40, near = 28, text = name, weight = '400', color = t.labelFar, ground = this.heightAt(lon, lat)
      if (k === 'p') {
        if (v === 'city') { prio = 100; near = 400; weight = '700'; color = t.label }
        else if (v === 'town') { prio = 90; near = 170; weight = '700'; color = t.label }
        else if (v === 'suburb' || v === 'quarter') { prio = 70; near = 42 }
        else if (v === 'village') { prio = 40; near = 26 }
        else { prio = 30; near = 18 }
      } else if (k === 'm') {
        text = `\u25B3 ${name} ${v.toLocaleString('ko-KR')}m`
        prio = 30 + v / 40; near = v >= 900 ? 130 : v >= 600 ? 70 : 38
      } else {
        const key = v === 'fire_station' || v === 'hospital' || v === 'townhall'
        const major = v === 'fire_station' || v === 'station' || v === 'ferry_terminal' || /시청|군청|소방서/.test(name)
        prio = major ? 85 : key ? 60 : 50; near = major ? 40 : key ? 15 : 15
        weight = '700'; color = t.label
        text = `\u25A0 ${name}`
      }
      span.textContent = text
      span.style.fontWeight = weight
      span.style.color = color
      span.style.fontSize = k === 'p' && v !== 'city' && v !== 'town' ? '11px' : '12px'
      const obj = new CSS2DObject(el)
      const [px, pz] = toXZ(lon, lat)
      obj.position.set(px, ground + 0.15, pz)
      obj.visible = false
      piece.group.add(obj)
      list.push({ obj, prio, near, w: Math.max(36, text.length * 12 + 18), h: 22, span, kind: k, v })
    }
    this.placeLabels = list
    this.labelsDirty = true
  }

  updatePlaceLabels() {
    if (!this.placeLabels?.length) return
    const dist = this.camera.position.distanceTo(this.controls.target)
    const W = this.box.clientWidth, H = this.box.clientHeight
    const taken = []
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    const v = new THREE.Vector3()
    // 먼저 우리 이름표(동해시 행정동, 시군)가 차지한 자리
    for (const p of this.pieces.values()) {
      if (!p.label?.visible) continue
      p.label.getWorldPosition(v); v.project(this.camera)
      if (v.z > 1) continue
      taken.push({ x: ((v.x + 1) / 2) * W - 30, y: ((1 - v.y) / 2) * H - 8, w: 60, h: 16 })
    }
    const cand = []
    for (const L of [...this.placeLabels, ...(this.roadLabels || [])]) {
      if (dist > L.near || this.layers.dongs === false) { L.obj.visible = false; continue }
      L.obj.getWorldPosition(v); v.project(this.camera)
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { L.obj.visible = false; continue }
      cand.push({ L, x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H })
    }
    cand.sort((a, b) => b.L.prio - a.L.prio)
    let shown = 0
    for (const c of cand) {
      const r = { x: c.x - c.L.w / 2, y: c.y - c.L.h / 2, w: c.L.w, h: c.L.h }
      // 등급별 라벨 상한을 지킨다. 시설 핀 자리를 먼저 남기려고 지명은 절반까지만 둔다
      const clash = taken.some((t) => overlap(r, t)) || shown >= Math.max(6, Math.round(this.maxLabels / 2))
      c.L.obj.visible = !clash
      if (!clash) { taken.push(r); shown += 1 }
    }
    // 공공시설 핀은 같은 겹침 목록을 써서 지명과 섞이지 않게 한다
    this.pins?.update(this.camera, W, H, { maxLabels: this.maxLabels, cameraDist: dist, taken, vec: v })
    this.labelsDirty = false
  }

  dispose() {
    if (this.box.__strataScene === this) delete this.box.__strataScene
    cancelAnimationFrame(this.raf)
    this.roleLayers?.dispose()
    this.slabs?.dispose()
    this.pins?.dispose()
    this.arcs?.dispose()
    this.hazard?.dispose()
    this.composer?.dispose?.()
    this.ro?.disconnect()
    clearTimeout(this.localTimer)
    this.localAbort?.abort()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerleave', this.onLeave)
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointerup', this.onUp)
    this.worker?.terminate()
    this.controls.dispose()
    this.scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose() }) })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.labels.domElement.remove()
  }
}

export { ORIGIN, BASE_Y }
