#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════╗
║  MOMENTUM — Autonomous Frontend Agent v3                       ║
║  Powered by Gemini 2.5 Flash · Fully Autonomous · Self-Learning║
║                                                                  ║
║  Just run it and walk away. It will:                            ║
║  • Analyze every file, prioritize by impact                     ║
║  • Auto-apply improvements (no approval needed)                 ║
║  • Learn from its own changes to get better each pass           ║
║  • Keep a changelog so you can review later                     ║
║  • Run continuously until you Ctrl+C                            ║
╚══════════════════════════════════════════════════════════════════╝

  export GEMINI_API_KEY="your-key"
  python3 fe_agent.py
"""

import os
import sys
import json
import signal
import difflib
import time
import subprocess
from pathlib import Path
from datetime import datetime

# ═══════════════════════════════════════════════════════════
# TERMINAL COLORS
# ═══════════════════════════════════════════════════════════
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    CYAN    = "\033[38;5;87m"
    GREEN   = "\033[38;5;114m"
    YELLOW  = "\033[38;5;221m"
    RED     = "\033[38;5;203m"
    VIOLET  = "\033[38;5;141m"
    BLUE    = "\033[38;5;75m"
    ORANGE  = "\033[38;5;215m"
    GRAY    = "\033[38;5;245m"
    WHITE   = "\033[38;5;255m"
    PINK    = "\033[38;5;218m"
    LIME    = "\033[38;5;156m"

def banner():
    print(f"""
{C.CYAN}{C.BOLD}
  ╔══════════════════════════════════════════════════════════╗
  ║  🚀 MOMENTUM — Autonomous Frontend Agent v3             ║
  ║  Model: Gemini 2.5 Flash                                ║
  ║  Mode: FULLY AUTONOMOUS — no approval needed            ║
  ║  Aesthetic: Apple · Wealthsimple · TradingView · Nike   ║
  ╚══════════════════════════════════════════════════════════╝
{C.RESET}""")

def log(icon, msg, color=C.CYAN):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"  {C.DIM}{ts}{C.RESET} {color}{icon}{C.RESET} {msg}")

def header(msg):
    print(f"\n  {C.VIOLET}{'━'*62}{C.RESET}")
    print(f"  {C.VIOLET}{C.BOLD}  {msg}{C.RESET}")
    print(f"  {C.VIOLET}{'━'*62}{C.RESET}\n")

def mini_diff_summary(original: str, improved: str) -> str:
    """One-line summary of changes."""
    orig = original.splitlines()
    impr = improved.splitlines()
    adds = 0
    dels = 0
    for line in difflib.unified_diff(orig, impr, lineterm=""):
        if line.startswith("+") and not line.startswith("+++"):
            adds += 1
        elif line.startswith("-") and not line.startswith("---"):
            dels += 1
    return f"{C.GREEN}+{adds}{C.RESET} {C.RED}-{dels}{C.RESET} lines"


# ═══════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════
ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend" / "src"
CHANGELOG_PATH = ROOT / "fe_agent_changelog.md"
MEMORY_PATH = ROOT / "fe_agent_memory.json"
FILE_EXTENSIONS = {".tsx", ".ts", ".css"}
SKIP_DIRS = {"node_modules", ".next", ".git", "__pycache__"}
MAX_FILE_SIZE = 120_000
MODEL = "gemini-2.5-flash"

# Rate: 1 request per 10 seconds = 6 RPM (under the 10 RPM limit)
REQUEST_INTERVAL = 10.0
last_request_time = 0.0
request_count = 0

# ═══════════════════════════════════════════════════════════
# DESIGN INSPIRATION — The agent's creative brain
# ═══════════════════════════════════════════════════════════
DESIGN_BIBLE = """
## Design Philosophy — The "IQ 300" Standard

You don't write code. You craft premium digital experiences.
Every pixel matters. Every interaction tells a story.

### INSPIRATION SOURCES (study these religiously):

**Apple (apple.com)**
- Vast whitespace (or dark-space in dark mode) — let elements breathe
- Typography is THE hero — SF Pro weights, tight tracking, massive hierarchy
- Minimal borders — use shadow depth and background tints instead
- Subtle parallax and scroll-triggered animations
- Glass/translucency with backdrop-blur (vibrancy)
- Rounded corners everywhere (border-radius: 1rem+)
- Monochrome with ONE accent color per section

