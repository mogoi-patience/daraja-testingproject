import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requireEnv = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
};

export const config = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    name: requireEnv('DB_NAME'),
    connectionLimit: 10,
  },

  daraja: {
    consumerKey: requireEnv('DARAJA_CONSUMER_KEY'),
    consumerSecret: requireEnv('DARAJA_CONSUMER_SECRET'),
    shortcode: process.env.DARAJA_SHORTCODE || '174379',
    passkey: requireEnv('DARAJA_PASSKEY'),
    callbackUrl: requireEnv('DARAJA_CALLBACK_URL'),
    apiBaseUrl: process.env.DARAJA_API_BASE_URL || 'https://sandbox.safaricom.co.ke',
    accountRef: process.env.DARAJA_ACCOUNT_REF || 'DarajaTest',
    transactionDesc: process.env.DARAJA_TRANSACTION_DESC || 'STK Push Payment',
  },

  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
} as const;

export type Config = typeof config;
