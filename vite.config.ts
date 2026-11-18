import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function readGameComingSoonFlag(rootDir: string): boolean {
  const configPath = path.resolve(rootDir, 'src/config.js');
  const raw = fs.readFileSync(configPath, 'utf8');
  const match = raw.match(/export\s+const\s+GAME_COMING_SOON\s*=\s*(true|false)\b/);
  if (!match) {
    throw new Error('Could not read literal GAME_COMING_SOON boolean from src/config.js');
  }
  return match[1] === 'true';
}

// Keep list inside dist/assets/game/ if ComingSoon ever references a file from assets/game/
const KEEP_COMING_SOON_GAME_FILES = new Set<string>();

// Home-page & credits audio files preserved in dist/assets/audio/ when the game is locked
const KEEP_HOME_AUDIO_FILES = new Set<string>([
  'SOURCES.txt',
  'bull-grunt.mp3',
  'credits.mp3',
  'snort-1.mp3',
  'snort-2.mp3',
  'snort-3.mp3',
]);

function gameComingSoonPlugin(rootDir: string): Plugin {
  const gameComingSoon = readGameComingSoonFlag(rootDir);
  let isBuild = false;
  let outDir = path.resolve(rootDir, 'dist');

  return {
    name: 'game-coming-soon-hygiene',
    configResolved(resolved) {
      isBuild = resolved.command === 'build';
      outDir = path.resolve(resolved.root, resolved.build.outDir);
    },
    buildStart() {
      if (isBuild && !gameComingSoon) {
        console.warn('\nGAME_COMING_SOON is false: the game is included in this build.\n');
      }
    },
    transform(code, id) {
      if (!gameComingSoon) return null;
      const normalized = id.replace(/\\/g, '/');
      if (!normalized.endsWith('/src/play/main.tsx')) return null;
      // Single source of truth is src/config.js; fold identifier here so Rolldown drops the dead import('./Play') chunk
      const transformed = code
        .replace(/import\s*\{\s*GAME_COMING_SOON\s*\}\s*from\s*['"]\.\.\/config\.js['"];?\s*/, '')
        .replace(/\bGAME_COMING_SOON\b/g, 'true');
      return {
        code: transformed,
        map: null,
      };
    },
    transformIndexHtml(html, ctx) {
      if (!gameComingSoon) return html;
      const isPlayHtml =
        ctx.filename?.endsWith(path.join('play', 'index.html')) ||
        ctx.path?.includes('/play/');
      if (!isPlayHtml) return html;
      if (html.includes('name="robots"')) return html;
      return html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
    },
    closeBundle() {
      if (!isBuild || !gameComingSoon) return;

      const removed: string[] = [];

      const removeUnkeptInDir = (dirPath: string, keepSet: Set<string>, pruneEmptyDir: boolean) => {
        if (!fs.existsSync(dirPath)) return;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            removeUnkeptInDir(full, keepSet, true);
          } else {
            const relFromOut = path.relative(outDir, full).replace(/\\/g, '/');
            if (!keepSet.has(entry.name) && !keepSet.has(relFromOut)) {
              fs.unlinkSync(full);
              removed.push(relFromOut);
            }
          }
        }
        if (pruneEmptyDir && fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
          fs.rmdirSync(dirPath);
        }
      };

      removeUnkeptInDir(path.join(outDir, 'assets', 'game'), KEEP_COMING_SOON_GAME_FILES, true);
      removeUnkeptInDir(path.join(outDir, 'assets', 'audio'), KEEP_HOME_AUDIO_FILES, false);

      if (removed.length > 0) {
        console.log(
          `[game-coming-soon] Removed ${removed.length} game asset(s) from ${path.basename(outDir)}:\n` +
            removed.map((f) => `  - ${f}`).join('\n')
        );
      } else {
        console.log('[game-coming-soon] No game assets to remove.');
      }
    },
  };
}

export default defineConfig(() => {
  const hasGallopFrames =
    fs.existsSync(path.resolve(__dirname, 'public/assets/game/bull-ride-b.webp')) &&
    fs.existsSync(path.resolve(__dirname, 'public/assets/game/bull-ride-c.webp'));
  const hasAnimJson = fs.existsSync(path.resolve(__dirname, 'public/assets/game/anim.json'));

  return {
    define: {
      __GALLOP_EXTRA_FRAMES__: JSON.stringify(hasGallopFrames),
      __HAS_GAME_ANIM_JSON__: JSON.stringify(hasAnimJson),
    },
    plugins: [
      react(),
      tailwindcss(),
      gameComingSoonPlugin(__dirname),
      {
        name: 'play-mpa-dev-route',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url && (req.url === '/play' || req.url.startsWith('/play?'))) {
              req.url = req.url.replace(/^\/play/, '/play/index.html');
            }
            next();
          });
        },
      },
      {
        name: 'supanova-public-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            const match = urlPath.match(/^\/api\/supanova\/tokens\/([a-zA-Z0-9_-]+)(\/trades)?$/);
            if (!match) return next();

            const slug = encodeURIComponent(match[1]);
            const suffix = match[2] || '';
            const targetUrl = `https://launch-api.supanova.app/api/v1/tokens/${slug}${suffix}`;
            try {
              const upstream = await fetch(targetUrl, {
                headers: { Accept: 'application/json' },
              });
              const body = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'public, max-age=15');
              res.end(body);
            } catch {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Upstream unavailable' }));
            }
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            const match = urlPath.match(/^\/api\/supanova\/tokens\/([a-zA-Z0-9_-]+)(\/trades)?$/);
            if (!match) return next();

            const slug = encodeURIComponent(match[1]);
            const suffix = match[2] || '';
            const targetUrl = `https://launch-api.supanova.app/api/v1/tokens/${slug}${suffix}`;
            try {
              const upstream = await fetch(targetUrl, {
                headers: { Accept: 'application/json' },
              });
              const body = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'public, max-age=15');
              res.end(body);
            } catch {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Upstream unavailable' }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          play: path.resolve(__dirname, 'play/index.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
