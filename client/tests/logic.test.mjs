// node tests/logic.test.mjs 계산 로직 단위 테스트
import assert from 'node:assert/strict'
import { formulaShortage } from '../src/lib/shortage.js'
import { buildContext, runBaseline, runOptimize, planDispatch } from '../src/lib/assign.js'
import { computeShortage, requiredExtraVehicles, scopeInput } from '../src/lib/shortageCalc.js'
import { LTC, TEMP_SHELTERS, VILLAGES } from '../src/mock/donghaeData.js'
import { verifyResult } from '../src/lib/intake.js'
import { diffOf, verifyNote, SAMPLE_NOTES, seedFieldNotes } from '../src/lib/notes.js'
import { detectAnomalies } from '../src/lib/anomaly.js'
import { buildSeed } from '../src/mock/seed.js'

let n = 0
const ok = (name, fn) => { fn(); n += 1; console.log('ok', name) }

ok('원문 예시: 침상 12 차량 2 왕복 120 → 부족 6', () => {
  const f = formulaShortage({ persons: 12, vehicles: 2, roundTripMinutes: 120 })
  assert.equal(f.availableMinutes, 420); assert.equal(f.trips, 3); assert.equal(f.movable, 6); assert.equal(f.shortage, 6)
})

ok('배정 기준선과 최적화가 원문 예시에서 같은 미이송 6', () => {
  const t0 = Date.UTC(2026, 3, 5, 0, 0)
  const persons = Array.from({ length: 12 }, (_, i) => ({ code: `P${String(i).padStart(2, '0')}`, villageCode: 'V1', grade: 'bed' }))
  const input = { persons, villages: [{ code: 'V1', roundTripMin: 120 }], vehicles: [{ code: 'A', type: 'ambulance' }, { code: 'B', type: 'ambulance' }], t0 }
  const ctx = buildContext(input)
  assert.equal(runBaseline(ctx).metrics.unserved, 6)
  assert.equal(runOptimize(ctx).metrics.unserved, 6)
})

const seed = buildSeed()
const scenario = seed.scenarios[0]
const t0 = seed.today
ok('실제 자료 기반 규모', () => {
  assert.equal(seed.villages.length, 37)
  assert.equal(TEMP_SHELTERS.length, 27)
  assert.equal(TEMP_SHELTERS.reduce((s, x) => s + x.capacity, 0), 5601)
  assert.equal(VILLAGES.reduce((s, v) => s + v.targets, 0), LTC.homeTotal)
  for (const v of seed.villages) assert.ok(Array.isArray(v.lngLat) && v.drive.length === 27, v.code)
  assert.equal(seed.vehicles.filter((v) => v.type === 'ambulance').length, 6)
  console.log('   대상자', seed.persons.length, '등급', JSON.stringify(seed.persons.reduce((m, p) => (m[p.grade] = (m[p.grade] || 0) + 1, m), {})))
})

let sh
ok('평시 부족분 계산', () => {
  sh = computeShortage({ ...seed, scenario, t0 })
  console.log('   총 부족', sh.total, '등급별', JSON.stringify(sh.byGrade), '잠정', sh.provisional)
  console.log('   공식표', sh.formula.map((f) => `${f.grade} 대상${f.persons} 차${f.vehicles} 왕복${f.roundTrip} 회${f.trips} 가능${f.movable} 부족${f.shortage}`).join(' | '))
})

ok('필요 추가 차량으로 부족분 해소', () => {
  const ex = requiredExtraVehicles({ ...seed, scenario, t0 }, sh)
  console.log('   ', JSON.stringify(ex))
  ex.forEach((e) => assert.equal(e.resolved, true))
})

ok('확산 시나리오는 구역 안 대피소를 피한다', () => {
  for (const sc of seed.scenarios.filter((x) => x.kind === 'fire')) {
    const sp = scopeInput({ persons: seed.persons, villages: seed.villages, scenario: sc, settings: seed.settings })
    const scope = new Set(sc.affected)
    for (const v of sp.villages) {
      const s = TEMP_SHELTERS.find((x) => x.code === v.shelterCode)
      if (v.shelterNote !== 'overflow') assert.ok(!scope.has(s.villageCode), `${sc.id} ${v.code} -> ${s.name}`)
    }
    console.log('   ', sc.id, '구역', sc.affected.length, '곳, 대상자', sp.persons.length, '명, 첫 도달', sc.windowHours, '시간')
  }
})

