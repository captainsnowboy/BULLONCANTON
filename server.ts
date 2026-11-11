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

// Serve static assets from dist directory with caching
app.use(
  express.static(path.join(__dirname, 'dist'), {
    maxAge: '1h',
    etag: true,
  })
);

// Fallback to index.html for SPA client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bull on Canton server running on http://0.0.0.0:${PORT}`);
});
