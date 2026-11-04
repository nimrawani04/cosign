import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link to="/dashboard" className="font-display text-xl">CoSign</Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/dashboard" className="text-muted-foreground [&.active]:text-foreground">Requests</Link>
            <Link to="/lab" className="text-muted-foreground [&.active]:text-foreground">Security lab</Link>
          </nav>
          <button className="ml-auto text-sm text-muted-foreground" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}>Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8"><Outlet /></main>
    </div>
  );
}
