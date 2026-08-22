import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory storage for GPS tracking logs
const trackingLogs: Array<{
  routeId: string;
  lat: number;
  lng: number;
  velocidadKmh: number;
  rumboGrados: number;
  timestamp: string;
}> = [];

// ==========================================
// API ROUTES
// ==========================================

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RutaEscolar PWA Backend',
    timestamp: new Date().toISOString()
  });
});

// 2. GPS Tracking Log update
app.post('/api/tracking', (req, res) => {
  const { routeId, lat, lng, velocidadKmh = 0, rumboGrados = 0 } = req.body;
  if (!routeId || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Missing required parameters (routeId, lat, lng)' });
  }

  const entry = {
    routeId,
    lat: Number(lat),
    lng: Number(lng),
    velocidadKmh: Number(velocidadKmh),
    rumboGrados: Number(rumboGrados),
    timestamp: new Date().toISOString()
  };

  trackingLogs.unshift(entry);
  if (trackingLogs.length > 500) trackingLogs.pop();

  res.json({ success: true, tracking: entry });
});

// 3. Get Latest Tracking for a Route
app.get('/api/tracking/:routeId', (req, res) => {
  const { routeId } = req.params;
  const latest = trackingLogs.find((t) => t.routeId === routeId);
  res.json({ latest: latest || null });
});

// ==========================================
// VITE OR STATIC SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Resolve dist/ robustly: some deployments run from a different cwd
    const candidates = [
      path.join(process.cwd(), 'dist'),
      path.join(__dirname, 'dist'),
      path.join(__dirname, '..', 'dist'),
    ];
    let distPath = candidates.find((p) => {
      try {
        return require('fs').existsSync(path.join(p, 'index.html'));
      } catch {
        return false;
      }
    });
    if (!distPath) distPath = candidates[0];

    console.log('📁 Serving static from:', distPath);

    app.use(express.static(distPath, { index: 'index.html', maxAge: '1h' }));

    // SPA fallback: ONLY for paths without a file extension (real routes).
    // Never serve index.html for missing .js/.css/.png assets (avoids MIME errors).
    app.get(/^\/(?!api\/).*/, (req, res) => {
      const p = req.path.split('?')[0];
      const hasExtension = /\.[a-z0-9]+$/i.test(p);
      if (hasExtension) {
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚌 RutaEscolar server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
