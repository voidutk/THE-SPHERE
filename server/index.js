import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '.env') });

import app from './app.js';
import { createLogger } from './logger.js';
import { startAISClient } from './ais/aisClient.js';

const logger = createLogger();
const PORT = process.env.PORT || 3001;

// Start — only when running as a standalone server (not in Vercel serverless)
app.listen(PORT, () => {
  logger.info(`🌐 THE SPHERE API running on http://localhost:${PORT}`);

  // Start AIS WebSocket client (requires persistent process)
  startAISClient();
});
