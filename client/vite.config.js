import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중 /api 는 배포된 서버리스 함수로 보낸다(공공데이터 키가 서버에만 있다).
// 다만 키가 필요 없는 문서 함수(hwpx, lint, law)는 이 컴퓨터에서 바로 돌려 배포 전에 시험한다.
const LOCAL_API = ['hwpx', 'lint', 'law']

function localApi() {
  return {
    name: 'strata-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url.match(/^\/api\/([a-z]+)(?:\?(.*))?$/)
        if (!m || !LOCAL_API.includes(m[1])) return next()
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks)
        let body = raw.length ? raw.toString('utf8') : undefined
        if (body && /json/.test(req.headers['content-type'] || '')) { try { body = JSON.parse(body) } catch { /* 함수가 처리 */ } }
        const vreq = { method: req.method, headers: req.headers, body, query: Object.fromEntries(new URLSearchParams(m[2] || '')), url: req.url }
        const vres = {
          statusCode: 200,
          status(c) { this.statusCode = c; return this },
          setHeader(k, v) { res.setHeader(k, v); return this },
          json(o) { res.statusCode = this.statusCode; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return this },
          send(b) { res.statusCode = this.statusCode; res.end(b); return this },
          end(b) { res.statusCode = this.statusCode; res.end(b); return this }
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          await mod.default(vreq, vres)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: { code: 'LOCAL', message: String(e?.stack || e) } }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
  ssr: { external: ['kordoc'] },
  server: { port: 5173, ...(process.env.VITE_API_PROXY ? { proxy: { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true, secure: true } } } : {}) }
})
