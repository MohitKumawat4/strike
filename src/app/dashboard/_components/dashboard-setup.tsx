import Link from "next/link";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";

export function DashboardSetup() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="auth-mark" aria-hidden="true">
          <KeyRound size={19} />
        </div>
        <p className="eyebrow">One-time setup</p>
        <h1>Connect Strike to Supabase</h1>
        <p>
          Add the project URL and publishable key from Supabase to `.env.local`.
          The dashboard will then enable secure sign-up and sign-in.
        </p>
        <pre className="env-snippet">NEXT_PUBLIC_SUPABASE_URL=https://…{`\n`}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…</pre>
        <div className="setup-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Never place the service-role key in a `NEXT_PUBLIC_*` variable.</span>
        </div>
        <Link className="primary-button" href="/login">
          <span>Open sign in</span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
