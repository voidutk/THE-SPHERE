import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createLogger } from './logger.js';
import countryRoutes from './routes/country.js';
import searchRoutes from './routes/search.js';
import shipRoutes from './routes/ships.js';

const logger = createLogger();
const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'request');
  next();
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api/country', countryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ships', shipRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
