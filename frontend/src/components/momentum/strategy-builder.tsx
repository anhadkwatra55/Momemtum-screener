import { useState, useRef, useCallback, useMemo, memo, Suspense, lazy } from "react";
import { useStrategy, type Condition } from "@/hooks/use-strategy";
import { SPRING_TRANSITION } from "@/lib/constants";
import type { IndicatorMeta } from "@/types/momentum";
import { motion, AnimatePresence } from "framer-motion";
import {
  cn,
  getTextColorClass,
  getBackgroundColorClass,
} from "@/lib/utils";

// UI Components
import { SFIcon, SFIconName } from "@/components/ui/SFIcon";
import { AppleButton } from "@/components/ui/apple-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue as SelectSelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Lazy load BacktestResults
const LazyBacktestResults = lazy(() => import("./backtest-results").then(module => ({ default: module.BacktestResults })));

const PRICE_FIELDS = ["Close", "Open", "High", "Low", "Volume"];
const OPS = [
  { value: ">", label: "is above" },
  { value: "<", label: "is below" },
  { value: ">=", label: "is at or above" },
  { value: "<=", label: "is at or below" },
  { value: "==", label: "equals" },
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
];

const FALLBACK_INDICATORS: IndicatorMeta[] = [
  { name: "RSI", category: "Momentum", description: "Relative Strength Index", params: [{ name: "period", default: 14, type: "int", desc: "Lookback" }], outputs: ["value"] },
  { name: "SMA", category: "Trend", description: "Simple Moving Average", params: [{ name: "period", default: 20, type: "int", desc: "Lookback" }], outputs: ["value"] },
  { name: "EMA", category: "Trend", description: "Exponential Moving Average", params: [{ name: "period", default: 12, type: "int", desc: "Lookback" }], outputs: ["value"] },
  { name: "MACD", category: "Momentum", description: "MACD", params: [{ name: "fast", default: 12, type: "int", desc: "Fast" }, { name: "slow", default: 26, type: "int", desc: "Slow" }, { name: "signal", default: 9, type: "int", desc: "Signal" }], outputs: ["macd", "signal", "histogram"] },
  { name: "BBANDS", category: "Volatility", description: "Bollinger Bands", params: [{ name: "period", default: 20, type: "int", desc: "Lookback" }], outputs: ["upper", "middle", "lower"] },
  { name: "STOCH", category: "Momentum", description: "Stochastic Oscillator", params: [{ name: "k", default: 14, type: "int", desc: "%K" }], outputs: ["%K", "%D"] },
  { name: "ATR", category: "Volatility", description: "Average True Range", params: [{ name: "period", default: 14, type: "int", desc: "Lookback" }], outputs: ["value"] },
  { name: "ADX", category: "Trend", description: "Average Directional Index", params: [{ name: "period", default: 14, type: "int", desc: "Lookback" }], outputs: ["adx", "+DI", "-DI"] },
  { name: "VWAP", category: "Volume", description: "Volume Weighted Avg Price", params: [], outputs: ["value"] },
  { name: "OBV", category: "Volume", description: "On Balance Volume", params: [], outputs: ["value"] },
  { name: "CCI", category: "Momentum", description: "Commodity Channel Index", params: [{ name: "period", default: 20, type: "int", desc: "Lookback" }], outputs: ["value"] },
  { name: "SUPERTREND", category: "Trend", description: "Supertrend", params: [{ name: "period", default: 10, type: "int", desc: "Lookback" }], outputs: ["value", "direction"] },
];

interface ConditionRowProps {
  cond: Condition;
  index: number;
  type: "entry" | "exit";
  indicators: IndicatorMeta[];
  onChange: (c: Condition) => void;
  onRemove: () => void;
}