ok('최적화는 기준선보다 나쁘지 않음 (시나리오별 대피 대상 구역)', () => {
  for (const sc of seed.scenarios) {
    const sp = scopeInput({ persons: seed.persons, villages: seed.villages, scenario: sc, settings: seed.settings })
    const arrivals = Object.fromEntries(sp.villages.map((v) => [v.code, t0 + (sc.windowHours + sc.offsetHours[v.code]) * 3600000]))
    const p = planDispatch({ ...seed, persons: sp.persons, villages: sp.villages, t0, arrivals, prepMinutes: 60, windowHours: sc.windowHours, completeBeforeHours: 0 })
    console.log('   ', sc.id, '기준선 미이송', p.baseline.metrics.unserved, '가중', p.baseline.metrics.weightedUnserved, '| 최적화', p.metrics.unserved, '가중', p.metrics.weightedUnserved, 'rule', p.rule, p.elapsedMs + 'ms', '차량묶음', p.assignments.length, '도우미경고', p.warnings.length)
    assert.ok(p.metrics.weightedUnserved <= p.baseline.metrics.weightedUnserved)
    for (const a of p.assignments) for (const tr of a.trips) assert.ok(tr.finishAt <= p.ctx.deadlines[tr.village].completeBy)
    const all = new Set(); for (const a of p.assignments) for (const tr of a.trips) for (const c of tr.personCodes) { assert.ok(!all.has(c)); all.add(c) }
    assert.equal(all.size + p.unassigned.length, sp.persons.length)
  }
})

ok('판독 원문 대조: 전사문에 없는 근거 문구는 신뢰도 하', () => {
  const doc = seed.intakeDocs[2]
  const r = verifyResult(doc.transcript, doc.results[1])
  assert.equal(r.quoteMatched, false); assert.equal(r.confidence, 'low')
  const r2 = verifyResult(doc.transcript, doc.results[0])
  assert.equal(r2.quoteMatched, true)
})

ok('이상 탐지 규칙', () => {
  const a = detectAnomalies({ ...seed, now: t0 })
  const rules = a.reduce((m, x) => (m[x.rule] = (m[x.rule] || 0) + 1, m), {})
  console.log('   ', JSON.stringify(rules))
  for (const k of ['pendingLong', 'gradeConflict', 'duplicate', 'contract', 'helperLoad']) assert.ok(rules[k] > 0, k)
})
// ---- 현장 소식(글, 음성) 판독
const noteSample = (id) => SAMPLE_NOTES.find((x) => x.id === id)
ok('현장 소식: 등급이 무거워지면 명부 변경 후보가 생긴다', () => {
  const s = noteSample('worse')
  const r = verifyNote(s.text, s.read, { grade: 'assist', tags: [] })
  assert.equal(r.diff.gradeChanged, true); assert.equal(r.diff.next.grade, 'wheelchair')
  assert.equal(r.quoteMatched, true); assert.equal(r.lightened, false); assert.equal(r.confidence, 'high')
})
ok('현장 소식: 등급을 낮추는 제안은 일치도를 한 단계 내린다', () => {
  const s = noteSample('better')
  const r = verifyNote(s.text, s.read, { grade: 'wheelchair', tags: ['oxygen'] })
  assert.equal(r.lightened, true); assert.equal(r.confidence, 'mid')
  assert.deepEqual(r.diff.removedTags, ['oxygen']); assert.deepEqual(r.diff.next.tags, [])
})
ok('현장 소식: 소식에 없는 근거 문구는 확인 필요로 떨어진다', () => {
  const s = noteSample('hallu')
  const r = verifyNote(s.text, s.read, { grade: 'walk', tags: [] })
  assert.equal(r.quoteMatched, false); assert.equal(r.confidence, 'low')
})
ok('현장 소식: 달라진 점이 없으면 명부를 바꾸지 않는다', () => {
  const s = noteSample('same')
  const d = diffOf({ grade: 'assist', tags: ['guardian'] }, s.read)
  assert.equal(d.changed, false); assert.deepEqual(d.next, { grade: 'assist', tags: ['guardian'] })
})
ok('현장 소식: 처음 화면에 확인 대기 3건이 있다', () => {
  const notes = seedFieldNotes(seed.persons, seed.today)
  assert.equal(notes.length, 3); assert.ok(notes.every((n) => n.status === 'pending' && n.mock))
})
console.log(`${n} passed`)
