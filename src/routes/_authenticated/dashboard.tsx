import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createIntent, listIntents, listMerchants } from "@/lib/api/cosign.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Purchase requests — CoSign" }, { name: "description", content: "Your AI purchase requests." }] }),
  component: Dashboard,
});

function Dashboard() {
  const list = useServerFn(listIntents);
  const merchantsFn = useServerFn(listMerchants);
  const create = useServerFn(createIntent);
  const qc = useQueryClient();
  const nav = useNavigate();
  const intents = useQuery({ queryKey: ["intents"], queryFn: () => list() });
  const merchants = useQuery({ queryKey: ["merchants"], queryFn: () => merchantsFn() });
  const [raw, setRaw] = useState("Find wireless headphones for university with good battery life.");
  const [budget, setBudget] = useState("7000");
  const [returns, setReturns] = useState("14");
  const [ship, setShip] = useState(true);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await create({ data: { raw, form: {
        max_amount: budget ? Number(budget) : null, currency: "INR", shipping_included: ship,
        minimum_return_days: returns ? Number(returns) : null, allowed_merchant_ids: allowed,
      } } });
      qc.invalidateQueries({ queryKey: ["intents"] });
      nav({ to: "/intents/$id", params: { id: r.id } });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      <section>
        <h1 className="font-display text-4xl">New purchase request</h1>
        <p className="mt-2 text-muted-foreground">Describe what you want. The Intent Agent drafts a policy; you lock it before any agent shops.</p>
        <form onSubmit={submit} className="mt-6 space-y-4 border border-border bg-card p-6">
          <div className="space-y-1"><Label>Request</Label><Textarea rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Budget (₹)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            <div className="space-y-1"><Label>Min. return days</Label><Input type="number" value={returns} onChange={(e) => setReturns(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={ship} onCheckedChange={setShip} /> Budget includes shipping</label>
          <div className="space-y-1">
            <Label>Allowed merchants (none = any trusted)</Label>
            <div className="flex flex-wrap gap-2">
              {merchants.data?.map((m) => (
                <button type="button" key={m.id} onClick={() => setAllowed((a) => a.includes(m.id) ? a.filter((x) => x !== m.id) : [...a, m.id])}
                  className={`border px-2 py-1 text-xs ${allowed.includes(m.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {m.name}{m.trusted ? "" : " (untrusted)"}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Intent Agent drafting…" : "Draft policy"}</Button>
        </form>
      </section>
      <section>
        <h2 className="font-display text-2xl">History</h2>
        <ul className="mt-4 divide-y divide-border border border-border">
          {intents.isLoading && <li className="p-4 text-sm text-muted-foreground">Loading…</li>}
          {intents.data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">No requests yet.</li>}
          {intents.data?.map((i) => (
            <li key={i.id}>
              <Link to="/intents/$id" params={{ id: i.id }} className="block p-4 hover:bg-muted">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{i.status}</Badge>
                  {i.is_simulation && <Badge variant="secondary">lab · {i.fixture_type}</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm">{i.raw_request}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
