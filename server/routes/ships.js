import { Router } from 'express';
import shipStore from '../ais/shipStore.js';
import { fetchVesselTrack, fetchVesselDetails } from '../ais/mstProvider.js';

const router = Router();

/** GET /api/ships — Snapshot of all tracked ships */
router.get('/', (req, res) => {
  const ships = shipStore.getAll();
  res.json({
    count: ships.length,
    ships: ships.map(s => ({
      mmsi: s.mmsi,
      name: s.name || 'Unknown',
      lat: s.lat,
      lng: s.lng,
      speed: s.speed,
      heading: s.heading,
      cog: s.cog,
      navStatus: s.navStatus,
      shipCategory: s.shipCategory || 'Unknown',
      destination: s.destination || null,
    })),
  });
});

/** GET /api/ships/stream — SSE endpoint, pushes batched updates every 3s */
router.get('/stream', (req, res) => {
  // In serverless (Vercel), SSE can't maintain a persistent connection.
  // Send an empty snapshot and a serverless flag so the client knows not to retry.
  if (process.env.VERCEL) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'close',
    });
    res.write(`event: snapshot\ndata: []\n\n`);
    res.write(`event: serverless\ndata: {"serverless":true}\n\n`);
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial snapshot
  const initial = shipStore.getAll().map(s => ({
    mmsi: s.mmsi,
    name: s.name || 'Unknown',
    lat: s.lat,
    lng: s.lng,
    speed: s.speed,
    heading: s.heading,
    cog: s.cog,
    navStatus: s.navStatus,
    shipCategory: s.shipCategory || 'Unknown',
    destination: s.destination || null,
  }));
  res.write(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`);

  // Push updates every 3 seconds
  const interval = setInterval(() => {
    const ships = shipStore.getAll().map(s => ({
      mmsi: s.mmsi,
      name: s.name || 'Unknown',
      lat: s.lat,
      lng: s.lng,
      speed: s.speed,
      heading: s.heading,
      cog: s.cog,
      navStatus: s.navStatus,
      shipCategory: s.shipCategory || 'Unknown',
      destination: s.destination || null,
    }));
    res.write(`event: update\ndata: ${JSON.stringify(ships)}\n\n`);
  }, 3000);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(heartbeat);
  });
});

/** GET /api/ships/track/:mmsi — Historical track from MyShipTracking */
router.get('/track/:mmsi', async (req, res) => {
  const mmsi = parseInt(req.params.mmsi, 10);
  if (isNaN(mmsi)) {
    return res.status(400).json({ error: 'Invalid MMSI' });
  }

  const days = parseInt(req.query.days, 10) || 7;
  const track = await fetchVesselTrack(mmsi, Math.min(days, 20));
  res.json({ mmsi, count: track.length, track });
});

/** GET /api/ships/details/:mmsi — Extended vessel info from MyShipTracking */
router.get('/details/:mmsi', async (req, res) => {
  const mmsi = parseInt(req.params.mmsi, 10);
  if (isNaN(mmsi)) {
    return res.status(400).json({ error: 'Invalid MMSI' });
  }

  const details = await fetchVesselDetails(mmsi);
  if (!details) {
    return res.status(404).json({ error: 'Vessel details not found' });
  }
  res.json(details);
});

/** GET /api/ships/:mmsi — Single ship from live store */
router.get('/:mmsi', (req, res) => {
  const mmsi = parseInt(req.params.mmsi, 10);
  if (isNaN(mmsi)) {
    return res.status(400).json({ error: 'Invalid MMSI' });
  }

  const ship = shipStore.get(mmsi);
  if (!ship) {
    return res.status(404).json({ error: 'Ship not found' });
  }

  res.json(ship);
});

export default router;
