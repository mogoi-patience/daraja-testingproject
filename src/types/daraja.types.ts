// ============================================================
// Daraja API Types
// ============================================================

export interface DarajaTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface StkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface StkCallbackItem {
  Name: string;
  Value: string | number;
}

export interface StkCallbackMetadata {
  Item: StkCallbackItem[];
}

export interface StkCallbackResultBody {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: StkCallbackMetadata;
}

export interface StkCallbackPayload {
  Body: {
    stkCallback: StkCallbackResultBody;
  };
}

export interface StkQueryRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  CheckoutRequestID: string;
}

export interface StkQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

// ============================================================
// Database Record Types
// ============================================================

export type TransactionStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT';

export interface StkTransaction {
  id: number;
  transaction_id: string;
  phone_number: string;
  amount: number;
  account_reference: string;
  transaction_desc: string;
  merchant_request_id: string | null;
  checkout_request_id: string | null;
  response_code: string | null;
  response_description: string | null;
  customer_message: string | null;
  status: TransactionStatus;
  mpesa_receipt_number: string | null;
  transaction_date: string | null;
  result_code: number | null;
  result_desc: string | null;
  raw_request: string | null;
  raw_response: string | null;
  raw_callback: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TokenCache {
  id: number;
  access_token: string;
  expires_at: Date;
  created_at: Date;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface InitiateStkPushBody {
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  status?: TransactionStatus;
}
