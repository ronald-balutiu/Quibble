// Infrastructure only. Session, judging and reveal routes are not implemented.
export default {
  fetch(request) {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/health' && request.method === 'GET') {
      return Response.json({ status: 'ok' })
    }

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
} satisfies ExportedHandler
