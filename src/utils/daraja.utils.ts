import crypto from 'crypto';

/**
 * Normalize a Kenyan phone number to the E.164 format required by Daraja.
 * Accepts: 07XXXXXXXX, 7XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX
 * Returns: 2547XXXXXXXX
 */
export const normalizePhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');

  if (/^\+254\d{9}$/.test(cleaned)) {
    return cleaned.slice(1); // remove +
  }
  if (/^254\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^07\d{8}$/.test(cleaned)) {
    return `254${cleaned.slice(1)}`;
  }
  if (/^7\d{8}$/.test(cleaned)) {
    return `254${cleaned}`;
  }

  throw new Error(
    `Invalid phone number format: "${phone}". Expected Kenyan number (07XXXXXXXX or 2547XXXXXXXX)`
  );
};

/**
 * Generate the Daraja STK Push password.
 * Formula: Base64(Shortcode + Passkey + Timestamp)
 */
export const generateStkPassword = (
  shortcode: string,
  passkey: string,
  timestamp: string
): string => {
  const raw = `${shortcode}${passkey}${timestamp}`;
  return Buffer.from(raw).toString('base64');
};

/**
 * Generate a Daraja-format timestamp: YYYYMMDDHHmmss
 */
export const generateTimestamp = (): string => {
  return new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);
};

/**
 * Parse the CallbackMetadata items array into a key-value map.
 */
export const parseCallbackMetadata = (
  items: Array<{ Name: string; Value: string | number }>
): Record<string, string | number> => {
  return items.reduce((acc, item) => {
    acc[item.Name] = item.Value;
    return acc;
  }, {} as Record<string, string | number>);
};

/**
 * Mask a phone number for safe logging: 2547XXXXX678
 */
export const maskPhone = (phone: string): string => {
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 4)}XXXXX${phone.slice(-3)}`;
};

/**
 * Generate a secure random UUID v4
 */
export const generateTransactionId = (): string => {
  return crypto.randomUUID();
};
