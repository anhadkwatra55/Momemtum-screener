"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import React, { useState, useCallback } from "react";

/* ── Dark Premium Palette ── */
const P = {
  bg: "#0a0a0a",
  surface: "#111111",
  card: "#161616",
  cardHover: "#1c1c1c",
  border: "#1e1e1e",
  borderHover: "#2a2a2a",
  textPrimary: "#e8e8e8",
  textSecondary: "#888888",
  textMuted: "#555555",
  gold: "#e2b857",
  goldSoft: "rgba(226,184,87,0.10)",
  goldGlow: "rgba(226,184,87,0.04)",
  green: "#4ade80",
  greenSoft: "rgba(74,222,128,0.08)",
  purple: "#9f7aea",
  purpleSoft: "rgba(159,122,234,0.08)",
  red: "#e05252",
  redSoft: "rgba(224,82,82,0.08)",
  cream: "#f5f2ed",
};

const ease = [0.33, 1, 0.68, 1] as const;

/* ── Animations ── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease } },
};
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};
const staggerSlow = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.18, delayChildren: 0.3 } },
};

/* ── Bento Card Component ── */
function BentoCard({
  title, subtitle, description, icon, accentColor, accentBg, href, span,
}: {
  title: string; subtitle: string; description: string;
  icon: string; accentColor: string; accentBg: string;
  href: string; span?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none", gridColumn: span ? "span 2" : undefined }}>
      <motion.div
        variants={fadeUp}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        style={{
          background: P.card,
          border: `1px solid ${P.border}`,
          borderRadius: 16,
          padding: "36px 32px",
          cursor: "pointer",
          transition: "border-color 0.3s ease, background 0.3s ease",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = P.borderHover;
          (e.currentTarget as HTMLElement).style.background = P.cardHover;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = P.border;
          (e.currentTarget as HTMLElement).style.background = P.card;
        }}
      >
        {/* Corner glow */}
        <div style={{
          position: "absolute", top: -40, right: -40, width: 120, height: 120,
          borderRadius: "50%", background: accentBg, filter: "blur(40px)",
          pointerEvents: "none", opacity: 0.5,
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 40, height: 40, borderRadius: 10,
          background: accentBg, marginBottom: 20, fontSize: 18,
        }}>
          {icon}
        </div>
        <span style={{
          display: "block", fontSize: 10, fontFamily: "var(--font-mono)",
          fontWeight: 600, color: accentColor, letterSpacing: "0.12em",
          textTransform: "uppercase", marginBottom: 10,
        }}>{subtitle}</span>
        <h3 style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 22, fontWeight: 500, color: P.textPrimary,
          marginBottom: 10, lineHeight: 1.3,
        }}>{title}</h3>
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: P.textSecondary,
          fontFamily: "var(--font-sans)",
        }}>{description}</p>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginTop: 20, fontSize: 12, fontFamily: "var(--font-mono)",
          color: accentColor, letterSpacing: "0.04em",
          transition: "gap 0.2s ease",
        }}>
          Explore <span style={{ fontSize: 14 }}>→</span>
        </span>
      </motion.div>
    </Link>
  );
}

/* ── Pillar Item ── */
function PillarItem({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <motion.div variants={fadeUp} style={{
      display: "flex", gap: 20, alignItems: "flex-start",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
        color: P.gold, minWidth: 28, lineHeight: "24px", letterSpacing: "0.06em",
      }}>{num}</span>
      <div>
        <h4 style={{
          fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600,
          color: P.textPrimary, marginBottom: 6,
        }}>{title}</h4>
        <p style={{
          fontSize: 13, lineHeight: 1.7, color: P.textSecondary,
          fontFamily: "var(--font-sans)",
        }}>{desc}</p>
      </div>
    </motion.div>
  );
}

