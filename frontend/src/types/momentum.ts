// ═══════════════════════════════════════════════════════
//  MOMENTUM — Shared TypeScript Types
//  Derived from README.md JSON schemas and refined for "IQ 300" standard
// ═══════════════════════════════════════════════════════

import { SIDEBAR_NAV } from '../lib/constants'; // Import necessary constants for type safety

// ── Branded Primitives for Enhanced Type Safety and Semantic Clarity ──
// These types enforce semantic meaning and allow for compile-time checks,
// preventing common data misuse and aligning with the 'Numbers are art' philosophy.
// They are still 'number' or 'string' at runtime, providing a robust developer experience.

type Branded<T, Brand> = T & { readonly __brand: Brand };

/** Represents a probability value, expected to be between 0 and 1. */
export type Probability = Branded<number, 'Probability'>;
/** Represents a percentage value, typically between 0 and 100, or a normalized factor. */
export type Percentage = Branded<number, 'Percentage'>;
/** Represents a score, often dimensionless or relative, used for rankings or system outputs. */
export type Score = Branded<number, 'Score'>;
/** Represents a monetary amount in USD, ensuring consistent currency handling. */
export type USDAmount = Branded<number, 'USDAmount'>;
/** Represents a count of discrete items, preventing negative or fractional values. */
export type Count = Branded<number, 'Count'>;
/** Represents a duration in milliseconds. */
export type Milliseconds = Branded<number, 'Milliseconds'>;
/** Represents a duration in days, for holding periods or historical ranges. */
export type Days = Branded<number, 'Days'>;
/** Represents a size in megabytes, typically for storage or database metrics. */
export type Megabytes = Branded<number, 'Megabytes'>;
/** Represents an ISO 8601 formatted date string (e.g., "YYYY-MM-DD"), ensuring consistent date representation. */
export type ISODateString = Branded<string, 'ISODateString'>;
/** Represents an ISO 8601 formatted year-month string (e.g., "YYYY-MM"), ensuring consistent date representation. */
export type ISOYearMonthString = Branded<string, 'ISOYearMonthString'>;

// ── Navigation Types (derived from constants for strictness) ──

/**
 * A union type representing all valid SF Symbol-like icon names used in the sidebar.
 * This ensures only predefined icons from `SIDEBAR_NAV` can be used, preventing broken UI.
 */
export type SFSymbolName = (typeof SIDEBAR_NAV)[number]['icon'];

/**
 * A union type representing all valid page IDs used in the sidebar navigation.
 * This ensures only existing routes from `SIDEBAR_NAV` can be referenced, improving navigation integrity.
 */
export type NavPageId = (typeof SIDEBAR_NAV)[number]['pageId'];

/**
 * A union type representing all valid section names used in the sidebar navigation.
 * This ensures only existing section names from `SIDEBAR_NAV` can be referenced.
 */
export type NavSection = (typeof SIDEBAR_NAV)[number]['section'];

/**
 * Defines a navigation item in the sidebar, with strictly typed icons and page IDs.
 */
export interface NavItem {
  label: string;
  icon: SFSymbolName; // Enforces usage of known SF Symbol-like strings.
  pageId: NavPageId; // Enforces usage of known page identifiers.
  section: NavSection; // Enforces usage of known section identifiers.
}

// ── Sentiment & Regime ──

/**
 * Represents the overall market sentiment for a ticker, providing a clear directional bias.
 */
export type Sentiment =
  | "Strong Bullish"
  | "Bullish"
  | "Neutral"
  | "Bearish"
  | "Strong Bearish";

/**
 * Describes the current market regime, categorizing price action behavior.
 */
export type Regime = "Trending" | "Mean-Reverting" | "Choppy";

/**
 * Indicates the current phase of momentum for a ticker, aiding in strategic timing.
 */
export type MomentumPhase = "Fresh" | "Exhausting" | "Neutral";

/**
 * Defines the urgency level for a signal or strategy, influencing decision speed.
 */
export type Urgency = "HIGH" | "MODERATE" | "LOW";

/**
 * Specifies the directional bias of a signal or trade, crucial for strategy definition.
 */
export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

/**
 * Indicates the explicit trade direction (long or short).
 */
export type TradeDirection = "LONG" | "SHORT";

// ── Advanced Signal Trigger Interfaces ──

