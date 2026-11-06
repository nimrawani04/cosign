import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { rankListingScreenshots } from "@/lib/api/cosign.functions";
import { formatMoney } from "@/lib/cosign/engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Result = Awaited<ReturnType<typeof rankListingScreenshots>>;
type Img = { name: string; image: string };

const read = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

export function ListingRank({ intentId }: { intentId: string }) {
  const rank = useServerFn(rankListingScreenshots);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function pick(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length > 6) { toast.error("Pick up to 6 screenshots."); return; }
    for (const f of files) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast.error(`${f.name}: use PNG, JPG, WebP or GIF.`); return; }
      if (f.size > 3_500_000) { toast.error(`${f.name}: must be under 3.5 MB.`); return; }
    }
    setImgs(await Promise.all(files.map(async (f) => ({ name: f.name, image: await read(f) }))));
    setRes(null);
    if (files.length) window.__lovableEvents?.track?.("project.listing_screenshot_uploaded", { mode: "compare", count: files.length });
  }

  async function run() {
    setBusy(true);
    try {
      const r = await rank({ data: { intentId, images: imgs } });
      setRes(r);
      window.__lovableEvents?.track?.("project.listing_comparison_completed", { listing_count: r.length, top_score: r[0]?.score ?? 0, unreadable_count: r.filter((x) => !x.ok).length });
    }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const src = (name: string) => imgs.find((i) => i.name === name)?.image;
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-2xl">Compare listing screenshots</h2>
      <p className="mt-1 text-sm text-muted-foreground">Upload 2–6 listings. AI reads each one; your locked policy rules score and rank them.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input aria-label="Listing screenshots" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => pick(e.target.files)} className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground" />
        <Button disabled={imgs.length < 2 || busy} onClick={run}>{busy ? `Reading ${imgs.length} listings…` : "Rank listings"}</Button>
      </div>
      {!res && imgs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">{imgs.map((i) => <img key={i.name} src={i.image} alt={i.name} className="h-24 rounded-lg border border-border object-cover" />)}</div>
      )}
      {res && (
        <ol className="mt-6 space-y-4">
          {res.map((r) => (
            <li key={r.name} className={`flex gap-4 rounded-xl border p-4 ${r.rank === 1 && r.score > 0 ? "border-primary" : "border-border"}`}>
              {src(r.name) && <img src={src(r.name)} alt={r.name} className="h-28 w-28 shrink-0 rounded-lg border border-border object-cover" />}
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">#{r.rank}</span>
                  <Badge variant={r.score >= 70 ? "default" : r.score >= 40 ? "secondary" : "destructive"}>Fit {r.score}/100</Badge>
                  <span className="font-medium">{r.terms?.product_name ?? r.name}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {r.terms?.merchant_name ?? "Unknown seller"} · {r.total_minor != null && r.currency ? formatMoney(r.total_minor, r.currency) : "no total"}
                  {r.terms?.return_days != null ? ` · ${r.terms.return_days}-day returns` : ""}
                </p>
                {r.flags.length === 0
                  ? <p className="mt-2 text-primary">Matches your policy.</p>
                  : <ul className="mt-2 space-y-1">{r.flags.map((f, i) => <li key={i}><Badge variant={f.severity === "HIGH" ? "destructive" : "outline"} className="mr-2">{f.severity}</Badge>{f.label} <span className="text-muted-foreground">— {f.detail}</span></li>)}</ul>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
