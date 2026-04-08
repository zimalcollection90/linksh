import Link from "next/link";
import { Zap, BarChart3, Shield, Link2, ArrowRight, Globe, Users } from 'lucide-react';
import { createClient } from "../../supabase/server";
import UserProfile from "@/components/user-profile";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark" style={{ background: "#0D1117" }}>
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-white font-bold text-lg" style={{ fontFamily: "Syne, sans-serif" }}>LinkFlux</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all">
                Dashboard
              </Link>
              <UserProfile user={user} profile={profile} />
            </div>
          ) : (
            <>
              <Link href="/sign-in" className="text-white/70 hover:text-white text-sm transition-colors">Sign In</Link>
              <Link href="/sign-up" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)" }} />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium mb-6">
            <Zap className="w-3 h-3" />
            URL Shortener & Analytics Platform
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
            Shorten URLs.<br />
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Track Everything.
            </span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
            A powerful URL shortener with real-time analytics, team management, earnings tracking, and fraud detection — built for modern SaaS teams.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={user ? "/dashboard" : "/sign-up"} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all hover:scale-105">
              Start for Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sign-in" className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-white/80 hover:text-white hover:border-white/20 font-medium transition-all">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12" style={{ fontFamily: "Syne, sans-serif" }}>
            Everything you need to manage links at scale
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Link2, title: "Smart URL Shortening", desc: "Custom aliases, QR codes, UTM builders, expiry dates, and password protection.", color: "text-purple-400", bg: "bg-purple-500/10" },
              { icon: BarChart3, title: "Real-Time Analytics", desc: "Track clicks by country, device, browser, referrer with live activity feeds.", color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { icon: Users, title: "Team Management", desc: "Invite members, assign roles, set earnings rates, and track performance.", color: "text-green-400", bg: "bg-green-500/10" },
              { icon: Shield, title: "Fraud Detection", desc: "Automatic bot detection with click quality scores and suspicious activity alerts.", color: "text-amber-400", bg: "bg-amber-500/10" },
              { icon: Globe, title: "Public Bio Pages", desc: "Linktree-style public profiles at /u/username with all your active links.", color: "text-pink-400", bg: "bg-pink-500/10" },
              { icon: Zap, title: "Lightning Fast", desc: "Sub-300ms redirects with automatic click logging — no slowdown.", color: "text-blue-400", bg: "bg-blue-500/10" },
            ].map((f, i) => (
              <div key={i} className="p-5 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className={`w-9 h-9 rounded-lg ${f.bg} flex items-center justify-center mb-3`}>
                  <f.icon className={`w-4.5 h-4.5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-1.5" style={{ fontFamily: "Syne, sans-serif" }}>{f.title}</h3>
                <p className="text-sm text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Syne, sans-serif" }}>Ready to get started?</h2>
          <p className="text-white/50 mb-8">Join teams using LinkFlux to manage links and track performance at scale.</p>
          <Link href={user ? "/dashboard" : "/sign-up"} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all hover:scale-105">
            {user ? "Go to Dashboard" : "Create Free Account"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span>LinkFlux — URL Shortener & Analytics Platform</span>
        </div>
      </footer>
    </div>
  );
}
