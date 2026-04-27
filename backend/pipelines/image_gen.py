import os
import json
import logging
import asyncio
import httpx
import base64
import random
from typing import Optional, List, Dict, Tuple
from datetime import datetime
from pathlib import Path

# Try to import db from the current directory or parent
try:
    import db
except ImportError:
    from . import db

logger = logging.getLogger(__name__)

# ── Config ──
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")

MAX_DAILY_IMAGES = 5
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "intel"
USE_SYNTHETIC_FALLBACK = True

MOBY_AESTHETIC_GUIDE = (
    "Ultra-premium editorial illustration in the exact style of Moby.co and The Economist cover art. "
    "Flat vector construction with heavy hand-drawn texture: risograph grain, silkscreen dot patterns, "
    "and subtle paper-fiber texture visible in flat color fields. "
    "Art style reference: Malika Favre meets editorial screen-printing. "
    "\n"
    "COMPOSITION RULES: "
    "- Asymmetric framing with dramatic negative space on one side. "
    "- Central focal point must occupy 60-70% of the frame and be captured mid-action (exploding, shattering, levitating, unraveling). "
    "- SATIRICAL CARICATURES: If a recognizable real-world figure (CEO, politician, founder) is central to the news, depict them as a highly stylized, expressive caricature. Focus on their signature physical traits (hair, glasses, iconic outfits) drawn in a 'sophisticated adult comic book' style. If no specific person is relevant, use a stylized archetype (e.g., a stressed executive). "
    "- Use forced perspective with converging diagonal lines to create depth. "
    "- Layer at least 3 distinct planes: foreground silhouette, midground action, background gradient/texture. "
    "- Dutch angle or dynamic tilt on the entire scene for tension and energy. "
    "\n"
    "COLOR PALETTE (strictly limited, used in large bold blocks): "
    "- Deep Teal (#0A4F4F) and Rich Navy (#0F1B3A) for shadows and background masses. "
    "- Mustard Yellow (#E5A823) and Burnt Orange (#D4652A) for highlights, sparks, energy bursts, and warm focal points. "
    "- Soft Cream (#F5F1E8) and Pale Sage (#C4D7C4) for mid-tones and contrast relief. "
    "- NO pastel gradients. NO sky-blue. NO generic corporate blues. NO muddy browns. "
    "- Colors must be applied as bold, unblended flat shapes with razor-sharp edges (not airbrushed). "
    "\n"
    "TEXTURE & LINE WORK: "
    "- Thick, confident black outlines (2-4px weight) around every major shape. "
    "- Halftone dot shading in the shadows (classic comic-book Ben-Day dots, 15-30% coverage). "
    "- Occasional risograph misregistration offset (cyan/magenta edge ghosting) for a hand-printed feel. "
    "- Grain texture overlay on solid color fields, NOT on gradients. "
    "\n"
    "ABSOLUTE NEGATIVES (must be repeated in final prompt): "
    "NO text. NO letters. NO numbers. NO words. NO logos. NO typography. NO watermarks. NO signatures. "
    "NO generic stock photography. NO photorealistic shading on faces (strictly use flat vector caricature). NO 3D renders. "
    "NO candlestick charts. NO upward arrows. NO dollar signs. NO generic bull or bear animals. "
    "NO clean corporate vector look. NO isometric flat illustration. No boring literal symbols."
)

