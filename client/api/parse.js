// api/parse.js Vercel 서버리스 함수. HWP, HWPX, PDF, DOCX 파일을 읽어 마크다운으로 돌려준다(PRD v2 F5, kordoc parse).
// POST ?name=파일명 본문 파일 바이트(Content-Type application/octet-stream, 4MB 이하) → { markdown, title, fileType }
// OCR 은 끈다(ocr: false). 스캔 PDF 는 글자를 읽지 못할 수 있다. Vercel 요청 본문 상한 4.5MB 때문에 4MB 로 제한한다.

export const config = { maxDuration: 60 }

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } })

const MAX_BYTES = 4 * 1024 * 1024
const EXT = ['.hwp', '.hwpx', '.pdf', '.docx']
const MAX_MD = 600 * 1024

async function readBytes(req) {
  const b = req.body
  if (Buffer.isBuffer(b)) return b
  if (b instanceof Uint8Array) return Buffer.from(b)
  if (typeof req.on !== 'function' || req.readableEnded) return null // 본문이 이미 JSON 으로 해석된 경우
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BYTES + 1024) throw Object.assign(new Error('too large'), { code: 'TOO_LARGE' })
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}

const baseName = (n) => String(n || '').replace(/\.[^.]+$/, '').trim()

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD', 'POST 만 허용')
  const name = String(req.query?.name || '')
  const ext = (name.match(/\.[^.]+$/)?.[0] || '').toLowerCase()
  if (!EXT.includes(ext)) return fail(res, 400, 'EXT', `확장자는 ${EXT.join(', ')} 중 하나`)

  let buf
  try { buf = await readBytes(req) } catch (e) {
    return e.code === 'TOO_LARGE' ? fail(res, 413, 'TOO_LARGE', '파일 크기 4MB 초과') : fail(res, 400, 'BODY', '본문을 읽지 못했습니다')
  }
  if (!buf || !buf.length) return fail(res, 400, 'BAD_INPUT', '파일 본문 필요')
  if (buf.length > MAX_BYTES) return fail(res, 413, 'TOO_LARGE', '파일 크기 4MB 초과')

  try {
    const { parse } = await import('kordoc')
    const r = await parse(buf, { ocr: false })
    if (!r.success) return fail(res, 422, r.code || 'PARSE', `파일을 읽지 못했습니다: ${r.error || '알 수 없는 오류'}`)
    let markdown = String(r.markdown || '')
    if (!markdown.trim()) return fail(res, 422, 'EMPTY', '읽을 수 있는 글자가 없습니다. 스캔한 이미지 파일은 지원하지 않습니다')
    if (markdown.length > MAX_MD) markdown = markdown.slice(0, MAX_MD)
    const heading = markdown.match(/^\s{0,3}#{1,2}\s+(.+)$/m)?.[1]?.trim()
    const title = (r.metadata?.title || '').trim() || heading || baseName(name) || '가져온 문서'
    return res.status(200).json({ markdown, title: title.slice(0, 120), fileType: r.fileType || ext.slice(1) })
  } catch (e) {
    return fail(res, 502, 'KORDOC', `파일 해석 실패: ${e.message}`)
  }
}
