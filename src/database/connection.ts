import mysql from 'mysql2/promise';
import { config } from '../config/app.config';
import { logger } from '../utils/logger';

let pool: mysql.Pool | null = null;

export const getPool = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      connectionLimit: config.database.connectionLimit,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+00:00',
    });

    logger.info('MySQL connection pool created', {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
    });
  }
  return pool;
};

export const testConnection = async (): Promise<void> => {
  const dbPool = getPool();
  const connection = await dbPool.getConnection();
  try {
    await connection.ping();
    logger.info('Database connection verified successfully');
  } finally {
    connection.release();
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
};
