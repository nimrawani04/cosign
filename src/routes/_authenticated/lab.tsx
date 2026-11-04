import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getLabFixtures, runLab } from "@/server/cosign.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/lab")({
  head: () => ({ meta: [{ title: "Security lab — CoSign" }, { name: "description", content: "Replay attacks against CoSign's guardrails." }] }),
  component: Lab,
});

function Lab() {
  const get = useServerFn(getLabFixtures);
  const run = useServerFn(runLab);
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["fixtures"], queryFn: () => get() });
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div>
      <h1 className="font-display text-4xl">Security lab</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Each scenario simulates a compromised Shopping Agent or hostile listing. Watch Guardian, Payment Intelligence and the deterministic engine respond. Request: “{q.data?.request}”</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {q.data?.fixtures.map((f) => (
          <div key={f.id} className="flex flex-col justify-between border border-border bg-card p-4">
            <div><p className="font-medium">{f.label}</p><p className="font-mono text-xs text-muted-foreground">{f.sku}</p></div>
            <Button className="mt-4" size="sm" disabled={!!busy} onClick={async () => {
              setBusy(f.id);
              try { const r = await run({ data: { fixture: f.id } }); nav({ to: "/intents/$id", params: { id: r.id } }); }
              catch (e) { toast.error((e as Error).message); setBusy(null); }
            }}>{busy === f.id ? "Running agents…" : "Run"}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
