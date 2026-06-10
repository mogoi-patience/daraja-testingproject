-- ============================================================
-- Daraja STK Push - Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- Table: token_cache
-- Stores OAuth access tokens to avoid redundant API calls
-- ============================================================
CREATE TABLE IF NOT EXISTS `token_cache` (
  `id`           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `access_token` VARCHAR(500)     NOT NULL,
  `expires_at`   DATETIME         NOT NULL,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cache for Daraja OAuth access tokens';

-- ============================================================
-- Table: stk_transactions
-- Stores all STK Push requests and their outcomes
-- ============================================================
CREATE TABLE IF NOT EXISTS `stk_transactions` (
  `id`                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `transaction_id`       VARCHAR(36)      NOT NULL COMMENT 'Internal UUID',
  `phone_number`         VARCHAR(15)      NOT NULL COMMENT 'E.164 format e.g. 254712345678',
  `amount`               DECIMAL(12,2)    NOT NULL,
  `account_reference`    VARCHAR(100)     NOT NULL,
  `transaction_desc`     VARCHAR(255)     NOT NULL,

  -- Daraja response fields
  `merchant_request_id`  VARCHAR(100)     NULL COMMENT 'MerchantRequestID from Daraja',
  `checkout_request_id`  VARCHAR(100)     NULL COMMENT 'CheckoutRequestID from Daraja',
  `response_code`        VARCHAR(10)      NULL,
  `response_description` VARCHAR(500)     NULL,
  `customer_message`     VARCHAR(500)     NULL,

  -- Transaction status
  `status`               ENUM('PENDING','SUCCESS','FAILED','CANCELLED','TIMEOUT')
                         NOT NULL DEFAULT 'PENDING',

  -- Callback fields (populated after payment)
  `mpesa_receipt_number` VARCHAR(50)      NULL COMMENT 'M-Pesa confirmation code',
  `transaction_date`     VARCHAR(20)      NULL COMMENT 'YYYYMMDDHHMMSS from Safaricom',
  `result_code`          INT              NULL,
  `result_desc`          VARCHAR(500)     NULL,

  -- Raw payloads for debugging/audit
  `raw_request`          JSON             NULL,
  `raw_response`         JSON             NULL,
  `raw_callback`         JSON             NULL,

  `created_at`           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transaction_id`       (`transaction_id`),
  UNIQUE KEY `uq_checkout_request_id`  (`checkout_request_id`),
  INDEX `idx_phone_number`             (`phone_number`),
  INDEX `idx_status`                   (`status`),
  INDEX `idx_created_at`               (`created_at`),
  INDEX `idx_merchant_request_id`      (`merchant_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='STK Push transaction records';

-- ============================================================
-- Table: api_request_logs
-- Audit log for all inbound API requests
-- ============================================================
CREATE TABLE IF NOT EXISTS `api_request_logs` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `request_id`    VARCHAR(36)      NOT NULL,
  `method`        VARCHAR(10)      NOT NULL,
  `path`          VARCHAR(500)     NOT NULL,
  `ip_address`    VARCHAR(45)      NULL,
  `user_agent`    VARCHAR(500)     NULL,
  `request_body`  JSON             NULL,
  `response_code` SMALLINT         NULL,
  `duration_ms`   INT              NULL,
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  INDEX `idx_request_id` (`request_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='API request audit log';

SET FOREIGN_KEY_CHECKS = 1;
