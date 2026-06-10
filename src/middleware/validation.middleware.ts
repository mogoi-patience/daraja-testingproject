import { body, param } from 'express-validator';

export const validateStkPush = [
  body('phoneNumber')
    .notEmpty()
    .withMessage('phoneNumber is required')
    .isString()
    .withMessage('phoneNumber must be a string')
    .trim()
    .custom((value: string) => {
      const cleaned = value.replace(/\s+/g, '');
      const patterns = [
        /^\+254\d{9}$/,
        /^254\d{9}$/,
        /^07\d{8}$/,
        /^7\d{8}$/,
      ];
      if (!patterns.some((p) => p.test(cleaned))) {
        throw new Error(
          'Invalid Kenyan phone number. Use format: 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX'
        );
      }
      return true;
    }),

  body('amount')
    .notEmpty()
    .withMessage('amount is required')
    .isFloat({ min: 1, max: 300000 })
    .withMessage('amount must be a number between 1 and 300,000'),

  body('accountReference')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 12 })
    .withMessage('accountReference must not exceed 12 characters'),

  body('transactionDesc')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 13 })
    .withMessage('transactionDesc must not exceed 13 characters'),
];

export const validateTransactionId = [
  param('id')
    .isUUID()
    .withMessage('id must be a valid UUID'),
];

export const validateCheckoutRequestId = [
  param('checkoutRequestId')
    .notEmpty()
    .withMessage('checkoutRequestId is required')
    .isString()
    .withMessage('checkoutRequestId must be a string'),
];
