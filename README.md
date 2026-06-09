# Daraja STK Push — Production-Ready M-Pesa Integration

A complete, production-ready Node.js/TypeScript application for integrating
Safaricom's Daraja API to initiate M-Pesa STK Push payments.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup (Ubuntu Linux)](#step-by-step-setup-ubuntu-linux)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [API Documentation](#api-documentation)
8. [Testing Instructions](#testing-instructions)
9. [Exposing Callback via ngrok](#exposing-callback-via-ngrok)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Architecture Overview

```
src/
├── config/
│   └── app.config.ts          # Centralised env-var config
├── controllers/
│   └── payments.controller.ts # HTTP request handlers
├── database/
│   ├── connection.ts          # MySQL connection pool
│   └── migrate.ts             # Migration runner
├── middleware/
│   ├── error.middleware.ts    # Global error handler
│   ├── requestLogger.middleware.ts
│   └── validation.middleware.ts
├── routes/
│   ├── health.routes.ts
│   └── payments.routes.ts
├── services/
│   ├── stk.service.ts         # Core STK Push business logic
│   └── token.service.ts       # OAuth token management
├── types/
│   └── daraja.types.ts        # TypeScript interfaces
├── utils/
│   ├── daraja.utils.ts        # Phone normalisation, password generation
│   └── logger.ts              # Winston logger
├── app.ts                     # Express app
└── index.ts                   # Entry point
```

---

## Prerequisites

| Requirement  | Version   |
|--------------|-----------|
| Node.js      | >= 18.x   |
| npm          | >= 9.x    |
| MySQL        | >= 8.0    |
| ngrok        | Any       |
| Daraja account | Sandbox |

---

## Step-by-Step Setup (Ubuntu Linux)

### 1. Install Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v20.x.x
npm --version    # should print 9.x or 10.x
```

### 2. Install MySQL 8

```bash
sudo apt update
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure the installation
sudo mysql_secure_installation
```

### 3. Create MySQL user and database

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE daraja_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'daraja_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
GRANT ALL PRIVILEGES ON daraja_db.* TO 'daraja_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Install ngrok (for local callback)

```bash
# Download and install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Or via npm
npm install -g ngrok

# Authenticate (get token from https://dashboard.ngrok.com)
ngrok config add-authtoken YOUR_NGROK_AUTH_TOKEN
```

### 5. Clone and install dependencies

```bash
git clone <repo-url> daraja-stk-push
cd daraja-stk-push
npm install
```

### 6. Configure environment

```bash
cp .env.example .env
nano .env   # Fill in your Daraja Sandbox credentials
```

### 7. Get Daraja Sandbox Credentials

1. Register at https://developer.safaricom.co.ke/
2. Log in → **My Apps** → **Add New App**
3. Enable: **Lipa Na M-Pesa Sandbox**
4. Copy your **Consumer Key** and **Consumer Secret**
5. Note the sandbox test credentials:
   - **Shortcode:** `174379`
   - **Passkey:** `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
   - **Test phone:** `254708374149`
   - **Test PIN:** `00000` (sandbox only)

### 8. Run migrations

```bash
npm run migrate
```

### 9. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

---

## Environment Configuration

Copy `.env.example` to `.env` and set all values:

```env
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=daraja_user
DB_PASSWORD=your_strong_password_here
DB_NAME=daraja_db

DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here
DARAJA_SHORTCODE=174379
DARAJA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
DARAJA_ACCOUNT_REF=DarajaTest
DARAJA_TRANSACTION_DESC=STK Push Payment
DARAJA_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/v1/payments/callback
DARAJA_API_BASE_URL=https://sandbox.safaricom.co.ke
```

---

## Database Setup

```bash
# Run migrations (creates tables automatically)
npm run migrate
```

### Schema Summary

| Table              | Purpose                                  |
|--------------------|------------------------------------------|
| `stk_transactions` | All STK Push requests and their statuses |
| `token_cache`      | Cached OAuth tokens (auto-refreshed)     |
| `api_request_logs` | All inbound API requests for audit       |

---

## Running the Application

```bash
# Terminal 1 — Start the app
npm run dev

# Terminal 2 — Expose callback URL
ngrok http 3000

# Copy the ngrok HTTPS URL and update .env:
# DARAJA_CALLBACK_URL=https://abc123.ngrok.io/api/v1/payments/callback
# Then restart: npm run dev
```

---

## API Documentation

### Base URL
`http://localhost:3000/api/v1`

---

### `POST /payments/stk-push`

Initiate an STK Push payment prompt.

**Request Body**
```json
{
  "phoneNumber": "254708374149",
  "amount": 1,
  "accountReference": "Order001",
  "transactionDesc": "Test Payment"
}
```

| Field              | Type   | Required | Description                                  |
|--------------------|--------|----------|----------------------------------------------|
| phoneNumber        | string | Yes      | Kenyan number: `07XXXXXXXX` or `2547XXXXXXXX` |
| amount             | number | Yes      | Amount in KES (1 – 300,000)                  |
| accountReference   | string | No       | Max 12 chars. Default: `DarajaTest`          |
| transactionDesc    | string | No       | Max 13 chars. Default: `STK Push Payment`    |

**202 Response**
```json
{
  "success": true,
  "message": "STK Push initiated successfully. Awaiting user PIN entry.",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "checkoutRequestId": "ws_CO_01022024100000000700000",
    "merchantRequestId": "29115-34620561-1",
    "customerMessage": "Success. Request accepted for processing",
    "status": "PENDING"
  },
  "timestamp": "2024-02-01T10:00:00.000Z"
}
```

---

### `POST /payments/callback`

> **This endpoint is called by Safaricom, not by you.**

Daraja POSTs the payment result to this URL. Must be a publicly accessible HTTPS endpoint (use ngrok for local development).

**Safaricom Success Payload**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_01022024100000000700000",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1.00 },
          { "Name": "MpesaReceiptNumber", "Value": "LHG31AA5TX" },
          { "Name": "TransactionDate", "Value": 20240201101010 },
          { "Name": "PhoneNumber", "Value": 254708374149 }
        ]
      }
    }
  }
}
```

**ResultCode meanings**

| Code | Meaning                     |
|------|-----------------------------|
| 0    | Success                     |
| 1    | Insufficient funds          |
| 1032 | Request cancelled by user   |
| 1037 | Timeout / no response       |
| 2001 | Wrong PIN entered           |

---

### `GET /payments/transactions`

List transactions with pagination.

**Query Parameters**

| Param  | Default | Description                               |
|--------|---------|-------------------------------------------|
| page   | 1       | Page number                               |
| limit  | 20      | Records per page (max 100)                |
| status |         | Filter: PENDING, SUCCESS, FAILED, etc.    |

---

### `GET /payments/transactions/:id`

Get a single transaction by UUID.

---

### `POST /payments/query/:checkoutRequestId`

Query the live status of a transaction directly from Daraja.

---

### `GET /health`

Returns server and database health status.

---

## Testing Instructions

### Full End-to-End Test

```bash
# 1. Ensure .env is configured with your Daraja credentials and ngrok URL

