import app from './app';
import { config } from './config/app.config';
import { testConnection, closePool } from './database/connection';
import { logger } from './utils/logger';

const start = async (): Promise<void> => {
  // Verify DB connection before starting
  await testConnection();

  const server = app.listen(config.server.port, () => {
    logger.info('🚀 Daraja STK Push server started', {
      port: config.server.port,
      env: config.server.nodeEnv,
      baseUrl: config.server.baseUrl,
    });
    logger.info(`📋 API docs: ${config.server.baseUrl}/api/v1/payments`);
    logger.info(`❤️  Health: ${config.server.baseUrl}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed');
      await closePool();
      logger.info('Database pool closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
};

start().catch((err: Error) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