**Wealthsimple (wealthsimple.com)**
- Numbers are art — large, bold, monospace, color-coded green/red
- Card-based layouts with generous padding
- Smooth page transitions (opacity + translateY)
- Dark mode done RIGHT — not just inverted, but deeply considered
- Data visualization: clean, minimal charts with no chartjunk
- Confidence in simplicity — fewer elements, each perfect
- Pull-to-refresh, skeleton loaders, optimistic UI

**TradingView (tradingview.com)**
- Information density WITHOUT clutter — master of data tables
- Sticky headers, frozen columns on scroll
- Real-time updates with subtle flash animations
- Keyboard shortcuts for power users
- Customizable layouts and watchlists
- Professional color coding: green=#26a69a, red=#ef5350
- Compact mode for data-heavy views

**Nike (nike.com)**
- Bold typography — massive headings, dramatic scale contrast  
- Full-bleed imagery and background gradients
- Scroll-triggered reveal animations (intersection observer)
- CTAs that POP — high contrast, rounded, with micro-animations
- Grid masonry layouts for product cards

**Google Material 3 (m3.material.io)**
- Dynamic color theming
- Responsive containers with consistent spacing
- State layers (hover, pressed, focused) on every interactive element
- Elevation system with tonal surfaces
- Motion: shared element transitions, container transforms

### TECHNICAL STANDARDS:

**Mobile-First (375px → 1440px)**
- Start with mobile layout, enhance for desktop
- Touch targets: minimum 44x44px
- Horizontal scroll for data tables on mobile
- Stack grids to single column under 640px
- Collapsible sections to save vertical space
- Bottom sheet modals on mobile (not centered dialogs)

**Animation & Motion**
- Framer Motion for layout animations
- Spring physics: stiffness=300, damping=30 for snappy
- Stagger children: 40-80ms delay between items
- Page transitions: opacity 0→1, y 20→0, 300ms
- Hover: translateY(-2px), elevated shadow, border glow
- Never animate layout properties (width, height) — use transform

**Performance**
- React.memo() on all pure display components
- useCallback for handlers passed as props
- useMemo for expensive computations
- No inline object/array literals in JSX props
- Lazy load charts and modals with dynamic import()
- CSS containment for complex components

**Typography (already set up)**
- Inter: UI text, labels, paragraphs
- JetBrains Mono: numbers, prices, data, code
- Scale: text-xs(mobile) → text-sm → text-base → text-lg → text-xl → text-2xl → text-4xl(hero)
- Letter-spacing: -0.03em for headings, 0.1em for uppercase labels

**Color Palette (from globals.css)**
- Background: #050a12 (near-black with blue tint)
- Card: rgba(15,23,42,0.45) with backdrop-blur
- Cyan: #06b6d4 (primary accent)
- Emerald: #10b981 (bullish/positive)
- Rose: #f43f5e (bearish/negative)
- Amber: #f59e0b (warnings/neutral)
- Violet: #8b5cf6 (secondary accent)
"""

# ═══════════════════════════════════════════════════════════
# SYSTEM PROMPTS
# ═══════════════════════════════════════════════════════════
ANALYZE_PROMPT = """\
You are a design critic with the combined taste of Jony Ive, the Wealthsimple design team, and TradingView's UX engineers.

Rate this file 1-10 against these standards:
{design_bible}

## CODEBASE PATTERNS:
{codebase_context}

## PREVIOUS IMPROVEMENTS YOU MADE (learn from these):
{memory}

Respond in EXACTLY this JSON format (no markdown, no fences):
{{"score": <1-10>, "priority": "<critical|high|medium|low>", "issues": ["issue 1", "issue 2", "issue 3"], "plan": "Brief plan of what to improve"}}

Rules:
- Score 9-10 = skip (already excellent)
- Score 1-5 = critical priority
- Score 6-7 = high priority
- Score 8 = medium priority
- Be BRUTAL in scoring. Apple-quality is a 10. Most code is 4-6.
- Focus on what would make the BIGGEST visual/UX impact
"""

IMPROVE_PROMPT = """\
You are the lead frontend engineer at Apple's Special Projects group, writing code for a premium trading platform.

{design_bible}

## CODEBASE PATTERNS (match these):
{codebase_context}

## WHAT YOU LEARNED FROM PREVIOUS IMPROVEMENTS:
{memory}

