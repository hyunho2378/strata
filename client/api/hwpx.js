// api/hwpx.js Vercel 서버리스 함수. 편집기 문서를 한글 문서(HWPX)로 만든다(kordoc 공문서 엔진 markdownToHwpx).
// POST { title, markdown, preset, gongmun, spans, paras, render }
//  - markdown: 편집기 본문. 개요 단계는 들여쓴 목록, 글자와 문단 모양은 ⟪sN⟫글⟪/⟫, ⟪pN⟫ 표지로 들어온다
//  - gongmun: kordoc 공문서 옵션 가운데 허용한 키만 받는다(두문, 결문, 결재란, 공고 머리, 보도자료 머리, 글꼴, 항목 체계, 쪽 번호)
//  - spans, paras: 표지 번호별 글자 모양(크기, 색, 밑줄, 취소선, 음영, 글꼴, 장평, 자간)과 문단 모양(정렬, 줄 간격, 쪽 나눔)
//  - render: true 면 파일 대신 { svg, pageCount, width, height, valid } 를 돌려준다(한글 문서 보기, kordoc 조판 엔진)
// 만든 파일은 kordoc validateHwpx 로 ZIP, mimetype, 필수 파트, XML 형식을 검사한 뒤에만 내보낸다.
import { applyHwpxStyles } from './_hwpxStyle.js'

export const config = { maxDuration: 30 }

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } })
const ALLOWED = ['docHead', 'docFoot', 'approval', 'noticeHead', 'press', 'bodyFont', 'bodyPt', 'numbering', 'cover', 'toc', 'summary', 'pageNumbers', 'endMark', 'bullet2', 'levels']
const pick = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => ALLOWED.includes(k)))
const MAX_MD = 500 * 1024
const safeName = (s) => (String(s || '문서').replace(/[\\/:*?"<>|\r\n]/g, '').trim().slice(0, 80) || '문서')
const small = (o, n) => (o && typeof o === 'object' && Object.keys(o).length <= n ? o : {})

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD', 'POST 만 허용')
  let body = req.body
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { return fail(res, 400, 'BAD_JSON', '요청 형식 오류') } }
  const { title, markdown, preset = '기안문', gongmun, spans, paras, render } = body || {}
  if (typeof markdown !== 'string' || !markdown.trim()) return fail(res, 400, 'BAD_INPUT', 'markdown 필요')
  if (typeof preset !== 'string' || preset.length > 20) return fail(res, 400, 'PRESET', 'preset 형식 오류')
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MD) return fail(res, 413, 'TOO_LARGE', '본문 500KB 초과')
  const name = safeName(title)

  try {
    const k = await import('kordoc')
    const warnings = []
    const raw = await k.markdownToHwpx(markdown, { gongmun: { ...pick(gongmun), preset: k.normalizeGongmunPreset(preset) }, warnings })
    const styled = await applyHwpxStyles(raw, { spans: small(spans, 5000), paras: small(paras, 5000) })
    const buf = Buffer.from(styled.buffer)
    const v = await k.validateHwpx(buf)
    if (!v.ok) return fail(res, 500, 'INVALID_HWPX', `한글 문서 검사 실패: ${(v.issues || []).map((i) => i.message || i).join(', ').slice(0, 300)}`)
    if (render) {
      const r = await k.renderHwpxToSvg(buf, { reflow: true })
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ svg: r.svg, pageCount: r.pageCount, width: r.width, height: r.height, valid: true, styled: styled.applied, warnings: [...warnings, ...(r.warnings || [])].slice(0, 20), bytes: buf.length })
    }
    res.setHeader('Content-Type', 'application/hwp+zip')
    res.setHeader('Content-Disposition', `attachment; filename="document.hwpx"; filename*=UTF-8''${encodeURIComponent(`${name}.hwpx`)}`)
    res.setHeader('Content-Length', String(buf.length))
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Hwpx-Valid', '1')
    if (warnings.length) res.setHeader('X-Strata-Warnings', encodeURIComponent(warnings.join(' | ').slice(0, 400)))
    return res.status(200).send(buf)
  } catch (e) {
    return fail(res, 502, 'KORDOC', `한글 문서 변환 실패: ${e.message}`)
  }
}
