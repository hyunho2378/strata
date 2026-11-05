// api/workspace.js Vercel 서버리스 함수. 문서함(문서, 시트, 설문지)과 설문 응답 저장소(PRD v2 F4).
// 저장소는 Upstash Redis. UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN 또는 KV_REST_API_URL/KV_REST_API_TOKEN 을 읽는다.
// 저장소 환경변수가 없으면 503 NO_STORE. 프론트는 이 응답을 받으면 메모리 방식으로 동작한다.
//
// GET    ?kind=doc|sheet|form          목록(설문지는 응답 포함, 담당자 화면용)
// GET    ?id=ID                        항목 1건(설문지는 응답 포함)
// GET    ?id=ID&public=1               응답 링크용 공개 설문지(질문만, 응답과 연결 시트 제외)
// GET    ?action=responses&id=FORMID   설문지 응답 목록
// PUT    본문 항목 JSON                항목 저장(없으면 만들고 있으면 덮어씀). POST 도 같은 동작
// DELETE ?id=ID                        항목 삭제(설문지는 응답도 삭제)
// POST   ?action=submit&id=FORMID      본문 { answers } 응답 추가(공개, 로그인 없음, IP 당 분당 제한)
// POST   ?action=seed                  본문 { items } 저장소가 비어 있고 처음일 때만 시연 항목 저장
//
// 인증이 없는 시연 서비스다. 항목 ID 는 프론트가 추측하기 어려운 값으로 만든다. 실제 주민 정보는 저장하지 않는다.
import { Redis } from '@upstash/redis'

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } })

// STRATA_WS_PREFIX 는 시험용 키 접두어다. 배포 환경에서는 설정하지 않는다(기본 strata:ws)
const P = () => process.env.STRATA_WS_PREFIX || 'strata:ws'
const KEY_ITEM = (id) => `${P()}:item:${id}`
const KEY_INDEX = () => `${P()}:index`
const KEY_RESP = (id) => `${P()}:resp:${id}`
const KEY_SEEDED = () => `${P()}:seeded`

const KINDS = ['doc', 'sheet', 'form']
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{1,63}$/
const MAX_ITEM_BYTES = 900 * 1024
const MAX_ANSWER_BYTES = 20 * 1024
const MAX_RESPONSES_PER_FORM = 5000
const LIST_RESPONSES = 2000
const SUBMIT_PER_MIN = 20
const WRITE_PER_MIN = 240

let client
let clientKey = ''
function getStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  if (!client || clientKey !== `${url}|${token}`) { client = new Redis({ url, token }); clientKey = `${url}|${token}` }
  return client
}

const readBody = (req) => {
  let b = req.body
  if (Buffer.isBuffer(b)) b = b.toString('utf8')
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { return null } }
  return b && typeof b === 'object' ? b : null
}

const clientIp = (req) => String(req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()

// 고정 창 호출 제한. 저장소 오류로 제한을 못 걸면 통과시킨다(시연 서비스, 가용성 우선)
async function allow(redis, bucket, max, ttl = 60) {
  try {
    const key = `${P()}:rl:${bucket}:${Math.floor(Date.now() / (ttl * 1000))}`
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, ttl + 5)
    return n <= max
  } catch { return true }
}

const randId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function cleanItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: '항목 형식 오류' }
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return { error: 'id 형식 오류' }
  if (!KINDS.includes(raw.kind)) return { error: 'kind 는 doc, sheet, form 중 하나' }
  if (typeof raw.title !== 'string' || raw.title.length > 200) return { error: 'title 오류' }
  const item = { ...raw }
  if (item.kind === 'form') delete item.responses // 응답은 별도 목록이 원본이다
  const size = Buffer.byteLength(JSON.stringify(item), 'utf8')
  if (size > MAX_ITEM_BYTES) return { error: '항목 크기 900KB 초과', status: 413 }
  return { item }
}

async function loadResponses(redis, formId, max = LIST_RESPONSES) {
  const list = await redis.lrange(KEY_RESP(formId), 0, max - 1)
  return (list || []).map((x) => (typeof x === 'string' ? safeParse(x) : x)).filter(Boolean)
}
const safeParse = (s) => { try { return JSON.parse(s) } catch { return null } }

const publicForm = (f) => ({ id: f.id, kind: 'form', title: f.title, desc: f.desc || '', questions: f.questions || [], open: f.open !== false })

// 응답 값 검증. 질문에 없는 키는 버리고 길이를 제한한다
function cleanAnswers(form, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { error: 'answers 형식 오류' }
  const out = {}
  for (const q of form.questions || []) {
    const v = answers[q.id]
    let val = null
    if (typeof v === 'string') val = v.slice(0, 2000)
    else if (typeof v === 'number' && Number.isFinite(v)) val = v
    else if (Array.isArray(v)) val = v.filter((x) => typeof x === 'string').slice(0, 50).map((x) => x.slice(0, 200))
    const empty = val == null || val === '' || (Array.isArray(val) && !val.length)
    if (q.required && empty) return { error: `필수 질문 미응답: ${q.title}` }
    if (!empty) out[q.id] = val
  }
  return { answers: out }
}

