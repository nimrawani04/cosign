import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { approveAndPay, confirmPolicy, getIntent, runAnalysis } from "@/lib/api/cosign.functions";
import { formatMoney, type EngineCheck, type Policy } from "@/lib/cosign/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ListingScan } from "@/components/ListingScan";
import { ListingRank } from "@/components/ListingRank";

export const Route = createFileRoute("/_authenticated/intents/$id")({
  head: () => ({ meta: [{ title: "Purchase request — CoSign" }, { name: "description", content: "Review agent proposals and approve payment." }] }),
  component: IntentPage,
});

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function IntentPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getIntent);
  const confirm = useServerFn(confirmPolicy);
  const analyze = useServerFn(runAnalysis);
  const pay = useServerFn(approveAndPay);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["intent", id], queryFn: () => get({ data: { id } }) });
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (q.data?.intent.draft_policy && !policy) setPolicy(q.data.intent.draft_policy as unknown as Policy); }, [q.data, policy]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try { await fn(); await qc.invalidateQueries({ queryKey: ["intent", id] }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-destructive">Could not load this request.</p>;
  const { intent, proposals, events, runs, logs, payments, products, merchants } = q.data;
  const clar = intent.clarifications as { missing?: string[]; question?: string | null };
  const pName = (pid: string) => products.find((p) => p.id === pid)?.name ?? pid;
  const mName = (mid: string) => merchants.find((m) => m.id === mid)?.name ?? mid;
  const live = proposals.filter((p) => p.status !== "stale");

  return (
    <div className="space-y-10">
      <header>
        <div className="flex gap-2"><Badge variant="outline">{intent.status}</Badge>{intent.is_simulation && <Badge variant="secondary">lab · {intent.fixture_type}</Badge>}{intent.current_policy_version && <Badge>policy v{intent.current_policy_version}</Badge>}</div>
        <h1 className="mt-3 font-display text-3xl">“{intent.raw_request}”</h1>
      </header>

      {intent.status === "failed" && <p className="border border-destructive p-4 text-destructive">The Intent Agent failed, so nothing was approved. Start a new request.</p>}

      {policy && !intent.is_simulation && (
        <section className="border border-border bg-card p-6">
          <h2 className="font-display text-2xl">1 · Spending policy</h2>
          {clar?.missing?.length ? <p className="mt-2 text-sm text-primary">Needs clarification: {clar.missing.join(", ")}. {clar.question}</p> : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1"><Label>Category</Label><Input value={policy.product_category} onChange={(e) => setPolicy({ ...policy, product_category: e.target.value })} /></div>
            <div className="space-y-1"><Label>Max total ({policy.currency})</Label><Input type="number" value={policy.max_amount_minor / 100} onChange={(e) => setPolicy({ ...policy, max_amount_minor: Math.round(Number(e.target.value) * 100) })} /></div>
            <div className="space-y-1"><Label>Min. return days</Label><Input type="number" value={policy.minimum_return_days} onChange={(e) => setPolicy({ ...policy, minimum_return_days: Number(e.target.value) })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Mandatory specs</Label><Input value={policy.mandatory_specs.join(", ")} onChange={(e) => setPolicy({ ...policy, mandatory_specs: list(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Preferences</Label><Input value={policy.preferences.join(", ")} onChange={(e) => setPolicy({ ...policy, preferences: list(e.target.value) })} /></div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button disabled={!!busy} onClick={() => act("lock", () => confirm({ data: { intentId: id, policy } }))}>{busy === "lock" ? "Locking…" : intent.current_policy_version ? "Save new policy version" : "Lock policy"}</Button>
            {intent.current_policy_version && <Button variant="secondary" disabled={!!busy} onClick={() => act("analyze", () => analyze({ data: { intentId: id } }))}>{busy === "analyze" ? "Agents shopping & reviewing…" : "2 · Run agents"}</Button>}
          </div>
        </section>
      )}

      {intent.current_policy_version && !intent.is_simulation && <ListingScan intentId={id} />}
      {intent.current_policy_version && !intent.is_simulation && <ListingRank intentId={id} />}

      {live.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">3 · Proposals</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {live.map((p) => {
              const checks = (p.engine_checks ?? []) as unknown as EngineCheck[];
              const paid = payments.find((x) => x.proposal_id === p.id);
              return (
                <article key={p.id} className={`border p-5 ${p.eligible ? "border-primary" : "border-destructive"} bg-card`}>
                  <div className="flex items-center justify-between"><Badge variant={p.eligible ? "default" : "destructive"}>{p.engine_decision ?? p.status}</Badge><span className="font-mono text-xs">#{p.rank}</span></div>
                  <h3 className="mt-3 font-medium">{pName(p.product_id)}</h3>
                  <p className="text-sm text-muted-foreground">{mName(p.merchant_id)}</p>
                  <p className="mt-2 font-mono text-lg">{formatMoney(p.total_minor, p.currency)}</p>
                  <p className="mt-2 text-sm">{p.rationale}</p>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div><dt className="inline font-medium">Guardian {p.guardian_decision ?? "—"}:</dt> <dd className="inline text-muted-foreground">{p.guardian_summary}</dd></div>
                    <div><dt className="inline font-medium">Payment Intel {p.pi_recommendation ?? "—"}:</dt> <dd className="inline text-muted-foreground">{p.pi_summary}</dd></div>
                  </dl>
                  <ul className="mt-3 space-y-1 text-xs">
                    {checks.map((c) => <li key={c.id} className={c.passed ? "text-muted-foreground" : "text-destructive"}>{c.passed ? "✓" : "✗"} {c.label} <span className="opacity-70">— {c.detail}</span></li>)}
                  </ul>
                  {paid ? <p className="mt-4 text-sm font-medium text-primary">Paid · {paid.paypal_order_id ? `PayPal sandbox ${paid.paypal_order_id}` : "simulated sandbox capture"}</p> : (
                    <Button className="mt-4 w-full" disabled={!p.eligible || !!busy || p.status === "paid"} onClick={() => act(p.id, async () => {
                      const r = await pay({ data: { proposalId: p.id } });
                      if (r.ok) toast.success("Payment approved"); else toast.error("Blocked at re-validation");
                    })}>{busy === p.id ? "Re-validating…" : p.eligible ? "Co-sign & pay" : "Blocked"}</Button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">Security findings</h2>
          <ul className="mt-3 divide-y divide-border border border-border text-sm">
            {events.map((e) => <li key={e.id} className="p-3"><Badge variant="destructive">{e.severity}</Badge> <span className="font-mono text-xs">{e.source} · {e.finding_type}</span><p className="mt-1">{e.explanation}</p><p className="font-mono text-xs text-muted-foreground">{e.evidence}</p></li>)}
          </ul>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-xl">Agent runs</h2>
          <ul className="mt-3 space-y-1 font-mono text-xs">{runs.map((r) => <li key={r.id} className={r.status === "failed" ? "text-destructive" : ""}>{r.agent} · {r.status} · {r.duration_ms}ms {r.error ? `· ${r.error}` : ""}</li>)}</ul>
        </div>
        <div>
          <h2 className="font-display text-xl">Audit log</h2>
          <ul className="mt-3 space-y-1 font-mono text-xs">{logs.map((l) => <li key={l.id}>{new Date(l.created_at).toLocaleTimeString()} · {l.action}</li>)}</ul>
        </div>
      </section>
    </div>
  );
}