# 2. Start the app
npm run dev

# 3. Start ngrok (new terminal)
ngrok http 3000
# Update DARAJA_CALLBACK_URL in .env with the HTTPS URL
# Restart: npm run dev

# 4. Initiate STK Push (use Daraja sandbox test number)
curl -X POST http://localhost:3000/api/v1/payments/stk-push \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254708374149",
    "amount": 1,
    "accountReference": "TestOrder",
    "transactionDesc": "Test Payment"
  }'

# 5. Note the checkoutRequestId from response

# 6. Check transaction status (before callback)
curl http://localhost:3000/api/v1/payments/transactions?status=PENDING

# 7. Daraja Sandbox sends STK Push to the test phone simulator
#    Enter PIN 00000 on the simulator

# 8. Daraja calls your callback URL automatically

# 9. Check transaction status (after callback)
curl http://localhost:3000/api/v1/payments/transactions?status=SUCCESS
```

### Simulate Callback Locally

```bash
# Success callback
curl -X POST http://localhost:3000/api/v1/payments/callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "29115-34620561-1",
        "CheckoutRequestID": "YOUR_CHECKOUT_REQUEST_ID",
        "ResultCode": 0,
        "ResultDesc": "The service request is processed successfully.",
        "CallbackMetadata": {
          "Item": [
            { "Name": "Amount", "Value": 1.00 },
            { "Name": "MpesaReceiptNumber", "Value": "LHG31AA5TX" },
            { "Name": "TransactionDate", "Value": 20240201101010 },
            { "Name": "PhoneNumber", "Value": 254708374149 }
          ]
        }
      }
    }
  }'
