export interface Env {
  DB: D1Database
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'poleczka-pwa', database: Boolean(env.DB) })
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
  },
}
