import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CoSign" },
      { name: "description", content: "Sign in to CoSign to supervise your AI shopping agents." },
      { property: "og:title", content: "Sign in — CoSign" },
      { property: "og:description", content: "Sign in to CoSign to supervise your AI shopping agents." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/dashboard" }); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (s && e === "SIGNED_IN") nav({ to: "/dashboard" }); });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    if (mode === "up" && !res.data.session) toast.success("Check your email to confirm your account.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">CoSign</p>
          <h1 className="mt-2 font-display text-3xl">{mode === "in" ? "Sign in" : "Create account"}</h1>
        </div>
        <div className="space-y-2">
          {(["google", "lovable"] as const).map((p) => (
            <Button key={p} variant="outline" className="w-full rounded-full" onClick={async () => {
              const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
              if (r.error) { toast.error(r.error.message); return; }
              if (r.redirected) return;
              nav({ to: "/dashboard" });
            }}>Continue with {p === "google" ? "Google" : "Lovable"}</Button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
        </form>
        <button className="text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
