"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import React, { useState, useCallback } from "react";

/* ── Anthropic Cream Palette ── */
const P = {
  cream: "#f5f2ed",
  warmGray: "#e8e4de",
  charcoal: "#1a1a1a",
  charcoalLight: "#2d2d2d",
  textPrimary: "#1a1a1a",
  textSecondary: "#5a5a5a",
  textMuted: "#8a8a8a",
  gold: "#e2b857",
  goldSoft: "rgba(226,184,87,0.15)",
  green: "#4ade80",
  purple: "#9f7aea",
};

const ease = [0.33, 1, 0.68, 1] as const;

/* ── Animations ── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};

/* ── Feature Card ── */
function FeatureCard({ title, description, tag, href }: { title: string; description: string; tag: string; href: string }) {
  return (
    <Link href={href}>
      <motion.div
        variants={fadeUp}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        style={{
          background: "white",
          border: `1px solid ${P.warmGray}`,
          borderRadius: 12,
          padding: "32px 28px",
          cursor: "pointer",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)";
          (e.currentTarget as HTMLElement).style.borderColor = P.gold;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
          (e.currentTarget as HTMLElement).style.borderColor = P.warmGray;
        }}
      >
        <span style={{
          display: "inline-block", fontSize: 10, fontFamily: "var(--font-mono)",
          fontWeight: 500, color: P.gold, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: 12,
          padding: "3px 8px", borderRadius: 4,
          background: P.goldSoft,
        }}>{tag}</span>
        <h3 style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 22, fontWeight: 500, color: P.charcoal,
          marginBottom: 8, lineHeight: 1.3,
        }}>{title}</h3>
        <p style={{
          fontSize: 14, lineHeight: 1.6, color: P.textSecondary,
          fontFamily: "var(--font-sans)",
        }}>{description}</p>
      </motion.div>
    </Link>
  );
}

/* ── Stat Pill ── */
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "12px 24px", background: "white", borderRadius: 8,
      border: `1px solid ${P.warmGray}`,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: P.charcoal }}>{value}</span>
      <span style={{ fontSize: 11, color: P.textMuted, fontWeight: 400, letterSpacing: "0.02em" }}>{label}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