## YOUR TASK:
Take this file and produce a DRAMATICALLY BETTER version. Think:
- "How would Apple's design team build this component?"
- "How would Wealthsimple make this data beautiful?"
- "How would TradingView make this information-dense but clean?"

OUTPUT RULES (STRICT):
- Output ONLY the complete improved file. No explanations. No markdown fences. No comments about changes.
- The file must compile with `npx next build` — no TypeScript errors.
- Do NOT change component names, export names, or import paths.
- Do NOT add new npm dependencies that aren't in package.json.
- Do NOT remove existing functionality or props.
- You MAY add new sub-components within the same file.
- You MAY restructure JSX for better mobile responsiveness.
- You MAY add Framer Motion animations (already installed).
- You MAY add new CSS classes using the existing Tailwind design tokens.
- You MAY add React.memo, useCallback, useMemo for performance.
- PRESERVE all TypeScript types and interfaces.

Make it BEAUTIFUL. Make it FAST. Make it PERFECT.
"""


# ═══════════════════════════════════════════════════════════
# FILE DISCOVERY & PRIORITY
# ═══════════════════════════════════════════════════════════
def discover_files() -> list[Path]:
    files = []
    for ext in FILE_EXTENSIONS:
        for path in FRONTEND_DIR.rglob(f"*{ext}"):
            if any(skip in path.parts for skip in SKIP_DIRS):
                continue
            if path.stat().st_size <= MAX_FILE_SIZE:
                files.append(path)
    return files


def build_codebase_context(files: list[Path]) -> str:
    parts = ["### Architecture:"]
    for f in files:
        rel = f.relative_to(FRONTEND_DIR)
        parts.append(f"  {rel} ({f.stat().st_size:,}b)")

    # Read key design files
    for name, path in [
        ("globals.css", FRONTEND_DIR / "app" / "globals.css"),
        ("constants.ts", FRONTEND_DIR / "lib" / "constants.ts"),
        ("utils.ts", FRONTEND_DIR / "lib" / "utils.ts"),
    ]:
        if path.exists():
            content = path.read_text(encoding="utf-8")
            if len(content) < 8000:
                parts.append(f"\n### {name}:\n{content}")

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════
# MEMORY / LEARNING SYSTEM
# ═══════════════════════════════════════════════════════════
def load_memory() -> dict:
    """Load the agent's persistent memory."""
    if MEMORY_PATH.exists():
        try:
            return json.loads(MEMORY_PATH.read_text())
        except Exception:
            pass
    return {
        "improvements_made": [],
        "patterns_learned": [],
        "files_scores": {},
        "total_improvements": 0,
        "sessions": 0,
    }

def save_memory(memory: dict):
    MEMORY_PATH.write_text(json.dumps(memory, indent=2, default=str))

