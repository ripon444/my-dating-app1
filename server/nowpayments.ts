import crypto from 'crypto';
import { SqlHelper } from './db.ts';

export interface NowPaymentsConfig {
  apiKey: string;
  ipnSecret: string;
  isSandbox: boolean;
  isEnabled: boolean;
  payoutCurrency: string;
}

/**
 * Retrieves the current NOWPayments configuration.
 * Merges stored database settings with environment variable fallbacks.
 */
export async function getNowPaymentsConfig(): Promise<NowPaymentsConfig> {
  let dbRow: any = null;
  try {
    dbRow = await SqlHelper.queryOne<any>("SELECT * FROM payment_settings WHERE id = 'nowpayments'");
  } catch (e) {
    console.warn('[NOWPayments Config] Error reading payment_settings:', e);
  }

  const apiKey = (dbRow?.api_key || process.env.NOWPAYMENTS_API_KEY || '').trim();
  const ipnSecret = (dbRow?.ipn_secret || process.env.NOWPAYMENTS_IPN_SECRET || '').trim();
  const isSandbox = dbRow?.is_sandbox !== undefined ? Boolean(dbRow.is_sandbox) : process.env.NOWPAYMENTS_SANDBOX === 'true';
  const isEnabled = dbRow?.is_enabled !== undefined ? Boolean(dbRow.is_enabled) : true;
  const payoutCurrency = (dbRow?.payout_currency || 'USDT').trim().toUpperCase();

  return {
    apiKey,
    ipnSecret,
    isSandbox,
    isEnabled,
    payoutCurrency,
  };
}

/**
 * Updates NOWPayments configuration in the database.
 */
export async function saveNowPaymentsConfig(config: Partial<NowPaymentsConfig>): Promise<NowPaymentsConfig> {
  const current = await getNowPaymentsConfig();
  const updated: NowPaymentsConfig = {
    apiKey: config.apiKey !== undefined ? config.apiKey.trim() : current.apiKey,
    ipnSecret: config.ipnSecret !== undefined ? config.ipnSecret.trim() : current.ipnSecret,
    isSandbox: config.isSandbox !== undefined ? Boolean(config.isSandbox) : current.isSandbox,
    isEnabled: config.isEnabled !== undefined ? Boolean(config.isEnabled) : current.isEnabled,
    payoutCurrency: config.payoutCurrency !== undefined ? config.payoutCurrency.trim().toUpperCase() : current.payoutCurrency,
  };

  const now = new Date().toISOString();
  await SqlHelper.execute(
    `INSERT OR REPLACE INTO payment_settings (id, api_key, ipn_secret, is_sandbox, is_enabled, payout_currency, updated_at)
     VALUES ('nowpayments', ?, ?, ?, ?, ?, ?)`,
    [
      updated.apiKey,
      updated.ipnSecret,
      updated.isSandbox ? 1 : 0,
      updated.isEnabled ? 1 : 0,
      updated.payoutCurrency,
      now,
    ]
  );

  return updated;
}

/**
 * Recursively sorts an object's keys alphabetically as required by NOWPayments IPN specification.
 */
export function sortObjectKeys(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj)
    .sort()
    .reduce((result: Record<string, any>, key: string) => {
      result[key] = sortObjectKeys(obj[key]);
      return result;
    }, {});
}

/**
 * Cryptographically verifies NOWPayments IPN webhook signature using HMAC-SHA512.
 * NOWPayments sends the HMAC signature in the 'x-nowpayments-sig' HTTP header.
 */
export function verifyNowPaymentsSignature(payload: any, signature: string | undefined, ipnSecret: string): boolean {
  if (!signature || !ipnSecret) {
    console.warn('[NOWPayments IPN] Missing signature header or IPN secret.');
    return false;
  }

  try {
    const sortedPayload = sortObjectKeys(payload);
    const jsonString = JSON.stringify(sortedPayload);
    const hmac = crypto.createHmac('sha512', ipnSecret.trim());
    hmac.update(jsonString);
    const expectedSignature = hmac.digest('hex');

    const cleanReceived = signature.trim().toLowerCase();
    const cleanExpected = expectedSignature.toLowerCase();

    if (cleanReceived.length !== cleanExpected.length) {
      console.warn('[NOWPayments IPN] Signature length mismatch.');
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(cleanReceived), Buffer.from(cleanExpected));
  } catch (err) {
    console.error('[NOWPayments IPN] Signature verification exception:', err);
    return false;
  }
}

/**
 * Creates a NOWPayments invoice for a subscription plan.
 * Returns the hosted checkout URL (invoice_url) where the user can choose
 * from hundreds of cryptocurrencies (USDT TRC20, ERC20, BTC, ETH, TON, etc.) to complete payment.
 */
export async function createNowPaymentsInvoice(params: {
  orderId: string;
  orderDescription: string;
  amount: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  ipnCallbackUrl: string;
}): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceUrl?: string;
  orderId?: string;
  error?: string;
}> {
  const config = await getNowPaymentsConfig();

  if (!config.isEnabled) {
    return { success: false, error: 'NOWPayments payment gateway is currently disabled by administrator.' };
  }

  if (!config.apiKey) {
    return { success: false, error: 'NOWPayments API key is not configured. Please configure it in Admin Portal.' };
  }

  const baseUrl = config.isSandbox
    ? 'https://api-sandbox.nowpayments.io/v1'
    : 'https://api.nowpayments.io/v1';

  const priceCurrency = (params.currency || 'USDT').toLowerCase();

  const requestBody = {
    price_amount: params.amount,
    price_currency: priceCurrency,
    pay_currency: null, // Allow user to choose any crypto on NOWPayments checkout page
    ipn_callback_url: params.ipnCallbackUrl,
    order_id: params.orderId,
    order_description: params.orderDescription,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  try {
    const response = await fetch(`${baseUrl}/invoice`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data: any = await response.json();

    if (!response.ok || !data.invoice_url) {
      console.error('[NOWPayments API Error]:', data);
      return {
        success: false,
        error: data.message || data.error || 'Failed to create payment invoice with NOWPayments.',
      };
    }

    return {
      success: true,
      invoiceId: String(data.id),
      invoiceUrl: data.invoice_url,
      orderId: data.order_id || params.orderId,
    };
  } catch (err: any) {
    console.error('[NOWPayments API Network Error]:', err);
    return {
      success: false,
      error: err?.message || 'Network error connecting to NOWPayments API.',
    };
  }
}

/**
 * Fetches the live status of a payment directly from NOWPayments API.
 */
export async function getNowPaymentsPaymentStatus(paymentId: string): Promise<any> {
  const config = await getNowPaymentsConfig();
  if (!config.apiKey || !paymentId) return null;

  const baseUrl = config.isSandbox
    ? 'https://api-sandbox.nowpayments.io/v1'
    : 'https://api.nowpayments.io/v1';

  try {
    const response = await fetch(`${baseUrl}/payment/${paymentId}`, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('[NOWPayments API] Error querying payment status:', e);
    return null;
  }
}

/**
 * Accurately calculates expiration date given a start date, duration number, and unit (days or months).
 */
export function calculateExpirationDate(startDate: Date, duration: number, durationUnit: string): Date {
  const result = new Date(startDate.getTime());
  const unit = (durationUnit || 'months').toLowerCase().trim();

  if (unit.startsWith('day')) {
    result.setDate(result.getDate() + Number(duration));
  } else if (unit.startsWith('year')) {
    result.setFullYear(result.getFullYear() + Number(duration));
  } else {
    // Default to months
    const currentMonth = result.getMonth();
    result.setMonth(currentMonth + Number(duration));
  }

  return result;
}
