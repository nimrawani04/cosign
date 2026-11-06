import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Policy } from "@/lib/cosign/engine";


export const listIntents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("purchase_intents")
      .select("id, raw_request, status, is_simulation, fixture_type, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [intents, payments, proposals, logs, paypal] = await Promise.all([
      sb.from("purchase_intents").select("id, raw_request, status, is_simulation, created_at").order("created_at", { ascending: false }).limit(100),
      sb.from("payments").select("id, intent_id, proposal_id, amount_minor, currency, status, paypal_status, is_sandbox, created_at").order("created_at", { ascending: false }).limit(100),
      sb.from("proposals").select("id, intent_id, status, eligible, total_minor, currency, created_at").order("created_at", { ascending: false }).limit(200),
      sb.from("audit_logs").select("action, created_at").like("action", "listing.%").order("created_at", { ascending: false }).limit(500),
      import("@/server/paypal.server"),
    ]);
    const ids = (intents.data ?? []).map((i) => i.id);
    const products = ids.length ? await sb.from("proposals").select("id, product_id, merchant_id").in("intent_id", ids) : { data: [] };
    const productIds = [...new Set((products.data ?? []).map((p) => p.product_id))];
    const merchantIds = [...new Set((products.data ?? []).map((p) => p.merchant_id))];
    const [names, merchants] = await Promise.all([
      productIds.length ? sb.from("products").select("id, name").in("id", productIds) : Promise.resolve({ data: [] }),
      merchantIds.length ? sb.from("merchants").select("id, name").in("id", merchantIds) : Promise.resolve({ data: [] }),
    ]);
    return {
      intents: intents.data ?? [], payments: payments.data ?? [], proposals: proposals.data ?? [],
      proposalDetails: products.data ?? [], products: names.data ?? [], merchants: merchants.data ?? [],
      screenshotScans: (logs.data ?? []).filter((l) => l.action === "listing.scanned").length,
      paypal: { configured: paypal.paypalConfigured(), live: paypal.paypalIsLive() },
    };
  });

export const getIntent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: intent } = await sb.from("purchase_intents").select("*").eq("id", data.id).maybeSingle();
    if (!intent) throw new Error("Not found");
    const [props, events, runs, logs, pays, products, merchants] = await Promise.all([
      sb.from("proposals").select("*").eq("intent_id", data.id).order("created_at"),
      sb.from("security_events").select("*").eq("intent_id", data.id).order("created_at"),
      sb.from("agent_runs").select("id, agent, status, model, error, duration_ms, proposal_id, created_at").eq("intent_id", data.id).order("created_at"),
      sb.from("audit_logs").select("*").eq("intent_id", data.id).order("created_at"),
      sb.from("payments").select("*").eq("intent_id", data.id),
      sb.from("products").select("id, name, sku, return_days"),
      sb.from("merchants").select("id, name"),
    ]);
    return {
      intent,
      proposals: props.data ?? [],
      events: events.data ?? [],
      runs: runs.data ?? [],
      logs: logs.data ?? [],
      payments: pays.data ?? [],
      products: products.data ?? [],
      merchants: merchants.data ?? [],
    };
  });

export const listMerchants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("merchants").select("id, name, trusted").order("name");
    return data ?? [];
  });

const formSchema = z.object({
  raw: z.string().trim().min(5).max(1000),
  form: z.object({
    max_amount: z.number().positive().max(10_000_000).nullable(),
    currency: z.string().length(3),
    shipping_included: z.boolean(),
    minimum_return_days: z.number().int().min(0).max(365).nullable(),
    allowed_merchant_ids: z.array(z.string().uuid()),
  }),
});

export const createIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof formSchema>) => formSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { draftIntent } = await import("@/server/pipeline.server");
    return { id: await draftIntent(context.userId, data.raw, data.form) };
  });

const policySchema = z.object({
  product_category: z.string().min(1),
  max_amount_minor: z.number().int().positive(),
  currency: z.string().length(3),
  shipping_included: z.boolean(),
  minimum_return_days: z.number().int().min(0),
  allowed_merchant_ids: z.array(z.string()),
  mandatory_specs: z.array(z.string()),
  preferences: z.array(z.string()),
  quantity: z.number(),
  requires_buyer_approval: z.literal(true),
});

