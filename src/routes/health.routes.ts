import { Router } from 'express';
import type { Request, Response } from 'express';
import { testConnection } from '../database/connection';
import { config } from '../config/app.config';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'ok';

  try {
    await testConnection();
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 200 : 503;

  res.status(status).json({
    status: status === 200 ? 'healthy' : 'degraded',
    environment: config.server.nodeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
    },
  });
});

export default router;
