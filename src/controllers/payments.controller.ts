import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { stkPushService } from '../services/stk.service';
import { logger } from '../utils/logger';
import type {
  ApiResponse,
  InitiateStkPushBody,
  PaginationQuery,
  StkCallbackPayload,
  TransactionStatus,
} from '../types/daraja.types';

const buildResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
  error?: string
): ApiResponse<T> => ({
  success,
  message,
  data,
  error,
  timestamp: new Date().toISOString(),
});

// ============================================================
// POST /api/v1/payments/stk-push
// ============================================================
export const initiateStkPush = async (
  req: Request<object, object, InitiateStkPushBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(
      buildResponse(false, 'Validation failed', undefined, JSON.stringify(errors.array()))
    );
    return;
  }

  try {
    const transaction = await stkPushService.initiate(req.body);

    res.status(202).json(
      buildResponse(true, 'STK Push initiated successfully. Awaiting user PIN entry.', {
        transactionId: transaction.transaction_id,
        checkoutRequestId: transaction.checkout_request_id,
        merchantRequestId: transaction.merchant_request_id,
        customerMessage: transaction.customer_message,
        status: transaction.status,
      })
    );
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/v1/payments/callback
// ============================================================
export const handleCallback = async (
  req: Request<object, object, StkCallbackPayload>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  logger.info('Daraja callback received', { body: req.body });

  // Always respond with 200 immediately — Daraja retries on non-2xx
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    await stkPushService.processCallback(req.body);
  } catch (err) {
    logger.error('Callback processing error (async)', { error: err });
    // Don't call next(err) — response already sent
  }
};

// ============================================================
// GET /api/v1/payments/transactions
// ============================================================
export const getTransactions = async (
  req: Request<object, object, object, PaginationQuery>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const status = req.query.status as TransactionStatus | undefined;

    const { data, total } = await stkPushService.getTransactions(page, limit, status);

    res.json(
      buildResponse(true, 'Transactions retrieved', {
        transactions: data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/v1/payments/transactions/:id
// ============================================================
export const getTransactionById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tx = await stkPushService.getTransactionByTransactionId(req.params.id);

    if (!tx) {
      res.status(404).json(buildResponse(false, 'Transaction not found'));
      return;
    }

    res.json(buildResponse(true, 'Transaction retrieved', tx));
  } catch (err) {
    next(err);
  }
};

// ============================================================
// POST /api/v1/payments/query/:checkoutRequestId
// ============================================================
export const queryTransactionStatus = async (
  req: Request<{ checkoutRequestId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkoutRequestId } = req.params;

    const [dbTx, darajaStatus] = await Promise.all([
      stkPushService.getTransactionByCheckoutId(checkoutRequestId),
      stkPushService.queryStatus(checkoutRequestId).catch((err: Error) => {
        logger.warn('Daraja status query failed', { error: err.message });
        return null;
      }),
    ]);

    if (!dbTx) {
      res.status(404).json(buildResponse(false, 'Transaction not found'));
      return;
    }

    res.json(
      buildResponse(true, 'Transaction status retrieved', {
        local: dbTx,
        daraja: darajaStatus,
      })
    );
  } catch (err) {
    next(err);
  }
};