def memory_summary(memory: dict) -> str:
    """Summarize what the agent has learned for context."""
    if not memory["improvements_made"]:
        return "No previous improvements. This is the first pass."
    
    recent = memory["improvements_made"][-10:]  # last 10
    lines = ["Recent improvements made:"]
    for imp in recent:
        lines.append(f"  • {imp.get('file', '?')}: {imp.get('summary', '?')}")
    
    if memory["patterns_learned"]:
        lines.append("\nPatterns discovered:")
        for p in memory["patterns_learned"][-5:]:
            lines.append(f"  • {p}")
    
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════
# CHANGELOG
# ═══════════════════════════════════════════════════════════
def append_changelog(file_path: Path, score: int, summary: str, diff_stats: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rel = file_path.relative_to(ROOT)
    entry = f"\n### [{ts}] `{rel}` (was {score}/10)\n{summary}\n{diff_stats}\n"
    
    if not CHANGELOG_PATH.exists():
        CHANGELOG_PATH.write_text(f"# Frontend Agent Changelog\n\nAutonomous improvements by Gemini 2.5 Flash\n{entry}")
    else:
        with open(CHANGELOG_PATH, "a") as f:
            f.write(entry)


# ═══════════════════════════════════════════════════════════
# GEMINI API
# ═══════════════════════════════════════════════════════════
def init_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(f"""
  {C.RED}{C.BOLD}✗ GEMINI_API_KEY not set!{C.RESET}

  {C.WHITE}Get your free key:{C.RESET}
  {C.CYAN}→ https://aistudio.google.com/apikey{C.RESET}
  
  {C.WHITE}Then:{C.RESET}
  {C.GREEN}export GEMINI_API_KEY="your-key"
  python3 fe_agent.py{C.RESET}
""")
        sys.exit(1)

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        log("✓", f"Connected to {C.BOLD}Gemini 2.5 Flash{C.RESET}", C.GREEN)
        return client
    except ImportError:
        print(f"\n  {C.RED}✗ Run: pip3 install google-genai{C.RESET}\n")
        sys.exit(1)


def rate_limit():
    global last_request_time, request_count
    elapsed = time.time() - last_request_time
    if elapsed < REQUEST_INTERVAL:
        wait = REQUEST_INTERVAL - elapsed
        # Show a nice countdown
        while wait > 0:
            print(f"\r  {C.GRAY}⏱ Rate limit: {wait:.0f}s{C.RESET}  ", end="", flush=True)
            time.sleep(min(1, wait))
            wait -= 1
        print("\r" + " " * 40 + "\r", end="", flush=True)
    last_request_time = time.time()
    request_count += 1


def call_gemini(client, prompt: str) -> str | None:
    rate_limit()
    try:
        response = client.models.generate_content_stream(
            model=MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        full = ""
        chars = 0
        for chunk in response:
            if chunk.text:
                full += chunk.text
                chars += len(chunk.text)
                # Minimal progress indicator
                dots = "·" * min(chars // 500, 20)
                print(f"\r  {C.GRAY}  streaming {dots} {chars:,}c{C.RESET}", end="", flush=True)
        print("\r" + " " * 60 + "\r", end="", flush=True)
        return full.strip() if full.strip() else None
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower() or "resource" in err.lower():
            log("⏱", f"Rate limited. Cooling down 65s...", C.YELLOW)
            time.sleep(65)
            return None
        log("✗", f"API error: {e}", C.RED)
        return None


# ═══════════════════════════════════════════════════════════
# CORE AGENT LOGIC
# ═══════════════════════════════════════════════════════════
def analyze_file(client, path: Path, content: str, context: str, memory: dict) -> dict | None:
    """Analyze a file and return structured assessment."""
    rel = path.relative_to(ROOT)
    prompt = ANALYZE_PROMPT.format(
        design_bible=DESIGN_BIBLE,
        codebase_context=context,
        memory=memory_summary(memory),
    )
    prompt += f"\n\nFile: {rel}\n\n```\n{content}\n```"

    log("🔍", f"Analyzing {C.CYAN}{rel}{C.RESET}", C.BLUE)
    result = call_gemini(client, prompt)
    if not result:
        return None

    # Parse JSON from response (handle model adding markdown fences)
    text = result.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    
    try:
        data = json.loads(text)
        return data
    except json.JSONDecodeError:
        # Try to find JSON in the response
        import re
        match = re.search(r'\{[^{}]*"score"[^{}]*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
        log("⚠", f"Couldn't parse analysis, treating as score 5", C.YELLOW)
        return {"score": 5, "priority": "high", "issues": ["Unparseable analysis"], "plan": "General improvement"}


def improve_file(client, path: Path, content: str, context: str, memory: dict, analysis: dict) -> str | None:
    """Generate improved version of the file."""
    rel = path.relative_to(ROOT)
    prompt = IMPROVE_PROMPT.format(
        design_bible=DESIGN_BIBLE,
        codebase_context=context,
        memory=memory_summary(memory),
    )
    prompt += f"\n\nFile: {rel}\n\nAnalysis: {json.dumps(analysis)}\n\nCurrent code:\n{content}"

    log("⚡", f"Improving {C.ORANGE}{C.BOLD}{rel}{C.RESET}", C.ORANGE)
    result = call_gemini(client, prompt)
    if not result:
        return None

    # Strip markdown fences
    cleaned = result
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    # Basic sanity: must have content and not be drastically shorter
    if len(cleaned) < len(content) * 0.3:
        log("⚠", "Output too short — model may have truncated. Skipping.", C.YELLOW)
        return None
    
    return cleaned


def verify_build() -> bool:
    """Quick build check to ensure no TypeScript errors."""
    log("🔨", "Verifying build...", C.GRAY)
    try:
        result = subprocess.run(
            ["npx", "next", "build"],
            cwd=str(ROOT / "frontend"),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            log("✓", f"Build passed {C.GREEN}✓{C.RESET}", C.GREEN)
            return True
        else:
            # Extract error
            error_lines = [l for l in result.stdout.split("\n") if "Error" in l or "error" in l.lower()]
            for line in error_lines[:3]:
                log("✗", f"{C.RED}{line.strip()}{C.RESET}", C.RED)
            return False
    except subprocess.TimeoutExpired:
        log("⚠", "Build timed out", C.YELLOW)
        return False
    except Exception as e:
        log("⚠", f"Build check failed: {e}", C.YELLOW)
        return False


# ═══════════════════════════════════════════════════════════
# MAIN AUTONOMOUS LOOP
# ═══════════════════════════════════════════════════════════
class GracefulExit(Exception):
    pass

def signal_handler(signum, frame):
    raise GracefulExit()


def run_autonomous():
    banner()
    signal.signal(signal.SIGINT, signal_handler)

    # Init
    client = init_gemini()
    memory = load_memory()
    memory["sessions"] += 1
    save_memory(memory)

    log("📊", f"Session #{memory['sessions']} · {memory['total_improvements']} total improvements so far", C.VIOLET)

    # Discover files
    files = discover_files()
    if not files:
        log("✗", f"No files in {FRONTEND_DIR}", C.RED)
        sys.exit(1)

    log("📁", f"Found {C.BOLD}{len(files)}{C.RESET} files")

    # Learn codebase
    log("🧠", "Learning codebase...", C.VIOLET)
    context = build_codebase_context(files)
    log("✓", f"Learned {len(context):,} chars of patterns", C.GREEN)

    print(f"""
  {C.WHITE}{C.BOLD}Mode:{C.RESET} {C.GREEN}FULLY AUTONOMOUS{C.RESET} — no approval needed
  {C.WHITE}{C.BOLD}Rate:{C.RESET} 1 req / 10s (2 reqs per file: analyze + improve)
  {C.WHITE}{C.BOLD}Style:{C.RESET} Apple · Wealthsimple · TradingView · Nike
  {C.WHITE}{C.BOLD}Ctrl+C:{C.RESET} Stop anytime (changes are saved instantly)
  {C.DIM}  Changelog: {CHANGELOG_PATH.name}{C.RESET}
""")

    stats = {"improved": 0, "excellent": 0, "failed": 0, "reverted": 0}
    pass_num = 0

    try:
        while True:
            pass_num += 1
            header(f"🔄 PASS #{pass_num}")

            # Re-discover and re-learn each pass (picks up changes)
            if pass_num > 1:
                files = discover_files()
                context = build_codebase_context(files)
                log("🧠", "Re-learned codebase", C.VIOLET)

            # Phase 1: Analyze ALL files and rank by priority
            log("📋", f"Phase 1: Analyzing all {len(files)} files...", C.BLUE)
            file_analyses: list[tuple[Path, dict, str]] = []

            for i, path in enumerate(files, 1):
                rel = path.relative_to(ROOT)
                try:
                    content = path.read_text(encoding="utf-8")
                except Exception:
                    continue

                analysis = analyze_file(client, path, content, context, memory)
                if not analysis:
                    continue

                score = analysis.get("score", 5)
                priority = analysis.get("priority", "medium")

                # Color-code the score
                if score >= 9:
                    sc = f"{C.GREEN}{C.BOLD}{score}/10 ★{C.RESET}"
                    log("★", f"{rel} → {sc} (excellent, skipping)", C.GREEN)
                    stats["excellent"] += 1
                    memory["files_scores"][str(rel)] = score
                    continue
                elif score >= 7:
                    sc = f"{C.YELLOW}{score}/10{C.RESET}"
                elif score >= 5:
                    sc = f"{C.ORANGE}{score}/10{C.RESET}"
                else:
                    sc = f"{C.RED}{C.BOLD}{score}/10{C.RESET}"

                log("📊", f"{rel} → {sc} [{priority}]", C.WHITE)
                issues = analysis.get("issues", [])
                for issue in issues[:2]:
                    print(f"        {C.DIM}• {issue}{C.RESET}")

                file_analyses.append((path, analysis, content))
                memory["files_scores"][str(rel)] = score

            # Sort by priority (lowest score first = most impactful)
            priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            file_analyses.sort(key=lambda x: (
                priority_order.get(x[1].get("priority", "medium"), 2),
                x[1].get("score", 5)
            ))

            if not file_analyses:
                log("🎉", f"All files are excellent! Pass complete.", C.GREEN)
                log("⏱", "Waiting 5 minutes before next pass...", C.GRAY)
                time.sleep(300)
                continue

            # Phase 2: Improve files in priority order
            header(f"⚡ Phase 2: Improving {len(file_analyses)} files (by priority)")

            for idx, (path, analysis, original_content) in enumerate(file_analyses, 1):
                rel = path.relative_to(ROOT)
                score = analysis.get("score", 5)
                plan = analysis.get("plan", "General improvement")

                print(f"\n  {C.BOLD}[{idx}/{len(file_analyses)}]{C.RESET} {C.CYAN}{C.BOLD}{rel}{C.RESET}")
                print(f"  {C.DIM}  Plan: {plan}{C.RESET}")

                # Generate improvement
                improved = improve_file(client, path, original_content, context, memory, analysis)
                if not improved:
                    stats["failed"] += 1
                    continue

                # Check if actually different
                if improved.strip() == original_content.strip():
                    log("→", "No changes generated", C.GRAY)
                    continue

                # Show compact diff summary
                diff_summary = mini_diff_summary(original_content, improved)
                log("📝", f"Changes: {diff_summary}", C.WHITE)

                # AUTO-APPLY
                path.write_text(improved, encoding="utf-8")
                log("✓", f"{C.GREEN}{C.BOLD}Applied!{C.RESET} {rel}", C.GREEN)

                # Quick build verify (every 3 files to save API budget)
                if idx % 3 == 0 or idx == len(file_analyses):
                    if not verify_build():
                        # REVERT the last change
                        log("↩", f"Build failed — reverting {rel}", C.RED)
                        path.write_text(original_content, encoding="utf-8")
                        stats["reverted"] += 1
                        # Record the failure so we learn
                        memory["patterns_learned"].append(
                            f"REVERT {rel}: Build failed after improvement. Be more careful with types."
                        )
                        continue

                # Success! Record in memory and changelog
                stats["improved"] += 1
                memory["total_improvements"] += 1
                
                improvement_record = {
                    "file": str(rel),
                    "score_before": score,
                    "summary": plan,
                    "timestamp": datetime.now().isoformat(),
                    "diff_stats": diff_summary.replace(C.GREEN, "").replace(C.RED, "").replace(C.RESET, ""),
                }
                memory["improvements_made"].append(improvement_record)
                
                # Keep memory manageable (last 50 improvements)
                if len(memory["improvements_made"]) > 50:
                    memory["improvements_made"] = memory["improvements_made"][-50:]
                
                save_memory(memory)
                append_changelog(path, score, plan, diff_summary)

            # Pass summary
            header(f"📊 Pass #{pass_num} Complete")
            print(f"  {C.GREEN}  ✓ Improved:   {stats['improved']}{C.RESET}")
            print(f"  {C.CYAN}  ★ Excellent:   {stats['excellent']}{C.RESET}")
            print(f"  {C.RED}  ↩ Reverted:    {stats['reverted']}{C.RESET}")
            print(f"  {C.GRAY}  ✗ Failed:      {stats['failed']}{C.RESET}")
            print(f"  {C.GRAY}  API calls:     {request_count} (session){C.RESET}")
            print(f"  {C.VIOLET}  Total all-time: {memory['total_improvements']} improvements{C.RESET}")

            # Pause between passes (2 min cooldown)
            log("⏱", f"Next pass in 2 minutes... (Ctrl+C to stop)", C.GRAY)
            time.sleep(120)

    except GracefulExit:
        save_memory(memory)
        print(f"""
{C.CYAN}
  👋 Agent stopped gracefully.
  
  {C.BOLD}Session #{memory['sessions']} Summary:{C.RESET}
  {C.GREEN}  ✓ {stats['improved']} files improved this session{C.RESET}
  {C.VIOLET}  ★ {memory['total_improvements']} total improvements all-time{C.RESET}
  {C.GRAY}  📋 Changelog: {CHANGELOG_PATH}{C.RESET}
  {C.GRAY}  🧠 Memory: {MEMORY_PATH}{C.RESET}
{C.RESET}""")


if __name__ == "__main__":
    run_autonomous()