_SECTOR_CONCEPTS = {
    "tech": [
        "a crystalline server cathedral dissolving into fiber-optic mist",
        "mechanical pollinators harvesting glowing data-fruit from circuit-board trees",
        "a satellite dish made of molten glass refracting mustard-yellow light beams"
    ],
    "health": [
        "a glass anatomical heart pumping rivers of bioluminescent data",
        "giant pills shattering into clouds of healing pollen",
        "surgical lasers weaving a golden bridge between two floating organs"
    ],
    "energy": [
        "lightning bolts frozen inside obsidian monoliths that are beginning to crack",
        "solar panels blooming like sunflowers and releasing clouds of golden spores",
        "an oil derrick vomiting liquid copper that hardens into abstract sculptures mid-air"
    ],
    "finance": [
        "a vault door growing organic teeth and consuming stacks of gold bars",
        "scales made of liquid mercury tipping and cascading into geometric waterfalls",
        "a hand crushing a diamond that fractures into a swarm of tiny abacus beads"
    ],
    "consumer": [
        "shopping bags inflating into hot-air balloons and lifting a factory into the sky",
        "a conveyor belt melting and re-solidifying as a rollercoaster track made of obsidian",
        "giant hands weaving luxury goods from threads of light and smoke"
    ],
    "industrial": [
        "cranes building themselves from their own debris, recursive and infinite",
        "steel beams growing like bamboo through a floor of cracked concrete",
        "assembly-line robots performing an elegant ballet while sparks freeze in mid-air"
    ]
}

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class NewsFetcher:
    """Fetch real-time news headlines for a ticker from Google News RSS. No API key needed."""

    GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search?q={ticker}+stock+news&hl=en-US&gl=US&ceid=US:en"

    @staticmethod
    async def fetch_news(ticker: str) -> str:
        """Fetch top 3 headlines + snippets for a ticker. Returns a text block or empty string on failure."""
        url = NewsFetcher.GOOGLE_NEWS_RSS_URL.format(ticker=ticker)
        try:
            import xml.etree.ElementTree as ET
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10.0, follow_redirects=True)
                if response.status_code != 200:
                    logger.warning(f"NewsFetcher: Yahoo RSS returned {response.status_code} for {ticker}")
                    return ""

                root = ET.fromstring(response.text)
                items = root.findall(".//item")[:3]  # Top 3 headlines only
                if not items:
                    return ""

                news_blocks = []
                for item in items:
                    title = item.findtext("title", "").strip()
                    description = item.findtext("description", "").strip()
                    if title:
                        block = f"- {title}"
                        if description and len(description) > 20:
                            block += f": {description[:300]}"
                        news_blocks.append(block)

                result = "\n".join(news_blocks)
                logger.info(f"📰 NewsFetcher: Got {len(news_blocks)} headlines for {ticker}")
                return result

        except Exception as e:
            logger.warning(f"NewsFetcher failed for {ticker}: {type(e).__name__}: {e}")
            return ""

