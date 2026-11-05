// api/lint.js Vercel 서버리스 함수. 공문서 표기법과 개조식 문체를 검사한다(kordoc lintGongmunText, lintMuncheText).
// POST { text, preset } → { gongmun: [...], munche: [...] }. 근거: 행정업무운영 편람 표기 규칙(kordoc 구현)
export const config = { maxDuration: 15 }
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } })

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD', 'POST 만 허용')
  let body = req.body
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { return fail(res, 400, 'BAD_JSON', '요청 형식 오류') } }
  const { text, preset } = body || {}
  if (typeof text !== 'string' || !text.trim()) return fail(res, 400, 'BAD_INPUT', 'text 필요')
  if (text.length > 200000) return fail(res, 413, 'TOO_LARGE', '본문이 너무 김')
  try {
    const k = await import('kordoc')
    const gongmun = k.lintGongmunText(text, { document: true }).slice(0, 200)
    const munche = k.usesGaejosikMunche(preset) ? k.lintMuncheText(text).slice(0, 200) : []
    return res.status(200).json({ gongmun, munche })
  } catch (e) {
    return fail(res, 502, 'KORDOC', `검사 실패: ${e.message}`)
  }
}