export default function LandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    
    if (!q) {
      router.push("/dashboard");
      return;
    }
    
    // Extract ticker from natural language
    // "help me trade TSLA" → "TSLA"
    // "AAPL" → "AAPL"  
    // "bullish tech stocks" → search filter
    const tickerMatch = q.match(/\b([A-Z]{1,5})\b/);
    const KNOWN_WORDS = new Set(["HELP", "ME", "TRADE", "BUY", "SELL", "FIND", "SHOW", "WHAT", "ABOUT", "ON"]);
    
    if (tickerMatch) {
        const candidates = q.split(/\s+/).filter(w => /^[A-Z]{1,5}$/.test(w) && !KNOWN_WORDS.has(w));
        if (candidates.length > 0) {
            // Navigate to dashboard with ticker selection
            router.push(`/dashboard?ticker=${candidates[0]}`);
            return;
        }
    }
    
    // Fallback: general search
    router.push(`/dashboard?search=${encodeURIComponent(query.trim())}`);
  }, [query, router]);

  return (
    <div style={{ background: P.cream, minHeight: "100vh", color: P.textPrimary }}>

      {/* ── Top Nav ── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 40px", borderBottom: `1px solid ${P.warmGray}`,
        position: "sticky", top: 0, zIndex: 50,
        background: `${P.cream}f0`, backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
            color: P.charcoal, letterSpacing: "0.06em",
          }}>HEADSTART</span>
          <span style={{
            fontSize: 9, fontFamily: "var(--font-mono)", color: P.textMuted,
            padding: "2px 6px", borderRadius: 4, border: `1px solid ${P.warmGray}`,
          }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/dashboard" style={{ fontSize: 13, color: P.textSecondary, textDecoration: "none", fontWeight: 400 }}>
            Dashboard
          </Link>
          <Link href="/dashboard" style={{
            fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500,
            padding: "6px 16px", borderRadius: 6,
            background: P.charcoal, color: P.cream,
            textDecoration: "none", letterSpacing: "0.02em",
          }}>
            Launch Terminal →
          </Link>
        </div>
      </nav>

      {/* ── Dark Hero with Logo Image ── */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={stagger}
        style={{
          background: "linear-gradient(180deg, #111111 0%, #1a1a1a 60%, #2a2520 85%, #f5f2ed 100%)",
          textAlign: "center",
          padding: "60px 24px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
          width: 500, height: 300, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(226,184,87,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <motion.p variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
          color: P.gold, letterSpacing: "0.14em", textTransform: "uppercase",
          marginBottom: 24, position: "relative", zIndex: 1,
        }}>
          HEADSTART
        </motion.p>

        <motion.h1 variants={fadeUp} style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 400,
          lineHeight: 1.15, letterSpacing: "-0.02em",
          color: "#f5f2ed", marginBottom: 20,
          position: "relative", zIndex: 1,
        }}>
          Smarter Alpha.
        </motion.h1>

        <motion.p variants={fadeUp} style={{
          fontSize: 17, lineHeight: 1.7, color: "rgba(245,242,237,0.65)",
          maxWidth: 520, margin: "0 auto",
          fontFamily: "var(--font-sans)",
          position: "relative", zIndex: 1,
        }}>
          The edge you didn&apos;t know you were missing. We scan thousands of options, track momentum shifts, and surface the trades that actually matter.
        </motion.p>
      </motion.section>

      {/* ── Search Bar Section (cream zone) ── */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={stagger}
        style={{ maxWidth: 600, margin: "-30px auto 0", padding: "0 24px 50px", position: "relative", zIndex: 2 }}
      >
        <motion.form variants={fadeUp} onSubmit={handleSearch} style={{
          display: "flex", maxWidth: 520, margin: "0 auto",
          background: "white", borderRadius: 10,
          border: `1px solid ${P.warmGray}`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          overflow: "hidden",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${P.goldSoft}`;
          (e.currentTarget as HTMLElement).style.borderColor = P.gold;
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)";
          (e.currentTarget as HTMLElement).style.borderColor = P.warmGray;
        }}
        >
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="How can I help you trade today?"
            style={{
              flex: 1, padding: "14px 20px", border: "none", outline: "none",
              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 400,
              color: P.charcoal, background: "transparent",
            }}
          />
          <button type="submit" style={{
            padding: "14px 24px", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500,
            background: P.charcoal, color: P.cream,
            letterSpacing: "0.04em",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = P.charcoalLight)}
          onMouseLeave={e => (e.currentTarget.style.background = P.charcoal)}
          >
            Explore →
          </button>
        </motion.form>
      </motion.section>

      {/* ── Stats Strip ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        variants={stagger}
        style={{
          display: "flex", justifyContent: "center", gap: 16,
          padding: "0 24px 60px", flexWrap: "wrap",
        }}
      >
        {[
          { label: "S&P 500 Universe", value: "500+" },
          { label: "Options Scanned Daily", value: "50K+" },
          { label: "Quant Signals", value: "Real-time" },
          { label: "Win Rate Tracking", value: "Verified" },
        ].map(s => (
          <motion.div key={s.label} variants={fadeUp}>
            <StatPill {...s} />
          </motion.div>
        ))}
      </motion.section>

      {/* ── Divider ── */}
      <div style={{ maxWidth: 120, margin: "0 auto 60px", height: 1, background: P.warmGray }} />

      {/* ── Feature Cards ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        style={{
          maxWidth: 1000, margin: "0 auto", padding: "0 24px 80px",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <FeatureCard
          tag="Options Flow"
          title="Alpha-Flow Options"
          description="Scans S&P 500 call options for high-conviction swing trades using institutional filters, Black-Scholes delta, and a composite quant score."
          href="/dashboard?view=alpha-calls"
        />
        <FeatureCard
          tag="Momentum"
          title="Momentum Lifecycle"
          description="Track emerging, trending, and exhausting momentum phases across the entire market with multi-timeframe confirmation signals."
          href="/dashboard?view=momentum-lifecycle"
        />
        <FeatureCard
          tag="Portfolio"
          title="Portfolio X-Ray"
          description="Diagnose concentration risk, correlation clusters, and sector exposure across your holdings with institutional-grade analytics."
          href="/dashboard?view=portfolio-intel"
        />
      </motion.section>

      {/* ── Philosophy Section ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={stagger}
        style={{
          maxWidth: 640, margin: "0 auto", padding: "0 24px 100px",
          textAlign: "center",
        }}
      >
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 32, fontWeight: 400, color: P.charcoal,
          marginBottom: 20, lineHeight: 1.2,
        }}>
          Research-grade clarity.<br />
          <span style={{ fontStyle: "italic", color: P.textSecondary }}>Not another trading app.</span>
        </motion.h2>
        <motion.p variants={fadeUp} style={{
          fontSize: 15, lineHeight: 1.8, color: P.textSecondary,
          fontFamily: "var(--font-sans)",
        }}>
          Every signal comes with a reasoning trace — a transparent explanation of <em>why</em> the system flagged it. No black boxes. No hype. Just quantitative evidence presented with the precision of a research publication.
        </motion.p>
      </motion.section>

      {/* ── CTA Footer ── */}
      <section style={{
        padding: "60px 24px", textAlign: "center",
        borderTop: `1px solid ${P.warmGray}`,
        background: "white",
      }}>
        <p style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 24, fontWeight: 400, color: P.charcoal, marginBottom: 24,
        }}>
          Ready to think differently about markets?
        </p>
        <Link href="/dashboard" style={{
          display: "inline-block", padding: "12px 32px", borderRadius: 8,
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
          background: P.charcoal, color: P.cream,
          textDecoration: "none", letterSpacing: "0.04em",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
        >
          Launch Terminal →
        </Link>
        <p style={{ marginTop: 16, fontSize: 12, color: P.textMuted }}>
          No account required. Explore free.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding: "24px 40px",
        borderTop: `1px solid ${P.warmGray}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 11, color: P.textMuted,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>HEADSTART © 2026</span>
        <span>Built for quantitative minds.</span>
      </footer>
    </div>
  );
}