/**
 * Details for a momentum shock signal trigger, indicating a sudden shift.
 */
export interface MomentumShockSignalTrigger {
  trigger: boolean;
  strength?: Score; // Optional strength of the shock, e.g., a z-score or percentile rank.
}

/**
 * Details for a smart money signal trigger, identifying institutional activity.
 */
export interface SmartMoneySignalTrigger {
  trigger: boolean;
  score?: Score; // Optional score indicating smart money activity.
}

/**
 * Details for a gamma squeeze signal trigger, associated with options market dynamics.
 */
export interface GammaSqueezeSignalTrigger {
  trigger: boolean;
  volume_spike?: Score; // Optional magnitude of the volume spike associated with gamma.
}

/**
 * Details for a continuation signal trigger, suggesting sustained price movement.
 */
export interface ContinuationSignalTrigger {
  trigger: boolean;
  probability?: Probability; // Optional probability of continuation (0-1).
}

// ── Base Signal Interface for common properties ──
/**
 * Common properties shared across all signal types, forming the core data structure.
 */
export interface BaseSignal {
  ticker: string;
  sector: string;
  price: USDAmount;
  composite: Score; // A composite score combining various factors.
  probability: Probability; // The probability of the signal playing out as expected (0-1).
  sentiment: Sentiment;
  regime: Regime;
  sys1_score: Score; // Score from System 1.
  sys2_score: Score; // Score from System 2.
  sys3_score: Score; // Score from System 3.
  sys4_score: Score; // Score from System 4.
  daily_change: Percentage; // Daily percentage change.
  return_20d: Percentage; // 20-day percentage return.
  momentum_phase: MomentumPhase;
}

// ── Core Signal ──

/**
 * Represents a comprehensive trading signal, extending with specific market data and advanced triggers.
 */
export interface Signal extends BaseSignal {
  volatility_20d: Percentage | null; // 20-day historical volatility.
  company_name?: string;
  vol_spike?: Score; // Magnitude of a recent volume spike.
  ta_branch?: string; // Technical analysis branch or pattern identified.
  cluster_size?: Count; // Number of signals or assets in a detected cluster.
  // Advanced signal triggers, using dedicated interfaces for structured data.
  momentum_shock?: MomentumShockSignalTrigger;
  smart_money?: SmartMoneySignalTrigger;
  gamma_squeeze?: GammaSqueezeSignalTrigger;
  continuation?: ContinuationSignalTrigger;
}

// ── Sector Data ──

/**
 * Provides an overview of a sector's regime, summarizing market behavior at a higher level.
 */
export interface SectorRegime {
  regime: Regime;
  avg_composite: Score; // Average composite score of tickers in the sector.
  avg_probability: Probability; // Average probability of signals in the sector.
  count: Count; // Number of tickers included in the sector analysis.
}

/**
 * Provides a breakdown of sentiment distribution within a sector.
 */
export interface SectorSentiment {
  bullish: Count; // Count of bullish tickers in the sector.
  bearish: Count; // Count of bearish tickers in the sector.
  neutral: Count; // Count of neutral tickers in the sector.
}

// ── Chart Data per Ticker ──

/**
 * Comprehensive chart data for a specific ticker, including price and various indicators.
 */
export interface TickerChartData {
  dates: ISODateString[]; // Array of date strings (ISO format).
  close: USDAmount[]; // Array of closing prices.
  hma: number[]; // Array of Hull Moving Average values.
  adx: number[]; // Array of Average Directional Index values.
  plus_di: number[]; // Array of Plus Directional Indicator values.
  minus_di: number[]; // Array of Minus Directional Indicator values.
  stoch_k: Percentage[]; // Array of Stochastic %K values (0-100 usually).
  stoch_d: Percentage[]; // Array of Stochastic %D values (0-100 usually).
  elder_colors: ("Emerald" | "Rose" | "Cyan")[]; // Colors for Elder Ray indicator (Bull, Bear, Neutral - aligned with design system).
  macd_hist: number[]; // Array of MACD Histogram values.
  trix: number[]; // Array of TRIX indicator values.
  trix_signal: number[]; // Array of TRIX signal line values.
}

// ── Structured Risk/Reward ──
/**
 * Defines the risk and reward potential for a trade, critical for trade planning.
 */
