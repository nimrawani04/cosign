const BASE = process.env['PAYPAL_ENVIRONMENT'] === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

let cached: { token: string; exp: number } | null = null;

export function paypalConfigured() {
  return Boolean(process.env['PAYPAL_CLIENT_ID'] && process.env['PAYPAL_CLIENT_SECRET']);
}

export function paypalIsLive() {
  return process.env['PAYPAL_ENVIRONMENT'] === "live";
}

async function token() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const id = process.env['PAYPAL_CLIENT_ID'];
  const secret = process.env['PAYPAL_CLIENT_SECRET'];
  if (!id || !secret) throw new Error("PayPal credentials are not configured");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function call<T>(path: string, init: RequestInit & { requestId?: string }): Promise<T> {
  const t = await token();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${t}`);
  headers.set("Content-Type", "application/json");
  if (init.requestId) headers.set("PayPal-Request-Id", init.requestId);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { message?: string; details?: { issue?: string; description?: string }[] };
    throw new Error(`PayPal ${res.status}: ${b.details?.[0]?.issue ?? b.message ?? "request failed"}`);
  }
  return body as T;
}

export const toValue = (minor: number) => (minor / 100).toFixed(2);

export type PaypalOrder = {
  id: string;
  status: string;
  links?: { href: string; rel: string; method: string }[];
  purchase_units?: {
    reference_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string } }[] };
  }[];
};

export function createOrder(p: { proposalId: string; amountMinor: number; currency: string; description: string; returnUrl: string; cancelUrl: string }) {
  return call<PaypalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: `cosign-order-${p.proposalId}`,
    body: JSON.stringify({
      intent: "CAPTURE",
      application_context: { return_url: p.returnUrl, cancel_url: p.cancelUrl, user_action: "PAY_NOW" },
      purchase_units: [
        {
          reference_id: p.proposalId,
          description: p.description.slice(0, 120),
          amount: { currency_code: p.currency, value: toValue(p.amountMinor) },
        },
      ],
    }),
  });
}

export const getOrder = (id: string) => call<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}`, { method: "GET" });

export const captureOrder = (id: string) =>
  call<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
    method: "POST",
    requestId: `cosign-capture-${id}`,
    body: "{}",
  });

export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env['PAYPAL_WEBHOOK_ID'];
  if (!webhookId) return false;
  const r = await call<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  return r.verification_status === "SUCCESS";
}