class SmartFilter:
    """Phase 1: Pure Data Curator — Pick the top 5 most relevant stories."""
    
    @staticmethod
    def _build_fallback_story(signal: dict) -> dict:
        """Helper to construct a basic curated story object from a signal."""
        ticker = signal.get("ticker", "UNKNOWN")
        sector = signal.get("sector", "Technology")
        phase = signal.get("momentum_phase", "Trending")
        return {
            "ticker": ticker,
            "headline": f"{ticker} Shows {phase} Momentum in {sector} Sector",
            "summary": f"{ticker} is exhibiting strong {phase.lower()} characteristics within the {sector} landscape today.",
            "sentiment": signal.get("sentiment", "bullish"),
            "sector": sector,
            "daily_change": signal.get("daily_change", 0)
        }

    @staticmethod
    async def filter_top_stories(signals: List[dict]) -> List[dict]:
        if not GOOGLE_API_KEY:
            logger.error("GOOGLE_API_KEY missing for SmartFilter.")
            return []

        # Prepare a compact representation of signals for the LLM
        candidate_data = []
        for s in signals:
            candidate_data.append({
                "ticker": s.get("ticker"),
                "news_context": s.get("latest_headline", "Recent market activity"),
                "composite": s.get("composite"),
                "probability": s.get("probability"),
                "sentiment": s.get("sentiment"),
                "momentum_phase": s.get("momentum_phase"),
                "sector": s.get("sector"),
                "daily_change": s.get("daily_change")
            })

        system_instruction = (
            "You are a senior financial editor curating a daily intelligence brief. Given market signal data, "
            "select exactly 5 tickers that represent the most newsworthy stories today. "
            "Prioritize stocks with the most dramatic FUNDAMENTAL CATALYSTS: earnings beats/misses, "
            "acquisitions, FDA approvals, product launches, executive changes, lawsuits, or guidance revisions. "
            "Return ONLY data — no visual descriptions."
        )

        user_prompt = (
            f"Candidates: {json.dumps(candidate_data)}\n\n"
            "Return ONLY a JSON array of exactly 5 objects. Each object must contain:\n"
            "- ticker (string)\n"
            "- headline (string, punchy editorial headline, ≤80 chars, like a Bloomberg or Moby.co title)\n"
            "- summary (string, 1–2 sentences. MUST state the SPECIFIC fundamental catalyst from the news_context field. "
            "Example: 'Driven by a Q1 earnings beat and $250M expansion into natural food dyes.' "
            "BANNED phrases in summary: 'bullish sentiment', 'smart-money interest', 'momentum surge', "
            "'sector rotation', 'institutional accumulation', 'showing strength'. "
            "You must explain exactly WHAT happened in the real world to cause the price movement.)\n"
            "- sentiment (string, 'bullish' or 'bearish')\n"
            "- sector (string, the sector name)\n"
            "- daily_change (number, the daily percentage change)"
        )

        payload = {
            "contents": [{
                "parts": [{"text": f"{system_instruction}\n\n{user_prompt}"}]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TEXT_MODEL}:generateContent?key={GOOGLE_API_KEY}"
        
        try:
            async with httpx.AsyncClient() as client:
                for retry in range(3):
                    logger.info(f"SmartFilter attempt {retry+1}/3 — sending to {GEMINI_TEXT_MODEL}...")
                    response = await client.post(url, json=payload, timeout=60.0)
                    if response.status_code == 200:
                        data = response.json()
                        text_output = data['candidates'][0]['content']['parts'][0]['text']
                        parsed = json.loads(text_output)
                        logger.info(f"SmartFilter returned {len(parsed)} stories successfully.")
                        return parsed
                    else:
                        error_text = await response.text()
                        logger.warning(f"SmartFilter attempt {retry+1} failed: {response.status_code} - {error_text[:300]}")
                        await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"SmartFilter error: {type(e).__name__}: {e}")

        if USE_SYNTHETIC_FALLBACK:
            logger.info("Falling back to synthetic curation.")
            sorted_signals = sorted(signals, key=lambda x: x.get("composite", 0), reverse=True)[:5]
            return [SmartFilter._build_fallback_story(s) for s in sorted_signals]
        
        return []

class NewsletterArtist:
    """Phase 2: Dedicated creative agent that writes optimized visual briefs."""

    @staticmethod
    def _build_fallback_brief(story: dict) -> str:
        sector = story.get("sector", "Technology").lower()
        concept_key = "tech"
        for key in _SECTOR_CONCEPTS:
            if key in sector:
                concept_key = key
                break
        base_concept = random.choice(_SECTOR_CONCEPTS[concept_key])
        colors = random.sample(["Deep Teal", "Burnt Orange", "Mustard Yellow", "Navy", "Soft Cream"], 2)
        return (
            f"Erupting from the center of the frame, {base_concept}. "
            f"A stylized figure in a sharp suit reacts with exaggerated shock, arms thrown wide. "
            f"The scene is rendered in bold blocks of {colors[0]} and {colors[1]} with heavy risograph grain "
            f"and thick black outlines. Strong directional rim-lighting creates dramatic cast shadows. "
            f"Halftone dot shading fills the dark areas. "
            f"No text, no letters, no numbers, no logos, no typography anywhere."
        )

    @staticmethod
    async def compose_visual_brief(story: dict, raw_news_context: str = "") -> str:
        """Takes a curated story and writes a dense, image-optimized visual brief."""
        if not GOOGLE_API_KEY:
            return NewsletterArtist._build_fallback_brief(story)

        system_prompt = (
            "You are the Senior Conceptual Editor at a premium financial magazine (Moby.co style). "
            "Your ONLY job is to write a single, dense visual brief that will be sent directly to an AI image generator.\n\n"
            "You think like Malika Favre crossed with a political cartoonist. You NEVER describe generic financial imagery. "
            "You create scenes where the SPECIFIC FUNDAMENTAL CATALYST becomes a PHYSICAL, IMPOSSIBLE object caught mid-action.\n\n"
            "THE CATALYST-FIRST RULE (most important):\n"
            "The central object in your scene MUST directly literalize the specific news event — NOT the generic sector.\n"
            "Examples:\n"
            "- News: '$250M investment in natural food dyes' → Central object: a COLOSSAL VAT of vibrant liquid colors exploding upward in a rainbow geyser\n"
            "- News: 'FDA approves new cancer drug' → Central object: a MONUMENTAL glowing pill splitting open to release a shower of golden light\n"
            "- News: 'Broadcom acquires chipmaker for $4.1B' → Central object: a massive silicon wafer being swallowed whole by a chrome corporate jaw\n"
            "- News: 'Earnings miss, guidance slashed' → Central object: a crumbling quarterly report disintegrating into ash mid-air\n"
            "- News: 'Company tempers full-year expectations' → Central object: a thermometer violently shattering as its mercury plummets\n"
            "NEVER use a generic sector symbol (metal bar for materials, server for tech, pill for health) when a specific catalyst is available.\n\n"
            "ADDITIONAL RULES:\n"
            "1. OPEN with a dramatic action verb (shattering, erupting, levitating, dissolving, compressing)\n"
            "2. If the news names a real CEO/founder/politician, describe a SATIRICAL CARICATURE: "
            "their signature physical traits (hair, glasses, build, iconic clothing) in exaggerated adult-comic style, "
            "with an extreme visible emotion (panic, greed, triumph, fury)\n"
            "3. If no specific person, use a stylized archetype (panicking executive, euphoric trader, stoic bureaucrat)\n"
            "4. Integrate 2-3 environmental details from the SPECIFIC news story naturally into the scene\n"
            "5. Explicitly name 2-3 colors from ONLY this set: Deep Teal, Burnt Orange, Mustard Yellow, Navy, Soft Cream\n"
            "6. Specify a texture: risograph grain, silkscreen dots, or paper fiber\n"
            "7. End with: 'No text, no letters, no numbers, no logos, no typography anywhere.'\n\n"
            "BANNED ELEMENTS (never mention): gears, arrows, dollar signs, bar charts, candlesticks, "
            "generic bulls/bears, handshakes, jigsaw puzzles, isometric grids, generic skylines, "
            "generic metal bars, generic server racks, generic pills (unless the news is literally about a pill)\n\n"
            "Output ONLY the visual brief paragraph. No preamble, no explanation, no markdown."
        )

        # Build news context section — NEWS GOES FIRST to anchor the AI
        news_section = ""
        if raw_news_context:
            news_section = (
                f"═══ PRIMARY SOURCE MATERIAL (this is the TRUTH — anchor your visual to THIS) ═══\n"
                f"{raw_news_context}\n\n"
                f"EXTRACTION TASK: From the news above, identify:\n"
                f"1. The SPECIFIC EVENT (earnings beat, acquisition, FDA approval, product launch, lawsuit, etc.)\n"
                f"2. Any NAMED PERSON (CEO, founder, politician, regulator) — they become the central caricature\n"
                f"3. The CONCRETE OBJECT or SUBSTANCE involved (a drug, a chip, a food ingredient, a satellite, etc.)\n"
                f"Your visual brief MUST be built around items 1-3 above. Do NOT fall back to generic sector imagery.\n\n"
            )

        user_prompt = (
            f"{news_section}"
            f"SIGNAL DATA (secondary context):\n"
            f"Ticker: {story['ticker']}\n"
            f"Headline: {story['headline']}\n"
            f"Summary: {story['summary']}\n"
            f"Sentiment: {story['sentiment']}\n"
            f"Sector: {story['sector']}\n"
            f"Daily Change: {story.get('daily_change', 'N/A')}%\n\n"
            f"Write a single paragraph visual brief (5-7 sentences) for an editorial illustration. "
            f"The central impossible object MUST literalize the specific news event, NOT the generic sector."
        )

        payload = {
            "contents": [{
                "parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]
            }],
            "generationConfig": {
                "temperature": 1.0
            }
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TEXT_MODEL}:generateContent?key={GOOGLE_API_KEY}"
        
        try:
            async with httpx.AsyncClient() as client:
                for retry in range(2):
                    response = await client.post(url, json=payload, timeout=30.0)
                    if response.status_code == 200:
                        data = response.json()
                        text_output = data['candidates'][0]['content']['parts'][0]['text']
                        return text_output.strip()
                    else:
                        await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"NewsletterArtist error: {e}")

        return NewsletterArtist._build_fallback_brief(story)