export interface RiskReward {
  risk: USDAmount; // Monetary risk or percentage risk.
  reward: USDAmount; // Monetary reward or percentage reward.
}

// ── Strategy ──

/**
 * Defines the available trading actions within a strategy, guiding automated or manual execution.
 */
export type StrategyAction =
  | "OPEN_LONG"
  | "OPEN_SHORT"
  | "CLOSE_LONG"
  | "CLOSE_SHORT"
  | "HOLD"
  | "MONITOR";

/**
 * Defines the available options strategies, from basic calls/puts to complex spreads.
 */
export type OptionsStrategyType =
  | "NONE"
  | "CALL_BUY"
  | "CALL_SELL"
  | "PUT_BUY"
  | "PUT_SELL"
  | "COVERED_CALL"
  | "CASH_SECURED_PUT"
  | "VERTICAL_SPREAD_CALL"
  | "VERTICAL_SPREAD_PUT"
  | "IRON_CONDOR"
  | "BUTTERFLY";

/**
 * Represents a defined trading strategy for a specific ticker, outlining entry, exit, and instrument details.
 */
export interface Strategy {
  ticker: string;
  sentiment: Sentiment;
  direction: Direction;
  action: StrategyAction; // Specific trading action using a union type.
  options_strategy: OptionsStrategyType; // Type of options strategy using a union type.
  options_note: string; // Free-form notes related to the options strategy.
  entry_price: USDAmount;
  stop_loss: USDAmount | null;
  target: USDAmount | null;
  risk_reward: RiskReward;
  etf_cost_est: USDAmount | null; // Estimated ETF cost. Should be a monetary amount, formatting for display occurs at UI.
  conviction: Score; // Conviction level for the strategy (e.g., 1-10).
  urgency: Urgency;
}

// ── Quote ──

/**
 * A motivational or insightful quote, adding a human touch to the platform.
 */
export interface Quote {
  text: string;
  author: string;
}

// ── KPI Summary ──

/**
 * Key Performance Indicators (KPIs) summarizing overall market or dashboard status, providing quick insights.
 */
export interface KPISummary {
  total_screened: Count; // Total number of tickers screened.
  bullish: Count; // Number of bullish tickers.
  bearish: Count; // Number of bearish tickers.
  avg_probability: Probability; // Average probability across all active signals.
  top_bull: string; // Ticker symbol of the top bullish asset.
  top_bear: string; // Ticker symbol of the top bearish asset.
}

// ── Full Dashboard Data (from momentum_data.json) ──

/**
 * Comprehensive data payload for the entire dashboard, integrating all key modules.
 */
export interface DashboardData {
  summary: KPISummary;
  signals: Signal[];
  strategies: Strategy[];
  /**
   * Represents chart data keyed by ticker symbol.
   * Keys are dynamic ticker symbols, hence `string` is used.
   */
  charts: Record<string, TickerChartData>;
  /**
   * Represents sector regime data keyed by sector name.
   * Keys are dynamic sector names, hence `string` is used.
   */
  sector_regimes: Record<string, SectorRegime>;
  /**
   * Represents sector sentiment data keyed by sector name.
   * Keys are dynamic sector names, hence `string` is used.
   */
  sector_sentiment: Record<string, SectorSentiment>;
  fresh_momentum: Signal[];
  exhausting_momentum: Signal[];
  rotation_ideas: Signal[];
  shock_signals: Signal[];
  gamma_signals: Signal[];
  smart_money: Signal[];
  continuation: Signal[];
  momentum_clusters: Signal[];
  shock_clusters: Signal[];
  hidden_gems: Signal[];
  high_yield_etfs: YieldSignal[];
  dividend_stocks: YieldSignal[];
  ai_stocks: Signal[];
  bullish_momentum: Signal[];
  high_volume_gappers: Signal[];
  earnings_growers: Signal[];
  quote: Quote;
  all_quotes: Quote[];
  db_stats?: DBStats;
}

// ── Yield Data ──

/**
 * Signal data specifically for high-yield ETFs or dividend stocks, focusing on income generation.
 */
export interface YieldSignal extends BaseSignal {
  company_name: string;
  category: string; // e.g., "Equity ETF", "Preferred Stock"
  dividend_yield: Percentage; // Annual dividend yield percentage.
  annual_dividend: USDAmount; // Annual dividend amount per share.
  ex_dividend_date: ISODateString | null; // The ex-dividend date (ISO 8601 string or null).
  vol_spike: Score; // Magnitude of a recent volume spike for yield assets.
}

