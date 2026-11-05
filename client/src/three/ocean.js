// ocean.js 동해 바다 상면 셰이더. 수심색, 두 겹 노멀, 프레넬 반사, 태양 정반사, 해안 거품을 한 재질에서 처리한다.
// 전체 수면을 흰색으로 날리지 않고 태양 방향에 묶인 좁은 정반사만 빛낸다.
// 해안 거품과 수심 전환은 육지 마스크를 흐리게 만든 거리 근사값으로 제한한다.
import * as THREE from 'three'
import { RENDER } from './palette.js'

// 육지 마스크. 육지는 1, 바다는 0. 흐림을 걸어 해안선에서 멀어질수록 값이 완만히 떨어지는 거리 근사를 만든다
export function buildCoastMask(pieces, project, box, px = 2048) {
  const { x0, z0, w, d } = box
  const cv = document.createElement('canvas')
  cv.width = px
  cv.height = Math.max(1, Math.round((px * d) / w))
  const g = cv.getContext('2d')
  g.fillStyle = '#000000'
  g.fillRect(0, 0, cv.width, cv.height)
  g.filter = 'blur(5px)'
  g.fillStyle = '#ffffff'
  const tx = (lon) => ((project(lon, 0)[0] - x0) / w) * cv.width
  const ty = (lat) => ((project(0, lat)[1] - z0) / d) * cv.height
  for (const p of pieces) {
    for (const poly of p.coordinates) {
      g.beginPath()
      for (const r of poly) {
        r.forEach(([lon, lat], i) => (i ? g.lineTo(tx(lon), ty(lat)) : g.moveTo(tx(lon), ty(lat))))
        g.closePath()
      }
      g.fill('evenodd')
    }
  }
  g.filter = 'none'
  const tex = new THREE.CanvasTexture(cv)
  tex.flipY = false
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

const VERT = /* glsl */`
  varying vec2 vXZ;
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vXZ;
  varying vec3 vWorld;
  uniform sampler2D uMask;
  uniform vec4 uBox;          // x0, z0, width, depth (km)
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;       // 장면 기준 태양 방향(정규화)
  uniform vec3 uSunColor;
  uniform vec3 uSkyLow;
  uniform vec3 uSkyHigh;
  uniform float uReflection;
  uniform float uTime;
  uniform float uChop;        // 물결 세기
  uniform float uFoamOn;
  uniform float uFog;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  // 두 겹의 물결. 방향과 속도와 파장을 다르게 둔다
  float waveLayer(vec2 p, vec2 dir, float len, float speed, float t) {
    float phase = dot(p, dir) / len + t * speed;
    return sin(phase) * 0.5 + 0.5;
  }

  vec3 waveNormal(vec2 p, float t, float amp) {
    float e = 0.012;
    vec2 d1 = normalize(vec2(0.86, 0.5));
    vec2 d2 = normalize(vec2(-0.35, 0.94));
    float h = 0.0;
    h += waveLayer(p, d1, 0.075, 1.35, t) * 0.6;
    h += waveLayer(p, d2, 0.028, 2.1, t) * 0.4;
    float hx = 0.0, hz = 0.0;
    hx += waveLayer(p + vec2(e, 0.0), d1, 0.075, 1.35, t) * 0.6 + waveLayer(p + vec2(e, 0.0), d2, 0.028, 2.1, t) * 0.4;
    hz += waveLayer(p + vec2(0.0, e), d1, 0.075, 1.35, t) * 0.6 + waveLayer(p + vec2(0.0, e), d2, 0.028, 2.1, t) * 0.4;
    vec3 n = normalize(vec3(-(hx - h) * amp / e, 1.0, -(hz - h) * amp / e));
    return n;
  }

  void main() {
    vec2 uv = (vXZ - uBox.xy) / uBox.zw;
    float land = texture2D(uMask, clamp(uv, 0.0, 1.0)).r;
    // 육지 마스크가 0.5 를 넘는 구간은 해안 안쪽이다. 거리 근사로 수심을 만든다
    float shore = smoothstep(0.02, 0.42, land);     // 해안에 가까울수록 1
    float depthMix = 1.0 - shore;                   // 먼바다 1, 연안 0

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float dist = length(cameraPosition - vWorld);
    // 먼 수면에서 잔물결을 그대로 그리면 줄무늬가 생긴다. 거리에 따라 물결 노멀을 평면으로 되돌린다
    // 거리가 멀면 잔물결을 평면으로 되돌린다. 사나운 물결을 먼 수면에 그대로 그리면 가로 줄무늬이 생긴다
    float near = clamp(1.0 - dist / 2.5, 0.0, 1.0);
    float mid = clamp(1.0 - dist / 14.0, 0.0, 1.0);
    vec3 n = normalize(mix(vec3(0.0, 1.0, 0.0), waveNormal(vXZ, uTime, uChop), near));
    // 중거리에는 파장이 긴 너울만 남긴다
    vec3 swell = waveNormal(vXZ * 0.08, uTime * 0.35, uChop * 0.5);
    n = normalize(mix(n, normalize(n + (swell - vec3(0.0, 1.0, 0.0)) * 0.35), mid));

    // 수심색: 먼바다는 해군색, 연안은 청록
    vec3 water = mix(uShallow, uDeep, depthMix);

    // 프레넬: 시선이 누울수록 하늘 반사가 커진다
    float f = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
    f = clamp(0.02 + f * 0.95, 0.0, 1.0);
    float up = clamp(reflect(-viewDir, n).y, 0.0, 1.0);
    vec3 sky = mix(uSkyLow, uSkyHigh, up);

    // 확산광과 태양 정반사. 정반사는 좁게 둔다
    float diff = clamp(dot(n, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
    vec3 h = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 320.0) * 1.1;
    float glint = pow(max(dot(n, h), 0.0), 36.0) * 0.08;

    vec3 col = water * (0.45 + 0.55 * diff);
    col = mix(col, sky, f * 0.72 * uReflection);
    col += uSunColor * (spec + glint) * uReflection;

    // 해안 거품. 해안선 띠에서만 켜고 물결 위상으로 끊는다
    float band = smoothstep(0.30, 0.46, land) * (1.0 - smoothstep(0.46, 0.62, land));
    float churn = waveLayer(vXZ, normalize(vec2(0.7, 0.72)), 0.09, 1.9, uTime) * 0.6 + 0.4;
    float foam = band * smoothstep(0.42, 0.92, churn) * uFoamOn;
    col = mix(col, uFoam, clamp(foam, 0.0, 1.0));

    // 해무와 거리 안개. 낮은 고도에서 더 두껍다
    float fogAmt = smoothstep(uFogNear, uFogFar, dist) * uFog;
    col = mix(col, uFogColor, clamp(fogAmt, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export function makeOceanMaterial({ maskTexture, box }) {
  const uniforms = {
    uMask: { value: maskTexture },
    uBox: { value: new THREE.Vector4(box.x0, box.z0, box.w, box.d) },
    uDeep: { value: new THREE.Color(RENDER.seaDeep) },
    uShallow: { value: new THREE.Color(RENDER.seaShallow) },
    uFoam: { value: new THREE.Color(RENDER.seaFoam) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, -0.7) },
    uSunColor: { value: new THREE.Color('#fff2dd') },
    uSkyLow: { value: new THREE.Color('#cfe0ef') },
    uSkyHigh: { value: new THREE.Color('#5b8fd0') },
    uTime: { value: 0 },
    uReflection: { value: 1 },
    uChop: { value: 0.05 },
    // 평상 해안은 흰 발광 띠 없이 차분하게 둔다. 해일 특보에서만 거품을 올린다
    uFoamOn: { value: 0.12 },
    uFog: { value: 0.85 },
    uFogColor: { value: new THREE.Color(RENDER.fogDay) },
    uFogNear: { value: 8 },
    uFogFar: { value: 60 }
  }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG })
  return { material, uniforms }
}