class ImageGenerator:
    """Phase 3: Use Gemini Image Model to generate visuals."""

    @staticmethod
    async def generate(visual_brief: str, ticker: str) -> Optional[Tuple[str, str]]:
        if not GOOGLE_API_KEY:
            logger.error("GOOGLE_API_KEY missing for ImageGenerator.")
            return None

        date_str = datetime.now().strftime("%Y%m%d")
        filename = f"{ticker}_{date_str}.png"
        file_path = OUTPUT_DIR / filename
        relative_url = f"/intel/{filename}"

        full_prompt = (
            f"EDITORIAL ILLUSTRATION BRIEF\n"
            f"Scene: {visual_brief}\n\n"
            f"Art Direction: {MOBY_AESTHETIC_GUIDE}\n\n"
            f"Technical Specifications:\n"
            f"- Ultra-premium magazine-cover quality\n"
            f"- Flat vector base with heavy silkscreen/risograph texture overlay\n"
            f"- Maximum 4 colors in large bold blocks (Deep Teal, Burnt Orange, Mustard Yellow, Navy)\n"
            f"- Dramatic rim-lighting and heavy black cast shadows\n"
            f"- Asymmetric composition with dynamic diagonal movement\n"
            f"- Mid-action freeze-frame energy (objects exploding, shattering, or levitating)\n\n"
            f"ABSOLUTE PROHIBITIONS (triple-enforced):\n"
            f"ABSOLUTELY NO text, letters, numbers, words, logos, typography, watermarks, signatures, "
            f"candlestick charts, arrows, dollar signs, generic bulls/bears, gears, or stock-photo realism. "
            f"This image must be a pure conceptual editorial illustration with zero readable characters anywhere."
        )

        payload = {
            "contents": [{
                "parts": [{"text": full_prompt}]
            }],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "temperature": 0.75
            }
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_IMAGE_MODEL}:generateContent?key={GOOGLE_API_KEY}"

        try:
            async with httpx.AsyncClient() as client:
                for retry in range(2):
                    response = await client.post(url, json=payload, timeout=60.0)
                    if response.status_code == 200:
                        data = response.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            continue
                        
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            if "inlineData" in part:
                                img_data_base64 = part["inlineData"]["data"]
                                img_bytes = base64.decodebytes(img_data_base64.encode('utf-8'))
                                with open(file_path, "wb") as f:
                                    f.write(img_bytes)
                                logger.info(f"Generated image for {ticker} at {file_path}")
                                return relative_url, full_prompt
                    else:
                        error_text = await response.text()
                        logger.warning(f"ImageGen attempt {retry+1} failed: {response.status_code} - {error_text}")
                        await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"ImageGenerator error for {ticker}: {e}", exc_info=True)

        return None