async function handleSubmit(req, res, redis) {
  const formId = String(req.query?.id || '')
  if (!ID_RE.test(formId)) return fail(res, 400, 'BAD_ID', 'id 필요')
  const body = readBody(req)
  if (!body) return fail(res, 400, 'BAD_JSON', '요청 형식 오류')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_ANSWER_BYTES) return fail(res, 413, 'TOO_LARGE', '응답 크기 20KB 초과')
  if (!(await allow(redis, `sub:${clientIp(req)}`, SUBMIT_PER_MIN))) {
    res.setHeader('Retry-After', '60')
    return fail(res, 429, 'RATE_LIMIT', '제출이 너무 잦습니다. 잠시 뒤 다시 시도하세요')
  }
  const form = await redis.get(KEY_ITEM(formId))
  if (!form || form.kind !== 'form') return fail(res, 404, 'NOT_FOUND', '설문지를 찾을 수 없습니다')
  if (form.open === false) return fail(res, 409, 'CLOSED', '응답을 받지 않는 설문지입니다')
  const c = cleanAnswers(form, body.answers)
  if (c.error) return fail(res, 400, 'BAD_ANSWERS', c.error)
  const count = await redis.llen(KEY_RESP(formId))
  if (count >= MAX_RESPONSES_PER_FORM) return fail(res, 409, 'FULL', `응답 ${MAX_RESPONSES_PER_FORM}개 상한에 도달했습니다`)
  const response = { id: `r${randId()}`, at: new Date().toISOString(), answers: c.answers }
  await redis.rpush(KEY_RESP(formId), JSON.stringify(response))
  return res.status(200).json({ ok: true, id: response.id, at: response.at })
}

async function handleSeed(req, res, redis) {
  const body = readBody(req)
  const items = Array.isArray(body?.items) ? body.items : null
  if (!items || !items.length || items.length > 50) return fail(res, 400, 'BAD_INPUT', 'items 는 1~50개 배열')
  const cleaned = []
  for (const raw of items) {
    const c = cleanItem(raw)
    if (c.error) return fail(res, c.status || 400, 'BAD_ITEM', c.error)
    cleaned.push(c.item)
  }
  const existing = await redis.scard(KEY_INDEX())
  if (existing > 0) return res.status(200).json({ seeded: false })
  const lock = await redis.set(KEY_SEEDED(), new Date().toISOString(), { nx: true })
  if (lock !== 'OK') return res.status(200).json({ seeded: false })
  for (const item of cleaned) {
    await redis.set(KEY_ITEM(item.id), item)
    await redis.sadd(KEY_INDEX(), item.id)
  }
  return res.status(200).json({ seeded: true, count: cleaned.length })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const redis = getStore()
  if (!redis) return fail(res, 503, 'NO_STORE', '저장소 미연결. UPSTASH_REDIS_REST_URL 과 UPSTASH_REDIS_REST_TOKEN 설정 필요')
  const q = req.query || {}
  try {
    if (req.method === 'GET') {
      if (q.action === 'responses') {
        const id = String(q.id || '')
        if (!ID_RE.test(id)) return fail(res, 400, 'BAD_ID', 'id 필요')
        return res.status(200).json({ responses: await loadResponses(redis, id) })
      }
      if (q.id) {
        const id = String(q.id)
        if (!ID_RE.test(id)) return fail(res, 400, 'BAD_ID', 'id 형식 오류')
        const item = await redis.get(KEY_ITEM(id))
        if (!item) return fail(res, 404, 'NOT_FOUND', '항목을 찾을 수 없습니다')
        if (q.public) {
          if (item.kind !== 'form') return fail(res, 404, 'NOT_FOUND', '설문지를 찾을 수 없습니다')
          return res.status(200).json({ item: publicForm(item) })
        }
        if (item.kind === 'form') item.responses = await loadResponses(redis, id)
        return res.status(200).json({ item })
      }
      const ids = await redis.smembers(KEY_INDEX())
      let items = ids.length ? (await redis.mget(...ids.map(KEY_ITEM))).filter(Boolean) : []
      if (q.kind) items = items.filter((x) => x.kind === q.kind)
      await Promise.all(items.filter((x) => x.kind === 'form').map(async (f) => { f.responses = await loadResponses(redis, f.id) }))
      return res.status(200).json({ items })
    }

    if (req.method === 'POST' && q.action === 'submit') return await handleSubmit(req, res, redis)

    if (req.method === 'POST' && q.action === 'seed') {
      if (!(await allow(redis, `seed:${clientIp(req)}`, 10))) return fail(res, 429, 'RATE_LIMIT', '요청이 너무 잦습니다')
      return await handleSeed(req, res, redis)
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      if (!(await allow(redis, `w:${clientIp(req)}`, WRITE_PER_MIN))) {
        res.setHeader('Retry-After', '60')
        return fail(res, 429, 'RATE_LIMIT', '저장 요청이 너무 잦습니다')
      }
      const body = readBody(req)
      if (!body) return fail(res, 400, 'BAD_JSON', '요청 형식 오류')
      const c = cleanItem(body.item && typeof body.item === 'object' ? body.item : body)
      if (c.error) return fail(res, c.status || 400, 'BAD_ITEM', c.error)
      await redis.set(KEY_ITEM(c.item.id), c.item)
      await redis.sadd(KEY_INDEX(), c.item.id)
      return res.status(200).json({ ok: true, id: c.item.id })
    }

    if (req.method === 'DELETE') {
      const id = String(q.id || '')
      if (!ID_RE.test(id)) return fail(res, 400, 'BAD_ID', 'id 필요')
      if (!(await allow(redis, `w:${clientIp(req)}`, WRITE_PER_MIN))) return fail(res, 429, 'RATE_LIMIT', '요청이 너무 잦습니다')
      const item = await redis.get(KEY_ITEM(id))
      if (item?.kind === 'form') await redis.del(KEY_RESP(id))
      await redis.del(KEY_ITEM(id))
      await redis.srem(KEY_INDEX(), id)
      return res.status(200).json({ ok: true })
    }

    return fail(res, 405, 'METHOD', 'GET, PUT, POST, DELETE 만 허용')
  } catch (e) {
    return fail(res, 502, 'STORE', `저장소 오류: ${e.message}`)
  }
}
