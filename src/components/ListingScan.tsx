import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { scanListingScreenshot } from "@/lib/api/cosign.functions";
import { formatMoney } from "@/lib/cosign/engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Result = Awaited<ReturnType<typeof scanListingScreenshot>>;

export function ListingScan({ intentId }: { intentId: string }) {
  const scan = useServerFn(scanListingScreenshot);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast.error("Use a PNG, JPG, WebP or GIF image."); return; }
    if (f.size > 5_000_000) { toast.error("Image must be under 5 MB."); return; }
    const r = new FileReader();
    r.onload = () => { setPreview(r.result as string); setRes(null); };
    r.readAsDataURL(f);
  }

  async function run() {
    if (!preview) return;
    setBusy(true);
    try { setRes(await scan({ data: { intentId, image: preview } })); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const t = res?.terms;
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-2xl">Check a listing screenshot</h2>
      <p className="mt-1 text-sm text-muted-foreground">Found something yourself? Upload a screenshot and we'll compare its terms to your locked policy.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input aria-label="Listing screenshot" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => pick(e.target.files?.[0])} className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground" />
        <Button disabled={!preview || busy} onClick={run}>{busy ? "Reading listing…" : "Scan listing"}</Button>
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {preview && <img src={preview} alt="Uploaded listing" className="max-h-80 w-full rounded-xl border border-border object-contain" />}
        {res && t && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Product</dt><dd>{t.product_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Seller</dt><dd>{t.merchant_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Price</dt><dd>{t.unit_price ?? "—"} {t.currency ?? ""}</dd>
              <dt className="text-muted-foreground">Shipping</dt><dd>{t.shipping_cost ?? "not shown"}</dd>
              <dt className="text-muted-foreground">Returns</dt><dd>{t.return_days != null ? `${t.return_days} days` : "not shown"}</dd>
              <dt className="text-muted-foreground">Est. total</dt><dd className="font-semibold">{res.total_minor != null ? formatMoney(res.total_minor, res.currency) : "—"}</dd>
            </dl>
            {res.flags.length === 0
              ? <p className="rounded-xl bg-accent p-3 text-accent-foreground">No risks found against your policy. Payment still goes through the normal checks.</p>
              : <ul className="space-y-2">{res.flags.map((f, i) => (
                  <li key={i} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2"><Badge variant={f.severity === "HIGH" ? "destructive" : "secondary"}>{f.severity}</Badge><span className="font-medium">{f.label}</span></div>
                    <p className="mt-1 text-muted-foreground">{f.detail}</p>
                  </li>))}</ul>}
          </div>
        )}
      </div>
    </section>
  );
}