def load_signals_from_json() -> List[dict]:
    """Fallback: Load signals from momentum_data.json if DB is empty."""
    json_path = Path(__file__).resolve().parents[0] / "momentum_data.json"
    if not json_path.exists():
        return []
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
            return data.get("signals", [])
    except Exception as e:
        logger.error(f"Error loading signals from JSON: {e}")
        return []

async def run_daily_intel_pipeline():
    """Step C: Orchestrate the daily intelligence generation."""
    logger.info("🚀 Starting Daily Market Intelligence pipeline...")

    if not GOOGLE_API_KEY:
        logger.error("Skipping pipeline: GOOGLE_API_KEY is missing.")
        return

    # Guard: Daily cap
    current_count = db.count_intel_images_today()
    if current_count >= MAX_DAILY_IMAGES:
        logger.info(f"Daily cap of {MAX_DAILY_IMAGES} images already reached. Exiting.")
        return

    # Fetch a broad pool of signals
    all_signals = db.load_signals(limit=200, order_by="probability DESC")

    if not all_signals:
        logger.info("Signals table is empty. Attempting to load from momentum_data.json...")
        all_signals = load_signals_from_json()

    if not all_signals:
        logger.warning("No signals found in DB or JSON cache. Cannot run pipeline.")
        return

    # AGGRESSIVE FILTER: Only process "Unusual Momentum" candidates
    # These are the winners our screener already flagged — not generic tickers
    unusual_signals = [
        s for s in all_signals
        if (abs(s.get("daily_change", 0)) > 4.0)        # Big movers (>4% swing)
        or (s.get("composite", 0) > 1.2)                 # High conviction composite
        or (s.get("momentum_phase") == "Fresh")           # Fresh breakout — early signal
    ]

    # Sort by absolute daily change (most dramatic action first)
    unusual_signals.sort(key=lambda x: abs(x.get("daily_change", 0)), reverse=True)

    # Cap at 20 candidates for SmartFilter. Fallback to top composite if filter too strict.
    signals = unusual_signals[:20] if unusual_signals else sorted(
        all_signals, key=lambda x: x.get("composite", 0), reverse=True
    )[:20]

    logger.info(f"📊 Unusual Momentum filter: {len(unusual_signals)} candidates from {len(all_signals)} total. Passing top {len(signals)} to SmartFilter.")

    # Phase 0.5: Pre-fetch news context for candidates so SmartFilter can write specific summaries
    news_cache = {}
    for sig in signals:
        ticker = sig["ticker"]
        news = await NewsFetcher.fetch_news(ticker)
        if news:
            news_cache[ticker] = news
            sig["latest_headline"] = news[:500] # Give the filter a good chunk
        await asyncio.sleep(0.2) # Be polite
    
    logger.info(f"📰 Pre-fetched news context for {len(news_cache)}/{len(signals)} candidates.")

    # Phase 1: Smart Filter — pick 5 stories (now with catalyst context!)
    curated_stories = await SmartFilter.filter_top_stories(signals)
    
    # Fill in if SmartFilter returned fewer than 5
    if len(curated_stories) < 5:
        logger.warning(f"SmartFilter returned only {len(curated_stories)} stories. Filling remaining slots with top composite signals.")
        existing_tickers = {s["ticker"] for s in curated_stories}
        for sig in sorted(signals, key=lambda x: x.get("composite", 0), reverse=True):
            if sig["ticker"] not in existing_tickers:
                curated_stories.append(SmartFilter._build_fallback_story(sig))
                if len(curated_stories) >= 5:
                    break

    if not curated_stories:
        logger.warning("No stories available to process.")
        return

    # Limit to remaining capacity
    capacity = MAX_DAILY_IMAGES - current_count
    stories_to_process = curated_stories[:capacity]

    date_str = datetime.now().strftime("%Y%m%d")
    
    for item in stories_to_process:
        ticker = item["ticker"]
        
        # Skip if ticker already has an image today
        existing = db.load_intel_images(ticker=ticker, limit=1)
        if existing:
            created_at = existing[0].get("created_at", "")
            if created_at.startswith(datetime.now().strftime("%Y-%m-%d")):
                logger.info(f"Skipping {ticker}: already generated today.")
                continue

        # Phase 1.5: Use pre-fetched news or fetch if missing
        raw_news = news_cache.get(ticker, "")
        if not raw_news:
            raw_news = await NewsFetcher.fetch_news(ticker)
            if raw_news:
                news_cache[ticker] = raw_news
        
        if raw_news:
            logger.info(f"📰 News for {ticker}:\n{raw_news[:200]}")
        else:
            logger.info(f"📰 No news found for {ticker}, proceeding with signal data only.")

        # Phase 2: Newsletter Artist — write brief WITH real news context
        visual_brief = await NewsletterArtist.compose_visual_brief(item, raw_news_context=raw_news)
        logger.info(f"🎨 Artist brief for {ticker}: {visual_brief[:100]}...")

        # Phase 3: Image Generator — render the brief
        gen_result = await ImageGenerator.generate(visual_brief, ticker)
        
        if gen_result:
            image_url, full_prompt_used = gen_result
            record = {
                "ticker": ticker,
                "headline": item["headline"],
                "summary": item["summary"],
                "metaphor": visual_brief,          # Store the artist's brief
                "style": "moby-editorial",
                "prompt_used": full_prompt_used,    # Store the complete image prompt
                "image_url": image_url,
                "image_path": str(OUTPUT_DIR / f"{ticker}_{date_str}.png"),
                "model_used": GEMINI_IMAGE_MODEL
            }
            db.save_intel_image(record)
            logger.info(f"✅ Daily Intel saved for {ticker}")
        
        # Be polite to the API
        await asyncio.sleep(2)

    # Cleanup: Delete records older than 7 days
    try:
        deleted_count = db.delete_intel_images_older_than(days=7)
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old intel images.")
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")

    logger.info("🏁 Daily Market Intelligence pipeline completed.")

if __name__ == "__main__":
    # Test run
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_daily_intel_pipeline())
