import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = uuidv4();
  const start = Date.now();

  // Attach requestId so controllers/errors can reference it
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  logger.info(`--> ${req.method} ${req.path}`, {
    requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info(`<-- ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`, {
      requestId,
      statusCode: res.statusCode,
      durationMs: duration,
    });

    // Async DB log — don't block response
    persistRequestLog({
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      body: req.body,
      statusCode: res.statusCode,
      durationMs: duration,
    }).catch((err: Error) =>
      logger.warn('Failed to persist request log', { error: err.message })
    );
  });

  next();
};

const persistRequestLog = async (params: {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  body: unknown;
  statusCode: number;
  durationMs: number;
}): Promise<void> => {
  const pool = getPool();

  // Sanitize body — don't log sensitive fields
  let sanitizedBody = params.body;
  if (sanitizedBody && typeof sanitizedBody === 'object') {
    const body = { ...(sanitizedBody as Record<string, unknown>) };
    delete body['password'];
    delete body['Password'];
    sanitizedBody = body;
  }

  await pool.query(
    `INSERT INTO api_request_logs
       (request_id, method, path, ip_address, user_agent, request_body, response_code, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.requestId,
      params.method,
      params.path,
      params.ip,
      params.userAgent,
      JSON.stringify(sanitizedBody),
      params.statusCode,
      params.durationMs,
    ]
  );
};
