import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/app.config';
import { requestLogger } from './middleware/requestLogger.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import paymentsRouter from './routes/payments.routes';
import healthRouter from './routes/health.routes';

const app = express();

// ============================================================
// Security middleware
// ============================================================
app.use(helmet());

app.use(
  cors({
    origin: config.server.nodeEnv === 'production' ? false : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});
app.use('/api/', limiter);

// ============================================================
// Body parsing
// ============================================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Logging
// ============================================================
app.use(morgan('combined'));
app.use(requestLogger);

// ============================================================
// Routes
// ============================================================
app.use('/', healthRouter);
app.use('/api/v1/payments', paymentsRouter);

// ============================================================
// Error handling (must be last)
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
