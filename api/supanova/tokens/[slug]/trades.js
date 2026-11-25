function extractSlug(req) {
  const qSlug = req?.query?.slug;
  if (typeof qSlug === 'string' && /^[a-zA-Z0-9_-]+$/.test(qSlug)) {
    return qSlug;
  }
  const urlPath = typeof req?.url === 'string' ? req.url.split('?')[0] : '';
  const match = urlPath.match(/\/tokens\/([a-zA-Z0-9_-]+)\/trades\/?$/);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const slug = extractSlug(req);
  if (!slug) {
    res.status(400).json({ error: 'Invalid token slug' });
    return;
  }

  const rawLimitParam =
    typeof req?.query?.limit === 'string'
      ? req.query.limit
      : typeof req?.url === 'string'
      ? new URL(req.url, 'http://localhost').searchParams.get('limit')
      : null;
  const limitNum = rawLimitParam ? parseInt(rawLimitParam, 10) : NaN;
  const limitQuery =
    Number.isFinite(limitNum) && limitNum >= 1 && limitNum <= 100 ? `?limit=${limitNum}` : '';

  try {
    const upstream = await fetch(
      `https://launch-api.supanova.app/api/v1/tokens/${encodeURIComponent(slug)}/trades${limitQuery}`,
      { headers: { Accept: 'application/json' } }
    );
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    res.status(upstream.status).send(body);
  } catch {
    res.status(502).json({ error: 'Upstream unavailable' });
  }
}
