import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cancelPaypalPayment, completePaypalPayment, createIntent, getDashboard, listMerchants } from "@/lib/api/cosign.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CoSign" }, { name: "description", content: "Your co-signed purchases and pending requests." }] }),
  component: Dashboard,
});

function Dashboard() {
  const get = useServerFn(getDashboard);
  const merchantsFn = useServerFn(listMerchants);
  const create = useServerFn(createIntent);
  const complete = useServerFn(completePaypalPayment);
  const cancel = useServerFn(cancelPaypalPayment);
  const qc = useQueryClient();
  const nav = useNavigate();
  const data = useQuery({ queryKey: ["dashboard"], queryFn: () => get() });
  const merchants = useQuery({ queryKey: ["merchants"], queryFn: () => merchantsFn() });
  const [raw, setRaw] = useState("Find wireless headphones for university with good battery life.");
  const [budget, setBudget] = useState("7000");
  const [returns, setReturns] = useState("14");
  const [ship, setShip] = useState(true);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypal = params.get("paypal");
    if (!paypal) return;
    let active = true;
    (async () => {
      try {
        if (paypal === "return") {
          const proposalId = params.get("proposal");
          const orderId = params.get("token");
          if (!proposalId || !orderId) throw new Error("PayPal return details are missing.");
          await complete({ data: { proposalId, orderId } });
          toast.success("PayPal payment captured successfully.");
        } else if (paypal === "cancel") {
          const orderId = params.get("token");
          if (orderId) await cancel({ data: { orderId } });
          toast("PayPal checkout was cancelled. No payment was captured.");
        }
      } catch (e) { toast.error((e as Error).message); }
      finally {
        if (active) {
          await qc.invalidateQueries({ queryKey: ["dashboard"] });
          window.history.replaceState({}, "", "/dashboard");
        }
      }
    })();
    return () => { active = false; };
  }, [cancel, complete, qc]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await create({ data: { raw, form: { max_amount: budget ? Number(budget) : null, currency: "INR", shipping_included: ship, minimum_return_days: returns ? Number(returns) : null, allowed_merchant_ids: allowed } } });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      nav({ to: "/intents/$id", params: { id: r.id } });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  const d = data.data;
  const paid = d?.payments.filter((p) => p.status === "captured") ?? [];
  const paidIntentIds = new Set(paid.map((p) => p.intent_id));
  const awaiting = d?.proposals.filter((p) => p.eligible && !["paid", "stale"].includes(p.status)) ?? [];
  const productName = (proposalId: string) => {
    const p = d?.proposalDetails.find((x) => x.id === proposalId);
    return d?.products.find((x) => x.id === p?.product_id)?.name ?? "Approved purchase";
  };
  const merchantName = (proposalId: string) => {
    const p = d?.proposalDetails.find((x) => x.id === proposalId);
    return d?.merchants.find((x) => x.id === p?.merchant_id)?.name ?? "Merchant";
  };

  return (
    <div className="space-y-10">
      <header><h1 className="font-display text-4xl">Your CoSign dashboard</h1><p className="mt-2 text-muted-foreground">Live status for approved purchases, requests and screenshot scans.</p></header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Co-signed purchases", paid.length], ["Pending requests", awaiting.length], ["Purchase requests", d?.intents.length ?? 0], ["Screenshot scans", d?.screenshotScans ?? 0]].map(([label, value]) =>
          <article className="border border-border bg-card p-5" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{data.isLoading ? "—" : value}</p></article>)}
      </section>
      {d && <p className="text-xs text-muted-foreground">PayPal: {d.paypal.configured ? (d.paypal.live ? "Live account connected" : "Sandbox account connected") : "Not configured on server"}</p>}

      <section className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="font-display text-2xl">New purchase request</h2>
          <p className="mt-2 text-muted-foreground">Describe what you want. Lock the policy before agents shop.</p>
          <form onSubmit={submit} className="mt-6 space-y-4 border border-border bg-card p-6">
            <div className="space-y-1"><Label>Request</Label><Textarea rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label>Budget (₹)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div><div className="space-y-1"><Label>Min. return days</Label><Input type="number" value={returns} onChange={(e) => setReturns(e.target.value)} /></div></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={ship} onCheckedChange={setShip} /> Budget includes shipping</label>
            <div className="space-y-1"><Label>Allowed merchants (none = any trusted)</Label><div className="flex flex-wrap gap-2">{merchants.data?.map((m) => <button type="button" key={m.id} onClick={() => setAllowed((a) => a.includes(m.id) ? a.filter((x) => x !== m.id) : [...a, m.id])} className={`border px-2 py-1 text-xs ${allowed.includes(m.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{m.name}{m.trusted ? "" : " (untrusted)"}</button>)}</div></div>
            <Button type="submit" disabled={busy}>{busy ? "Drafting…" : "Draft policy"}</Button>
          </form>
        </div>
        <div><h2 className="font-display text-2xl">Pending requests</h2><ul className="mt-4 divide-y divide-border border border-border">{awaiting.length === 0 && <li className="p-4 text-sm text-muted-foreground">No eligible purchases awaiting your co-sign.</li>}{awaiting.map((p) => <li key={p.id}><Link to="/intents/$id" params={{ id: p.intent_id }} className="block p-4 hover:bg-muted"><Badge variant="outline">Ready to co-sign</Badge><p className="mt-2 font-medium">{productName(p.id)}</p><p className="text-sm text-muted-foreground">{merchantName(p.id)} · {(p.total_minor / 100).toLocaleString()} {p.currency}</p></Link></li>)}</ul></div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div><h2 className="font-display text-2xl">Co-signed purchases</h2><ul className="mt-4 divide-y divide-border border border-border">{paid.length === 0 && <li className="p-4 text-sm text-muted-foreground">No captured purchases yet.</li>}{paid.map((p) => <li key={p.id} className="p-4"><div className="flex justify-between gap-3"><span className="font-medium">{productName(p.proposal_id)}</span><Badge>Paid</Badge></div><p className="text-sm text-muted-foreground">{merchantName(p.proposal_id)} · {(p.amount_minor / 100).toLocaleString()} {p.currency} · {new Date(p.created_at).toLocaleDateString()}</p></li>)}</ul></div>
        <div><h2 className="font-display text-2xl">Purchase requests</h2><ul className="mt-4 divide-y divide-border border border-border">{d?.intents.map((i) => <li key={i.id}><Link to="/intents/$id" params={{ id: i.id }} className="block p-4 hover:bg-muted"><div className="flex gap-2"><Badge variant="outline">{i.status}</Badge>{i.is_simulation && <Badge variant="secondary">lab</Badge>}{paidIntentIds.has(i.id) && <Badge>Co-signed</Badge>}</div><p className="mt-2 line-clamp-2 text-sm">{i.raw_request}</p></Link></li>)}</ul></div>
      </section>
    </div>
  );
}