// Memoized ConditionRow component for performance
const ConditionRow = memo(function ConditionRow({
  cond, index, type, indicators, onChange, onRemove
}: ConditionRowProps) {
  const indList = useMemo(() => indicators.length > 0 ? indicators : FALLBACK_INDICATORS, [indicators]);

  const leftInd = useMemo(() => indList.find((i) => i.name === cond.left.name), [indList, cond.left.name]);
  const rightInd = useMemo(() => cond.right.type === "indicator" ? indList.find((i) => i.name === cond.right.name) : null, [indList, cond.right.type, cond.right.name]);

  const updateLeft = useCallback((patch: Partial<Condition["left"]>) => {
    onChange({ ...cond, left: { ...cond.left, ...patch } });
  }, [cond, onChange]);

  const updateRight = useCallback((patch: Partial<Condition["right"]>) => {
    onChange({ ...cond, right: { ...cond.right, ...patch } });
  }, [cond, onChange]);

  const handleLeftTypeChange = useCallback((value: string) => {
    const t = value as "indicator" | "price";
    updateLeft({
      type: t,
      name: t === "indicator" ? (indList[0]?.name || FALLBACK_INDICATORS[0].name) : undefined,
      output: t === "indicator" ? (indList[0]?.outputs?.[0] || FALLBACK_INDICATORS[0].outputs[0]) : undefined,
      field: t === "price" ? "Close" : undefined
    });
  }, [indList, updateLeft]);

  const handleLeftNameChange = useCallback((value: string) => {
    const ind = indList.find((i) => i.name === value);
    updateLeft({ name: value, output: ind?.outputs?.[0] || "value" });
  }, [indList, updateLeft]);

  const handleLeftOutputChange = useCallback((value: string) => {
    updateLeft({ output: value });
  }, [updateLeft]);

  const handleLeftFieldChange = useCallback((value: string) => {
    updateLeft({ field: value });
  }, [updateLeft]);

  const handleOpChange = useCallback((value: string) => {
    onChange({ ...cond, op: value });
  }, [cond, onChange]);

  const handleRightTypeChange = useCallback((value: string) => {
    const t = value as "constant" | "indicator" | "price";
    updateRight({
      type: t,
      value: t === "constant" ? 30 : undefined,
      name: t === "indicator" ? (indList[0]?.name || FALLBACK_INDICATORS[0].name) : undefined,
      field: t === "price" ? "Close" : undefined
    });
  }, [indList, updateRight]);

  const handleRightValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateRight({ value: parseFloat(e.target.value) || 0 });
  }, [updateRight]);

  const handleRightNameChange = useCallback((value: string) => {
    const ind = indList.find((i) => i.name === value);
    updateRight({ name: value, output: ind?.outputs?.[0] || "value" });
  }, [indList, updateRight]);

  const handleRightOutputChange = useCallback((value: string) => {
    updateRight({ output: value });
  }, [updateRight]);

  const handleRightFieldChange = useCallback((value: string) => {
    updateRight({ field: value });
  }, [updateRight]);

  // Plain-english preview
  const leftLabel = cond.left.type === "price" ? `Price ${cond.left.field || "Close"}` : `${cond.left.name || "?"} ${cond.left.output || ""}`;
  const opLabel = OPS.find((o) => o.value === cond.op)?.label || cond.op;
  const rightLabel = cond.right.type === "constant" ? String(cond.right.value ?? "?") : `${cond.right.name || "?"} ${cond.right.output || ""}`;

  const labelClass = "text-xs sm:text-sm text-muted-foreground font-semibold uppercase tracking-[0.1em] mb-1";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={SPRING_TRANSITION}
      className={cn(
        "mb-4 p-5 rounded-3xl shadow-card bg-card/40 glass-subtle"
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm text-muted-foreground font-semibold uppercase tracking-[0.1em]">Rule {index + 1}</span>
        <span className="flex-1" />
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className={cn(
            getTextColorClass("rose", "400"), "opacity-80 hover:opacity-100",
            "hover:bg-rose-500/10"
          )}
        >
          <span className="sr-only">Remove rule</span>
          <SFIcon name="xmark" size="sm" className="mr-2" />
          Remove
        </AppleButton>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-4 gap-x-3 items-end">
        {/* LEFT SIDE */}
        <div className="flex flex-col">
          <label className={labelClass}>When</label>
          <Select value={cond.left.type} onValueChange={handleLeftTypeChange}>
            <SelectTrigger className="w-full">
              <SelectSelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indicator">
                <SFIcon name="chart.bar.fill" size="sm" className="mr-2" />
                Indicator
              </SelectItem>
              <SelectItem value="price">
                <SFIcon name="dollarsign.circle.fill" size="sm" className="mr-2" />
                Price
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {cond.left.type === "indicator" ? (
          <>
            <div className="flex flex-col">
              <label className={labelClass}>Indicator</label>
              <Select value={cond.left.name || ""} onValueChange={handleLeftNameChange}>
                <SelectTrigger className="w-full">
                  <SelectSelectValue placeholder="Select indicator" />
                </SelectTrigger>
                <SelectContent>
                  {indList.map((ind) => <SelectItem key={ind.name} value={ind.name}>{ind.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {leftInd && leftInd.outputs.length > 1 && (
              <div className="flex flex-col">
                <label className={labelClass}>Output</label>
                <Select value={cond.left.output || ""} onValueChange={handleLeftOutputChange}>
                  <SelectTrigger className="w-full">
                    <SelectSelectValue placeholder="Select output" />
                  </SelectTrigger>
                  <SelectContent>
                    {leftInd.outputs.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col">
            <label className={labelClass}>Field</label>
            <Select value={cond.left.field || "Close"} onValueChange={handleLeftFieldChange}>
              <SelectTrigger className="w-full">
                <SelectSelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {PRICE_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* OPERATOR */}
        <div className="flex flex-col">
          <label className={labelClass}>Condition</label>
          <Select value={cond.op} onValueChange={handleOpChange}>
            <SelectTrigger className="w-full">
              <SelectSelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex flex-col">
          <label className={labelClass}>Compare to</label>
          <Select value={cond.right.type} onValueChange={handleRightTypeChange}>
            <SelectTrigger className="w-full">
              <SelectSelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="constant">
                <SFIcon name="number.circle.fill" size="sm" className="mr-2" />
                Number
              </SelectItem>
              <SelectItem value="indicator">
                <SFIcon name="chart.bar.fill" size="sm" className="mr-2" />
                Indicator
              </SelectItem>
              <SelectItem value="price">
                <SFIcon name="dollarsign.circle.fill" size="sm" className="mr-2" />
                Price
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {cond.right.type === "constant" && (
          <div className="flex flex-col">
            <label className={labelClass}>Value</label>
            <Input type="number" value={cond.right.value ?? ""} onChange={handleRightValueChange} className="w-full" />
          </div>
        )}
        {cond.right.type === "indicator" && (
          <>
            <div className="flex flex-col">
              <label className={labelClass}>Indicator</label>
              <Select value={cond.right.name || ""} onValueChange={handleRightNameChange}>
                <SelectTrigger className="w-full">
                  <SelectSelectValue placeholder="Select indicator" />
                </SelectTrigger>
                <SelectContent>
                  {indList.map((ind) => <SelectItem key={ind.name} value={ind.name}>{ind.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {rightInd && rightInd.outputs.length > 1 && (
              <div className="flex flex-col">
                <label className={labelClass}>Output</label>
                <Select value={cond.right.output || ""} onValueChange={handleRightOutputChange}>
                  <SelectTrigger className="w-full">
                    <SelectSelectValue placeholder="Select output" />
                  </SelectTrigger>
                  <SelectContent>
                    {rightInd.outputs.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
        {cond.right.type === "price" && (
          <div className="flex flex-col">
            <label className={labelClass}>Field</label>
            <Select value={cond.right.field || "Close"} onValueChange={handleRightFieldChange}>
              <SelectTrigger className="w-full">
                <SelectSelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {PRICE_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {/* Preview */}
      <div className="mt-4 text-sm text-muted-foreground/80 italic">
        → When <span className="text-foreground font-medium not-italic">{leftLabel}</span> {opLabel} <span className="text-foreground font-medium not-italic">{rightLabel}</span>
      </div>
    </motion.div>
  );
});

// Skeleton loader for BacktestResults
const BacktestResultsSkeleton = () => (
  <div className="mt-8 rounded-3xl shadow-card bg-card/40 glass-subtle skeleton p-6">
    <div className="h-6 w-1/4 bg-muted/20 rounded-2xl mb-4" />
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 bg-muted/10 rounded-xl">
          <div className="h-4 w-3/4 bg-muted/20 rounded-md" />
          <div className="h-4 w-1/2 bg-muted/20 rounded-md" />
        </div>
      ))}
    </div>
    <div className="h-48 w-full bg-muted/20 rounded-2xl mt-6" />
  </div>
);

const EmptyState = ({ icon, title, description }: { icon: SFIconName; title: string; description: string }) => (
  <div className="py-16 text-center text-muted-foreground rounded-3xl bg-card/40 glass-subtle shadow-card">
    <SFIcon name={icon} size="xl" className={cn("text-6xl block mb-4 mx-auto text-cyan-400/60")} />
    <h3 className="text-xl font-semibold text-foreground tracking-tight mb-2">{title}</h3>
    <p className="text-sm px-4 md:px-8 max-w-lg mx-auto">{description}</p>
  </div>
);

export function StrategyBuilder() {
  const {
    running, result, error, indicators, savedStrategies,
    run4System, runBuilder, runCode, cancel, save, load, remove, history,
  } = useStrategy();
  const [activeTab, setActiveTab] = useState("4system");

  // 4-System form state
  const [btTicker, setBtTicker] = useState("");
  const [btCapital, setBtCapital] = useState(100000);
  const [btHolding, setBtHolding] = useState("5");
  const [btThresh, setBtThresh] = useState("0.5");
  const [btPeriod, setBtPeriod] = useState("1y");
  const [btSystems, setBtSystems] = useState<number[]>([1, 2, 3, 4]);
  const [btEnsemble, setBtEnsemble] = useState<string | null>(null);

  // Strategy Builder form state
  const [sbTicker, setSbTicker] = useState("AAPL");
  const [sbCapital, setSbCapital] = useState(100000);
  const [sbPosSize, setSbPosSize] = useState(10);
  const [sbPeriod, setSbPeriod] = useState("1y");
  const [sbSL, setSbSL] = useState("");
  const [sbTP, setSbTP] = useState("");
  const [sbMaxHold, setSbMaxHold] = useState("");
  const [sbSaveName, setSbSaveName] = useState("");
  const [entryConditions, setEntryConditions] = useState<Condition[]>([]);
  const [exitConditions, setExitConditions] = useState<Condition[]>([]);

  // Code Editor form state
  const [ceTicker, setCeTicker] = useState("AAPL");
  const [ceCapital, setCeCapital] = useState(100000);
  const [cePosSize, setCePosSize] = useState(10);
  const [cePeriod, setCePeriod] = useState("1y");
  const [ceSL, setCeSL] = useState("");
  const [ceTP, setCeTP] = useState("");
  const [ceMaxHold, setCeMaxHold] = useState("");
  const [ceSaveName, setCeSaveName] = useState("");
  const codeRef = useRef<HTMLTextAreaElement>(null);

  const toggleSystem = useCallback((s: number) => {
    setBtSystems((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }, []);

  const addCondition = useCallback((type: "entry" | "exit") => {
    const defaultIndicator = indicators.length > 0 ? indicators[0] : FALLBACK_INDICATORS[0];
    const defaultCondition: Condition = {
      left: { type: "indicator", name: defaultIndicator.name, output: defaultIndicator.outputs?.[0] || "value" },
      op: ">",
      right: { type: "constant", value: 30 },
    };
    if (type === "entry") setEntryConditions((prev) => [...prev, defaultCondition]);
    else setExitConditions((prev) => [...prev, defaultCondition]);
  }, [indicators]);

  const removeCondition = useCallback((type: "entry" | "exit", idx: number) => {
    if (type === "entry") setEntryConditions((prev) => prev.filter((_, i) => i !== idx));
    else setExitConditions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handle4System = useCallback(() => {
    run4System({
      ticker: btTicker || null,
      systems: btSystems,
      holding_period: Number(btHolding),
      entry_threshold: Number(btThresh),
      period: btPeriod,
      ensemble_k: btEnsemble ? Number(btEnsemble) : null,
      initial_capital: btCapital,
      top_n: 20,
    });
  }, [btTicker, btSystems, btHolding, btThresh, btPeriod, btEnsemble, btCapital, run4System]);

  const handleBuilder = useCallback(() => {
    runBuilder({
      ticker: sbTicker || "AAPL",
      period: sbPeriod,
      initial_capital: sbCapital,
      position_size_pct: sbPosSize,
      stop_loss_pct: sbSL ? parseFloat(sbSL) : null,
      take_profit_pct: sbTP ? parseFloat(sbTP) : null,
      max_holding_days: sbMaxHold ? parseInt(sbMaxHold, 10) : null,
      entry_conditions: entryConditions,
      exit_conditions: exitConditions,
    });
  }, [sbTicker, sbPeriod, sbCapital, sbPosSize, sbSL, sbTP, sbMaxHold, entryConditions, exitConditions, runBuilder]);

  const handleCode = useCallback(() => {
    runCode({
      ticker: ceTicker || "AAPL",
      code: codeRef.current?.value || "",
      period: cePeriod,
      initial_capital: ceCapital,
      position_size_pct: cePosSize,
      stop_loss_pct: ceSL ? parseFloat(ceSL) : null,
      take_profit_pct: ceTP ? parseFloat(ceTP) : null,
      max_holding_days: ceMaxHold ? parseInt(ceMaxHold, 10) : null,
    });
  }, [ceTicker, cePeriod, ceCapital, cePosSize, ceSL, ceTP, ceMaxHold, runCode]);

  const handleLoadStrategy = useCallback(async (id: number) => {
    const s = await load(id);
    if (!s) return;
    if (s.type === "code") {
      setActiveTab("code");
      if (codeRef.current) codeRef.current.value = s.code || "";
      if (s.config) {
        setCeTicker(String(s.config.ticker || "AAPL"));
        setCeCapital(Number(s.config.capital) || 100000);
        setCePeriod(String(s.config.period || "1y"));
        setCeSL(String(s.config.sl || ""));
        setCeTP(String(s.config.tp || ""));
        setCeMaxHold(String(s.config.maxHold || ""));
        setCePosSize(Number(s.config.posSize) || 10);
      }
      setCeSaveName(s.name);
    } else {
      setActiveTab("builder");
      if (s.config) {
        setSbTicker(String(s.config.ticker || "AAPL"));
        setSbCapital(Number(s.config.capital) || 100000);
        setSbPeriod(String(s.config.period || "1y"));
        setSbSL(String(s.config.sl || ""));
        setSbTP(String(s.config.tp || ""));
        setSbMaxHold(String(s.config.maxHold || ""));
        setSbPosSize(Number(s.config.posSize) || 10);
        if (Array.isArray(s.config.entry)) setEntryConditions(s.config.entry as Condition[]);
        if (Array.isArray(s.config.exit)) setExitConditions(s.config.exit as Condition[]);
      }
      setSbSaveName(s.name);
    }
  }, [load]);

  const handleSaveBuilderStrategy = useCallback(() => {
    save({
      name: sbSaveName || "Untitled Visual Strategy",
      type: "visual",
      config: { entry: entryConditions, exit: exitConditions, ticker: sbTicker, capital: sbCapital, period: sbPeriod, sl: sbSL, tp: sbTP, maxHold: sbMaxHold, posSize: sbPosSize }
    });
  }, [sbSaveName, entryConditions, exitConditions, sbTicker, sbCapital, sbPeriod, sbSL, sbTP, sbMaxHold, sbPosSize, save]);

  const handleSaveCodeStrategy = useCallback(() => {
    save({
      name: ceSaveName || "Untitled Code Strategy",
      type: "code",
      code: codeRef.current?.value || "",
      config: { ticker: ceTicker, capital: ceCapital, period: cePeriod, sl: ceSL, tp: ceTP, maxHold: ceMaxHold, posSize: cePosSize }
    });
  }, [ceSaveName, ceTicker, ceCapital, cePeriod, ceSL, ceTP, ceMaxHold, cePosSize, save]);

  const handleRemoveStrategy = useCallback((id: number) => {
    remove(id);
  }, [remove]);

  const tabs = useMemo(() => [
    { id: "4system", label: "4-System" },
    { id: "builder", label: "Strategy Builder" },
    { id: "code", label: "Code Editor" },
    { id: "saved", label: "Saved Strategies" },
  ], []);

  const labelClass = "text-xs sm:text-sm text-muted-foreground font-semibold uppercase tracking-[0.1em] mb-1";
  const formSectionTitleClass = "text-lg md:text-xl font-bold text-foreground mb-3 flex items-center gap-2 tracking-[-0.03em]";

  // Removed backgroundColor from whileHover to use Tailwind CSS hover states instead.
  const tabButtonWhileHover = useMemo(() => ({ scale: 1.02 }), []); 

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8 flex items-center gap-4 tracking-[-0.03em]">
        <SFIcon name="flask.fill" className={getTextColorClass("cyan", "400")} size="lg" />
        Strategy Builder
      </h1>
      <div className="rounded-3xl apple-card glass p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 tracking-[-0.03em]">
          <SFIcon name="microscope.fill" className={getTextColorClass("cyan", "400")} size="md" />
          Strategy Backtesting Engine
        </h2>

        {/* Sub-tabs */}
        <div className="flex gap-2 mb-8 p-1 bg-card/50 rounded-2xl overflow-x-auto custom-scrollbar">
          {tabs.map((t) => (
            <motion.button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "relative px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] rounded-xl transition-all whitespace-nowrap",
                activeTab === t.id ? getTextColorClass("cyan", "400") : "text-muted-foreground hover:text-secondary-foreground hover:bg-white/5"
              )}
              whileHover={activeTab !== t.id ? tabButtonWhileHover : undefined}
              transition={SPRING_TRANSITION}
            >
              {t.label}
              {activeTab === t.id && (
                <motion.span
                  layoutId="tab-underline"
                  className={cn("absolute bottom-0 left-0 right-0 h-[3px] rounded-full", getBackgroundColorClass("cyan", "400"))}
                  transition={SPRING_TRANSITION}
                />
              )}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING_TRANSITION}
          >
            {/* ── 4-System ── */}
            {activeTab === "4system" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div className="flex flex-col"><label className={labelClass}>Ticker (blank=universe)</label><Input type="text" value={btTicker} onChange={(e) => setBtTicker(e.target.value)} placeholder="e.g. AAPL" /></div>
                  <div className="flex flex-col"><label className={labelClass}>Initial Capital ($)</label><Input type="number" value={btCapital} onChange={(e) => setBtCapital(Number(e.target.value))} /></div>
                  <div className="flex flex-col">
                    <label className={labelClass}>Holding Period (days)</label>
                    <Select value={btHolding} onValueChange={(val) => setBtHolding(val)}>
                      <SelectTrigger className="w-full">
                        <SelectSelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 3, 5, 10, 20, 60].map((v) => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col">
                    <label className={labelClass}>Entry Threshold</label>
                    <Select value={btThresh} onValueChange={(val) => setBtThresh(val)}>
                      <SelectTrigger className="w-full">
                        <SelectSelectValue placeholder="Select threshold" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.3">0.3 (Loose)</SelectItem>
                        <SelectItem value="0.5">0.5 (Normal)</SelectItem>
                        <SelectItem value="0.8">0.8 (Strict)</SelectItem>
                        <SelectItem value="1.0">1.0 (Very Strict)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col">
                    <label className={labelClass}>Date Range</label>
                    <Select value={btPeriod} onValueChange={(val) => setBtPeriod(val)}>
                      <SelectTrigger className="w-full">
                        <SelectSelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        {["6mo", "1y", "2y", "3y", "5y"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col">
                    <label className={labelClass}>Systems</label>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {[1, 2, 3, 4].map((s) => (
                        <label key={s} className={cn(
                          "flex items-center gap-2 text-sm text-secondary-foreground cursor-pointer select-none py-2 px-3 rounded-xl transition-colors duration-150 active:scale-[0.98] relative group",
                          "hover:bg-muted/10",
                          "has-[input:checked]:bg-cyan-400/10",
                          "has-[input:checked]:text-cyan-400",
                          "has-[input:checked]:font-medium",
                          "focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-background focus-within:z-10"
                        )}>
                          <input type="checkbox" checked={btSystems.includes(s)} onChange={() => toggleSystem(s)} className="peer absolute h-full w-full opacity-0 cursor-pointer z-10" />
                          <span className={cn(
                              "relative h-5 w-5 rounded-md flex items-center justify-center transition-all flex-shrink-0",
                              "border-2",
                              "border-slate-700/60",
                              "peer-checked:bg-cyan-400",
                              "peer-checked:border-cyan-400",
                              "group-hover:border-cyan-400/80 group-hover:bg-cyan-400/10"
                          )}>
                              <SFIcon name="checkmark.fill" size="sm" className={cn("text-white transition-opacity", btSystems.includes(s) ? "opacity-100" : "opacity-0")} />
                          </span>
                          <span>System {s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className={labelClass}>Ensemble K-of-N</label>
                    <Select value={btEnsemble || ""} onValueChange={(val) => setBtEnsemble(val)}>
                      <SelectTrigger className="w-full">
                        <SelectSelectValue placeholder="Off" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Off</SelectItem>
                        <SelectItem value="2">2-of-N</SelectItem>
                        <SelectItem value="3">3-of-N</SelectItem>
                        <SelectItem value="4">4-of-4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <AppleButton
                    variant="primary"
                    size="lg"
                    onClick={handle4System}
                    disabled={running}
                  >
                    {running ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full mr-2"
                        />
                        Running…
                      </>
                    ) : (
                      <>
                        <SFIcon name="play.fill" size="md" className="mr-2" />
                        Run Backtest
                      </>
                    )}
                  </AppleButton>
                  {running && (
                    <AppleButton
                      variant="destructive"
                      size="md"
                      onClick={cancel}
                    >
                      <SFIcon name="stop.fill" size="md" className="mr-2" />
                      Stop
                    </AppleButton>
                  )}
                </div>
              </div>
            )}

            {/* ── Strategy Builder ── */}
            {activeTab === "builder" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col"><label className={labelClass}>Ticker</label><Input type="text" value={sbTicker} onChange={(e) => setSbTicker(e.target.value)} /></div>
                  <div className="flex flex-col"><label className={labelClass}>Capital ($)</label><Input type="number" value={sbCapital} onChange={(e) => setSbCapital(Number(e.target.value))} /></div>
                  <div className="flex flex-col"><label className={labelClass}>Position Size (%)</label><Input type="number" value={sbPosSize} onChange={(e) => setSbPosSize(Number(e.target.value))} /></div>
                  <div className="flex flex-col">
                    <label className={labelClass}>Period</label>
                    <Select value={sbPeriod} onValueChange={(val) => setSbPeriod(val)}>
                      <SelectTrigger className="w-full">
                        <SelectSelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {["6mo", "1y", "2y", "3y", "5y"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex flex-col"><label className={labelClass}>Stop Loss (%)</label><Input type="number" value={sbSL} onChange={(e) => setSbSL(e.target.value)} placeholder="e.g. 5" /></div>
                  <div className="flex flex-col"><label className={labelClass}>Take Profit (%)</label><Input type="number" value={sbTP} onChange={(e) => setSbTP(e.target.value)} placeholder="e.g. 10" /></div>
                  <div className="flex flex-col"><label className={labelClass}>Max Holding (days)</label><Input type="number" value={sbMaxHold} onChange={(e) => setSbMaxHold(e.target.value)} placeholder="e.g. 20" /></div>
                </div>
                <div className="w-full mt-4">
                  <div className={cn(formSectionTitleClass)}>
                    <SFIcon name="chart.line.uptrend.circle.fill" size="md" /> Entry Conditions
                    <span className="text-muted-foreground font-normal text-sm ml-2 tracking-normal">(ALL must be true to enter a trade)</span>
                  </div>
                  <AnimatePresence>
                    {entryConditions.map((cond, i) => (
                      <ConditionRow key={i} cond={cond} index={i} type="entry" indicators={indicators} onChange={(c) => { const next = [...entryConditions]; next[i] = c; setEntryConditions(next); }} onRemove={() => removeCondition("entry", i)} />
                    ))}
                  </AnimatePresence>
                  <AppleButton
                    variant="ghost"
                    onClick={() => addCondition("entry")}
                    className={cn(
                      getTextColorClass("cyan", "400"),
                      "hover:bg-cyan-400/10"
                    )}
                    size="sm"
                  >
                    <span className="relative z-10 font-semibold"><SFIcon name="plus" size="sm" className="mr-2" /> Add Entry Condition</span>
                  </AppleButton>
                </div>
                <div className="w-full mt-4">
                  <div className={cn(formSectionTitleClass)}>
                    <SFIcon name="chart.line.uptrend.circle.fill" size="md" /> Exit Conditions
                    <span className="text-muted-foreground font-normal text-sm ml-2 tracking-normal">(ANY one triggers exit)</span>
                  </div>
                  <AnimatePresence>
                    {exitConditions.map((cond, i) => (
                      <ConditionRow key={i} cond={cond} index={i} type="exit" indicators={indicators} onChange={(c) => { const next = [...exitConditions]; next[i] = c; setExitConditions(next); }} onRemove={() => removeCondition("exit", i)} />
                    ))}
                  </AnimatePresence>
                  <AppleButton
                    variant="ghost"
                    onClick={() => addCondition("exit")}
                    className={cn(
                      getTextColorClass("violet", "400"),
                      "hover:bg-violet-500/10"
                    )}
                    size="sm"
                  >
                    <span className="relative z-10 font-semibold"><SFIcon name="plus" size="sm" className="mr-2 text-violet-400" /> Add Exit Condition</span>
                  </AppleButton>
                </div>
                <div className="w-full flex gap-4 items-center flex-wrap mt-4">
                  <AppleButton
                    variant="primary"
                    size="lg"
                    onClick={handleBuilder}
                    disabled={running}
                  >
                    {running ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full mr-2"
                        />
                        Running…
                      </>
                    ) : (
                      <>
                        <SFIcon name="play.fill" size="md" className="mr-2" />
                        Run Strategy
                      </>
                    )}
                  </AppleButton>
                  {running && (
                    <AppleButton
                      variant="destructive"
                      size="md"
                      onClick={cancel}
                    >
                      <SFIcon name="stop.fill" size="md" className="mr-2" />
                      Stop
                    </AppleButton>
                  )}
                  <Input type="text" value={sbSaveName} onChange={(e) => setSbSaveName(e.target.value)} placeholder="Strategy name…" className="w-full sm:w-48" />
                  <AppleButton
                    variant="secondary"
                    size="lg"
                    onClick={handleSaveBuilderStrategy}
                  >
                    <SFIcon name="square.and.arrow.down.fill" size="md" className="mr-2" />
                    Save
                  </AppleButton>
                </div>
              </div>
            )}

            {/* ── Code Editor ── */}
            {activeTab === "code" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col"><label className={labelClass}>Ticker</label><Input type="text" value={ceTicker} onChange={(e) => setCeTicker(e.target.value)} /></div>
                  <div className="flex flex-col"><label className={labelClass}>Capital ($)</label><Input type="number" value={ceCapital} onChange={(e) => setCeCapital(Number(e.target.value))} /></div>
                  <div className="flex flex-col"><label className={labelClass}>Pos Size (%)</label><Input type="number" value={cePosSize} onChange={(e) => setCePosSize(Number(e.target.value))} /></div>
                  <div className="flex flex-col">
                    <label className={labelClass}>Period</label>
                    <Select value={cePeriod} onValueChange={(val) => setCePeriod(val)}>
                      <SelectTrigger className="w-full">
                        <SelectSelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {["6mo", "1y", "2y", "3y", "5y"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex flex-col"><label className={labelClass}>Stop Loss (%)</label><Input type="number" value={ceSL} onChange={(e) => setCeSL(e.target.value)} placeholder="e.g. 5" /></div>
                  <div className="flex flex-col"><label className={labelClass}>Take Profit (%)</label><Input type="number" value={ceTP} onChange={(e) => setCeTP(e.target.value)} placeholder="e.g. 10" /></div>
                  <div className="flex flex-col"><label className={labelClass}>Max Holding</label><Input type="number" value={ceMaxHold} onChange={(e) => setCeMaxHold(e.target.value)} placeholder="e.g. 20" /></div>
                </div>
                <textarea
                  ref={codeRef}
                  spellCheck={false}
                  className="w-full bg-card/40 backdrop-blur-md shadow-card rounded-2xl font-mono-data text-sm text-foreground p-5 min-h-[280px] resize-y leading-relaxed tab-[4] focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-background outline-none custom-scrollbar"
                  defaultValue={`# Available: df (OHLCV DataFrame), ind (indicator helper)
# You MUST set: entries (bool Series), exits (bool Series)
# Indicators: ind.rsi(), ind.macd(), ind.bbands(), ind.ema(), ind.sma(),
#   ind.stoch(), ind.atr(), ind.adx(), ind.vwap(), ind.obv(),
#   ind.cci(), ind.willr(), ind.ichimoku(), ind.supertrend(), ind.psar()

# Example: RSI mean-reversion strategy
rsi = ind.rsi(period=14)
sma200 = ind.sma(period=200)

entries = (rsi < 30) & (df['Close'] > sma200)
exits = (rsi > 70)`}
                />
                {error && activeTab === "code" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={SPRING_TRANSITION}
                    className={cn(
                      "w-full rounded-xl p-4 text-base whitespace-pre-wrap shadow-soft",
                      getBackgroundColorClass("rose", "500", "8"),
                      getTextColorClass("rose", "400")
                    )}
                  >
                    {error}
                  </motion.div>
                )}
                <div className="w-full flex gap-4 items-center flex-wrap mt-2">
                  <AppleButton
                    variant="primary"
                    size="lg"
                    onClick={handleCode}
                    disabled={running}
                  >
                    {running ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full mr-2"
                        />
                        Running…
                      </>
                    ) : (
                      <>
                        <SFIcon name="play.fill" size="md" className="mr-2" />
                        Run Code
                      </>
                    )}
                  </AppleButton>
                  {running && (
                    <AppleButton
                      variant="destructive"
                      size="md"
                      onClick={cancel}
                    >
                      <SFIcon name="stop.fill" size="md" className="mr-2" />
                      Stop
                    </AppleButton>
                  )}
                  <Input type="text" value={ceSaveName} onChange={(e) => setCeSaveName(e.target.value)} placeholder="Strategy name…" className="w-full sm:w-48" />
                  <AppleButton
                    variant="secondary"
                    size="lg"
                    onClick={handleSaveCodeStrategy}
                  >
                    <SFIcon name="square.and.arrow.down.fill" size="md" className="mr-2" />
                    Save
                  </AppleButton>
                </div>
              </div>
            )}

            {/* ── Saved Strategies ── */}
            {activeTab === "saved" && (
              <div>
                <div className="text-xl font-bold text-foreground mb-4 tracking-[-0.03em]">Saved Strategies</div>
                {savedStrategies.length === 0 ? (
                  <EmptyState
                    icon="archive.box.fill"
                    title="No strategies saved"
                    description="Create a strategy in the builder or code editor and save it to see it here."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                      {savedStrategies.map((s) => (
                        <motion.div
                          key={s.id}
                          onClick={() => handleLoadStrategy(s.id)}
                          className="apple-card p-5 cursor-pointer rounded-3xl group"
                          whileHover={{ translateY: -2, boxShadow: "var(--shadow-glow-cyan)" }}
                          transition={SPRING_TRANSITION}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-semibold text-lg">{s.name}</div>
                            <AppleButton
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleRemoveStrategy(s.id); }}
                              className="text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <span className="sr-only">Remove strategy</span>
                              <SFIcon name="xmark" size="sm" />
                            </AppleButton>
                          </div>
                          <span className={cn(
                            "px-2.5 py-1 rounded-full font-semibold uppercase text-xs inline-block tracking-[0.1em]",
                            s.type === "code" ?
                              cn(getBackgroundColorClass("cyan", "400", "15"), getTextColorClass("cyan", "400")) :
                              cn(getBackgroundColorClass("slate", "500", "15"), getTextColorClass("slate", "400"))
                          )}>
                            {s.type}
                          </span>
                          <div className="text-xs text-muted-foreground mt-2 font-mono-data">{(s.updated || "").replace("T", " ").slice(0, 16)}</div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>


        {/* Loading */}
        {running && (
          <div className="flex items-center justify-center gap-4 py-10 text-muted-foreground text-base mt-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className={cn("w-8 h-8 border-2 border-t-transparent rounded-full border-cyan-400/80")}
            />
            Running backtest…
          </div>
        )}

        {/* Error (non-code) */}
        {error && activeTab !== "code" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING_TRANSITION}
            className={cn(
              "mt-8 rounded-xl p-4 text-base shadow-soft",
              getBackgroundColorClass("rose", "500", "8"),
              getTextColorClass("rose", "400")
            )}
          >
            {error}
          </motion.div>
        )}

        {/* Results */}
        <Suspense fallback={<BacktestResultsSkeleton />}>
          {result && !running && <LazyBacktestResults result={result} />}
        </Suspense>

        {/* Back test history */}
        {history.length > 0 && (
          <div className="mt-10 p-6 apple-card rounded-3xl">
            <div className="text-xl font-bold text-foreground mb-4 tracking-[-0.03em]">
              <SFIcon name="tray.fill" size="md" className="mr-2" />
              Backtest History
            </div>
            <div className="overflow-x-auto custom-scrollbar rounded-2xl">
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm border-separate border-spacing-y-2">
                  <thead className="sticky top-0 bg-card/60 glass-subtle z-10">
                    <tr className="text-muted-foreground">
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-[0.1em]">ID</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-[0.1em]">Time</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-[0.1em]">Ticker</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-[0.1em]">Return</th>
                      <th className="text-left px-5 py-3 font-semibold uppercase tracking-[0.1em]">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {history.map((h) => {
                        const s = h.summary || {};
                        const ret = Number(s.total_return_pct || s.avg_return_pct || 0);
                        return (
                          <motion.tr
                            key={h.id}
                            className={cn(
                              "bg-card/30 cursor-pointer transition-all duration-150",
                              "hover:bg-cyan-400/5",
                              "shadow-none hover:shadow-glow-cyan"
                            )}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={SPRING_TRANSITION}
                          >
                            <td className="px-5 py-3 font-mono-data text-foreground rounded-l-2xl">{h.id}</td>
                            <td className="px-5 py-3 text-xs text-muted-foreground font-mono-data">{(h.run_time || "").replace("T", " ").slice(0, 16)}</td>
                            <td className="px-5 py-3 font-bold text-foreground">{String(h.params?.ticker || "Universe")}</td>
                            <td className={cn(
                              "px-5 py-3 font-bold font-mono-data",
                              ret > 0 ? getTextColorClass("emerald", "400") : ret < 0 ? getTextColorClass("rose", "400") : getTextColorClass("slate", "400")
                            )}>{ret.toFixed(2)}%</td>
                            <td className="px-5 py-3 font-mono-data text-foreground rounded-r-2xl">{String(s.total_trades || "—")}</td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}