```

### Import Postman Collection

1. Open Postman
2. Click **Import**
3. Select `docs/Daraja_STK_Push.postman_collection.json`
4. Set `baseUrl` variable to `http://localhost:3000`
5. Run the **Initiate STK Push** request first — it auto-captures `checkoutRequestId`

---

## Exposing Callback via ngrok

The callback URL **must be HTTPS and publicly accessible**. For local development:

```bash
# Start ngrok
ngrok http 3000

# You'll see output like:
# Forwarding  https://abc123.ngrok.io -> http://localhost:3000

# Update .env:
DARAJA_CALLBACK_URL=https://abc123.ngrok.io/api/v1/payments/callback

# Restart the app
npm run dev

# Test the ngrok tunnel
curl https://abc123.ngrok.io/health
```

> **Important:** The ngrok URL changes every restart (on the free plan).
> Update `DARAJA_CALLBACK_URL` and register the new URL in your Daraja app settings each time.

---

## Troubleshooting Guide

### ❌ "Missing required environment variable: DARAJA_CONSUMER_KEY"

Ensure `.env` exists in the project root and contains all required variables.

```bash
ls -la .env          # should exist
cat .env | grep DARAJA  # check values are set
```

---

### ❌ "Daraja OAuth failed: 400 Bad Request"

- Double-check Consumer Key and Secret in `.env`
- Ensure your Daraja app has **Lipa Na M-Pesa** product enabled
- Sandbox base URL must be `https://sandbox.safaricom.co.ke`

---

### ❌ "STK Push failed: 400 — Bad Request: Invalid Initiator Information"

- Confirm `DARAJA_SHORTCODE=174379` (sandbox shortcode)
- Confirm `DARAJA_PASSKEY` matches the one in the Daraja portal

---

### ❌ Callback never received

1. Ensure ngrok is running: `curl https://YOUR_NGROK.ngrok.io/health`
2. Confirm `DARAJA_CALLBACK_URL` ends with `/api/v1/payments/callback`
3. The URL must be HTTPS — plain HTTP is rejected by Safaricom
4. Check Daraja portal → your app → **Test Credentials** and look for recent callback attempts

---

### ❌ "ER_ACCESS_DENIED_ERROR"

```bash
# Verify MySQL credentials
mysql -u daraja_user -p daraja_db
# Enter the password from .env
```

---

### ❌ "ECONNREFUSED 127.0.0.1:3306"

```bash
sudo systemctl status mysql
sudo systemctl start mysql
```

---

### ❌ Phone number validation fails

Accepted formats:
- `0712345678`
- `254712345678`
- `+254712345678`

**Not accepted:** spaces, dashes, brackets.

---

### Viewing logs

```bash
# Live log stream
tail -f logs/app.log | jq .

# Error log only
tail -f logs/error.log | jq .

# Daraja-specific log
tail -f logs/daraja.log | jq .
```

---

## Production Considerations

1. **Use a process manager:** `pm2 start dist/index.js --name daraja-app`
2. **HTTPS only:** Terminate TLS at nginx or a load balancer
3. **Secure the callback endpoint:** Validate `x-safaricom-*` headers or restrict by IP
4. **Rotate Daraja credentials** regularly
5. **Monitor token expiry** — the token service handles this automatically
6. **Database backups:** Schedule regular MySQL dumps
7. **Set `NODE_ENV=production`** — disables verbose error stacks in responses
# daraja-testingproject
