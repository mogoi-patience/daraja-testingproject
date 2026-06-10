import axios from 'axios';
import { getPool } from '../database/connection';
import { config } from '../config/app.config';
import { darajaLogger } from '../utils/logger';
import type { DarajaTokenResponse, TokenCache } from '../types/daraja.types';
import type { RowDataPacket } from 'mysql2';

/**
 * TokenService manages OAuth access tokens with automatic refresh.
 * Tokens are cached in the database and reused until 60 seconds before expiry.
 */
export class TokenService {
  private readonly tokenUrl: string;
  private readonly credentials: string;

  constructor() {
    this.tokenUrl = `${config.daraja.apiBaseUrl}/oauth/v1/generate?grant_type=client_credentials`;
    this.credentials = Buffer.from(
      `${config.daraja.consumerKey}:${config.daraja.consumerSecret}`
    ).toString('base64');
  }

  /**
   * Get a valid access token, fetching a new one if the cached token is expired.
   */
  async getAccessToken(): Promise<string> {
    // Check DB cache first
    const cached = await this.getCachedToken();
    if (cached) {
      darajaLogger.debug('Using cached OAuth token', {
        expiresAt: cached.expires_at,
      });
      return cached.access_token;
    }

    // Fetch fresh token from Daraja
    return this.fetchAndCacheToken();
  }

  private async getCachedToken(): Promise<TokenCache | null> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, access_token, expires_at, created_at
       FROM token_cache
       WHERE expires_at > DATE_ADD(NOW(), INTERVAL 60 SECOND)
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (rows.length === 0) return null;

    return {
      id: rows[0].id,
      access_token: rows[0].access_token,
      expires_at: rows[0].expires_at,
      created_at: rows[0].created_at,
    };
  }

  private async fetchAndCacheToken(): Promise<string> {
    darajaLogger.info('Fetching new OAuth token from Daraja');

    let response;
    try {
      response = await axios.get<DarajaTokenResponse>(this.tokenUrl, {
        headers: {
          Authorization: `Basic ${this.credentials}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data || err.message
        : String(err);
      darajaLogger.error('Failed to fetch OAuth token', { error: message });
      throw new Error(`Daraja OAuth failed: ${JSON.stringify(message)}`);
    }

    const { access_token, expires_in } = response.data;
    const expiresInSeconds = parseInt(expires_in, 10) || 3600;

    // Persist token to cache
    const pool = getPool();
    await pool.query(
      `INSERT INTO token_cache (access_token, expires_at)
       VALUES (?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [access_token, expiresInSeconds]
    );

    // Clean up old tokens
    await pool.query(
      `DELETE FROM token_cache WHERE expires_at < NOW()`
    );

    darajaLogger.info('New OAuth token fetched and cached', {
      expiresIn: `${expiresInSeconds}s`,
    });

    return access_token;
  }
}

export const tokenService = new TokenService();