// ── Backtest ──

/**
 * Details of an individual trade within a backtest, crucial for granular performance analysis.
 */
export interface BacktestTrade {
  entry_date: ISODateString; // Date of trade entry (ISO 8601 string).
  exit_date: ISODateString; // Date of trade exit (ISO 8601 string).
  direction: TradeDirection;
  entry_price: USDAmount;
  exit_price: USDAmount;
  shares: Count;
  pnl: USDAmount; // Profit and Loss for the trade.
  return_pct: Percentage; // Percentage return for the trade.
  composite_at_entry?: Score; // Composite score at the time of entry.
  exit_reason?: string; // Reason for trade exit (e.g., "Stop Loss", "Target Hit", "Time Expiration").
  holding_days?: Days; // Number of days the trade was held.
}

/**
 * Summary statistics for a backtest run, providing an overall performance snapshot.
 */
export interface BacktestSummary {
  ticker?: string; // Ticker symbol if backtest is for a single asset.
  systems?: number[]; // Systems used for the backtest.
  holding_period: Days; // Max holding period in days.
  entry_threshold?: Score; // Entry signal threshold.
  ensemble_k?: Count | null; // Ensemble parameter K.
  initial_capital: USDAmount;
  final_equity: USDAmount;
  total_return: USDAmount; // Absolute total return.
  total_return_pct: Percentage; // Percentage total return.
  annualised_return: Percentage;
  max_drawdown: USDAmount; // Absolute maximum drawdown.
  max_drawdown_pct: Percentage; // Percentage maximum drawdown.
  max_peak_profit: USDAmount; // Maximum profit achieved during the backtest.
  sharpe_ratio: Score;
  sortino_ratio: Score;
  win_rate: Percentage; // Percentage of winning trades.
  avg_win: Percentage; // Average profit of winning trades.
  avg_loss: Percentage; // Average loss of losing trades.
  profit_factor: Score; // Total gross profit divided by total gross loss.
  total_trades: Count;
  best_trade: USDAmount; // PNL of the best performing trade.
  worst_trade: USDAmount; // PNL of the worst performing trade.
  max_consec_wins?: Count; // Maximum consecutive winning trades.
  max_consec_losses?: Count; // Maximum consecutive losing trades.
  avg_holding_days: Days;
  elapsed_ms?: Milliseconds; // Time taken for the backtest simulation in milliseconds.
}

/**
 * A single point on the equity curve, charting portfolio value over time.
 */
export interface EquityPoint {
  date: ISODateString; // Date of the equity point (ISO 8601 string).
  equity: USDAmount; // Equity value at that date.
}

/**
 * A single point on the drawdown curve, showing maximum decline from peak equity.
 */
export interface DrawdownPoint {
  date: ISODateString; // Date of the drawdown point (ISO 8601 string).
  drawdown: Percentage; // Drawdown percentage at that date.
}

/**
 * Monthly PNL return data, useful for performance attribution and visualization.
 */
export interface MonthlyReturn {
  month: ISOYearMonthString; // Month string (e.g., "YYYY-MM").
  pnl: USDAmount; // PNL for that month.
}

/**
 * The full results object for a backtest, encompassing all simulation outputs.
 */
export interface BacktestResult {
  ticker?: string; // Ticker symbol if backtest is for a single asset.
  trades: BacktestTrade[];
  equity_curve: EquityPoint[];
  summary: BacktestSummary;
  /** Optional. Contains forward projection data if the backtest includes a projection simulation. */
  projection?: {
    projected_equity: USDAmount[];
    expected_return: Percentage;
    confidence_interval: [Percentage, Percentage]; // e.g., [0.05, 0.95]
    forward_days: Days;
    n_simulations: Count;
    expected_final_equity: USDAmount;
  };
  /** Optional. Detailed drawdown curve points, typically omitted if only summary statistics are requested or not computed. */
  drawdown?: DrawdownPoint[];
  /** Optional. Monthly profit and loss returns, useful for performance attribution, but might not always be generated or requested. */
  monthly_returns?: MonthlyReturn[];
}

