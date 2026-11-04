import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoSign — AI shopping agents that can't overspend" },
      { name: "description", content: "Lock a spending policy, let AI agents shop, and co-sign only purchases that pass deterministic checks." },
      { property: "og:title", content: "CoSign — AI shopping agents that can't overspend" },
      { property: "og:description", content: "Lock a spending policy, let AI agents shop, and co-sign only purchases that pass deterministic checks." },
    ],
  }),
  component: Index,
});

const steps = [
  ["Intent Agent", "Turns your words into a draft spending policy you edit and lock."],
  ["Shopping Agent", "Picks up to three candidates from the catalogue."],
  ["Guardian", "Hunts for prompt injection, hidden fees and substitutions."],
  ["Policy engine", "Deterministic checks decide. AI never approves money."],
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">CoSign · prototype</p>
        <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[1.05]">Your AI can shop. Only you can sign.</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">A locked policy, four supervising agents and a deterministic engine stand between an AI shopper and your wallet.</p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/dashboard">Open app</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/lab">Try the security lab</Link></Button>
        </div>
        <ol className="mt-20 grid gap-px border border-border bg-border sm:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="bg-card p-5"><span className="font-mono text-xs text-primary">0{i + 1}</span><h3 className="mt-2 font-medium">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></li>
          ))}
        </ol>
      </div>
    </div>
  );
}
