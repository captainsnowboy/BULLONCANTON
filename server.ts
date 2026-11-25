import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

// Public Supanova proxy routes (no API key, no auth headers) to avoid browser CORS blocks
app.get('/api/supanova/tokens/:slug', async (req, res) => {
  const slug = encodeURIComponent(req.params.slug);
  try {
    const upstream = await fetch(`https://launch-api.supanova.app/api/v1/tokens/${slug}`, {
      headers: { Accept: 'application/json' },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.send(body);
  } catch {
    res.status(502).json({ error: 'Upstream unavailable' });
  }
});

app.get('/api/supanova/tokens/:slug/trades', async (req, res) => {
  const slug = encodeURIComponent(req.params.slug);
  const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
  const limitQuery =
    Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? `?limit=${rawLimit}` : '';
  try {
    const upstream = await fetch(
      `https://launch-api.supanova.app/api/v1/tokens/${slug}/trades${limitQuery}`,
      {
        headers: { Accept: 'application/json' },
      }
    );
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.send(body);
  } catch {
    res.status(502).json({ error: 'Upstream unavailable' });
  }
});

// Serve static assets from dist directory with caching
app.use(
  express.static(path.join(__dirname, 'dist'), {
    maxAge: '1h',
    etag: true,
  })
);

// Serve the separate Play page before the SPA catch-all
app.get(['/play', '/play/'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'play', 'index.html'));
});

// Fallback to index.html for SPA client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bull on Canton server running on http://0.0.0.0:${PORT}`);
});