// ── Indicator Catalog ──

/**
 * Describes a parameter for an indicator, including its type and default value.
 */
export interface IndicatorParam {
  name: string;
  default: number; // Default values can be generic numbers.
  type: "int" | "float";
  desc: string; // Description of the parameter.
}

/**
 * Metadata for a trading indicator, providing context and configuration details.
 */
export interface IndicatorMeta {
  name: string;
  category: string;
  description: string;
  params: IndicatorParam[];
  outputs: string[]; // Names of the outputs generated by the indicator.
}

// ── Receipt ──

/**
 * Represents a historical trade receipt or log entry, detailing past trade outcomes.
 */
export interface Receipt {
  id?: number; // Receipt ID, often numerical.
  date: ISODateString; // Date of the receipt/trade.
  ticker: string;
  signal_type: string; // Type of signal that led to this trade.
  result: "WIN" | "LOSS" | "OPEN"; // Outcome of the trade.
  return_pct: Percentage; // Percentage return.
  pnl: USDAmount; // Profit and Loss.
  trades?: Count; // Number of underlying trades if aggregated.
  sharpe?: Score; // Sharpe ratio for the period.
  holding?: Days; // Holding period in days.
  note?: string; // Additional notes for the receipt.
}

/**
 * Summary data for a collection of receipts, providing an overview of trading history.
 */
export interface ReceiptsData {
  receipts: Receipt[];
  win_rate: Percentage;
  avg_return: Percentage; // Average return across all receipts.
  best_call: string; // Description or ID of the best performing call.
  worst_call: string; // Description or ID of the worst performing call.
  total_calls: Count;
  sharpe: Score; // Overall Sharpe ratio for all receipts.
  pnl_curve?: EquityPoint[]; // Optional PNL equity curve.
}

// ── DB Stats ──

/**
 * Database statistics and metadata, for monitoring system health and data freshness.
 */
export interface DBStats {
  db_size_mb: Megabytes; // Database size in megabytes.
  total_rows: Count; // Total number of rows across all tables.
  total_tickers: Count; // Total unique tickers stored.
  date_min: ISODateString | null; // Earliest data date (ISO 8601 string or null).
  date_max: ISODateString | null; // Latest data date (ISO 8601 string or null).
  backtest_count: Count; // Number of backtests performed.
  db_path: string; // Path to the database file.
}

// ── Saved Strategy ──

/**
 * Configuration for a visual strategy, typically defined through UI selections and parameters.
 */
export interface VisualStrategyConfig {
  entryConditions: { id: string; params: Record<string, string | number | boolean | string[] | Record<string, unknown>> }[];
  exitConditions: { id: string; params: Record<string, string | number | boolean | string[] | Record<string, unknown>> }[];
  filters: { id: string; params: Record<string, string | number | boolean | string[] | Record<string, unknown>> }[];
  parameters: Record<string, number | string | boolean | string[]>;
  // Additional specific fields for a visual strategy builder can be added here.
}

/**
 * Configuration metadata for a code-based strategy, including language and dependencies.
 */
export interface CodeStrategyConfig {
  language?: "python" | "javascript" | "typescript" | "pseudocode";
  version?: string; // Version of the strategy code or logic.
  dependencies?: string[]; // List of dependencies if applicable.
  parameters?: Record<string, number | string | boolean>; // Parameters passed to the code.
}

/**
 * Represents a saved user strategy, which can be either visual (UI-driven) or code-based.
 * Uses a discriminated union to ensure type safety based on the 'type' field, enhancing reliability.
 */
export type SavedStrategy =
  | {
      id: number;
      name: string;
      description: string;
      type: "visual";
      config: VisualStrategyConfig; // Required config for visual strategies.
      code?: never; // 'code' is not allowed for visual strategies, ensuring type exclusivity.
      created: ISODateString;
      updated: ISODateString;
    }
  | {
      id: number;
      name: string;
      description: string;
      type: "code";
      config?: CodeStrategyConfig; // Optional metadata config for code strategies.
      code: string; // 'code' is required for code strategies, ensuring logic is present.
      created: ISODateString;
      updated: ISODateString;
    };

// ── Pipeline Status ──

/**
 * Current status of a data pipeline or background process, for real-time system feedback.
 */
export type PipelineStatus = "idle" | "running" | "done" | "error";