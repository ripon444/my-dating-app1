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

  const rawDbKey = (dbRow?.api_key || '').trim();
  const envKey = (process.env.NOWPAYMENTS_API_KEY || '').trim();
  const apiKey = (rawDbKey && !rawDbKey.includes('****')) ? rawDbKey : envKey;

  const rawDbSecret = (dbRow?.ipn_secret || '').trim();
  const envSecret = (process.env.NOWPAYMENTS_IPN_SECRET || '').trim();
  const ipnSecret = (rawDbSecret && !rawDbSecret.includes('****')) ? rawDbSecret : envSecret;

  const isSandbox = dbRow?.is_sandbox !== undefined 
    ? Boolean(dbRow.is_sandbox) 
    : (process.env.NOWPAYMENTS_SANDBOX === 'true' || process.env.NOWPAYMENTS_SANDBOX === '1');
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
  payCurrency?: string;
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

  // Subscription prices are denominated in USDT (Tether stablecoin) as configured in subscription plans.
  // Passing price_currency="usdt" ensures NOWPayments bases the invoice in USDT directly.
  // This prevents fiat-to-crypto internal conversion cuts (such as 10 USD -> 9.991984 USDT)
  // which trigger NOWPayments' "Crypto amount is less than minimal" error on 10-14 USDT plans.
  const rawCurrency = (params.currency || 'usdt').trim().toLowerCase();
  const priceCurrency = rawCurrency;

  const requestBody: Record<string, any> = {
    price_amount: Number(params.amount),
    price_currency: priceCurrency,
    ipn_callback_url: params.ipnCallbackUrl,
    order_id: params.orderId,
    order_description: params.orderDescription,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  // Only include pay_currency if explicitly provided as a non-empty string.
  // When omitted, NOWPayments gives the customer full freedom to select ANY available cryptocurrency on the checkout page.
  if (params.payCurrency && typeof params.payCurrency === 'string' && params.payCurrency.trim()) {
    requestBody.pay_currency = params.payCurrency.trim().toLowerCase();
  }

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
 * Checks dynamic minimum payment amount from NOWPayments API.
 * Minimum amounts vary dynamically depending on network conditions, blockchain gas fees,
 * and the specific cryptocurrency pair (currencyFrom -> currencyTo).
 */
export async function getNowPaymentsMinAmount(params: {
  currencyFrom?: string;
  currencyTo?: string;
  isFixedRate?: boolean;
}): Promise<{ minAmount: number; currencyFrom?: string; currencyTo?: string } | null> {
  const config = await getNowPaymentsConfig();
  if (!config.apiKey) return null;

  const baseUrl = config.isSandbox
    ? 'https://api-sandbox.nowpayments.io/v1'
    : 'https://api.nowpayments.io/v1';

  try {
    const query = new URLSearchParams();
    if (params.currencyFrom) query.set('currency_from', params.currencyFrom.toLowerCase().trim());
    if (params.currencyTo) query.set('currency_to', params.currencyTo.toLowerCase().trim());
    if (params.isFixedRate !== undefined) query.set('is_fixed_rate', String(params.isFixedRate));

    const response = await fetch(`${baseUrl}/min-amount?${query.toString()}`, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    return {
      minAmount: Number(data.min_amount || 0),
      currencyFrom: data.currency_from,
      currencyTo: data.currency_to,
    };
  } catch (err) {
    console.warn('[NOWPayments API] Error checking min-amount:', err);
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
