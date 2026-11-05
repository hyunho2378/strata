// workspaceApi.js 문서함 서버 함수 호출. 응답이 JSON 이 아니거나 실패하면 unavailable 로 본다
// (vite 개발 서버에서는 /api 가 index.html 을 돌려주므로 메모리 모드로 떨어진다).

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}

async function call(path, opts = {}) {
  let r
  try {
    r = await fetch(path, opts)
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결하지 못했습니다')
  }
  const type = r.headers.get('content-type') || ''
  if (!type.includes('application/json')) throw new ApiError(r.status, 'UNAVAILABLE', '서버 저장소를 쓸 수 없습니다')
  const body = await r.json()
  if (!r.ok) throw new ApiError(r.status, body?.error?.code || 'ERROR', body?.error?.message || '요청을 처리하지 못했습니다')
  return body
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// 서버에 보낼 항목. 설문 응답은 따로 저장하므로 빼고, 너무 크면 버전 기록을 줄인다
export function serialize(item) {
  const { responses, ...rest } = item // eslint-disable-line no-unused-vars
  let out = item.kind === 'form' ? rest : item
  if (JSON.stringify(out).length > 700_000 && out.versions) out = { ...out, versions: out.versions.slice(-3) }
  return out
}

export const list = () => call('/api/workspace').then((b) => b.items || [])
export const publicForm = (id) => call(`/api/workspace?id=${encodeURIComponent(id)}&public=1`).then((b) => b.item)
export const put = (item) => call('/api/workspace', json('PUT', serialize(item)))
export const del = (id) => call(`/api/workspace?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
export const submit = (formId, answers) => call(`/api/workspace?action=submit&id=${encodeURIComponent(formId)}`, json('POST', { answers }))
export const responses = (id) => call(`/api/workspace?action=responses&id=${encodeURIComponent(id)}`).then((b) => b.responses || [])
export const seed = (items) => call('/api/workspace?action=seed', json('POST', { items: items.map(serialize) }))
export const law = (text) => call('/api/law', json('POST', { text }))
export const lint = (text, preset) => call('/api/lint', json('POST', { text, preset }))

export async function parseFile(file) {
  if (file.size > 4 * 1024 * 1024) throw new ApiError(413, 'TOO_LARGE', '4MB 이하 파일만 읽을 수 있습니다')
  return call(`/api/parse?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
}

// 한글 문서 보기: 내보낼 파일과 같은 HWPX 를 kordoc 조판 엔진으로 그린 SVG
export const hwpxPreview = (doc) => call('/api/hwpx', json('POST', { ...doc, render: true }))

export async function hwpx({ title, markdown, preset, gongmun, spans, paras }) {
  let r
  try {
    r = await fetch('/api/hwpx', json('POST', { title, markdown, preset, gongmun, spans, paras }))
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결하지 못했습니다')
  }
  const type = r.headers.get('content-type') || ''
  if (!r.ok || type.includes('application/json') || type.includes('text/html')) {
    let msg = '한글 문서를 만들지 못했습니다'
    if (type.includes('application/json')) { const b = await r.json().catch(() => null); msg = b?.error?.message || msg }
    else if (type.includes('text/html')) msg = '한글 문서 변환은 배포된 서버에서만 동작합니다'
    throw new ApiError(r.status, 'HWPX', msg)
  }
  return r.blob()
}
