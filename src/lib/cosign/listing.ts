// Deterministic comparison of AI-extracted listing terms against a locked policy.
// AI only reads the screenshot; these rules decide what is flagged.
import type { Policy } from "./engine";

export type ListingTerms = {
  product_name: string | null;
  merchant_name: string | null;
  currency: string | null;
  unit_price: number | null;
  shipping_cost: number | null;
  other_fees: { label: string; amount: number }[];
  quantity: number | null;
  return_days: number | null;
  specs: string[];
  suspicious_text: string[];
  notes: string | null;
};

export type ListingFlag = { id: string; severity: "HIGH" | "MEDIUM" | "LOW"; label: string; detail: string };

const fmt = (minor: number, cur: string) => `${cur} ${(minor / 100).toFixed(2)}`;

export function assessListing(t: ListingTerms, policy: Policy, merchantNames: string[]): { flags: ListingFlag[]; total_minor: number | null } {
  const flags: ListingFlag[] = [];
  const qty = t.quantity ?? policy.quantity ?? 1;
  const fees = t.other_fees.reduce((s, f) => s + f.amount, 0);
  const total_minor = t.unit_price == null ? null : Math.round((t.unit_price * qty + (t.shipping_cost ?? 0) + fees) * 100);

  if (t.currency && t.currency.toUpperCase() !== policy.currency.toUpperCase())
    flags.push({ id: "currency", severity: "HIGH", label: "Currency mismatch", detail: `Listing is in ${t.currency}, policy is ${policy.currency}.` });
  if (total_minor == null)
    flags.push({ id: "price_unknown", severity: "HIGH", label: "Price not visible", detail: "No price could be read from the screenshot." });
  else if (total_minor > policy.max_amount_minor)
    flags.push({ id: "over_budget", severity: "HIGH", label: "Over budget", detail: `Total ${fmt(total_minor, policy.currency)} exceeds limit ${fmt(policy.max_amount_minor, policy.currency)}.` });
  if (t.other_fees.length)
    flags.push({ id: "extra_fees", severity: "MEDIUM", label: "Extra fees", detail: t.other_fees.map((f) => `${f.label}: ${f.amount}`).join(", ") });
  if (policy.shipping_included && t.shipping_cost == null)
    flags.push({ id: "shipping_unknown", severity: "MEDIUM", label: "Shipping not shown", detail: "Policy requires shipping in the total, but no shipping cost is visible." });
  if (t.return_days == null)
    flags.push({ id: "returns_unknown", severity: "MEDIUM", label: "Return policy not shown", detail: `Policy requires at least ${policy.minimum_return_days} days.` });
  else if (t.return_days < policy.minimum_return_days)
    flags.push({ id: "returns_short", severity: "HIGH", label: "Return window too short", detail: `${t.return_days} days, policy requires ${policy.minimum_return_days}.` });
  if (policy.allowed_merchant_ids.length) {
    const m = t.merchant_name?.toLowerCase().trim();
    if (!m || !merchantNames.some((n) => n.toLowerCase() === m))
      flags.push({ id: "merchant", severity: "HIGH", label: "Merchant not allowed", detail: `${t.merchant_name ?? "Unknown seller"} is not on your allowed list.` });
  }
  const haystack = [t.product_name ?? "", ...t.specs].join(" ").toLowerCase();
  for (const spec of policy.mandatory_specs)
    if (!haystack.includes(spec.toLowerCase()))
      flags.push({ id: `spec:${spec}`, severity: "MEDIUM", label: "Required spec not confirmed", detail: spec });
  for (const s of t.suspicious_text)
    flags.push({ id: "injection", severity: "HIGH", label: "Suspicious instructions in listing", detail: s });
  return { flags, total_minor };
}
