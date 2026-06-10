import axios from 'axios';
import { getPool } from '../database/connection';
import { config } from '../config/app.config';
import { tokenService } from './token.service';
import { darajaLogger } from '../utils/logger';
import {
  generateStkPassword,
  generateTimestamp,
  generateTransactionId,
  normalizePhoneNumber,
  parseCallbackMetadata,
  maskPhone,
} from '../utils/daraja.utils';
import type {
  InitiateStkPushBody,
  StkCallbackPayload,
  StkPushRequest,
  StkPushResponse,
  StkQueryResponse,
  StkTransaction,
  TransactionStatus,
} from '../types/daraja.types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export class StkPushService {
  private readonly stkPushUrl: string;
  private readonly stkQueryUrl: string;

  constructor() {
    this.stkPushUrl = `${config.daraja.apiBaseUrl}/mpesa/stkpush/v1/processrequest`;
    this.stkQueryUrl = `${config.daraja.apiBaseUrl}/mpesa/stkpushquery/v1/query`;
  }

  // ============================================================
  // Initiate STK Push
  // ============================================================

  async initiate(body: InitiateStkPushBody): Promise<StkTransaction> {
    const transactionId = generateTransactionId();
    const timestamp = generateTimestamp();
    const phone = normalizePhoneNumber(body.phoneNumber);
    const amount = Math.ceil(body.amount); // Daraja requires integer amounts
    const accountRef = body.accountReference || config.daraja.accountRef;
    const txDesc = body.transactionDesc || config.daraja.transactionDesc;

    darajaLogger.info('Initiating STK Push', {
      transactionId,
      phone: maskPhone(phone),
      amount,
    });

    const password = generateStkPassword(
      config.daraja.shortcode,
      config.daraja.passkey,
      timestamp
    );

    const requestPayload: StkPushRequest = {
      BusinessShortCode: config.daraja.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: config.daraja.shortcode,
      PhoneNumber: phone,
      CallBackURL: config.daraja.callbackUrl,
      AccountReference: accountRef,
      TransactionDesc: txDesc,
    };

    // Save transaction to DB with PENDING status before calling Daraja
    const dbId = await this.createTransactionRecord({
      transactionId,
      phone,
      amount,
      accountRef,
      txDesc,
      rawRequest: requestPayload,
    });

    // Call Daraja
    let stkResponse: StkPushResponse;
    try {
      const accessToken = await tokenService.getAccessToken();
      const { data } = await axios.post<StkPushResponse>(
        this.stkPushUrl,
        requestPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      stkResponse = data;
    } catch (err: unknown) {
      const errorMsg = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data || err.message)
        : String(err);

      darajaLogger.error('STK Push API call failed', {
        transactionId,
        error: errorMsg,
      });

      await this.updateTransactionStatus(dbId, 'FAILED', {
        resultDesc: `API Error: ${errorMsg}`,
      });

      throw new Error(`STK Push failed: ${errorMsg}`);
    }

    darajaLogger.info('STK Push API response received', {
      transactionId,
      merchantRequestId: stkResponse.MerchantRequestID,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      responseCode: stkResponse.ResponseCode,
    });

    // Update record with Daraja response fields
    const pool = getPool();
    await pool.query(
      `UPDATE stk_transactions SET
         merchant_request_id  = ?,
         checkout_request_id  = ?,
         response_code        = ?,
         response_description = ?,
         customer_message     = ?,
         raw_response         = ?,
         status               = ?
       WHERE id = ?`,
      [
        stkResponse.MerchantRequestID,
        stkResponse.CheckoutRequestID,
        stkResponse.ResponseCode,
        stkResponse.ResponseDescription,
        stkResponse.CustomerMessage,
        JSON.stringify(stkResponse),
        stkResponse.ResponseCode === '0' ? 'PENDING' : 'FAILED',
        dbId,
      ]
    );

    if (stkResponse.ResponseCode !== '0') {
      throw new Error(
        `Daraja rejected the request: ${stkResponse.ResponseDescription}`
      );
    }

    const tx = await this.getTransactionByInternalId(dbId);
    return tx!;
  }

  // ============================================================
  // Handle Daraja Callback
  // ============================================================

  async processCallback(payload: StkCallbackPayload): Promise<void> {
    const callback = payload.Body.stkCallback;

    darajaLogger.info('Processing STK Push callback', {
      checkoutRequestId: callback.CheckoutRequestID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
    });

    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM stk_transactions WHERE checkout_request_id = ?`,
      [callback.CheckoutRequestID]
    );

    if (rows.length === 0) {
      darajaLogger.warn('Callback received for unknown CheckoutRequestID', {
        checkoutRequestId: callback.CheckoutRequestID,
      });
      return;
    }

    const dbId: number = rows[0].id;

    let status: TransactionStatus = 'FAILED';
    let mpesaReceiptNumber: string | null = null;
    let transactionDate: string | null = null;

    if (callback.ResultCode === 0 && callback.CallbackMetadata) {
      status = 'SUCCESS';
      const meta = parseCallbackMetadata(callback.CallbackMetadata.Item);
      mpesaReceiptNumber = String(meta['MpesaReceiptNumber'] || '');
      transactionDate = String(meta['TransactionDate'] || '');

      darajaLogger.info('Payment successful', {
        checkoutRequestId: callback.CheckoutRequestID,
        mpesaReceiptNumber,
        transactionDate,
      });
    } else if (callback.ResultCode === 1032) {
      status = 'CANCELLED';
      darajaLogger.info('Payment cancelled by user', {
        checkoutRequestId: callback.CheckoutRequestID,
      });
    } else {
      darajaLogger.warn('Payment failed', {
        checkoutRequestId: callback.CheckoutRequestID,
        resultCode: callback.ResultCode,
        resultDesc: callback.ResultDesc,
      });
    }

    await pool.query(
      `UPDATE stk_transactions SET
         status                = ?,
         result_code           = ?,
         result_desc           = ?,
         mpesa_receipt_number  = ?,
         transaction_date      = ?,
         raw_callback          = ?
       WHERE id = ?`,
      [
        status,
        callback.ResultCode,
        callback.ResultDesc,
        mpesaReceiptNumber,
        transactionDate,
        JSON.stringify(payload),
        dbId,
      ]
    );
  }

  // ============================================================
  // Query STK Push Status
  // ============================================================

  async queryStatus(checkoutRequestId: string): Promise<StkQueryResponse> {
    const timestamp = generateTimestamp();
    const password = generateStkPassword(
      config.daraja.shortcode,
      config.daraja.passkey,
      timestamp
    );

    const accessToken = await tokenService.getAccessToken();

    const { data } = await axios.post<StkQueryResponse>(
      this.stkQueryUrl,
      {
        BusinessShortCode: config.daraja.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return data;
  }

  // ============================================================
  // Database queries
  // ============================================================

  async getTransactions(
    page: number,
    limit: number,
    status?: TransactionStatus
  ): Promise<{ data: StkTransaction[]; total: number }> {
    const pool = getPool();
    const offset = (page - 1) * limit;

    const whereClause = status ? 'WHERE status = ?' : '';
    const queryParams: (string | number)[] = status
      ? [status, limit, offset]
      : [limit, offset];

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM stk_transactions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    const countParams: string[] = status ? [status] : [];
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM stk_transactions ${whereClause}`,
      countParams
    );

    return {
      data: rows as StkTransaction[],
      total: countRows[0].total as number,
    };
  }

  async getTransactionByCheckoutId(
    checkoutRequestId: string
  ): Promise<StkTransaction | null> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM stk_transactions WHERE checkout_request_id = ?`,
      [checkoutRequestId]
    );
    return rows.length ? (rows[0] as StkTransaction) : null;
  }

  async getTransactionByTransactionId(
    transactionId: string
  ): Promise<StkTransaction | null> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM stk_transactions WHERE transaction_id = ?`,
      [transactionId]
    );
    return rows.length ? (rows[0] as StkTransaction) : null;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async createTransactionRecord(params: {
    transactionId: string;
    phone: string;
    amount: number;
    accountRef: string;
    txDesc: string;
    rawRequest: StkPushRequest;
  }): Promise<number> {
    const pool = getPool();
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO stk_transactions
         (transaction_id, phone_number, amount, account_reference,
          transaction_desc, status, raw_request)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        params.transactionId,
        params.phone,
        params.amount,
        params.accountRef,
        params.txDesc,
        JSON.stringify(params.rawRequest),
      ]
    );
    return result.insertId;
  }

  private async updateTransactionStatus(
    id: number,
    status: TransactionStatus,
    extra?: { resultDesc?: string }
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE stk_transactions SET status = ?, result_desc = ? WHERE id = ?`,
      [status, extra?.resultDesc || null, id]
    );
  }

  private async getTransactionByInternalId(
    id: number
  ): Promise<StkTransaction | null> {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM stk_transactions WHERE id = ?`,
      [id]
    );
    return rows.length ? (rows[0] as StkTransaction) : null;
  }
}

export const stkPushService = new StkPushService();
