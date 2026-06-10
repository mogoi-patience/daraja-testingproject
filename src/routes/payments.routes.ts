import { Router } from 'express';
import {
  initiateStkPush,
  handleCallback,
  getTransactions,
  getTransactionById,
  queryTransactionStatus,
} from '../controllers/payments.controller';
import {
  validateStkPush,
  validateTransactionId,
  validateCheckoutRequestId,
} from '../middleware/validation.middleware';

const router = Router();

/**
 * @route  POST /api/v1/payments/stk-push
 * @desc   Initiate an M-Pesa STK Push payment prompt
 * @body   { phoneNumber, amount, accountReference?, transactionDesc? }
 */
router.post('/stk-push', validateStkPush, initiateStkPush);

/**
 * @route  POST /api/v1/payments/callback
 * @desc   Receive STK Push payment result from Daraja (Safaricom calls this)
 * @note   Must be publicly accessible HTTPS endpoint
 */
router.post('/callback', handleCallback);

/**
 * @route  GET /api/v1/payments/transactions
 * @desc   List all transactions with pagination
 * @query  page, limit, status (PENDING|SUCCESS|FAILED|CANCELLED|TIMEOUT)
 */
router.get('/transactions', getTransactions);

/**
 * @route  GET /api/v1/payments/transactions/:id
 * @desc   Get a single transaction by internal UUID
 */
router.get('/transactions/:id', validateTransactionId, getTransactionById);

/**
 * @route  POST /api/v1/payments/query/:checkoutRequestId
 * @desc   Query the status of a transaction from Daraja directly
 */
router.post(
  '/query/:checkoutRequestId',
  validateCheckoutRequestId,
  queryTransactionStatus
);

export default router;
