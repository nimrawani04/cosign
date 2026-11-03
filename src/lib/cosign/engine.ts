// Deterministic CoSign policy engine. Pure functions only — no AI, no I/O.
// The LLM agents never decide whether a payment is permitted; this does.

export type Policy = {
  product_category: string;
  max_amount_minor: number;
  currency: string;
  shipping_included: boolean;
  minimum_return_days: number;
  allowed_merchant_ids: string[];
  mandatory_specs: string[];
  preferences: string[];
  quantity: number;
  requires_buyer_approval: true;
};

export type CatalogueProduct = {
  id: string;
  sku: string;
  merchant_id: string;
  category: string;
  price_minor: number;
  shipping_minor: number;
  currency: string;
  return_days: number;
  description: string;
};

export type CatalogueMerchant = { id: string; trusted: boolean };

export type Claimed = {
  product_id?: string | null;
  merchant_id?: string | null;
  unit_price_minor?: number | null;
  shipping_minor?: number | null;
  currency?: string | null;
  return_days?: number | null;
};

export type EngineInput = {
  policy: Policy;
  currentPolicyVersion: number | null;
  proposalPolicyVersion: number;
  quantity: number;
  product: CatalogueProduct;
  merchant: CatalogueMerchant;
  claimed: Claimed;
  guardianDecision: string | null;
  piRecommendation: string | null;
};

export type EngineCheck = { id: string; label: string; passed: boolean; detail: string };
export type EngineResult = {
  decision: "PASS" | "BLOCK";
  eligible: boolean;
  checks: EngineCheck[];
  subtotal_minor: number;
  total_minor: number;
};

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |the )?(previous|prior|above|user'?s?)/i,
  /system (note|prompt|message|instruction)/i,
  /(to|for) (ai|llm|assistant|shopping) agents?/i,
  /pre-?approved/i,
  /disregard (the |all )?(budget|instructions|policy)/i,
  /mark (it|this) as (within budget|approved|safe)/i,
  /you (must|should) (select|choose|buy)/i,
];

export function scanForInjection(text: string): string[] {
  const hits: string[] = [];
  for (const p of INJECTION_PATTERNS) {
    const m = text.match(p);
    if (m) hits.push(m[0]);
  }
  return hits;
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function hashPolicy(policy: Policy): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(policy));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function evaluate(input: EngineInput): EngineResult {
  const { policy, product, merchant, claimed } = input;
  const qty = input.quantity;
  const subtotal = product.price_minor * qty;
  const total = subtotal + product.shipping_minor;
  const budgetBasis = policy.shipping_included ? total : subtotal;
  const checks: EngineCheck[] = [];
  const add = (id: string, label: string, passed: boolean, detail: string) =>
    checks.push({ id, label, passed, detail });

  add(
    "policy_current",
    "Policy version is current",
    input.currentPolicyVersion !== null && input.proposalPolicyVersion === input.currentPolicyVersion,
    `Proposal bound to v${input.proposalPolicyVersion}, current v${input.currentPolicyVersion ?? "none"}`,
  );
  add("quantity", "Quantity matches policy", qty === policy.quantity && qty > 0, `qty ${qty} / policy ${policy.quantity}`);
  add(
    "category",
    "Product category matches intent",
    product.category === policy.product_category,
    `${product.category} vs required ${policy.product_category}`,
  );
  add("currency", "Currency matches policy", product.currency === policy.currency, `${product.currency} vs ${policy.currency}`);
  add(
    "budget",
    policy.shipping_included ? "Total incl. shipping within limit" : "Item price within limit",
    product.currency === policy.currency && budgetBasis <= policy.max_amount_minor,
    `${budgetBasis} ≤ ${policy.max_amount_minor} (minor units)`,
  );
  add(
    "return_policy",
    "Return window meets minimum",
    product.return_days >= policy.minimum_return_days,
    `${product.return_days} days vs ${policy.minimum_return_days} required`,
  );
  const allowListOk = policy.allowed_merchant_ids.length === 0 || policy.allowed_merchant_ids.includes(merchant.id);
  add("merchant_allowed", "Merchant permitted by policy", allowListOk, allowListOk ? "Permitted" : "Not on allow-list");
  add("merchant_trusted", "Merchant is trusted", merchant.trusted, merchant.trusted ? "Trusted catalogue merchant" : "Unverified merchant");

  const mismatches: string[] = [];
  if (claimed.product_id != null && claimed.product_id !== product.id) mismatches.push("product");
  if (claimed.merchant_id != null && claimed.merchant_id !== product.merchant_id) mismatches.push("merchant");
  if (claimed.unit_price_minor != null && claimed.unit_price_minor !== product.price_minor) mismatches.push("price");
  if (claimed.shipping_minor != null && claimed.shipping_minor !== product.shipping_minor) mismatches.push("shipping");
  if (claimed.currency != null && claimed.currency !== product.currency) mismatches.push("currency");
  if (claimed.return_days != null && claimed.return_days !== product.return_days) mismatches.push("return_days");
  add(
    "claim_integrity",
    "Proposal matches catalogue record",
    mismatches.length === 0,
    mismatches.length ? `Mismatch: ${mismatches.join(", ")}` : "All claimed fields match",
  );

  const hits = scanForInjection(product.description);
  add("no_injection", "No embedded instructions in listing", hits.length === 0, hits.length ? `Found: "${hits[0]}"` : "Clean");
  add("guardian", "Guardian verdict is PASS", input.guardianDecision === "PASS", `Guardian: ${input.guardianDecision ?? "missing"}`);
  add(
    "payment_intelligence",
    "Payment Intelligence recommends APPROVE",
    input.piRecommendation === "APPROVE",
    `PI: ${input.piRecommendation ?? "missing"}`,
  );

  const eligible = checks.every((c) => c.passed);
  return { decision: eligible ? "PASS" : "BLOCK", eligible, checks, subtotal_minor: subtotal, total_minor: total };
}

export function formatMoney(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
