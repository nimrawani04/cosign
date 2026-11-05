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

    const { paypalConfigured, createOrder } = await import("@/server/paypal.server");
    let orderId: string | null = null;
    let status = "simulated_capture";
    if (paypalConfigured() && !r.isSimulation) {
      const order = await createOrder({ proposalId: data.proposalId, amountMinor: r.total_minor, currency: r.product.currency, description: r.product.name });
      orderId = order.id;
      status = order.status;
    }
    await db.from("payments").insert({
      user_id: context.userId, intent_id: r.intentId, proposal_id: data.proposalId,
      amount_minor: r.total_minor, currency: r.product.currency, is_sandbox: true,
      paypal_order_id: orderId, paypal_status: status, status: orderId ? "created" : "captured",
    });
    await db.from("proposals").update({ status: "paid" }).eq("id", data.proposalId);
    await db.from("purchase_intents").update({ status: "paid" }).eq("id", r.intentId);
    await audit(context.userId, r.intentId, "payment.approved", { total_minor: r.total_minor, mode: orderId ? "paypal_sandbox" : "simulated" }, data.proposalId);
    return { ok: true as const, mode: orderId ? "paypal_sandbox" : "simulated" };
  });

export const getLabFixtures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { FIXTURES, DEMO_REQUEST } = await import("@/server/pipeline.server");
    return { request: DEMO_REQUEST, fixtures: Object.entries(FIXTURES).map(([id, f]) => ({ id, label: f.label, sku: f.sku })) };
  });