/* ── Stat Pill ── */
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "14px 28px", background: P.card, borderRadius: 10,
      border: `1px solid ${P.border}`,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: P.textPrimary }}>{value}</span>
      <span style={{ fontSize: 10, color: P.textMuted, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</span>
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
      router.push("/dashboard?view=today");
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
    <div style={{ background: P.bg, minHeight: "100vh", color: P.textPrimary }}>

      {/* ── Top Nav ── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 40px", borderBottom: `1px solid ${P.border}`,
        position: "sticky", top: 0, zIndex: 50,
        background: `${P.bg}e6`, backdropFilter: "blur(16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
            color: P.textPrimary, letterSpacing: "0.08em",
          }}>HEADSTART</span>
          <span style={{
            fontSize: 9, fontFamily: "var(--font-mono)", color: P.textMuted,
            padding: "2px 6px", borderRadius: 4, border: `1px solid ${P.border}`,
          }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/dashboard?view=today" style={{ fontSize: 13, color: P.textSecondary, textDecoration: "none", fontWeight: 400 }}>
            Dashboard
          </Link>
          <Link href="/dashboard?view=today" style={{
            fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500,
            padding: "8px 20px", borderRadius: 8,
            background: P.gold, color: P.bg,
            textDecoration: "none", letterSpacing: "0.02em",
            transition: "opacity 0.2s ease",
          }}>
            Launch Terminal →
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={stagger}
        style={{
          textAlign: "center",
          padding: "100px 24px 60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glows */}
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(226,184,87,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "60%", left: "30%", transform: "translateX(-50%)",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(74,222,128,0.02) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <motion.p variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
          color: P.gold, letterSpacing: "0.16em", textTransform: "uppercase",
          marginBottom: 28, position: "relative", zIndex: 1,
        }}>
          Institutional-Grade Intelligence
        </motion.p>

        <motion.h1 variants={fadeUp} style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "clamp(40px, 5.5vw, 64px)", fontWeight: 400,
          lineHeight: 1.1, letterSpacing: "-0.025em",
          color: P.textPrimary, marginBottom: 24,
          position: "relative", zIndex: 1,
        }}>
          The edge you didn&apos;t know<br />
          <span style={{ color: P.gold }}>you were missing.</span>
        </motion.h1>

        <motion.p variants={fadeUp} style={{
          fontSize: 17, lineHeight: 1.8, color: P.textSecondary,
          maxWidth: 540, margin: "0 auto",
          fontFamily: "var(--font-sans)",
          position: "relative", zIndex: 1,
        }}>
          We track market sentiment, options flow, and momentum shifts across the entire S&P universe — so you don&apos;t have to. Institutional tools, simplified.
        </motion.p>
      </motion.section>

      {/* ── Search Bar Section ── */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={stagger}
        style={{ maxWidth: 600, margin: "0 auto", padding: "0 24px 60px", position: "relative", zIndex: 2 }}
      >
        <motion.form variants={fadeUp} onSubmit={handleSearch} style={{
          display: "flex", maxWidth: 540, margin: "0 auto",
          background: P.card, borderRadius: 12,
          border: `1px solid ${P.border}`,
          overflow: "hidden",
          transition: "border-color 0.3s ease",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = P.gold;
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = P.border;
        }}
        >
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search a ticker or ask anything..."
            style={{
              flex: 1, padding: "15px 20px", border: "none", outline: "none",
              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 400,
              color: P.textPrimary, background: "transparent",
            }}
          />
          <button type="submit" style={{
            padding: "15px 28px", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
            background: P.gold, color: P.bg,
            letterSpacing: "0.04em",
            transition: "opacity 0.2s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
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
          display: "flex", justifyContent: "center", gap: 12,
          padding: "0 24px 80px", flexWrap: "wrap",
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
      <div style={{ maxWidth: 80, margin: "0 auto 80px", height: 1, background: P.border }} />

      {/* ── "The Why" Section ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        style={{
          maxWidth: 800, margin: "0 auto", padding: "0 24px 100px",
          textAlign: "center",
        }}
      >
        <motion.p variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          color: P.gold, letterSpacing: "0.16em", textTransform: "uppercase",
          marginBottom: 20,
        }}>
          Why Headstart
        </motion.p>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 400, color: P.textPrimary,
          marginBottom: 20, lineHeight: 1.15, letterSpacing: "-0.02em",
        }}>
          Institutional-Grade Momentum,{" "}
          <span style={{ fontStyle: "italic", color: P.textSecondary }}>Simplified.</span>
        </motion.h2>
        <motion.p variants={fadeUp} style={{
          fontSize: 16, lineHeight: 1.8, color: P.textSecondary,
          maxWidth: 580, margin: "0 auto 48px",
          fontFamily: "var(--font-sans)",
        }}>
          Hedge funds spend millions on quant infrastructure. We distill the same edge — momentum signals, options flow, sector rotation — into a single research terminal anyone can use.
        </motion.p>

        {/* Three pillars */}
        <motion.div variants={staggerSlow} style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32,
          textAlign: "left", maxWidth: 700, margin: "0 auto",
        }}>
          <PillarItem num="01" title="Quantitative Signals" desc="Multi-system composite scores across momentum, mean-reversion, and volatility regimes — updated in real-time." />
          <PillarItem num="02" title="Options Intelligence" desc="Unusual activity detection powered by GEX analysis, volatility risk premium, and skew-adjusted Greeks." />
          <PillarItem num="03" title="Verified Track Record" desc="Every signal is logged and tracked. No cherry-picking. Full transparency into historical hit rates." />
        </motion.div>
      </motion.section>

      {/* ── Divider ── */}
      <div style={{ maxWidth: 80, margin: "0 auto 80px", height: 1, background: P.border }} />

      {/* ── Bento Grid: "The What" ── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        style={{
          maxWidth: 1060, margin: "0 auto", padding: "0 24px 100px",
        }}
      >
        <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            color: P.gold, letterSpacing: "0.16em", textTransform: "uppercase",
            marginBottom: 16,
          }}>
            Your Research Terminal
          </p>
          <h2 style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 400, color: P.textPrimary,
            lineHeight: 1.2, letterSpacing: "-0.02em",
          }}>
            Four views. Zero noise.
          </h2>
        </motion.div>

        <motion.div variants={stagger} style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
        }}>
          <BentoCard
            icon="◉"
            subtitle="Executive Summary"
            title="Today View"
            description="Your daily briefing. Market regime, top momentum shifts, and high-conviction signals — all in one glance. Start every session here."
            accentColor={P.green}
            accentBg={P.greenSoft}
            href="/dashboard?view=today"
            span
          />
          <BentoCard
            icon="◈"
            subtitle="Deep Dive"
            title="Market Pulse"
            description="Sector rotation heatmaps, hidden gems, daily movers, and the signals that institutional desks actually track."
            accentColor={P.purple}
            accentBg={P.purpleSoft}
            href="/dashboard?view=market-pulse"
          />
          <BentoCard
            icon="◇"
            subtitle="Options Intelligence"
            title="Alpha Calls"
            description="Unusual institutional options flow. GEX-powered strike analysis. Conviction trades with quantified edge."
            accentColor={P.gold}
            accentBg={P.goldSoft}
            href="/dashboard?view=alpha-calls"
          />
          <BentoCard
            icon="▣"
            subtitle="Backtesting"
            title="Strategy Lab"
            description="Prove it works. Backtest any momentum strategy against historical data with institutional-grade metrics and performance attribution."
            accentColor={P.green}
            accentBg={P.greenSoft}
            href="/dashboard?view=strategy"
            span
          />
        </motion.div>
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
        <motion.p variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          color: P.textMuted, letterSpacing: "0.16em", textTransform: "uppercase",
          marginBottom: 20,
        }}>
          Our Philosophy
        </motion.p>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 32, fontWeight: 400, color: P.textPrimary,
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
        padding: "80px 24px", textAlign: "center",
        borderTop: `1px solid ${P.border}`,
        background: P.surface,
      }}>
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          color: P.textMuted, letterSpacing: "0.14em", textTransform: "uppercase",
          marginBottom: 20,
        }}>
          Get Started
        </p>
        <p style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 28, fontWeight: 400, color: P.textPrimary, marginBottom: 32,
          lineHeight: 1.2,
        }}>
          Ready to think differently<br />about markets?
        </p>
        <Link href="/dashboard?view=today" style={{
          display: "inline-block", padding: "14px 40px", borderRadius: 10,
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
          background: P.gold, color: P.bg,
          textDecoration: "none", letterSpacing: "0.04em",
          transition: "transform 0.2s ease, opacity 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLElement).style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.opacity = "1";
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
        borderTop: `1px solid ${P.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 11, color: P.textMuted, background: P.bg,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>HEADSTART © 2026</span>
        <span>Built for quantitative minds.</span>
      </footer>
    </div>
  );
}