export const confirmPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { intentId: string; policy: Policy }) =>
    z.object({ intentId: z.string().uuid(), policy: policySchema }).parse(d) as { intentId: string; policy: Policy })
  .handler(async ({ data, context }) => {
    const { lockPolicy } = await import("@/server/pipeline.server");
    return { version: await lockPolicy(context.userId, data.intentId, data.policy) };
  });

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { intentId: string }) => z.object({ intentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { analyze } = await import("@/server/pipeline.server");
    await analyze(context.userId, data.intentId);
    return { ok: true };
  });

export const runLab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fixture: string }) => z.object({ fixture: z.string().max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { runSimulation } = await import("@/server/pipeline.server");
    return { id: await runSimulation(context.userId, data.fixture) };
  });

export const approveAndPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string }) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { revalidate, audit } = await import("@/server/pipeline.server");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const r = await revalidate(context.userId, data.proposalId);
    if (!r.eligible) {
      await audit(context.userId, r.intentId, "payment.blocked", { failed: r.checks.filter((c) => !c.passed).map((c) => c.id) }, data.proposalId);
      return { ok: false as const, checks: r.checks };
    }
    const { data: existing } = await db.from("payments").select("id").eq("proposal_id", data.proposalId).maybeSingle();
    if (existing) return { ok: true as const, mode: "already_paid" };

    const { paypalConfigured, paypalIsLive, createOrder } = await import("@/server/paypal.server");
    if (!paypalConfigured() && !r.isSimulation) throw new Error("PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the server environment.");
    let orderId: string | null = null;
    let status = "simulated_capture";
    let approvalUrl: string | null = null;
    if (paypalConfigured() && !r.isSimulation) {
      const origin = process.env['APP_URL'] ?? process.env['PUBLIC_APP_URL'];
      if (!origin) throw new Error("Set APP_URL (or PUBLIC_APP_URL) to the public app URL before enabling PayPal checkout.");
      const returnUrl = `${origin}/dashboard?paypal=return&proposal=${encodeURIComponent(data.proposalId)}`;
      const cancelUrl = `${origin}/dashboard?paypal=cancel`;
      const order = await createOrder({ proposalId: data.proposalId, amountMinor: r.total_minor, currency: r.product.currency, description: r.product.name, returnUrl, cancelUrl });
      orderId = order.id;
      status = order.status;
      approvalUrl = order.links?.find((l) => l.rel === "approve")?.href ?? null;
      if (!approvalUrl) throw new Error("PayPal did not return an approval link.");
    }
    if (orderId) {
      await db.from("payments").insert({ user_id: context.userId, intent_id: r.intentId, proposal_id: data.proposalId,
        amount_minor: r.total_minor, currency: r.product.currency, is_sandbox: !paypalIsLive(), paypal_order_id: orderId,
        paypal_status: status, status: "pending" });
      await audit(context.userId, r.intentId, "payment.checkout_created", { total_minor: r.total_minor, mode: paypalIsLive() ? "paypal_live" : "paypal_sandbox", order_id: orderId }, data.proposalId);
      return { ok: true as const, mode: paypalIsLive() ? "paypal_live" : "paypal_sandbox", approvalUrl };
    }
    await db.from("payments").insert({
      user_id: context.userId, intent_id: r.intentId, proposal_id: data.proposalId,
      amount_minor: r.total_minor, currency: r.product.currency, is_sandbox: true,
      paypal_order_id: orderId, paypal_status: status, status: orderId ? "created" : "captured",
    });
    if (!r.isSimulation) {
      await db.from("proposals").update({ status: "paid" }).eq("id", data.proposalId);
      await db.from("purchase_intents").update({ status: "paid" }).eq("id", r.intentId);
    }
    await audit(context.userId, r.intentId, "payment.approved", { total_minor: r.total_minor, mode: "simulated" }, data.proposalId);
    return { ok: true as const, mode: orderId ? "paypal_sandbox" : "simulated" };
  });

export const completePaypalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string; orderId: string }) => z.object({ proposalId: z.string().uuid(), orderId: z.string().min(1).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { revalidate, audit } = await import("@/server/pipeline.server");
    const { getOrder, captureOrder } = await import("@/server/paypal.server");
    const { data: payment } = await context.supabase.from("payments").select("*").eq("proposal_id", data.proposalId).eq("paypal_order_id", data.orderId).maybeSingle();
    if (!payment || payment.user_id !== context.userId) throw new Error("Payment order not found.");
    if (payment.status === "captured") return { ok: true as const };
    const check = await revalidate(context.userId, data.proposalId);
    if (!check.eligible || check.intentId !== payment.intent_id || check.total_minor !== payment.amount_minor || check.product.currency !== payment.currency)
      throw new Error("Purchase no longer passes the locked policy; payment was not captured.");
    const order = await getOrder(data.orderId);
    const unit = order.purchase_units?.[0];
    if (unit?.reference_id !== data.proposalId || unit.amount?.currency_code !== payment.currency || Number(unit.amount.value) !== payment.amount_minor / 100)
      throw new Error("PayPal order does not match the approved purchase.");
    const captured = order.status === "COMPLETED" ? order : await captureOrder(data.orderId);
    const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
    if (captured.status !== "COMPLETED" || !capture || capture.status !== "COMPLETED") throw new Error("PayPal has not completed the capture.");
    await db.from("payments").update({ paypal_capture_id: capture.id, paypal_status: capture.status, status: "captured", updated_at: new Date().toISOString() }).eq("id", payment.id);
    await db.from("proposals").update({ status: "paid" }).eq("id", data.proposalId);
    await db.from("purchase_intents").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", payment.intent_id);
    await audit(context.userId, payment.intent_id, "payment.captured", { capture_id: capture.id, order_id: data.orderId, total_minor: payment.amount_minor }, data.proposalId);
    return { ok: true as const };
  });

export const cancelPaypalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => z.object({ orderId: z.string().min(1).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("payments").update({ status: "cancelled", paypal_status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("paypal_order_id", data.orderId).eq("user_id", context.userId).eq("status", "pending");
    return { ok: true as const };
  });

export const getLabFixtures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { FIXTURES, DEMO_REQUEST } = await import("@/server/pipeline.server");
    return { request: DEMO_REQUEST, fixtures: Object.entries(FIXTURES).map(([id, f]) => ({ id, label: f.label, sku: f.sku })) };
  });

export const scanListingScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { intentId: string; image: string }) =>
    z.object({ intentId: z.string().uuid(), image: z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,/).max(7_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { scanListing } = await import("@/server/pipeline.server");
    return scanListing(context.userId, data.intentId, data.image);
  });

export const rankListingScreenshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { intentId: string; images: { name: string; image: string }[] }) =>
    z.object({
      intentId: z.string().uuid(),
      images: z.array(z.object({ name: z.string().max(200), image: z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,/).max(5_000_000) })).min(2).max(6),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { scanListing } = await import("@/server/pipeline.server");
    const { rankListings } = await import("@/lib/cosign/listing");
    const results = [];
    for (const img of data.images) {
      try {
        const r = await scanListing(context.userId, data.intentId, img.image);
        results.push({ name: img.name, ok: true as const, ...r });
      } catch (e) {
        results.push({ name: img.name, ok: false as const, error: (e as Error).message, terms: null, flags: [{ id: "unreadable", severity: "HIGH" as const, label: "Couldn't read screenshot", detail: (e as Error).message }], total_minor: null, currency: "" });
      }
    }
    return rankListings(results);
  });

export const createProposalFromListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { intentId: string; image: string }) => z.object({ intentId: z.string().uuid(), image: z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,/).max(5_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { createListingProposal } = await import("@/server/pipeline.server");
    return createListingProposal(context.userId, data.intentId, data.image);
  });
