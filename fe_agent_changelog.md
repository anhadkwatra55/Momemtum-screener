# Frontend Agent Changelog

Autonomous improvements by Gemini 2.5 Flash

### [2026-03-10 02:54:32] `frontend/src/components/ui/sheet.tsx` (was 3/10)
Refactor SheetContent to remove borders, apply generous `border-radius` (e.g., `rounded-2xl`), and implement a translucent `rgba()` background with `backdrop-blur`. Replace current CSS animations with `Framer Motion` using specified spring physics. Increase `SheetTitle` font size to align with bold typography standards. Ensure close button meets 44x44px touch target. Adjust animation durations to 300ms.
[38;5;114m+107[0m [38;5;203m-41[0m lines

### [2026-03-10 02:55:26] `frontend/src/components/ui/dialog.tsx` (was 3/10)
Refactor `DialogContent` to render as a bottom sheet on mobile and a centered dialog on larger screens. Implement all animations (overlay, content, close/open) using Framer Motion with spring physics. Replace the `ring-1` with a subtle elevation shadow. Ensure the close button's interactive area meets the 44x44px touch target. Rework `DialogFooter` layout for consistent spacing without negative margins.
[38;5;114m+116[0m [38;5;203m-39[0m lines

### [2026-03-10 02:57:51] `frontend/src/components/ui/tabs.tsx` (was 4/10)
Increase `TabsTrigger` touch target size to 44x44px. Update `border-radius` to `1rem+` for all relevant elements. Revise padding for a more spacious layout. Integrate `Framer Motion` with spring physics for all interactive animations, including hover states, and explore `backdrop-blur` for tab list backgrounds.
[38;5;114m+136[0m [38;5;203m-42[0m lines

### [2026-03-10 02:58:26] `frontend/src/components/ui/table.tsx` (was 4/10)
Refactor styling to replace hard borders with subtle background tints, elevation shadows, and `backdrop-blur` for visual depth. Introduce `border-radius: 1rem+` to the table and its sub-components. Implement Framer Motion for all interactive states, adding spring physics, `translateY` elevation, and hover effects. Develop functionality for sticky table headers and optional frozen columns. Enhance typography for numerical cells to use `JetBrains Mono` with specific sizing, bolder weights, and semantic color-coding. Apply `React.memo` to all exported table components. Adjust padding and row heights to find a balance between data density and ample whitespace, potentially offering a 'compact' variant.
[38;5;114m+181[0m [38;5;203m-80[0m lines

### [2026-03-10 02:59:46] `frontend/src/components/ui/select.tsx` (was 4/10)
Refactor `SelectTrigger` and `SelectContent` to use `border-radius: 1rem+` (16px). Increase vertical padding and minimum height for `SelectTrigger` and `SelectItem` to meet the 44x44px touch target. Implement Framer Motion for `SelectContent` and `SelectItem` animations, including spring physics for transitions and hover effects. Explicitly apply `backdrop-blur` to `SelectContent` with a translucent background. Adjust padding in `SelectGroup` and `SelectItem` for a more spacious, premium feel. Remove the default border from `SelectTrigger`, relying on shadow depth or background tints for visual separation.
[38;5;114m+116[0m [38;5;203m-80[0m lines

### [2026-03-10 03:00:19] `frontend/src/components/momentum/leaderboard.tsx` (was 4/10)
1. Drastically increase typography scale for all elements, especially titles, numbers, and key data points, ensuring JetBrains Mono is prominent for numbers. 2. Increase vertical and horizontal padding for list items and spacing between internal elements to provide ample whitespace. 3. Reassign score colors: use `rose` for low scores (<40), `amber` for mid-range (40-70), and `emerald` for high scores (>70). 4. Implement Framer Motion for list item animations and complete hover effects (translateY, shadow, border glow). Adjust animation durations to be snappier. 5. Apply `React.memo` to the `Leaderboard` component and wrap `onSelectTicker` with `useCallback`.
[38;5;114m+108[0m [38;5;203m-39[0m lines

### [2026-03-10 03:01:55] `frontend/src/components/momentum/ticker-search.tsx` (was 4/10)
Implement responsive sizing for the search input. Refactor the dropdown to use `bg-card` with `backdrop-blur`. Introduce Framer Motion for dropdown entrance/exit and enhanced hover effects on list items. Adjust all relevant border-radius values to `1rem+`. Increase the font size for ticker names to improve legibility. Replace the emoji search icon with a proper SVG or icon. Integrate the `cn` utility for all conditional Tailwind class compositions.
[38;5;114m+138[0m [38;5;203m-37[0m lines

### [2026-03-10 03:02:18] `frontend/src/components/momentum/strategy-card.tsx` (was 4/10)
Refactor component to significantly increase internal padding and line-height for better readability and a premium feel. Enhance typography with a clear hierarchy, utilizing larger, bolder `JetBrains Mono` for key financial figures. Implement the full suite of hover animations, including `translateY` and elevated shadows. Simplify card borders by favoring subtle shadows and increasing `border-radius` to `1rem+`. Re-evaluate the usage of urgency color to align with the 'one accent color' principle or ensure its visual weight is clearly secondary. Centralize dynamic color logic if patterns are repetitive.
[38;5;114m+53[0m [38;5;203m-27[0m lines

### [2026-03-10 03:03:58] `frontend/src/app/receipts/page.tsx` (was 5/10)
1. Implement Framer Motion for page entry/exit transitions and enhanced hover/interaction animations. 2. Add `overflow-x-auto` to the data table for mobile responsiveness. 3. Refactor all inline object/array literals in JSX props to use `useMemo` or predefined constants/styles. 4. Replace generic loading spinner with content-aware skeleton loaders. 5. Redesign typography hierarchy with a significantly larger, bolder hero heading and clearer scale. 6. Enhance hover states for interactive elements with translateY, elevated shadows, and subtle border glows. 7. Increase visual touch target size for filter buttons to meet accessibility standards.
[38;5;114m+270[0m [38;5;203m-126[0m lines

### [2026-03-10 03:04:25] `frontend/src/components/ui/apple-button.tsx` (was 5/10)
1. Increase `border-radius` values to meet the `1rem+` Apple standard for all button sizes. 2. Refactor gradient colors for `primary` and `danger` variants to use a single accent color (e.g., `from-cyan-500 to-cyan-600`), ensuring all colors strictly adhere to the `globals.css` palette. 3. Adjust `padding` and/or `min-height` for all button sizes (`sm`, `md`, `lg`) to guarantee a minimum `44x44px` touch target. 4. Update `whileHover` animation to implement `translateY(-2px)` combined with an elevated shadow and/or border glow. 5. Standardize Framer Motion `stiffness` to `300` and `damping` to `30`. 6. Wrap the `AppleButton` component in `React.memo()` for performance optimization. 7. Evaluate and potentially remove the explicit border from the `secondary` variant, relying on shadow depth or background tints instead. 8. Review and adjust typography tracking to align with defined standards. 9. Integrate the `cn` utility for combining class names.
[38;5;114m+64[0m [38;5;203m-41[0m lines

### [2026-03-10 03:06:27] `frontend/src/components/momentum/signal-table.tsx` (was 5/10)
Refactor `SignalTable` to leverage Framer Motion for all interactive elements and data updates, optimize performance by memoizing child components and extracting inline style objects, implement sticky/frozen columns for improved data navigation, and transform static probability tiers into interactive, collapsible sections to enhance information density and user control.
[38;5;114m+359[0m [38;5;203m-101[0m lines

### [2026-03-10 03:07:05] `frontend/src/components/momentum/kpi-strip.tsx` (was 5/10)
1. Re-implement the value animation in `KPICard` using `Framer Motion` with spring physics. 2. Remove explicit borders, replacing them with subtle shadow depth and background tints. 3. Adjust number formatting to retain appropriate precision for financial values. 4. Enhance hover effects with `Framer Motion` to include `translateY`, elevated shadow, and border glow. 5. Adjust label font size to align with the defined typography scale or ensure its readability is rigorously tested across all devices. 6. Wrap `KPICard` with `React.memo`.
[38;5;114m+77[0m [38;5;203m-29[0m lines

### [2026-03-10 03:08:39] `frontend/src/components/momentum/trending-sectors.tsx` (was 5/10)
1. Refactor typography to adhere strictly to the defined scale, ensuring all text, especially key data points and headings, is legible and contributes to a strong visual hierarchy. 2. Standardize color application using Tailwind classes and the `cn` utility. 3. Replace the emoji in the heading with a refined SVG icon or rely purely on impactful typography. 4. Implement a skeleton loader for data fetching states.
[38;5;114m+141[0m [38;5;203m-28[0m lines

### [2026-03-10 03:08:47] `frontend/src/components/momentum/sentiment-badge.tsx` (was 5/10)
Refactor the badge styling: update `rounded-md` to `rounded-xl` or larger. Replace `text-[0.68rem]` with a class from the established typography scale (`text-xs` for now, or define a new scale-aligned tiny variant). Adjust letter spacing to `tracking-wider` (0.1em) if it functions as an uppercase-style label, or `tracking-normal`. Wrap the `SentimentBadge` component with `React.memo()` to optimize re-renders. Consider replacing the `border` with a subtle inset shadow or a more pronounced background tint variation for depth.
[38;5;114m+5[0m [38;5;203m-4[0m lines

### [2026-03-10 03:10:15] `frontend/src/components/momentum/ticker-modal.tsx` (was 5/10)
Refactor the modal to use a bottom sheet on mobile, adapting content for that layout. Implement Framer Motion for all modal and interactive element animations, ensuring spring physics and specified hover states. Rework typography to emphasize hierarchy, making section headers larger and numbers more prominent. Apply the specified glass/translucency with backdrop-blur to the modal body and internal cards. Introduce more generous whitespace and consistent padding to enhance the premium feel. Move inline array/object literals out of JSX for performance. Standardize border-radius across all rounded elements to adhere to the 1rem+ standard.
[38;5;114m+263[0m [38;5;203m-157[0m lines

### [2026-03-10 03:10:39] `frontend/src/components/momentum/mini-signal-list.tsx` (was 5/10)
Increase vertical padding on list items to ensure 44px touch targets. Standardize font sizes using the defined scale (`text-xs`, `text-sm`). Implement a richer hover animation with `translateY`, shadow, and glow. Add explicit vertical spacing between list items. Refactor list item layout for mobile responsiveness (e.g., stacking elements). Wrap the component in `React.memo()`. Utilize the `cn` utility for class composition.
[38;5;114m+124[0m [38;5;203m-37[0m lines

### [2026-03-10 03:11:39] `frontend/src/components/momentum/yield-table.tsx` (was 5/10)
1. Revise typography to increase base font sizes and establish a clear, impactful hierarchy, ensuring key numbers are 'art' with larger scales. 2. Refactor all data coloring to exclusively use established Tailwind classes or `COLORS` constants. 3. Implement sticky table headers and consider frozen columns for enhanced data navigation. 4. Adjust padding and min-heights to ensure all interactive elements meet minimum touch target requirements. 5. Introduce Framer Motion for richer hover effects (translateY, shadows) and more engaging transitions.
[38;5;114m+197[0m [38;5;203m-86[0m lines

### [2026-03-10 03:11:52] `frontend/src/components/momentum/quote-rotator.tsx` (was 5/10)
Immediately refactor content transition to use Framer Motion with prescribed spring physics. Re-evaluate and elevate typography scale for visual impact and hierarchy. Apply `backdrop-blur` and a translucent background to integrate with the premium depth aesthetic. Implement `React.memo` for performance and replace inline styles with className-based solutions.
[38;5;114m+38[0m [38;5;203m-22[0m lines

### [2026-03-10 03:12:46] `frontend/src/components/layout/topnav.tsx` (was 5/10)
Refine typography (font sizes, letter-spacing), enforce 1rem+ border-radius, align color usage with single accent principle, implement Framer Motion for sophisticated hover effects, and refactor navigation links to use global constants and a more professional icon system.
[38;5;114m+71[0m [38;5;203m-20[0m lines

### [2026-03-10 03:13:00] `frontend/src/app/layout.tsx` (was 5/10)
General improvement
[38;5;114m+18[0m [38;5;203m-1[0m lines

### [2026-03-10 03:14:28] `frontend/src/lib/constants.ts` (was 5/10)
General improvement
[38;5;114m+20[0m [38;5;203m-9[0m lines

### [2026-03-10 03:15:00] `frontend/src/app/globals.css` (was 6/10)
Refactor custom `@theme inline` and `@custom-variant dark` to standard Tailwind CSS dark mode configuration or a more widely adopted theming solution. Migrate all significant UI animations (page transitions, staggered lists, hover effects for interactive components) to Framer Motion to ensure a unified, high-fidelity animation system. Remove redundant CSS animations. Refine the universal `border-border` application, making it more targeted to interactive or container elements where it provides clear value. Re-evaluate the need for `shadcn/tailwind.css` as a global import, ensuring it aligns with the project's component strategy and doesn't introduce redundancy or conflicts. Explore generating JS color constants from CSS variables to eliminate manual duplication.
[38;5;114m+48[0m [38;5;203m-127[0m lines

### [2026-03-10 03:16:12] `frontend/src/components/ui/badge.tsx` (was 6/10)
1. Revamp `badgeVariants` to leverage the semantic color palette defined in `globals.css` and `constants.ts` (e.g., `success`, `danger`, `warning`, `info`). 2. Implement rich hover and focus states for interactive badges, including `translateY`, shadow, and/or a subtle border glow. 3. Increase the minimum height and padding for interactive badges to meet the 44x44px touch target guideline, or clearly delineate non-interactive variants. 4. Refine the focus-visible styling to be more subtle and integrated into the badge's aesthetic. 5. Adjust padding to provide more generous visual breathing room, aligning with Wealthsimple's card layouts and Apple's whitespace principles.
[38;5;114m+109[0m [38;5;203m-33[0m lines

### [2026-03-10 03:16:25] `frontend/src/components/ui/separator.tsx` (was 6/10)
1. Define `bg-border` in `globals.css` to be an ultra-subtle color, specifically a low-opacity white or a nearly black shade that provides just enough contrast without drawing undue attention. 2. Review the application of `Separator` components throughout the UI, ensuring they are used judiciously. Prioritize alternative separation methods (spacing, background tints, subtle card shadows) in areas where explicit lines are not strictly necessary to enhance visual minimalism and breathing room.
[38;5;114m+11[0m [38;5;203m-8[0m lines

### [2026-03-10 03:17:35] `frontend/src/components/momentum/sector-heatmap.tsx` (was 6/10)
Refactor card components to consistently use the global `Card` background, `backdrop-blur`, and `border-radius: 1rem+`. Re-evaluate color strategy to adhere to the "one accent color per section" principle. Adjust typography scale within cards to emphasize key information and ensure all text meets readability standards, treating numbers as art. Enhance hover states with elevated shadows and subtle border glows. Centralize regime-based background styling by utilizing `REGIME_STYLES` from `constants.ts`. Convert inline style objects for width to CSS variables or a utility class.
[38;5;114m+82[0m [38;5;203m-51[0m lines

### [2026-03-10 03:18:35] `frontend/src/components/momentum/backtest-results.tsx` (was 6/10)
1. Implement the Drawdown chart with proper data visualization or provide a sophisticated skeleton/loading state. 2. Replace all explicit borders with elevation via shadows and background tints for a more premium, glass-like aesthetic. 3. Adjust all `border-radius` values to meet the `1rem+` standard. 4. Standardize the sticky table header background using a color palette variable from `globals.css` or `bg-card`. 5. Implement lazy loading for `EquityChart` and other potentially heavy chart components. 6. Memoize the `metrics` array to prevent unnecessary re-creations. 7. Enhance the trade log with pagination or a 'Showing X of Y' indicator. 8. Add subtle hover states (e.g., `translateY`, shadow, tonal change) to metric cards and table rows.
[38;5;114m+276[0m [38;5;203m-126[0m lines

### [2026-03-10 03:19:46] `frontend/src/types/momentum.ts` (was 6/10)
1. Refactor `YieldSignal` to enforce strict usage of `Sentiment`, `Regime`, and `MomentumPhase` union types. 2. Define a `BaseSignal` interface for common properties to be shared by `Signal` and `YieldSignal`. 3. Introduce a structured type for `Strategy.risk_reward` (e.g., `{ risk: number; reward: number; }`). 4. Standardize `ex_dividend_date` to a `string` (e.g., ISO 8601) for consistency with other date representations.
[38;5;114m+17[0m [38;5;203m-21[0m lines

### [2026-03-10 03:20:28] `frontend/src/hooks/use-backtest.ts` (was 6/10)
Refactor the hook to support a richer `progress` state, potentially using an event stream or a callback for finer-grained updates from the `runBacktest` API. Introduce structured error types instead of a generic string to allow for more specific UI feedback. Explore strategies for optimistic state updates or maintaining prior results during loading to enhance perceived performance and fluidity.
[38;5;114m+122[0m [38;5;203m-23[0m lines

### [2026-03-10 03:21:35] `frontend/src/app/page.tsx` (was 7/10)
Refactor inline object/array literals into `useMemo` or external constants. Implement detailed, component-specific skeleton loaders. Add subtle flash animations for real-time table updates and a sticky header. Enhance accessibility for icons. Abstract magic numbers into constants.
[38;5;114m+345[0m [38;5;203m-220[0m lines

### [2026-03-10 03:22:02] `frontend/src/components/ui/card.tsx` (was 7/10)
1. Increase border-radius from `rounded-xl` to `rounded-2xl` (1rem) or `rounded-3xl` (1.5rem) to meet the `1rem+` standard. 2. Replace the `ring-1` with a subtle `shadow-sm` or `shadow-md` for elevation, possibly combined with a very subtle background tint. 3. Implement default interactive states (e.g., hover:translate-y, hover:shadow) directly on the `Card` component, ideally controlled by an `isInteractive` prop. 4. Refactor highly complex Tailwind class strings into more readable `@apply` directives or smaller utility functions.
[38;5;114m+89[0m [38;5;203m-42[0m lines

### [2026-03-10 03:23:22] `frontend/src/components/charts/equity-chart.tsx` (was 7/10)
Implement a dedicated chart title component with appropriate typography. Add skeleton loader and 'No data' messages for better UX. Refactor color defaults to use `constants.ts` values. Explore `lightweight-charts` or custom overlays for subtle update animations. Increase default label font size for improved legibility and elevate text color contrast.
[38;5;114m+137[0m [38;5;203m-52[0m lines

### [2026-03-10 03:23:48] `frontend/src/components/charts/elder-chart.tsx` (was 7/10)
Increase chart label font size to a more readable value (e.g., text-xs/12px). Refactor `COLOR_MAP` to import colors from `lib/constants.ts`. Re-evaluate and potentially enable a subtle time axis (`timeVisible: true`) for better context. Review parent component usage to ensure proper height provisioning for the chart.
[38;5;114m+40[0m [38;5;203m-17[0m lines

### [2026-03-10 03:24:48] `frontend/src/services/api.ts` (was 7/10)
1. Define explicit TypeScript interfaces for all complex API request bodies and response payloads (e.g., `StrategyParams`, `BacktestHistoryItemSummary`) to eliminate `Record<string, unknown>` and enhance type safety. 2. Align `fetchDashboardData` to consistently use a dynamic API endpoint (e.g., `/api/dashboard`) to ensure a unified and predictable data source experience across the dashboard. 3. Add comprehensive JSDoc comments to all public API functions, detailing parameters, return values, potential errors, and usage examples to improve developer experience and minimize integration-related UI issues.
[38;5;114m+209[0m [38;5;203m-25[0m lines

### [2026-03-10 03:25:18] `frontend/src/hooks/use-strategy.ts` (was 8/10)
Refactor error handling for initial data fetches to expose a dedicated error state. Extract common backtest initialization logic into a reusable helper function. Refine API service response types to be more explicit about error and cancellation flags, reducing the need for loose type assertions.
[38;5;114m+206[0m [38;5;203m-66[0m lines

### [2026-03-10 03:46:57] `frontend/src/app/layout.tsx` (was 3/10)
1. Remove the `"use client"` directive from `app/layout.tsx` to restore its function as a server component, allowing metadata to be correctly processed and leveraging Next.js's server-side rendering benefits. 2. Extract the `AnimatePresence` and `motion.div` page transition logic into a separate, dedicated client component (e.g., `components/layout/page-transition-wrapper.tsx`). This wrapper component would then be imported and used within the server `RootLayout` to wrap the `children` prop, ensuring animations are handled on the client while the layout remains on the server. 3. Update the page transition animation in the new client wrapper to utilize Framer Motion's `spring` physics with `stiffness=300, damping=30` for a more premium and snappy feel as per design standards.
[38;5;114m+4[0m [38;5;203m-18[0m lines

### [2026-03-10 03:47:37] `frontend/src/components/ui/tooltip.tsx` (was 3/10)
Refactor `TooltipContent` to use `var(--card)` or a suitable translucent background, apply a `glass-subtle` class for `backdrop-blur`, and adjust text color to `text-foreground`. Increase `border-radius` to `rounded-2xl` or `rounded-3xl` and add `box-shadow: var(--shadow-soft)` for elevation. Clean up and correct any non-standard Tailwind class syntax. Tune animation timing functions to be snappier, aligning with spring physics, or evaluate integration with Framer Motion for a more cohesive motion language.
[38;5;114m+39[0m [38;5;203m-3[0m lines

### [2026-03-10 03:50:10] `frontend/src/components/momentum/strategy-builder.tsx` (was 4/10)
1. Redesign Typography: Increase font sizes for all labels, subheadings, and primary content to meet readability standards, ensuring clear hierarchy and utilizing appropriate text scales from globals.css. 2. Standardize Rounded Corners: Replace all instances of 'rounded-lg' and 'rounded-md' with 'rounded-2xl' (1rem) or higher, or use custom radius variables (e.g., 'var(--radius-lg)') for consistency. 3. Increase Touch Target Sizes: Adjust padding and minimum dimensions for inputs, selects, and buttons to ensure all interactive elements meet the 44x44px touch target minimum. 4. Implement Responsive Grids: Refactor grid layouts ('grid-cols-4', 'grid-cols-3') to use responsive classes (e.g., 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4') for proper stacking on mobile. 5. Optimize Performance: Apply React.memo to ConditionRow and wrap all event handlers with useCallback; implement dynamic import() for BacktestResults. 6. Refine Elevation: Minimize explicit 'border' usage on interactive elements and containers, favoring box-shadow and subtle background tints for separation. 7. Enhance Whitespace: Increase 'gap' values and padding around sections to provide more breathing room.
[38;5;114m+509[0m [38;5;203m-278[0m lines

### [2026-03-10 03:50:48] `frontend/src/components/charts/indicator-chart.tsx` (was 4/10)
1. Increase chart `fontSize` for labels and text to `12px` (`text-xs`) or `14px` (`text-sm`) for improved legibility, using `var(--foreground)` or a higher contrast color for `textColor`. 2. Refactor all hardcoded colors to utilize CSS variables (e.g., `--muted-foreground`, `--border`, `--ring`) or `COLORS` from `constants.ts`. Update `DataLine` and `horizontalLines` interfaces to enforce the use of `COLORS` enum or string literals from the approved palette. 3. Implement a sophisticated skeleton loader that activates when `dates` or `lines` are empty, and a clear "No data" message for when data fetching is complete but no data is available. 4. Add a `title` prop and render a dedicated chart title component above the chart container, leveraging the defined typography scale and `Inter` font. 5. Explicitly document that parent components should `useMemo` the `lines` and `horizontalLines` props to prevent unnecessary chart re-initializations.
[38;5;114m+197[0m [38;5;203m-38[0m lines

### [2026-03-10 03:51:53] `frontend/src/components/ui/badge.tsx` (was 5/10)
1. **Rectify Touch Target Sizes:** Increase the `h-` utility classes for all interactive badge sizes to ensure a minimum of 44px total height, including padding. 2. **Standardize Hover/Focus Glows:** Refactor the `boxShadow` properties in Framer Motion's `whileHover` and `whileFocus` to utilize `var(--shadow-glow-cyan)` from `globals.css`. 3. **Implement Glassmorphism:** Introduce a `backdrop-filter` to the badge's background, potentially via a `glass-subtle` utility class, to enhance the premium, translucent aesthetic. 4. **Centralize Variant Definitions:** Abstract the common parts of semantic badge styling (e.g., opacity, border opacity) into a helper or a constant to reduce duplication and improve maintainability.
[38;5;114m+22[0m [38;5;203m-21[0m lines

### [2026-03-10 03:52:26] `frontend/src/components/ui/table.tsx` (was 5/10)
Refactor the `Table` container (`data-slot="table-card-container"`) to consistently utilize the `components/ui/AppleCard.tsx` component or the precise styling tokens defined by the `.apple-card` class in `globals.css`, ensuring unified `border-radius`, `background`, `backdrop-filter`, and `box-shadow` values. Extract the `whileHover` object literal in `TableRow` into a `useMemo` or a constant outside the component to adhere to performance best practices. Adjust `TableCell` padding (e.g., `py-4`) to guarantee a minimum vertical touch target of 44px, aligning with mobile-first accessibility standards. Standardize the `TableHead`'s `letter-spacing` (e.g., by creating a specific Tailwind utility or using `tracking-[0.1em]`) to match the `0.1em` standard for uppercase labels or `text-xs` headings.
[38;5;114m+50[0m [38;5;203m-41[0m lines

### [2026-03-10 03:53:31] `frontend/src/components/momentum/screener-table.tsx` (was 5/10)
1. **Redesign Table Typography:** Increase font sizes for table headers (to `text-sm` or `text-base` with `font-semibold`) and body text (to `text-sm`) to enhance legibility. Adjust letter-spacing for headers. Re-evaluate `h1` size for "massive" impact. 2. **Implement Elevation & Glassmorphism:** Replace explicit borders on the table container, inputs, and select with `shadow-card` (or similar) and background tints. Ensure the table container uses a dedicated `AppleCard` or `Card` component to consistently apply `backdrop-blur` and `1rem+` rounded corners (`rounded-2xl` or `rounded-3xl`). 3. **Add Premium Interactivity & Motion:** Implement a `sticky header` for the table. Integrate `Framer Motion` for hover effects on table rows, inputs, and select elements, including `translateY(-2px)`, elevated shadows, and subtle `border glow`. Introduce subtle flash animations for real-time data updates. 4. **Refactor Inline Styles:** Convert all inline `style` objects into Tailwind utility classes or dynamic class names via `cn` and `constants.ts`. 5. **Implement Skeleton Loader:** Replace the "No signals" message with a component-specific skeleton loader. 6. **Improve Mobile Responsiveness & Touch Targets:** Re-evaluate input widths for small mobile screens. Ensure all interactive elements meet the 44x44px touch target minimum. 7. **Consistent Font Usage:** Ensure `font-mono-data` is used where JetBrains Mono is intended for semantic clarity.
[38;5;114m+138[0m [38;5;203m-47[0m lines

### [2026-03-10 03:53:57] `frontend/src/components/momentum/top-signals.tsx` (was 5/10)
1. **Standardize Card Implementation:** Refactor the main container `div` to use the `components/ui/card.tsx` component, ensuring consistent `border-radius`, elevation, and `backdrop-blur`. If `ui/card` doesn't support a `glass` prop, extend it or ensure `apple-card` class is used. 2. **Integrate Framer Motion for Hover Effects:** Apply `motion.div` to each interactive list item, implementing `whileHover={{ translateY: -2, boxShadow: 'var(--shadow-elevated)' }}` to achieve the desired elevated shadow and subtle transform on hover. 3. **Implement Skeleton Loader:** Create a `TopSignalsSkeleton` component that mimics the structure of the `TopSignals` list, displaying multiple `skeleton` (shimmering) rows when data is loading. 4. **Refine Typography:** Increase the `h2` title to `text-xl` or `text-lg` for greater prominence. Evaluate and slightly increase font sizes for numerical data (e.g., probability and daily change) to enhance readability and visual impact. 5. **Optimize Performance:** Wrap the `TopSignals` component in `React.memo()` and use `useMemo` for the `bulls` array calculation.
[38;5;114m+60[0m [38;5;203m-24[0m lines

### [2026-03-10 03:55:32] `frontend/src/hooks/use-backtest.ts` (was 5/10)
Refactor `runBacktest` (and corresponding backend) to provide genuine, streamed progress updates to populate `percentage`. Implement a strategy to retain previous backtest results and display them under a skeleton loader or with reduced opacity during new runs. Update the `cancelBacktest` API to take a unique identifier to target specific backend processes. Remove the arbitrary `setTimeout` delay.
[38;5;114m+147[0m [38;5;203m-29[0m lines

### [2026-03-10 03:56:12] `frontend/src/hooks/use-signals.ts` (was 5/10)
1. Wrap the `sortedSignals` logic in `useMemo` to optimize performance. 2. Refactor the sorting mechanism to be type-safe, leveraging `keyof Signal` or a more controlled dynamic property access. 3. Remove `selectedTicker` from the `loadData`'s `useCallback` dependencies to prevent unnecessary full data re-fetches. 4. Introduce structured error types from the API service for more granular error feedback to the user.
[38;5;114m+59[0m [38;5;203m-25[0m lines

### [2026-03-10 03:57:35] `frontend/src/components/layout/sidebar.tsx` (was 5/10)
General improvement
[38;5;114m+134[0m [38;5;203m-62[0m lines

### [2026-03-10 03:58:30] `frontend/src/services/api.ts` (was 5/10)
General improvement
[38;5;114m+76[0m [38;5;203m-37[0m lines

### [2026-03-10 04:00:11] `frontend/src/components/ui/card.tsx` (was 6/10)
1. Integrate `backdrop-filter` directly into the `Card` component's base styles. 2. Memoize the `interactiveProps` object using `React.useMemo` and wrap the `Card` component itself with `React.memo`. 3. Standardize accent color usage for hover states to reference CSS variables (e.g., `--primary`) via a dedicated Tailwind utility or a more robust theming approach. 4. Implement truly responsive padding for the default card size, scaling with screen size rather than relying solely on the `size` prop. 5. Update the hover `boxShadow` to utilize the defined 'Apple-style shadows' from `globals.css` for a more consistent and premium depth effect.
[38;5;114m+58[0m [38;5;203m-42[0m lines

### [2026-03-10 04:00:24] `frontend/src/components/ui/separator.tsx` (was 6/10)
Refactor the separator's styling to give it more thoughtful presence. Consider using a slightly more visible tonal `background-color` (e.g., `bg-muted` with a reduced opacity) or applying a very subtle `box-shadow` to create depth and elevation, aligning it with the design philosophy's emphasis on shadows and tints over flat borders. Ensure it provides clear visual delineation without compromising minimalism, perhaps by integrating a subtle linear gradient for a premium feel.
[38;5;114m+2[0m [38;5;203m-1[0m lines

### [2026-03-10 04:01:08] `frontend/src/components/momentum/regime-badge.tsx` (was 6/10)
1. Update `rounded-md` to `rounded-lg` (1rem) or `rounded-xl` (1.4rem) to strictly adhere to the `1rem+` border-radius standard. 2. Replace `text-[0.68rem]` with a defined scale utility like `text-xs` (0.75rem) and adjust padding (`px`, `py`) for visual balance and improved readability. 3. Explore incorporating a subtle `backdrop-filter` or adjusting the translucent background to better align with the 'glass surface' aesthetic, ensuring it enhances the premium feel without compromising legibility. 4. Investigate replacing the `border` with a subtle inner shadow or a more prominent elevated shadow to align with the 'minimal borders' philosophy.
[38;5;114m+11[0m [38;5;203m-6[0m lines

### [2026-03-10 04:01:41] `frontend/src/components/momentum/mini-signal-list.tsx` (was 6/10)
1. Refactor `MiniSignalList` to use `components/ui/apple-card.tsx` or `components/ui/card.tsx` for its container, ensuring consistent glassmorphism, shadows, and rounded corners. 2. Update `MiniSignalListItem`'s `rounded-xl` to `rounded-2xl` to meet the `1rem+` standard. 3. Replace hardcoded `whileHover` styles with CSS variables for shadows and `COLORS` constants for background tints. 4. Elevate the `h2` title typography (e.g., to `text-2xl` or `text-3xl`) for stronger hierarchy. 5. Utilize the `font-mono-data` utility class for all numerical displays.
[38;5;114m+54[0m [38;5;203m-26[0m lines

### [2026-03-10 04:02:35] `frontend/src/components/momentum/strategy-card.tsx` (was 6/10)
Refactor `StrategyCard` to consistently apply the global `.apple-card` class or replicate its full styling. Eliminate the explicit left border, replacing it with a subtle visual cue using shadows or a background tint. Update all static and hover `boxShadow` properties to correctly utilize the CSS variables defined in `globals.css`. Increase the font size and improve contrast for the `options_note` to ensure readability. Re-evaluate the accent color strategy for sentiment and urgency to ensure adherence to the "one accent color per section" rule, perhaps by making secondary indicators more subtle.
[38;5;114m+49[0m [38;5;203m-21[0m lines

### [2026-03-10 04:03:04] `frontend/src/components/momentum/sector-heatmap.tsx` (was 6/10)
Refactor the card to use `apple-card` and `rounded-2xl`, standardize hover shadows with `--shadow-glow-cyan`, optimize sentiment bar widths, add a base `box-shadow: var(--shadow-card)` to the card, re-evaluate the AURA badge color, and align grid gaps with the `bento-grid` standard.
[38;5;114m+13[0m [38;5;203m-15[0m lines

### [2026-03-10 04:04:12] `frontend/src/components/charts/elder-chart.tsx` (was 6/10)
1. **Enhance Label Contrast:** Adjust the `textColor` for chart labels to a higher contrast value (e.g., `foreground` or a brighter `muted-foreground`) to significantly improve readability and meet accessibility standards. 2. **Implement Skeleton and Empty States:** Integrate a well-designed skeleton loader that fills the chart area when data is loading, and a clear, minimal "No data available" message when `dates.length` is empty, following Wealthsimple's optimistic UI principles. 3. **Integrate Chart Title:** Introduce a prop for a chart title and render it with appropriate, bold typography (e.g., `text-lg` or `text-xl` `font-sans` with negative tracking) above the chart container. 4. **Enforce Rounded Corners:** Ensure the chart's main container `div` explicitly applies the system's `border-radius` (e.g., `rounded-2xl`) and potentially a subtle `box-shadow` if it's meant to visually delineate itself as a standalone UI element.
[38;5;114m+69[0m [38;5;203m-19[0m lines

### [2026-03-10 04:05:04] `frontend/src/hooks/use-strategy.ts` (was 6/10)
Refactor `running` to a richer `status` state (e.g., 'idle', 'loading', 'success', 'error') and implement a strategy to maintain previous `result` data during loading for optimistic UI. Define and use structured `BacktestError` types for all error scenarios to enable specific UI feedback. Enforce strict TypeScript interfaces for all API request bodies and responses, eliminating `Record<string, unknown>` by defining these types in `types/momentum.ts` or `services/api.ts`. Centralize `ApiExecutionResponse` definition and ensure API functions return it directly. Abstract common API call and error handling patterns into a reusable utility.
[38;5;114m+245[0m [38;5;203m-155[0m lines

### [2026-03-10 04:06:12] `frontend/src/app/page.tsx` (was 7/10)
1. Reconcile the 'Platform Modules' section with the 'one accent color per section' principle; either unify the tag accent color or provide a clear rationale/alternative design pattern. 2. Implement subtle, short-duration flash animations on relevant cells or rows in the 'Live Signal Feed' table to visually confirm real-time data updates. 3. Abstract the styling for 'Fresh' momentum phases into a dedicated component or integrate it with existing styling conventions (e.g., `REGIME_STYLES`) to centralize its definition. 4. Design a more polished and informative error state UI, potentially using an `AppleCard` with a clear message, a relevant icon, and options like a 'Retry' `AppleButton`.
[38;5;114m+93[0m [38;5;203m-38[0m lines

### [2026-03-10 04:07:17] `frontend/src/app/receipts/page.tsx` (was 7/10)
Refine typography scale for table headers and labels, ensuring optimal legibility and hierarchical contrast. Unify filter button accent color to a single, consistent selection state color. Replace table row borders with subtle background tints or elevation-based separation. Integrate predefined `shadow-glow` variants into hover states for cards and interactive elements. Implement a robust solution for truncated data in tables, such as tooltips for full content.
[38;5;114m+203[0m [38;5;203m-174[0m lines

### [2026-03-10 04:08:08] `frontend/src/components/ui/sheet.tsx` (was 7/10)
1. Replace the `border-t` in `SheetFooter` with a subtle top `box-shadow` or a distinct, slightly elevated `bg-card` tint to maintain separation without an explicit line. 2. Increase the `gap` in `SheetHeader` to `gap-4` (16px) or `gap-3` (12px) for improved visual hierarchy and breathing room. 3. Explore options for the close button to be more prominent by default (e.g., `text-foreground` or a more distinct `hover:bg-white/10`) while retaining its current elegant rounded shape and size.
[38;5;114m+14[0m [38;5;203m-23[0m lines

### [2026-03-10 04:08:35] `frontend/src/components/ui/apple-button.tsx` (was 7/10)
Refactor the `secondary` button variant to remove the inset shadow in its base state, relying instead on background tint and a subtle outer shadow (e.g., `var(--shadow-soft)`) for definition. Explore implementing `backdrop-filter` for applicable variants to fully leverage the glassmorphism aesthetic. Replace the hardcoded `border-radius` with a variable from `globals.css`. Develop a more sophisticated visual treatment for disabled states beyond simple `opacity-50`.
[38;5;114m+25[0m [38;5;203m-18[0m lines

### [2026-03-10 04:10:34] `frontend/src/components/ui/select.tsx` (was 7/10)
1. Increase `SelectItem` `border-radius` to `1rem+` (e.g., `rounded-2xl`). 2. Implement a conditional rendering mechanism to utilize the `Sheet` component for select options on mobile. 3. Adjust the `SelectLabel`'s `letter-spacing` to `0.1em`. 4. Re-evaluate the `SelectContent` border, potentially removing it or making it even more subtle.
[38;5;114m+133[0m [38;5;203m-15[0m lines

### [2026-03-10 04:11:57] `frontend/src/components/momentum/signal-table.tsx` (was 7/10)
1. Implement subtle flash animations for real-time data updates on table cells/rows using Framer Motion. 2. Replace explicit borders on the table and rows with a combination of elevation shadows and very subtle tonal background changes or the `var(--border)` token. 3. Correct the `z-index` of sticky table headers and cells to ensure proper layering, and apply consistent `backdrop-blur` and `bg-card/80` to sticky `<td>` elements. 4. Explore structural alternatives or visual techniques to achieve consistent `1rem+` rounded corners for table rows. 5. Refactor hardcoded `boxShadow` values in `whileHover` states to use the named shadow tokens from `globals.css`. 6. Convert magic numbers for table height into props or dynamic CSS variables for better responsiveness.
[38;5;114m+188[0m [38;5;203m-77[0m lines

### [2026-03-10 04:12:56] `frontend/src/components/momentum/ticker-search.tsx` (was 7/10)
Implement a content-aware skeleton loader for search results. Add robust keyboard navigation for dropdown items. Standardize all border-radii to 1rem+. Extract Framer Motion animation properties to external constants/useMemo. Increase vertical spacing between input and dropdown. Centralize `minHeight` styling into a utility class or `globals.css`.
[38;5;114m+223[0m [38;5;203m-83[0m lines

### [2026-03-10 04:13:32] `frontend/src/components/momentum/backtest-results.tsx` (was 7/10)
1. Refactor all card-like elements to utilize `components/ui/card.tsx` or the `apple-card` utility class, adjusting their styling to achieve depth purely through shadows and tonal backgrounds, eliminating explicit borders. 2. Implement actual data visualization for the Drawdown Chart, adhering to clean, minimal chart design. 3. Explore using CSS custom properties or dynamic Tailwind classes to reduce inline style objects in the monthly returns heatmap. 4. Wrap the `BacktestResults` component in `React.memo` for performance. 5. Adjust the KPI grid to default to `grid-cols-1` on the smallest mobile viewports and scale up from there.
[38;5;114m+95[0m [38;5;203m-83[0m lines

### [2026-03-10 04:14:05] `frontend/src/components/layout/app-shell.tsx` (was 7/10)
1. Increase the hamburger button's `w-10 h-10` to `w-11 h-11` to meet the 44x44px touch target standard. 2. Update the button's `border-radius` from `rounded-xl` to `rounded-2xl` for consistent 1rem+ rounded corners. 3. Apply a default `shadow-soft` to the button for subtle elevation and enhance its hover state to include `translateY(-2px)` and a more prominent shadow like `shadow-card`, potentially with a subtle border glow from `var(--shadow-glow-cyan)`.
[38;5;114m+11[0m [38;5;203m-3[0m lines

### [2026-03-10 04:14:43] `frontend/src/components/charts/equity-chart.tsx` (was 7/10)
1. Adjust chart label `fontSize` (e.g., to `14px` or `16px`) and conditionally apply `fontFamily` (Inter for non-numeric labels, JetBrains Mono for numeric values) within `lightweight-charts` options. 2. Implement a subtle "flash" animation or highlight for the most recent data point when new data is received, aligning with TradingView's real-time updates. 3. Update Framer Motion transitions to use `type: "spring"` with specified `stiffness` and `damping` values. 4. Standardize the `min-height` property across the chart content, skeleton, and no-data messages. 5. Refine the `h3` title's horizontal padding to be responsive, increasing it on larger screen sizes.
[38;5;114m+148[0m [38;5;203m-37[0m lines

### [2026-03-10 04:15:39] `frontend/src/types/momentum.ts` (was 7/10)
Refine complex and loosely typed structures by extracting nested objects into dedicated interfaces, replacing broad `string` or `Record<string, unknown>` types with stricter union types or specific interfaces where appropriate, and enhancing JSDoc comments for improved developer clarity and precision.
[38;5;114m+323[0m [38;5;203m-136[0m lines

### [2026-03-10 04:16:30] `frontend/src/components/momentum/leaderboard.tsx` (was 8/10)
Refactor color derivation to link more directly with `constants.ts` definitions. Implement a skeleton loader for the leaderboard. Abstract magic numbers in the score calculation into named constants.
[38;5;114m+65[0m [38;5;203m-22[0m lines

### [2026-03-10 04:16:56] `frontend/src/components/layout/topnav.tsx` (was 8/10)
1. Refactor `framer-motion`'s `whileHover` `boxShadow` properties to consistently use the defined CSS shadow variables (e.g., `var(--shadow-card)`, `var(--shadow-glow-cyan)`) for a unified elevation system. 2. Replace the `nav` element's `border-b` with a subtle inner shadow or a distinct tonal background tint to adhere more closely to the 'minimal borders' principle favoring elevation over explicit lines. 3. Remove the unused `COLORS` import from `lib/constants.ts` to improve code hygiene.
[38;5;114m+4[0m [38;5;203m-4[0m lines

### [2026-03-10 04:39:07] `frontend/src/components/ui/separator.tsx` (was 4/10)
Re-evaluate the need for an explicit `Separator` line. If separation is required, replace the line with either increased spatial padding/margin, a subtle tonal background shift, or a very faint, diffuse elevation shadow between elements. If a `Separator` component must exist, implement it by rendering a `div` with `h-px`/`w-px` that applies a `bg-muted` color, a subtle gradient, or a precise `box-shadow` from the `globals.css` tokens, rather than a border-based line.
[38;5;114m+18[0m [38;5;203m-7[0m lines

### [2026-03-10 04:39:45] `frontend/src/components/ui/button.tsx` (was 4/10)
1. Increase all button sizes to ensure a minimum 44x44px touch target. 2. Standardize `border-radius` across all variants to consistently meet the `1rem+` standard using `var(--radius-lg)` or larger Tailwind `rounded-` classes. 3. Apply `var(--shadow-soft)` to the base button and implement `translateY(-2px)` with `var(--shadow-card)` and a `var(--shadow-glow-cyan)` for hover/focus states, leveraging Framer Motion with spring physics. 4. Introduce `backdrop-filter` using the `glass-subtle` utility for relevant button variants (e.g., `secondary`, `outline`). 5. Redesign the disabled state for a more sophisticated visual treatment beyond simple opacity. 6. Replace `focus-visible:ring` with a subtle border glow shadow for a more integrated focus indicator.
[38;5;114m+117[0m [38;5;203m-19[0m lines

### [2026-03-10 04:41:17] `frontend/src/components/charts/elder-chart.tsx` (was 4/10)
Refactor the `useEffect` to update the `lightweight-charts` series data incrementally instead of re-creating the entire chart. Implement conditional font families for `lightweight-charts` labels, using `Inter` for time labels and `JetBrains Mono` for numeric values. Standardize `ChartSkeleton`'s border-radius to `rounded-2xl`. Remove the explicit `1px` border from the `apple-card` styling for the chart wrapper, enhancing elevation through shadows and background tints only.
[38;5;114m+77[0m [38;5;203m-43[0m lines

### [2026-03-10 04:42:03] `frontend/src/app/dashboard/page.tsx` (was 5/10)
1. Replace the native `<select>` element in "Ticker Detail" with the custom `Select` component from `components/ui/select.tsx`, ensuring it fully adheres to all specified design standards. 2. Refactor all inline `style={{ color: ... }}` instances to leverage the Tailwind class utilities provided by `SENTIMENT_STYLES`, `REGIME_STYLES`, or specific color classes from `constants.ts` where appropriate. 3. Standardize `border-radius` for all card-like and list item elements to `rounded-xl` for visual consistency. 4. Redesign the "View All →" CTA to be more prominent, increasing its size and applying a premium button style with appropriate hover animations. 5. Re-evaluate small font sizes for data labels, adjusting them for improved legibility while maintaining information density.
[38;5;114m+406[0m [38;5;203m-352[0m lines

### [2026-03-10 04:43:23] `frontend/src/components/momentum/screener-table.tsx` (was 5/10)
1. Refactor all Framer Motion transitions to consistently use `type: "spring"` with `stiffness=300, damping=30`. 2. Implement subtle flash animations for real-time data updates in table cells/rows. 3. Update `TickerModal` to render as a bottom sheet on mobile devices using the `Sheet` component. 4. Increase the touch target size for inputs and select elements to meet the 44x44px standard. 5. Introduce structural or visual techniques to apply `1rem+` rounded corners to table rows. 6. Adjust table header `letter-spacing` to `0.1em`. 7. Centralize strength indicator styling by utilizing `SENTIMENT_STYLES` from `constants.ts`. 8. Ensure all skeleton components adhere to the `1rem+` border-radius standard. 9. Replace the explicit border on the sticky table header with elevation shadows or tonal background. 10. Extract inline Framer Motion animation properties to external constants or `useMemo` hooks. 11. Remove the unused `COLORS` import and move inline styles from the skeleton to external definitions. 12. Wrap the `ScreenerTable` component in `React.memo` for performance optimization.
[38;5;114m+208[0m [38;5;203m-79[0m lines

### [2026-03-10 04:43:33] `frontend/src/components/momentum/regime-badge.tsx` (was 5/10)
1. Update `rounded-xl` to `rounded-2xl` or `rounded-3xl` for consistent `1rem+` rounded corners. 2. Refactor Framer Motion `transition` to use spring physics (`type: "spring", stiffness: 300, damping: 30`). 3. Increase vertical padding (e.g., `py-2.5` or `py-3`) and potentially text size to `text-sm` to improve visual spaciousness and approximate touch target guidelines. 4. Re-evaluate `tracking-wide` for legibility and aesthetic; consider `tracking-normal` or removing it. 5. Remove the `border` property from `REGIME_STYLES` in `constants.ts` since it's overridden.
[38;5;114m+2[0m [38;5;203m-2[0m lines

### [2026-03-10 04:45:30] `frontend/src/components/ui/apple-card.tsx` (was 5/10)
General improvement
[38;5;114m+94[0m [38;5;203m-41[0m lines

### [2026-03-10 04:46:40] `frontend/src/components/ui/tooltip.tsx` (was 5/10)
General improvement
[38;5;114m+81[0m [38;5;203m-63[0m lines

### [2026-03-10 04:47:51] `frontend/src/components/charts/price-chart.tsx` (was 5/10)
General improvement
[38;5;114m+243[0m [38;5;203m-75[0m lines

### [2026-03-10 04:48:04] `frontend/src/hooks/use-sectors.ts` (was 5/10)
General improvement
[38;5;114m+36[0m [38;5;203m-18[0m lines

### [2026-03-10 04:50:04] `frontend/src/app/page.tsx` (was 6/10)
Refactor table rows and skeleton components to consistently use `1rem+` rounded corners. Replace explicit internal borders within cards and tables with subtle elevation shadows or tonal background shifts. Implement subtle flash animations for real-time data updates in the 'Live Signal Feed' table. Increase the font size of overly small text elements for improved readability and ensure all custom badge/tag components adhere to the `1rem+` `border-radius` standard.
[38;5;114m+97[0m [38;5;203m-62[0m lines

### [2026-03-10 04:51:04] `frontend/src/app/receipts/page.tsx` (was 6/10)
Refactor the receipt table to introduce `1rem+` rounded corners for rows and enhance row hover animations to include `translateY`, `var(--shadow-elevated)`, and a subtle border glow. Implement subtle flash animations for real-time data updates within table cells. Update the sticky table header to use `bg-card/80` with `backdrop-blur` for a richer glassmorphic effect. Re-evaluate the `AppleCard` to remove its explicit border in favor of shadow-based elevation. Adjust the `KPIStrip`'s mobile layout to `grid-cols-1` on the smallest screens.
[38;5;114m+139[0m [38;5;203m-46[0m lines

### [2026-03-10 04:51:53] `frontend/src/components/momentum/kpi-strip.tsx` (was 6/10)
1. Refactor `KPICard`'s `whileHover` `boxShadow` to use `var(--shadow-elevated)` combined with `var(--shadow-glow-cyan)` for a unified elevation and glow effect. 2. Update `KPICard` to utilize the `apple-card` utility class, removing redundant styling properties. 3. Adjust the `gap` property in `KPIStrip` to be responsive, starting with `gap-3` on mobile but increasing to `gap-4` or `gap-5` on `md` and `lg` breakpoints respectively, for more breathing room. 4. Replace `font-mono tracking-tight` with the `font-mono-data` utility class wherever numbers are displayed.
[38;5;114m+9[0m [38;5;203m-7[0m lines

### [2026-03-10 04:54:51] `frontend/src/components/momentum/strategy-builder.tsx` (was 6/10)
1. Replace all native `<select>` elements with `components/ui/select.tsx`, ensuring all relevant props are correctly mapped to leverage its complete feature set. 2. Refactor all custom button implementations to use `components/ui/apple-button.tsx`, passing appropriate `variant` and `size` props, and ensure that the advanced disabled states and proper glassmorphism styles (base `backdrop-filter`, `var(--shadow-soft)`) are consistently applied. 3. Adjust the sizing and padding of all interactive elements (buttons, checkboxes) to meet the 44x44px minimum touch target, prioritizing UX and accessibility. 4. Update the `labelClass` and any other uppercase text styles to explicitly use `tracking-[0.1em]` to align with the typography standards.
[38;5;114m+310[0m [38;5;203m-210[0m lines

### [2026-03-10 04:55:54] `frontend/src/components/momentum/top-signals.tsx` (was 6/10)
1. Update the `border-radius` of individual signal `motion.div` elements from `rounded-lg` to `rounded-xl` or `rounded-2xl` for consistent `1rem+` rounded corners. 2. Implement a subtle flash animation (e.g., a background highlight or border glow fade-out) for relevant data points within each signal item (`s.probability`, `s.daily_change`) when their values update. 3. Adjust the `h2` heading's letter-spacing to precisely `-0.03em` using a custom CSS class or direct style. 4. Increase the vertical padding or `space-y` between signal items to enhance whitespace and the premium aesthetic.
[38;5;114m+76[0m [38;5;203m-22[0m lines

### [2026-03-10 04:56:24] `frontend/src/components/momentum/rotation-signals.tsx` (was 6/10)
Refactor the main container to utilize the `apple-card` utility class or `components/ui/card.tsx` to ensure consistent elevation and rounded corners. Replace explicit `border-b` on list items with tonal background changes or `var(--border)`. Adjust all typography to adhere to the established scale, using `text-xs` for details and a larger, bolder heading (e.g., `text-xl` or `text-2xl`). Replace `font-mono` with `.font-mono-data` for numerical values. Introduce subtle hover animations on list items for enhanced interactivity.
[38;5;114m+74[0m [38;5;203m-26[0m lines

### [2026-03-10 04:58:47] `frontend/src/components/momentum/yield-table.tsx` (was 6/10)
1. Refactor the main container to use the `apple-card` utility class or consistently apply its styles for proper glassmorphism, depth, and `backdrop-filter`. 2. Standardize all `border-radius` values across the component to use `rounded-[var(--radius-2xl)]` or similar `1rem+` radius variables. 3. Eliminate explicit `border-b` on table headers and rows, replacing them with subtle tonal background shifts or thin inner shadows for visual separation. 4. Update table row `whileHover` `boxShadow` and hover border effects to leverage CSS custom properties like `var(--shadow-glow-cyan)` for consistency and visual quality. 5. Implement a robust skeleton loader for the table when data is fetching or absent. 6. Add subtle flash animations for real-time data updates on table cells or rows. 7. Standardize the search input styling to use `var(--input)`, `var(--border)`, and the `focus-visible:ring-ring` from `globals.css`, and replace the emoji icon with an SVG. 8. Refine `SentimentBadge` styling to use `1rem+` radius and replace explicit borders with inner shadows or background tints. 9. Replace text sort indicators with appropriate SVG icons.
[38;5;114m+183[0m [38;5;203m-63[0m lines

### [2026-03-10 04:59:31] `frontend/src/components/layout/sidebar.tsx` (was 6/10)
1. Standardize `border-radius` for `SidebarNavItem` buttons and the mobile close button to `rounded-2xl` or higher to consistently meet the 1rem+ requirement. 2. Increase the `w-10 h-10` dimensions of the logo `motion.div` and mobile close button to `w-11 h-11` for a 44x44px touch target. 3. Replace the explicit `border-b` and `border-t` with subtle tonal background shifts or a light shadow to create separation without visible lines. 4. Apply a `glass-subtle` class or similar `backdrop-filter` to the main sidebar's `nav` element to introduce subtle translucency.
[38;5;114m+20[0m [38;5;203m-9[0m lines

### [2026-03-10 05:00:44] `frontend/src/components/charts/indicator-chart.tsx` (was 6/10)
1. Apply the 'apple-card' utility class or its constituent styles (backdrop-filter, box-shadow, rounded-corners) directly to the chart's `motion.div` container or ensure the Lightweight Charts instance effectively renders within such a premium visual shell. 2. Implement a targeted flash animation or highlight for newly received data points on the chart lines to meet TradingView's real-time update standard. 3. Update all Framer Motion transitions within the component to utilize spring physics (`type: "spring", stiffness: 300, damping: 30`). 4. Refine Lightweight Charts options to apply JetBrains Mono strictly to numeric values (e.g., price scale, time scale numbers) and ensure any non-numeric labels, if present, use the global sans-serif font (Inter). Review `fontSize` for better responsiveness and legibility. 5. Correct the fallback color for `getCssVariable("--muted-foreground")` to either match the explicit CSS variable value or ensure `COLORS.slate` is consistently defined and used.
[38;5;114m+159[0m [38;5;203m-83[0m lines

### [2026-03-10 05:01:07] `frontend/src/types/momentum.ts` (was 6/10)
1. Replace `Record<string, any>` in `VisualStrategyConfig` with `Record<string, unknown>` as a minimum, or ideally, a more constrained union type if the expected parameter types are known (e.g., `Record<string, string | number | boolean | string[] | object>`). 2. Add detailed JSDoc comments to all optional fields in `BacktestResult`, clarifying precisely when they are expected to be present or absent. Re-evaluate if any of these fields should, in fact, be non-optional for a completed backtest. 3. Update the `elder_colors` union type in `TickerChartData` to use string literals (e.g., "Emerald" | "Rose" | "Cyan" | "Violet") that directly map to the named accent colors defined in `globals.css` and `constants.ts`.
[38;5;114m+7[0m [38;5;203m-4[0m lines

### [2026-03-10 05:01:56] `frontend/src/app/globals.css` (was 7/10)
1. Adjust the `border-radius` of the `.skeleton` class to consistently use a value of `1rem` or greater, ideally `var(--radius)` or `var(--radius-lg)` to align with the global standard. 2. Implement global letter-spacing rules for headings (e.g., `h1` through `h6`) to `-0.03em` and create a utility class (e.g., `.label-uppercase`) for elements that commonly use uppercase text with a `0.1em` letter-spacing. 3. Consider refining the `body::before` ambient glow to predominantly feature a single primary accent color, or clarify in documentation how these subtle, multi-color atmospheric effects align with the 'one accent per section' design philosophy.
[38;5;114m+12[0m [38;5;203m-1[0m lines

### [2026-03-10 05:02:29] `frontend/src/components/ui/card.tsx` (was 7/10)
Refactor the `Card` component to consistently apply the visual properties of the `.apple-card` utility class. This could involve either directly applying the `.apple-card` utility class to the `motion.div` element, or ensuring that the explicit Tailwind classes and `glass-subtle` variant used within `Card` perfectly mirror the `.apple-card`'s definitions. Additionally, update the `.apple-card` utility in `globals.css` to use a `var(--radius)` token for its `border-radius` to align with the design system's radius variables.
[38;5;114m+9[0m [38;5;203m-8[0m lines

### [2026-03-10 05:03:51] `frontend/src/components/ui/table.tsx` (was 7/10)
1. **Refine Table Row Rounded Corners:** Implement a strategy to apply `1rem+` rounded corners to individual table rows, or at least the first/last visible rows, to better align with the 'card-based layout' and 'rounded corners everywhere' philosophy. This may require adjusting `border-spacing` or using more advanced CSS techniques. 2. **Standardize Shadow Tokens:** Replace all hardcoded `boxShadow` values with the appropriate CSS variables (e.g., `var(--shadow-glow-cyan)`, `var(--shadow-card)`) defined in `globals.css` to ensure a consistent and maintainable elevation system. 3. **Integrate Skeleton Loader:** Add an `isLoading: boolean` prop to the `Table` component to conditionally render a skeleton version of table rows and cells when data is loading, adhering to optimistic UI principles. 4. **Explore Sticky Column Pattern:** Research and implement a pattern for sticky/frozen columns, ensuring they also benefit from `backdrop-blur` and correct `z-index` layering as per the TradingView standard.
[38;5;114m+196[0m [38;5;203m-20[0m lines

### [2026-03-10 05:04:26] `frontend/src/components/momentum/leaderboard.tsx` (was 7/10)
1. Refactor `LeaderboardItem` to include `backdrop-filter` (e.g., using `glass-subtle` class) on its base and hover states to fully achieve a consistent glassmorphic interaction. 2. Implement a Framer Motion-driven flash animation for the numeric score, triggering when the underlying `composite` signal value updates. 3. Redesign the 'No signals to display' message with a premium icon (e.g., from an SVG library), refined typography, and possibly a subtle background illustration. 4. Explore badge or icon-based designs for the `auraLabel` to provide a more distinct and visually appealing indicator.
[38;5;114m+107[0m [38;5;203m-49[0m lines

### [2026-03-10 05:05:58] `frontend/src/components/momentum/sentiment-badge.tsx` (was 7/10)
1. Apply `box-shadow: var(--shadow-soft);` to the badge's `span` element to give it subtle depth. 2. Implement a CSS `transition` on `box-shadow` and `transform` properties, adding a `hover:translate-y-[-1px] hover:shadow-card` (or similar) to provide a nuanced interactive experience without Framer Motion for this component.
[38;5;114m+3[0m [38;5;203m-2[0m lines

### [2026-03-10 05:06:36] `frontend/src/components/momentum/mini-signal-list.tsx` (was 7/10)
Refactor the inline `style` for `dailyChangeColor` to use dynamic Tailwind classes via `cn`. Create a new CSS custom property in `globals.css` (e.g., `--card-hover-accent-bg`) for the subtle hover background tint, replacing the inline hex-to-rgba conversion. Implement a micro-animation (e.g., a brief background pulse or text color flash) on `daily_change` and `price` elements whenever their values update, leveraging Framer Motion's `key` prop on specific data elements or a dedicated state-driven animation.
[38;5;114m+105[0m [38;5;203m-32[0m lines

### [2026-03-10 05:07:40] `frontend/src/components/momentum/quote-rotator.tsx` (was 7/10)
1. Update the component's `div` to use `shadow-[var(--shadow-card)]` for proper depth and elevation. 2. Replace `backdrop-blur-xl` with `glass` or `glass-heavy` for consistent glassmorphism. 3. Remove `duration: 0.3` from the Framer Motion `motionProps.transition` object. 4. Align the `bg-card` opacity with the `apple-card` standard by using `bg-card/80` or explicitly setting it to `0.45` via a custom utility, or update `globals.css` if `bg-card` is meant to be lighter. 5. Refine the author's `tracking-tight` to precisely `-0.03em` if possible via custom Tailwind configuration or inline style for exact typographic adherence.
[38;5;114m+8[0m [38;5;203m-5[0m lines

### [2026-03-10 05:08:21] `frontend/src/components/layout/app-shell.tsx` (was 7/10)
1. Remove the `border border-border` from the hamburger button, relying on its `bg-card/80`, `glass`, and sophisticated `box-shadow` for definition. 2. Implement the `Sidebar`'s mobile display using the `components/ui/sheet.tsx` component to provide a proper mobile-native bottom/side sheet modal. 3. Extract the `initial`, `whileHover`, and `transition` Framer Motion properties into `useMemo` hooks or constants for improved code clarity.
[38;5;114m+63[0m [38;5;203m-30[0m lines

### [2026-03-10 05:09:29] `frontend/src/hooks/use-signals.ts` (was 7/10)
1. Improve the type safety of sortable keys by either dynamically deriving `ValidSortKey` from the `Signal` interface's `string | number` properties or by enforcing a strict validation mechanism that clearly links sortable columns to defined properties. 2. Enhance the `selectedTicker` management to re-evaluate its validity when `data.signals` changes, automatically selecting a new default (e.g., the first signal) or resetting to `null` if the previously selected ticker is no longer available. 3. Refactor the `setError` mechanism to accept a more structured error object, allowing for richer, user-facing error messages and internal logging details separately.
[38;5;114m+100[0m [38;5;203m-39[0m lines

### [2026-03-10 05:09:47] `frontend/src/hooks/use-strategy.ts` (was 7/10)
1. Implement Real-time Backtest Progress: Enhance `executeBacktest` to listen for progress updates (e.g., via a WebSocket connection or long-polling if the API supports it) and expose a `progress` state (e.g., `0-100%`, `currentStepMessage`). 2. Align API Service Types: Update `services/api.ts` and associated type definitions (`types/momentum.ts`) to fully conform to the refined interfaces, eliminating the need for `as` type assertions. 3. Standardize CRUD Operation Feedback: Introduce clear statuses (e.g., `saveStatus: 'idle' | 'saving' | 'success' | 'error'`) and structured error handling for `save`, `load`, and `remove` operations. 4. Centralize Constants: Extract the hardcoded `10` used for `getBacktestHistory` into `lib/constants.ts`.
[38;5;114m+159[0m [38;5;203m-66[0m lines

### [2026-03-10 05:10:25] `frontend/src/components/ui/badge.tsx` (was 8/10)
Extract the Framer Motion animation properties for `whileHover`, `whileTap`, and `whileFocus` into `useMemo` hooks or external constants. This will ensure consistency with stated technical standards and previous codebase improvements, preventing unnecessary object recreation on renders.
[38;5;114m+49[0m [38;5;203m-35[0m lines

### [2026-03-10 05:10:44] `frontend/src/components/momentum/strategy-card.tsx` (was 8/10)
Adjust the `border-radius` of the directional indicator `div` to precisely match the parent `AppleCard`'s `border-radius` (1.25rem, likely achievable with `rounded-l-xl` if `rounded-xl` maps to `var(--radius-lg)` or by directly applying a custom value) to ensure visual consistency.
[38;5;114m+23[0m [38;5;203m-14[0m lines

### [2026-03-10 05:35:42] `frontend/src/components/ui/input.tsx` (was 4/10)
1. Increase the input's height to at least `min-h-[44px]` to meet touch target requirements. 2. Correct the typography scaling to `text-xs sm:text-sm md:text-base` (or similar) to align with mobile-first and global typographic standards. 3. Integrate `box-shadow` (e.g., `shadow-[var(--shadow-soft)]` default, `shadow-[var(--shadow-elevated)]` on focus/hover) for subtle depth. 4. Implement hover/focus micro-animations for `translateY`, shadow elevation, and a border glow using CSS transitions or Framer Motion. 5. Apply `glass-subtle` or a direct `backdrop-filter` class to the input, and re-evaluate `dark:bg-input/30` to correctly achieve desired translucency. 6. Adjust `border-input` to use `border-border` or a more subtle opacity for its default state.
[38;5;114m+74[0m [38;5;203m-12[0m lines

### [2026-03-10 05:36:22] `frontend/src/components/momentum/leaderboard.tsx` (was 4/10)
Refactor Framer Motion props into useMemo, fix the scrolling header, standardize color usage with Tailwind theme or CSS variables, consolidate aura styling with constants, and address typographic and magic string inconsistencies.
[38;5;114m+83[0m [38;5;203m-51[0m lines

### [2026-03-10 05:38:05] `frontend/src/components/ui/card.tsx` (was 5/10)
Refactor the padding strategy for `Card` and its sub-components to ensure consistent and predictable spacing. Standardize border-radius values across `apple-card` and all related sub-elements for pixel precision. Re-evaluate `CardFooter` background for strict adherence to a single tonal surface. Adjust `CardHeader` vertical spacing to enhance typographic breathing room. Remove the redundant border declaration for non-interactive cards.
[38;5;114m+34[0m [38;5;203m-22[0m lines

### [2026-03-10 05:38:48] `frontend/src/components/ui/table.tsx` (was 5/10)
Refactor the `Table` and `TableBody` components to ensure `TableHeader`, `TableFooter`, and `TableCaption` always render, regardless of the `isLoading` state. Only the content within the `TableBody` should conditionally render actual rows or skeleton rows based on `isLoading`. Additionally, standardize shadow application across all sticky and interactive elements to consistently use Tailwind's `shadow-[var(...)]` syntax, deprecating direct `style={{ boxShadow: ... }}` usage. Review and potentially remove the generic `transition-all` from `TableRow` to rely solely on Framer Motion for controlled animations.
[38;5;114m+79[0m [38;5;203m-80[0m lines

### [2026-03-10 05:40:14] `frontend/src/components/momentum/mini-signal-list.tsx` (was 5/10)
1. **Refine Typography:** Increase font sizes for `ticker` and `daily_change` to `text-lg` or `text-xl` and `price` to `text-sm` to truly make numbers 'art' and enhance hierarchy. Remove `tracking-tight` from `font-mono-data` elements to maintain monospace legibility. 
2. **Enhance `FlashValue`:** Implement a much more subtle flash animation (e.g., a faint background tint like `rgba(6, 182, 212, 0.1)` or `rgba(148, 163, 184, 0.08)`) and avoid inverting text colors. Update `rounded-sm` to `rounded-lg` or `rounded-xl` for consistent rounded corners. 
3. **Perfect `MiniSignalListItem` Hover State:** Define a new CSS custom property (e.g., `--card-hover-accent-bg`) in `globals.css` for the hover background tint and use it via Tailwind, replacing the inline JS calculation. Add `glass-subtle` or similar `backdrop-blur` to the item's `whileHover` state. Adjust the `box-shadow` on hover to `var(--shadow-card)` combined with `var(--shadow-glow-cyan)` for a more nuanced elevation. 
4. **Optimize Framer Motion:** Extract the `transition` object from `MiniSignalListItem`'s `motion.div` into a `useMemo` hook or constant. 
5. **Elevate 'No Signals' UI:** Replace the current SVG icon with a more premium, custom, or contextually relevant icon to match the product's aesthetic aspirations.
[38;5;114m+40[0m [38;5;203m-25[0m lines

### [2026-03-10 05:40:51] `frontend/src/components/ui/dialog.tsx` (was 5/10)
General improvement
[38;5;114m+77[0m [38;5;203m-60[0m lines

### [2026-03-10 05:42:32] `frontend/src/components/momentum/strategy-card.tsx` (was 5/10)
General improvement
[38;5;114m+30[0m [38;5;203m-30[0m lines

### [2026-03-10 05:43:24] `frontend/src/components/momentum/yield-table.tsx` (was 5/10)
General improvement
[38;5;114m+166[0m [38;5;203m-116[0m lines

### [2026-03-10 05:44:42] `frontend/src/hooks/use-backtest.ts` (was 5/10)
General improvement
[38;5;114m+46[0m [38;5;203m-48[0m lines

### [2026-03-10 05:45:31] `frontend/src/hooks/use-signals.ts` (was 5/10)
General improvement
[38;5;114m+62[0m [38;5;203m-24[0m lines

### [2026-03-10 05:48:02] `frontend/src/app/receipts/page.tsx` (was 6/10)
1. **Refactor `useEffect` for data fetching and real-time updates:** Modify the `useEffect` to fetch data once on mount, and separate the real-time update logic into an interval that uses functional `setData` updates and does not depend on the `data` state itself, preventing unnecessary interval re-creations. 2. **Harmonize table row and header styling:** Consolidate the `rounded-xl` logic so that `motion.tr` is solely responsible for row-level rounding. For sticky headers, ensure the full header row behaves as a single rounded element that visually 'attaches' to the `AppleCard` container, particularly when horizontally scrolled. 3. **Correct Framer Motion `transition` properties:** Remove all `duration` properties from Framer Motion `transition` objects when using `type: 'spring'` to ensure consistent and correct spring-physics-driven animations. 4. **Improve table accessibility:** Add `scope='col'` to all `th` elements in the table header for enhanced semantic correctness and accessibility.
[38;5;114m+52[0m [38;5;203m-41[0m lines

### [2026-03-10 05:48:36] `frontend/src/components/ui/tabs.tsx` (was 6/10)
Refactor `TabsTrigger` to use appropriate `var(--shadow-...)` tokens for hover `boxShadow` and extract `whileHover`/`whileTap` Framer Motion properties into memoized constants. Adjust the focus ring to use `focus-visible:ring-primary` or a dedicated Tailwind color utility. Update `TabsList` to use the `glass-subtle` utility class. Harmonize `TabsContent` animations to match the `y 20->0` standard for entry/exit.
[38;5;114m+25[0m [38;5;203m-16[0m lines

### [2026-03-10 05:49:26] `frontend/src/components/ui/button.tsx` (was 6/10)
Refactor the Framer Motion implementation to solely leverage its declarative API. Remove the `animate` prop that targets `currentY.current` and `currentShadow.current`, and delete the `onHoverStart/End` and `onFocus/Blur` event handlers responsible for manually updating these refs for animation. Define the button's default state entirely within the `initial` prop, and rely on the `whileHover` and `whileFocus` props to declaratively define their respective states. When hover or focus ends, Framer Motion will automatically transition back to the `initial` state. Additionally, extract the `hoverProps` and `focusProps` into `useMemo` hooks or external constants to prevent unnecessary object recreation.
[38;5;114m+28[0m [38;5;203m-69[0m lines

### [2026-03-10 05:50:26] `frontend/src/components/ui/select.tsx` (was 6/10)
1. Replace all hardcoded shadow values and Tailwind `shadow-*` classes with appropriate CSS shadow variables from `globals.css`. 2. Extract Framer Motion `transition` objects in `SelectContent` and `SelectItem` to `useMemo` hooks or constants. 3. Refactor `SelectTrigger` to use Framer Motion for its hover animation, applying the specified `translateY(-2px)` and elevated shadow. 4. Update `SelectContent` (desktop) to use a suitable `glass` utility class. 5. Adjust `SelectItem` vertical padding to ensure it meets the 44x44px touch target requirement.
[38;5;114m+44[0m [38;5;203m-32[0m lines

### [2026-03-10 05:51:06] `frontend/src/components/momentum/regime-badge.tsx` (was 6/10)
1. Resolve the border conflict by removing the `border` property from `REGIME_STYLES` in `constants.ts` if borders are truly not desired, or update the badge to consistently use a very subtle border (e.g., `border-[var(--border)]`) if minimal definition is needed. 2. Apply `box-shadow: var(--shadow-soft);` to the `motion.span` element for consistent elevation and depth. 3. Implement a `whileHover` animation, adding `translateY(-1px)` and updating `box-shadow` to `var(--shadow-card)` (and potentially `var(--shadow-glow-cyan)` if applicable), aligning with `sentiment-badge.tsx` improvements. 4. Extract `initial`, `animate`, and `transition` Framer Motion objects into `useMemo` hooks or external constants to improve performance and maintain consistency across UI components. 5. Introduce responsive padding (e.g., `px-3 py-2.5 sm:px-4 sm:py-3.5`) to ensure appropriate sizing across mobile and desktop breakpoints.
[38;5;114m+36[0m [38;5;203m-6[0m lines

### [2026-03-10 05:51:41] `frontend/src/components/momentum/rotation-signals.tsx` (was 6/10)
Refactor inline color styles and Framer Motion `whileHover` objects into compliant Tailwind classes and `useMemo` hooks. Standardize the hover background color to use existing CSS variables. Implement subtle flash animations for updating numeric data. Redesign the empty state message for a premium visual experience.
[38;5;114m+72[0m [38;5;203m-19[0m lines

### [2026-03-10 05:52:11] `frontend/src/components/layout/topnav.tsx` (was 6/10)
1. Refactor both `TopNavItem` and the logo's `motion.div` to extract their `whileHover` Framer Motion prop objects into `useMemo` hooks or external constants. 2. Update the logo's base shadow to use a CSS variable from `globals.css` (e.g., `shadow-[var(--shadow-soft)]` or a more specific custom variable for tinted shadows). 3. Adjust the main `nav` background to use a `bg-card` based class (e.g., `bg-card/85`) to ensure its color and translucency align with the established dark-mode palette and glassmorphic aesthetic.
[38;5;114m+20[0m [38;5;203m-16[0m lines

### [2026-03-10 05:53:08] `frontend/src/components/charts/elder-chart.tsx` (was 6/10)
1. Implement responsive font sizing for `lightweight-charts` labels, potentially by dynamically calculating `fontSize` based on screen size or using `rem` values if the library supports it. 2. Unify all Framer Motion transitions to use spring physics (`stiffness=300, damping=30`) for a consistent, premium animation feel across all states (loading, no data, entry). 3. Refactor hardcoded chart colors within `createChart` to consistently use CSS variables or `COLORS` constants from `lib/constants.ts`. 4. Enhance the `NoDataPlaceholder` with a premium SVG icon and potentially a subtle background treatment to create a more engaging empty state. 5. Introduce a subtle flash animation (e.g., a momentary background tint or bar animation) on the histogram bars when their values update, aligning with TradingView's real-time update standard. 6. Review and adjust the `apple-card` definition in `globals.css` or create a specific borderless variant to remove the `!border-none` override for this component.
[38;5;114m+91[0m [38;5;203m-30[0m lines

### [2026-03-10 05:54:19] `frontend/src/lib/constants.ts` (was 6/10)
1. Establish Single Source of Truth for Colors: Consolidate all color definitions into a single, canonical location (e.g., exclusively in `globals.css` as CSS custom properties). Update `constants.ts` to either derive these values programmatically at runtime (if `as const` is not a hard requirement for all values) or ensure a strict build-time synchronization process. Crucially, resolve the inconsistency in the `card` color's opacity, making sure both `globals.css` and `constants.ts` (if it must exist) reflect the same, correct `rgba(15,23,42,0.45)`. 2. Upgrade Navigation Icons: Replace all emoji icons in `SIDEBAR_NAV` with a curated set of vector-based icons (e.g., custom SVGs or a high-quality icon library like Feather Icons or similar to SF Symbols), ensuring visual consistency, crispness, and scalability across all devices. 3. Complete Constant Consolidation: Review the codebase for any remaining hardcoded values (like the `10` for `getBacktestHistory`) and systematically move them into `lib/constants.ts`, ensuring this file serves its intended purpose as a comprehensive central repository for application-wide constants.
[38;5;114m+28[0m [38;5;203m-23[0m lines

### [2026-03-10 05:54:39] `frontend/src/app/globals.css` (was 7/10)
1. Standardize `--card` custom property and `.apple-card` background opacity to a single, consistent value, preferably `0.45` if that's the desired translucency for the Apple-style card. 2. Re-evaluate the `body::before` ambient gradient. Consider making one of the accent colors more dominant or transitioning the gradient to feature primarily the `--primary` accent to align more strictly with the 'one accent color' principle. 3. Explicitly define `var(--font-mono)` in `:root` within `globals.css` (assuming `JetBrains Mono` font is imported elsewhere) to ensure `font-mono-data` is robust. 4. Remove the redundant `.horizontal-scroll-on-mobile` class and rely solely on the `overflow-x-auto` Tailwind utility or consolidate into a single, clearly named utility.
[38;5;114m+10[0m [38;5;203m-7[0m lines

### [2026-03-10 05:56:07] `frontend/src/components/ui/apple-card.tsx` (was 7/10)
Refactor `whileHover`'s `boxShadow` to apply a single, cohesive elevation and accent glow, directly utilizing CSS variables like `var(--shadow-elevated)` and a selected `var(--shadow-glow-*)` based on a named accent key. Align the inner glow shimmer's opacity transition duration with Framer Motion's spring-driven animations. Implement responsive padding for the card (e.g., `p-4 sm:p-6`) for better mobile-first adherence. Revise `glowColor` prop to accept named accent keys from `constants.ts`.
[38;5;114m+36[0m [38;5;203m-41[0m lines

### [2026-03-10 05:56:19] `frontend/src/components/ui/tooltip.tsx` (was 7/10)
1. Extract all Framer Motion animation properties (`initial`, `animate`, `exit`, `transition`) into `useMemo` hooks or external constants within `TooltipContent` to ensure they are not redefined on every render. 2. Increase the `border-radius` of the `TooltipPrimitive.Arrow` to be more visually consistent with the overall `1rem+` rounding strategy, for example, `rounded-sm` or a custom `rounded-[4px]` value.
[38;5;114m+17[0m [38;5;203m-15[0m lines

### [2026-03-10 05:57:48] `frontend/src/components/momentum/screener-table.tsx` (was 7/10)
1. Refine table row styling to apply `border-radius: var(--radius-lg)` to the first and last visible `<tr>` elements, or implement a card-like visual for each row for a true 'card-based layout' feel. 2. Implement a sticky left column for the 'Ticker' to enhance usability, leveraging the `sticky` and `left-0` CSS properties with appropriate `z-index` and `backdrop-blur`. 3. Adjust skeleton loader elements in `ScreenerTableSkeleton` to use `rounded-xl` (or `var(--radius-lg)`) for consistent rounding. 4. Modify `FlashCell` to use a more neutral and subtle background color (e.g., a very faint slate/background tint) for data updates that are not explicitly positive or negative, to ensure the primary accent color is reserved for significant directional changes. 5. Increase table header font size to `text-sm` at the smallest breakpoint to improve legibility and align with premium typography standards. 6. Adjust `FlashCell` to remove its internal `py-3`, allowing the parent `<td>` to dictate vertical padding for consistent row height and spacing.
[38;5;114m+59[0m [38;5;203m-52[0m lines

### [2026-03-10 05:58:25] `frontend/src/components/momentum/top-signals.tsx` (was 7/10)
1. Refactor the inline `style` for `daily_change` into dynamic Tailwind classes using `cn` or a utility function mapping colors to Tailwind text classes. 2. Move the `variants` object for `FlashOnChange` outside the component or `useMemo` it. 3. Implement `AnimatePresence` around the `bulls.map` to enable proper exit animations for list items. 4. Redesign the 'No signals' message with an appropriate icon, elevated typography, and a subtle background for a premium empty state. 5. Adjust the `FlashOnChange` background effect to use `rounded-xl` for consistent rounded corners. 6. Fine-tune the skeleton loader dimensions to more accurately match the loaded content heights to prevent layout shifts. 7. Revisit the scrollable container's padding to handle scrollbar gutters more elegantly.
[38;5;114m+132[0m [38;5;203m-56[0m lines

### [2026-03-10 05:59:29] `frontend/src/components/momentum/backtest-results.tsx` (was 7/10)
Refactor `Card` component usage to be consistent, either by making `Card` itself glassmorphic or by consistently applying `apple-card` utility. Implement rounded corners for table rows. Convert all inline style objects for colors to dynamic Tailwind classes using `cn`. Harmonize letter-spacing for headings to match the `globals.css` definition. Simplify the 'Coming Soon' placeholder animation to be subtle or static.
[38;5;114m+165[0m [38;5;203m-126[0m lines

### [2026-03-10 05:59:49] `frontend/src/components/momentum/quote-rotator.tsx` (was 7/10)
Refactor the letter-spacing style into a Tailwind utility class. Move the `motionProps` object outside the component to a top-level constant. Implement `aria-live='polite'` on the `motion.div` element to announce quote changes to assistive technologies.
[38;5;114m+16[0m [38;5;203m-16[0m lines

### [2026-03-10 06:00:38] `frontend/src/components/charts/equity-chart.tsx` (was 7/10)
1. Apply the `apple-card` class to the `motion.div` that wraps the chart title and the `containerRef` to ensure consistent glassmorphism and elevation. 2. Add `overflow-hidden` to this same `motion.div` to correctly clip the chart canvas within its rounded borders. 3. Ensure the chart drawing area (`containerRef`) respects the card's internal padding by applying consistent responsive horizontal padding, matching the title's `px-` values.
[38;5;114m+48[0m [38;5;203m-41[0m lines

### [2026-03-10 06:01:22] `frontend/src/components/charts/price-chart.tsx` (was 7/10)
1. Update `timeScale` and `rightPriceScale` options to explicitly use `JetBrains Mono` via a CSS variable (e.g., `var(--font-mono)`) for numeric labels. 2. Increase the font size and potentially weight of the 'Price Performance' `h3` title to align with 'massive hierarchy' and 'bold typography' standards. 3. Implement subtle visual flashes or micro-animations on the latest price/HMA values when their data updates to signify real-time changes. 4. Extract all Framer Motion `transition` objects into `useMemo` hooks or dedicated constants for performance and maintainability. 5. Standardize all `ChartSkeleton` internal rounded corners to use `var(--radius-lg)` (via `rounded-xl` if mapped correctly in Tailwind config). 6. Simplify chart loading logic by removing or refining the `isChartReady` state, relying primarily on the `isLoading` prop and `data` presence.
[38;5;114m+58[0m [38;5;203m-42[0m lines

### [2026-03-10 06:02:40] `frontend/src/services/api.ts` (was 7/10)
1. Modify `apiFetch` to first attempt parsing the response body as JSON for non-OK responses, falling back to text parsing if JSON parsing fails. Update the `ApiError.body` type to `unknown` to accommodate structured error objects. 2. Introduce a configurable logging utility to replace `console.error` calls within `apiFetch`, enabling centralized error tracking for production environments.
[38;5;114m+38[0m [38;5;203m-11[0m lines

### [2026-03-10 06:02:49] `frontend/src/components/ui/apple-button.tsx` (was 8/10)
Refactor the `AppleButton` component to extract the Framer Motion `whileHover`, `whileTap`, and `transition` objects into `useMemo` hooks. This aligns with technical standards for performance and maintains consistency with codebase patterns.
[38;5;114m+30[0m [38;5;203m-20[0m lines

### [2026-03-10 06:04:50] `frontend/src/components/momentum/sentiment-badge.tsx` (was 8/10)
1. Integrate `glass-subtle` or a custom `backdrop-filter` class into the badge's `cn` utility for true glassmorphism. 2. Remove the unused `border` property from `SENTIMENT_STYLES` in `constants.ts` to maintain consistency, or apply it if deemed necessary for visual separation while adhering to 'minimal borders'. 3. Re-evaluate and adjust the letter-spacing for the sentiment text to either `tracking-normal` or a custom, tighter value, aligning with the typographic precision guidelines for non-uppercase text.
[38;5;114m+17[0m [38;5;203m-6[0m lines

### [2026-03-10 06:05:29] `frontend/src/components/momentum/ticker-search.tsx` (was 8/10)
Refactor the search input and dropdown to leverage the `glass` utility classes. Enhance the general loading spinner with Framer Motion for a more fluid and premium animation. Standardize hover background colors to use existing Tailwind utilities or CSS variables. Consolidate interactive element transitions, especially focus states, to Framer Motion for consistent spring physics.
[38;5;114m+85[0m [38;5;203m-86[0m lines

### [2026-03-10 06:29:16] `frontend/src/components/momentum/signal-table.tsx` (was 2/10)
Refactor all animations to use `transform` properties instead of `width` and `height` for optimal performance. Adjust the `RealtimeFlashValue` to use a neutral background flash for general updates and reserve accent colors for directional changes. Standardize all rounded corners across the component to `rounded-xl` or `rounded-2xl` (1rem+) for visual cohesion. Enhance table rows with a more distinct card-like appearance and appropriate `border-radius`. Increase table header font size to `text-sm` or `text-base` for improved legibility. Eliminate all inline style objects and extract Framer Motion `whileHover` props into external constants or `useMemo` hooks. Re-evaluate `CollapsibleTier` implementation to maintain semantic table structure during animation. Ensure skeleton loaders match the consistent rounding.
[38;5;114m+101[0m [38;5;203m-89[0m lines

### [2026-03-10 06:30:07] `frontend/src/components/ui/apple-card.tsx` (was 4/10)
1. Define `ACCENT_COLOR_KEYS_FOR_GLOW` in `constants.ts` as an array of literal strings reflecting the valid accent color keys from the `COLORS` object. 2. Wrap the conditional `innerGlow shimmer` `motion.div` with `Framer Motion`'s `AnimatePresence` component to ensure its `exit` animation runs smoothly. 3. Consider refactoring the `innerGlow` background color to use `rgba(var(--color-mo-${glowColor}-rgb), 0.08)` for improved readability and maintainability, adjusting the opacity for a slightly more perceptible yet still subtle glow effect if deemed appropriate.
[38;5;114m+83[0m [38;5;203m-42[0m lines

### [2026-03-10 06:35:36] `frontend/src/components/layout/topnav.tsx` (was 4/10)
1. Implement a dedicated icon component that can interpret and render SF Symbol-like strings as visual icons. 2. Define `TOP_NAV_LINKS` and the `TopNavItemData` interface within `constants.ts`. 3. Refactor `TopNavItem` to simplify the `whileHover` prop by moving only the `transition` object to `useMemo` and applying `y` and `boxShadow` directly within the `whileHover` prop for better clarity.
[38;5;114m+68[0m [38;5;203m-27[0m lines

### [2026-03-10 06:36:27] `frontend/src/components/ui/sheet.tsx` (was 5/10)
General improvement
[38;5;114m+91[0m [38;5;203m-38[0m lines

### [2026-03-10 06:36:54] `frontend/src/components/ui/tooltip.tsx` (was 5/10)
General improvement
[38;5;114m+5[0m [38;5;203m-26[0m lines

### [2026-03-10 06:38:55] `frontend/src/app/receipts/page.tsx` (was 6/10)
1. Extract all recurring Framer Motion `transition` objects into `useMemo` hooks or top-level constants. 2. Refactor table rows to achieve a true card-based layout per row using semantic HTML and robust CSS (e.g., wrapper `div`s for each row's content or a CSS Grid solution for the table body). 3. Implement a sticky left column for the 'Ticker' in the receipt log table. 4. Remove hover animations from skeleton table rows. 5. Refine the flash animation color for data updates, potentially using a neutral background tint for non-directional changes.
[38;5;114m+196[0m [38;5;203m-136[0m lines

### [2026-03-10 06:40:14] `frontend/src/app/dashboard/page.tsx` (was 6/10)
1. Implement Framer Motion `motion.div` wrappers around each major `activePage` content block to enable smooth page transitions as specified. 2. Refactor all main headings to use larger font sizes, heavier weights, and `tracking-tight` (`-0.03em`) letter-spacing for a more impactful visual hierarchy. 3. Replace all literal emojis with custom SVG icons or appropriate SF Symbol placeholders to align with the premium design aesthetic. 4. Implement `dynamic import()` for all chart components to lazy load them, enhancing initial page performance. 5. Consolidate accent color usage for non-data UI elements within each section to a single, chosen primary accent color (e.g., cyan) to align with Apple's design philosophy.
[38;5;114m+322[0m [38;5;203m-132[0m lines

### [2026-03-10 06:41:27] `frontend/src/components/momentum/trending-sectors.tsx` (was 6/10)
1. Refactor `TrendingSectorItem` to be a self-contained, rounded card (`rounded-xl` + `bg-card/30` + `backdrop-blur` if applicable) that truly elevates and reveals its rounded shape on hover, removing the parent `divide-y` and managing its own spacing. 2. Update `TrendingSectorsSkeleton` to use `rounded-xl` for all its placeholder elements. 3. Consolidate `bullPctColorClass` determination in `TrendingSectorItem` to leverage or consistently map to `SENTIMENT_STYLES` from `constants.ts`. 4. Migrate the `zIndex` adjustment for the hover effect into Framer Motion `variants` for a more declarative and performant approach.
[38;5;114m+56[0m [38;5;203m-44[0m lines

### [2026-03-10 06:42:13] `frontend/src/components/momentum/ticker-modal.tsx` (was 6/10)
Address critical animation performance and technical standard violations by using `transform: scaleX()` for progress bars and memoizing Framer Motion properties. Enhance mobile responsiveness by adjusting grid layouts. Improve design system consistency by moving inline styles to reusable utilities and refining animation parameters for spring physics.
[38;5;114m+41[0m [38;5;203m-36[0m lines

### [2026-03-10 06:43:34] `frontend/src/hooks/use-backtest.ts` (was 6/10)
1. Modify `services/api.ts` to update `cancelBacktest` to accept a `backtestId` and update `useBacktest` to pass the `currentBacktestId` for all cancellation requests. 2. Adjust the simulated progress logic: stop the `progressIntervalRef` and set the percentage to 90% immediately before `await runBacktest`, then set it to 100% only after the `runBacktest` promise successfully resolves. 3. Implement a centralized logging utility and replace all direct `console` calls within the hook with calls to this utility.
[38;5;114m+74[0m [38;5;203m-55[0m lines

### [2026-03-10 06:44:39] `frontend/src/hooks/use-strategy.ts` (was 6/10)
1. Refactor `services/api.ts` functions (e.g., `runBacktest`, `getBacktestHistory`) to explicitly return the exact types expected by `useStrategy`, eliminating all `as` type assertions within the hook. 2. Replace the simulated `progressIntervalRef` logic with a true real-time mechanism for backtest progress. 3. Integrate a configurable logging utility, replacing all direct `console.error` calls. 4. Ensure `progressIntervalRef.current` is consistently cleared and nulled in all execution paths.
[38;5;114m+93[0m [38;5;203m-61[0m lines

### [2026-03-10 06:45:53] `frontend/src/components/ui/dialog.tsx` (was 7/10)
Refine the visual subtlety of the dialog. Adjust the `DialogOverlay` background opacity and blur to be more transparent. Remove the border from the `DialogClose` button, relying on its inherent visual properties. Subtly reduce the prominence of the mobile drag handle. Re-evaluate header/footer separation, considering tonal surfaces or padding instead of explicit borders.
[38;5;114m+5[0m [38;5;203m-6[0m lines

### [2026-03-10 06:46:32] `frontend/src/components/ui/badge.tsx` (was 7/10)
1. Dynamically adjust the `whileFocus` `boxShadow` based on the `variant` prop, mapping to appropriate glow colors from the established palette (e.g., a `rose` badge should have a subtle `rose`-tinted glow on focus). 2. Introduce an explicit `tracking` utility class to `badgeVariants` (e.g., `tracking-tight` or a custom `letter-spacing`) to fine-tune the letter-spacing for optimal legibility, aligning with the typographic precision guidelines. 3. Refactor the rendering logic to consistently wrap the `useRender` output with `motion()` for all badges, leveraging `motion(ComponentType)` to ensure all badges benefit from Framer Motion's capabilities even if not immediately interactive.
[38;5;114m+88[0m [38;5;203m-62[0m lines

### [2026-03-10 06:48:07] `frontend/src/components/momentum/strategy-builder.tsx` (was 7/10)
Refine color palette usage to adhere strictly to the "one accent per section" rule, replacing explicit borders with shadows or subtle background tints. Adjust typography scale for section titles and replace emoji icons with SF Symbol-style placeholders. Ensure consistent `border-radius` values across all relevant components and increase visual touch target sizes. Integrate the code editor's styling with the glassmorphic theme. Enhance the loading spinner and design premium empty states. Implement custom scrollbar styling.
[38;5;114m+230[0m [38;5;203m-112[0m lines

### [2026-03-10 06:49:05] `frontend/src/components/momentum/screener-table.tsx` (was 7/10)
Refactor the inline style for the progress bar's width. Revisit table row styling to introduce subtle visual separation (e.g., alternating row backgrounds, or a very faint `border-b`) to enhance the 'card-like' feel without compromising data density. Adjust the letter spacing for table headers to be tighter. Increase the vertical padding for table headers for improved visual breathing room.
[38;5;114m+144[0m [38;5;203m-59[0m lines

### [2026-03-10 06:49:33] `frontend/src/components/momentum/top-signals.tsx` (was 7/10)
Refine individual list item presentation to achieve a more distinct 'card-like' feel in their default state, resolve horizontal padding inconsistencies, add `aria-live` to dynamic data updates, and simplify `z-index` usage.
[38;5;114m+25[0m [38;5;203m-11[0m lines

### [2026-03-10 06:50:18] `frontend/src/components/momentum/mini-signal-list.tsx` (was 7/10)
Implement a dedicated icon component that correctly maps SF Symbol-like string names to actual SVG representations, ensuring the visual fidelity demanded by the Apple design philosophy. Additionally, standardize all color usage by defining a specific `secondary` token within `constants.ts` and `globals.css` if it's intended for general use, or refactor the badge's background to use an existing, appropriate color from the established palette.
[38;5;114m+147[0m [38;5;203m-26[0m lines

### [2026-03-10 06:51:18] `frontend/src/components/momentum/strategy-card.tsx` (was 7/10)
Refactor the directional indicator to a more subtle visual treatment. Implement the specified 'border glow' for hover states. Reconcile the `ticker` letter-spacing with global typographic standards. Introduce subtle flash animations for real-time data updates. Evaluate and adjust internal vertical spacing for improved visual breathing room.
[38;5;114m+59[0m [38;5;203m-18[0m lines

### [2026-03-10 06:52:11] `frontend/src/components/layout/sidebar.tsx` (was 7/10)
Refactor inline Framer Motion transitions. Replace icon string placeholders with a proper SVG/component-based icon system. Adjust horizontal padding for nav items to align with main sidebar content. Refine footer background layering. Harmonize vertical spacing for sidebar section headers.
[38;5;114m+158[0m [38;5;203m-34[0m lines

### [2026-03-10 06:53:26] `frontend/src/components/charts/elder-chart.tsx` (was 7/10)
Refine chart container styling for consistent clipping and visual layering, update empty state icon, standardize CSS variable access for colors, and fine-tune animation timing and background harmony for empty states.
[38;5;114m+12[0m [38;5;203m-13[0m lines

### [2026-03-10 06:54:09] `frontend/src/components/charts/indicator-chart.tsx` (was 7/10)
1. Define the `animate-data-flash` keyframes and its corresponding utility class in `globals.css` to enable the subtle background flash animation for real-time data updates. 2. Standardize the border-radius for chart skeleton and 'no data' states to `rounded-[var(--radius-lg)]` (or its equivalent `rounded-xl` if mapped to `var(--radius-lg)` in the Tailwind config) to ensure consistent visual language across all card-like UI elements. 3. Integrate a configurable logging utility for error reporting in `getCssVariable` to replace `console.error` for a more production-ready error handling mechanism.
[38;5;114m+50[0m [38;5;203m-43[0m lines

### [2026-03-10 06:55:46] `frontend/src/types/momentum.ts` (was 7/10)
Enhance type strictness for navigation items by defining explicit unions for `icon` (e.g., based on a predefined icon map) and `pageId` (based on `ROUTES` or actual page components). Investigate patterns for enforcing numerical ranges (e.g., branded types or Zod schemas) for critical metrics like probabilities and scores to ensure consistent data interpretation and presentation. Evaluate if `Record<string, ...>` types can be replaced with more specific key unions for known data structures.
[38;5;114m+252[0m [38;5;203m-191[0m lines

### [2026-03-10 06:56:10] `frontend/src/lib/constants.ts` (was 7/10)
Synchronize the `COLORS.card` opacity in `constants.ts` to strictly match the global design standard's `0.45`. Conduct an audit of all components using `SENTIMENT_STYLES` and `REGIME_STYLES` to confirm the `border` properties are either removed or meticulously applied to enhance without cluttering, adhering to 'minimal borders'. Document the intended usage of the broader color palette to ensure it complements the primary accent without overwhelming the 'monochrome with one accent' principle in UI sections where data visualization isn't the primary focus.
[38;5;114m+15[0m [38;5;203m-11[0m lines

### [2026-03-10 06:56:58] `frontend/src/app/page.tsx` (was 8/10)
Refactor inline color styles within `LiveSignalRow` and `mainCharMetrics` to use `cn` with dynamic Tailwind classes. Adjust the hero subtitle's letter-spacing to a tighter value (e.g., `0.1em`). Re-evaluate `MomentumPhaseBadge` styling to integrate with `constants.ts` for better consistency and explore achieving its visual separation without an explicit border if possible.
[38;5;114m+13[0m [38;5;203m-13[0m lines

### [2026-03-10 06:57:32] `frontend/src/components/ui/card.tsx` (was 8/10)
Address the CardFooter border, improve CardTitle's semantic structure, and refactor the interactive boxShadow into a dedicated Tailwind utility class for better consistency and maintainability.
[38;5;114m+3[0m [38;5;203m-3[0m lines

### [2026-03-10 06:58:30] `frontend/src/components/ui/separator.tsx` (was 8/10)
Re-evaluate the philosophical approach to visual separation, exploring alternatives to a literal line. If a line remains, refine its visual presence with a gradient fade or subtle `backdrop-blur` where appropriate. Ensure consistency in applying rounded corner tokens throughout the UI.
[38;5;114m+26[0m [38;5;203m-17[0m lines

### [2026-03-10 06:58:47] `frontend/src/components/ui/button.tsx` (was 8/10)
Refactor the `spring` constant into `lib/constants.ts`. Improve the readability of the `cva` definition by splitting the class string. Rename `glowShadow` to a more descriptive `interactiveGlowShadow`.
[38;5;114m+19[0m [38;5;203m-19[0m lines

### [2026-03-10 06:59:48] `frontend/src/components/ui/input.tsx` (was 8/10)
1. Modify the `Input` component to conditionally apply `font-mono` when `type` is 'number' or a similar numerical input type. 2. Add `transition-[border-color,box-shadow]` to the `cn` utility to ensure a smooth animation when the `aria-invalid` state changes. 3. Re-evaluate the `focus-visible` styles to ensure a clear yet subtle indicator, potentially a slightly bolder (but still minimal) border or a more defined glow, for enhanced accessibility.
[38;5;114m+13[0m [38;5;203m-28[0m lines

### [2026-03-10 07:01:11] `frontend/src/components/momentum/ticker-search.tsx` (was 8/10)
1. Refactor the input's focus state to leverage Framer Motion and `springPhysics` for its visual transitions, ensuring a consistent motion language across all interactive elements. 2. Adjust the `LoadingSpinner` implementation by moving `AnimatePresence` to wrap its conditional rendering in the `TickerSearch` component, ensuring the spinner has proper entry and exit animations. 3. Update the `itemHoverVariants` to utilize the `bg-cyan-500/10` Tailwind utility class for hover backgrounds, aligning with the project's utility-first styling approach.
[38;5;114m+206[0m [38;5;203m-136[0m lines

### [2026-03-10 07:01:41] `frontend/src/components/momentum/quote-rotator.tsx` (was 8/10)
Adjust the letter-spacing on the author's name to `tracking-normal` or `0em` to strictly adhere to the defined typographic hierarchy and letter-spacing guidelines for optimal readability and aesthetic balance.
[38;5;114m+1[0m [38;5;203m-1[0m lines

### [2026-03-10 07:02:13] `frontend/src/hooks/use-signals.ts` (was 8/10)
1. Refine the `loadData` function's error handling to explicitly differentiate between true API errors and successfully retrieved, but empty, datasets. This may involve ensuring `fetchDashboardData` consistently returns a `DashboardData` object with an empty `signals` array (`{ signals: [] }`) instead of `null` or `undefined` when no signals are present. This allows the UI to render an appropriate empty state. 2. Replace the `console.error` in `loadData` with a custom, configurable logging utility to centralize error reporting, aligning with the established technical standards for production environments. 3. Modify the `sortedSignals` `useMemo` to include explicit logic for `NaN` values during numeric comparisons, ensuring their deterministic placement within the sorted array (e.g., always at the end) to enhance data reliability and predictability.
[38;5;114m+29[0m [38;5;203m-15[0m lines

### [2026-03-10 07:03:03] `frontend/src/lib/utils.ts` (was 8/10)
Investigate creating a specialized `cn` wrapper or a companion utility that offers stronger type inference or validation for design system tokens defined in `constants.ts` and `globals.css`, ensuring developers adhere strictly to the intended visual language. This could involve using template literal types for Tailwind classes or utility functions for specific design properties, making incorrect class usage harder at compile time.
[38;5;114m+103[0m [38;5;203m-0[0m lines

### [2026-03-10 07:28:40] `frontend/src/app/dashboard/page.tsx` (was 4/10)
1. Replace emoji-based `SF_SYMBOLS` with an actual SF Symbol integration or a meticulously designed SVG icon set that truly reflects the Apple aesthetic. 2. Remove the local `getTextColorClass` helper and refactor all dynamic text color applications to exclusively use `lib/utils.ts/getTextColorClass` with `PaletteColorKey`. 3. Refactor KPI stat items to use the `Card` component for structural consistency, applying `whileHover` and other styles as props to `Card` or a dedicated `AppleCard` wrapper component. 4. Memoize the `lines` and `horizontalLines` array definitions passed to `LazyIndicatorChart` using `useMemo`.
[38;5;114m+60[0m [38;5;203m-78[0m lines

### [2026-03-10 07:29:41] `frontend/src/app/page.tsx` (was 5/10)
1. Re-architect the 'Live Signal Feed' table: Transition from styling `<tr>` elements as cards to either a `div`-based CSS Grid/Flexbox layout for card-like rows, or strictly adhere to semantic `<table>` styling by applying card-like visuals to `<td>` cells via pseudo-elements. 2. Standardize Typography Tracking: Conduct a thorough audit and consolidate `letter-spacing` values for all uppercase and label text to a consistent, meticulously chosen value (e.g., `0.1em`), ensuring strict adherence to the defined typographic hierarchy. 3. Eliminate Borders in Card Headers: Replace `border-b` in `AppleCard` headers with shadow depth, subtle background tints, or a dedicated, refined 'separator' component to achieve visual separation without explicit lines. 4. Improve Sticky Header Spacing: Replace the dummy `<tr>` with a more robust solution for sticky header spacing, such as `scroll-padding-top`, or by dynamically calculating and applying `padding-top` to the content below the sticky header. 5. Integrate `MomentumPhaseBadge` with Design Utilities: Update `MomentumPhaseBadge` to use color utilities from `lib/utils.ts` to ensure its styling is driven by the central design system for improved consistency and maintainability.
[38;5;114m+82[0m [38;5;203m-82[0m lines

### [2026-03-10 07:30:59] `frontend/src/components/ui/apple-button.tsx` (was 5/10)
1. Move `springTransition` to `lib/constants.ts` and import it into `AppleButton.tsx`. 2. Reconcile the `rounded-xl` usage: either adjust the Tailwind configuration to ensure `rounded-xl` maps to `1.4rem` (or another value `>= 1rem`), or create a custom utility class that achieves the `1rem+` standard, and update the comment accordingly. 3. Refactor the `inset` `boxShadow` value into a new CSS variable (e.g., `--shadow-glow-inset`) or a dedicated Tailwind utility class, and apply it consistently.
[38;5;114m+11[0m [38;5;203m-11[0m lines

### [2026-03-10 07:32:00] `frontend/src/components/momentum/signal-table.tsx` (was 5/10)
1. Refactor the `SignalTableRow` to resolve the visual and semantic conflict: either fully commit to distinct card-like `div` elements for each row (requiring a layout change from `<table>` to `<div>` with grid/flex) or remove `my-1` and `rounded-xl` to embrace a traditional table row appearance. 2. Correct the `CollapsibleTier`'s HTML structure: ensure its header is a `tr` containing valid `td`s (with `colSpan`) and its collapsible content renders `tr`s directly within the parent table's `tbody` (or its own fragment within that `tbody`). 3. Update `tracking-wider` to `tracking-widest` (or `0.1em`) for all uppercase text in headers and labels to align with the typographic standards. 4. Move the Framer Motion `spring` constant to `lib/constants.ts` to centralize animation physics. 5. Refine `AnimatePresence` usage for `CollapsibleSignalRows` to correctly implement `staggerChildren` for individual row entry/exit animations, and fix the syntax error.
[38;5;114m+126[0m [38;5;203m-94[0m lines

### [2026-03-10 07:33:11] `frontend/src/components/ui/select.tsx` (was 5/10)
General improvement
[38;5;114m+59[0m [38;5;203m-53[0m lines

### [2026-03-10 07:34:04] `frontend/src/components/momentum/top-signals.tsx` (was 5/10)
General improvement
[38;5;114m+84[0m [38;5;203m-77[0m lines

### [2026-03-10 07:35:32] `frontend/src/components/momentum/quote-rotator.tsx` (was 5/10)
General improvement
[38;5;114m+12[0m [38;5;203m-13[0m lines

### [2026-03-10 07:36:22] `frontend/src/components/charts/indicator-chart.tsx` (was 5/10)
General improvement
[38;5;114m+5[0m [38;5;203m-12[0m lines

### [2026-03-10 07:37:47] `frontend/src/hooks/use-backtest.ts` (was 5/10)
General improvement
[38;5;114m+68[0m [38;5;203m-22[0m lines

### [2026-03-10 07:38:07] `frontend/src/hooks/use-signals.ts` (was 5/10)
General improvement
[38;5;114m+74[0m [38;5;203m-101[0m lines

### [2026-03-10 07:39:02] `frontend/src/app/globals.css` (was 6/10)
1. **Strictly Redefine `focus-visible`:** Completely remove the generic `*` `focus-visible` styling from `globals.css`. Instead, create specific, visually refined `focus-visible` utility classes (e.g., `focus-glow-primary`, `focus-inset-border`) that leverage the existing `--shadow-glow-*` variables or a subtle tonal border for different interactive elements (buttons, inputs, links, cards). Ensure these are integrated into `Button.tsx`, `Input.tsx`, `Select.tsx`, etc., components, possibly via `cva` variants or conditional `cn` calls, to provide a branded, subtle, and consistent focus indicator across the application. This is a direct follow-up on the previously identified improvement. 2. **Refine Background Accent Usage:** Re-evaluate the `body::before` background gradient to strictly adhere to the 'monochrome with ONE accent color' principle, even for subtle ambient effects. Prioritize the primary cyan accent, or integrate the subtle secondary accents in a way that doesn't dilute the primary accent's dominance. 3. **Consolidate Border Definitions:** Update `.apple-card` to use `border: 1px solid var(--border);` to improve maintainability and adherence to DRY principles. 4. **Standardize Popover Styling:** Define explicit global styles or utility classes for popovers (`--popover`) that ensure they inherit glassmorphism, rounded corners, and elevation attributes consistent with other premium UI elements. 5. **Complete Shadow System Integration:** Ensure all defined shadow CSS variables (`--shadow-*`, `--shadow-glow-*`) have corresponding Tailwind utility classes created (e.g., `shadow-soft`, `shadow-card`, `focus-glow-cyan`) or are consistently consumed via `cn` wrappers for improved consistency, maintainability, and developer experience.
[38;5;114m+71[0m [38;5;203m-23[0m lines

### [2026-03-10 07:39:29] `frontend/src/components/ui/tabs.tsx` (was 6/10)
1. Extract `stiffness` and `damping` values for Framer Motion spring physics into `lib/constants.ts` (e.g., `SPRING_PHYSICS_DEFAULT`) and utilize this constant in `TabsTrigger` and other components. 2. Define `var(--shadow-card), var(--shadow-glow-cyan)` as a reusable Tailwind utility class or constant, then apply it to the `TabsTrigger` `whileHover` `boxShadow`. 3. Add an explicit `tracking` utility class (e.g., `tracking-normal` or `tracking-tight`) to the `TabsTrigger` text for precise typographic control. 4. Refactor `TabsTrigger` to receive `isActive` and `variant` as explicit props if the primitive allows, enhancing type safety and clarity.
[38;5;114m+29[0m [38;5;203m-20[0m lines

### [2026-03-10 07:40:59] `frontend/src/components/momentum/leaderboard.tsx` (was 6/10)
1. Refactor the progress bar animation to use `scaleX` for width changes, ensuring smooth performance. 2. Standardize all dynamic color assignments (background, flash animations) to leverage the `getBackgroundColorClass` utility from `lib/utils.ts`. 3. Remove the explicit border from the `LeaderboardEmptyState` icon container, using shadows or tonal surfaces for separation. 4. Clarify the `text-label-uppercase` usage: either make `AURA_LABELS` truly uppercase or adjust the class and its associated typographic rule to reflect the actual casing of the labels.
[38;5;114m+61[0m [38;5;203m-61[0m lines

### [2026-03-10 07:41:59] `frontend/src/components/momentum/screener-table.tsx` (was 6/10)
1. Correct header letter-spacing to `tracking-[0.1em]`.
2. Refactor `FlashCell`'s color logic to use design system utility functions (e.g., `getBackgroundColorClass`) or explicit `rgba` constants for flash variants.
3. Adjust `HOVER_BG_CYAN` to consistently use `bg-cyan-500/10` as per previous guidance.
4. Evaluate and implement semantic `<table>` elements for the screener to enhance accessibility and data structure clarity, while preserving existing visual design and motion.
5. Standardize `ScreenerTableSkeleton`'s `border-radius` values to accurately mirror the live UI components they represent.
6. Re-evaluate `AppleCard`'s `whileHover` behavior or visually differentiate it when interactivity is disabled to maintain design coherence.
7. Ensure `FlashCell` always receives a stable, unique `flashKey` and remove `value` as a fallback key for `motion.span`.
[38;5;114m+159[0m [38;5;203m-158[0m lines

### [2026-03-10 07:43:21] `frontend/src/components/momentum/ticker-modal.tsx` (was 6/10)
Refactor all instances of explicit `border` classes on badges and alerts to align with the 'minimal borders' philosophy, either by removing them entirely or utilizing `border-transparent` and enhancing `bg` tints or subtle shadows for depth. Convert all inline `boxShadow` and `textShadow` styles into reusable Tailwind utility classes or `cn` wrappers for improved maintainability and design system adherence. Re-evaluate the `tracking-widest` usage, considering `tracking-wide` for more precise typographic control. Additionally, consider an audit of the modal's main `border border-white/10` for potential removal to further embrace the borderless design principle.
[38;5;114m+57[0m [38;5;203m-42[0m lines

### [2026-03-10 07:43:39] `frontend/src/components/momentum/strategy-card.tsx` (was 6/10)
1. Refactor the Framer Motion `spring` constant into `lib/constants.ts` to ensure consistency and maintainability across the entire application. 2. Increase the width of the `Subtle Directional Indicator` from `w-[1px]` to `w-[2px]` or explore alternative subtle enhancements like an `inset` shadow along that edge, ensuring its visual presence is discernible and impactful without compromising its minimalist design.
[38;5;114m+5[0m [38;5;203m-9[0m lines

### [2026-03-10 07:44:58] `frontend/src/hooks/use-sectors.ts` (was 6/10)
1. Extract the `0.1` threshold for `hasAura` into a descriptive constant (e.g., `STRONG_TRENDING_COMPOSITE_THRESHOLD`) within `lib/constants.ts`. 2. Rename the `hasAura` property and its logic to `isStronglyTrending` for improved semantic clarity and consistency. 3. Introduce explicit logging for unexpected data structures within `sector_regimes` or `sector_sentiment` using a centralized logging utility. 4. Carefully verify all type definitions after changes to prevent a recurrence of previous build failures.
[38;5;114m+18[0m [38;5;203m-10[0m lines

### [2026-03-10 07:46:08] `frontend/src/services/api.ts` (was 6/10)
Integrate a configurable retry mechanism with exponential backoff into `apiFetch` for specific error codes and HTTP methods to enhance resilience. Augment `apiFetch` or provide companion utilities that facilitate client-side caching strategies (e.g., via integration with React Query/SWR) to dramatically improve perceived performance. Design and introduce a dedicated module or wrapper within the service layer to handle WebSocket/SSE connections for real-time data, ensuring consistent error handling and data flow. Implement comprehensive unit and integration tests for `api.ts` to ensure future changes can be made with high confidence, preventing regressions and accelerating evolution towards premium features.
[38;5;114m+372[0m [38;5;203m-82[0m lines

### [2026-03-10 07:47:01] `frontend/src/components/ui/card.tsx` (was 7/10)
1. Implement a robust `whileFocus` state for `isInteractive` cards using Framer Motion or `focus-visible` pseudo-classes to provide a clear visual indicator consistent with the hover state, leveraging existing shadow tokens. 2. Refine `CardTitle` typography by evaluating `font-semibold` or `font-bold` to enhance visual hierarchy and align with the 'bold typography' standard. 3. Document the specific purpose and hierarchy of `shadow-card` vs. `var(--shadow-elevated)` within the design system's `globals.css` or relevant documentation to clarify the elevation system.
[38;5;114m+16[0m [38;5;203m-7[0m lines

### [2026-03-10 07:47:32] `frontend/src/components/ui/badge.tsx` (was 7/10)
Consolidate `springPhysics` and `tapPhysics` into `lib/constants.ts` for application-wide consistency. Refine `focus-visible` states by unifying the ring and glow into a single, cohesive, and subtle premium indicator. Standardize the glow color logic so that both hover and focus states consistently use either a singular primary accent glow or a contextually appropriate variant-specific glow. Finally, enhance the glow color mapping by exploring more programmatic or token-driven approaches within the `cva` definition or through a dedicated utility, reducing manual string mappings.
[38;5;114m+15[0m [38;5;203m-44[0m lines

### [2026-03-10 07:47:56] `frontend/src/components/momentum/sentiment-badge.tsx` (was 7/10)
1. Remove the redundant 'border' class from the component if 'style.border' continues to be 'border-transparent'. 2. Change 'tracking-tight' to 'tracking-normal' for improved readability and typographic consistency with small UI labels. 3. Refactor the component to utilize 'getSentimentClasses' from 'lib/utils.ts' for consistent style retrieval and adherence to existing abstractions.
[38;5;114m+6[0m [38;5;203m-8[0m lines

### [2026-03-10 07:49:15] `frontend/src/components/momentum/mini-signal-list.tsx` (was 7/10)
1. Replace the `SFIcon` implementation with a proper, scalable solution for SF Symbols or an equivalent custom icon system to meet the premium aesthetic and consistency standards. 2. Move `springTransition` to `lib/constants.ts`. 3. Standardize `MiniSignalListItem`'s hover background to use `bg-cyan-500/10` Tailwind utility for consistency. 4. Refactor the 'No Active Signals' card and signal count badge to use background tints or tonal surfaces for separation, removing explicit borders. 5. Remove the spacebar (`e.key === ' '`) condition from the `onKeyDown` handler in `MiniSignalListItem`.
[38;5;114m+67[0m [38;5;203m-57[0m lines

### [2026-03-10 07:51:08] `frontend/src/components/layout/sidebar.tsx` (was 7/10)
1. Extract Framer Motion spring physics constants to `lib/constants.ts` and ensure all motion definitions (`itemTransition`, `logoTransition`, `closeButtonTransition`) utilize these centralized constants. 2. Refactor color usage in `Sidebar` and `SidebarNavItem` to consistently leverage `getBackgroundColorClass`, `getTextColorClass`, and `getBorderColorClass` from `lib/utils.ts` for all palette-defined colors. 3. Re-evaluate the logo's gradient and the 'Pipeline Active' status color against the 'monochrome with one accent' principle; consider if `emerald` should be restricted to pure data visualization contexts, or if the rule needs further refinement for status indicators. 4. Develop a more robust `SFIcon` implementation, migrating from generic SVG placeholders to a production-grade icon system. 5. Implement `position: sticky` for sidebar section headers to ensure they remain visible during scroll, enhancing navigation for power users. 6. Adjust vertical spacing, particularly `space-y-1` and padding around section headers, to create more generous and consistent breathing room, improving overall visual hierarchy.
[38;5;114m+47[0m [38;5;203m-53[0m lines

### [2026-03-10 07:51:32] `frontend/src/components/layout/topnav.tsx` (was 7/10)
1. Refine `SF_Symbol` to provide a more visually intelligent placeholder or integrate with a mock icon system that better represents SF Symbols. 2. Extract the Framer Motion spring configuration into `lib/constants.ts` and utilize it consistently across all relevant components. 3. Define `TOP_NAV_LINKS` within `lib/constants.ts` to ensure a complete navigation structure. 4. Ensure the `Link` wrapping the app logo explicitly meets or exceeds the 44x44px touch target requirement. 5. Correct the `SF_Symbol` `displayName` assignment for better code clarity.
[38;5;114m+12[0m [38;5;203m-21[0m lines

### [2026-03-10 07:53:06] `frontend/src/components/momentum/rotation-signals.tsx` (was 8/10)
1. Replace emoji icons with proper SF Symbol-like SVGs or a standardized icon component. 2. Extract Framer Motion spring physics constants to `lib/constants.ts`. 3. Refactor the `itemHoverProps.backgroundColor` to use a design token or a utility function for a consistent tonal hover state. 4. Remove the unused `COLORS` import.
[38;5;114m+81[0m [38;5;203m-34[0m lines

### [2026-03-10 07:53:22] `frontend/src/app/layout.tsx` (was 8/10)
Refactor `metadata.description` for a more engaging, benefit-driven tone. Research and implement a more robust font loading strategy to eliminate FOUT, potentially by preloading critical fonts or using `display: "optional"`.
[38;5;114m+15[0m [38;5;203m-4[0m lines

### [2026-03-10 07:54:06] `frontend/src/components/ui/dialog.tsx` (was 8/10)
Extract `useMediaQuery` to a shared hook. Move primary motion constants to `lib/constants.ts`. Review close button's background and blur for tighter integration with the `--card` token and overall glassmorphism.
[38;5;114m+31[0m [38;5;203m-80[0m lines

### [2026-03-10 07:54:37] `frontend/src/components/ui/button.tsx` (was 8/10)
1. Re-evaluate the `interactiveGlowShadow` logic to strictly adhere to the "one accent color per section" rule, perhaps by providing an explicit accent color prop to `Button` or by ensuring the glow color is always the primary accent of the encompassing section. 2. Wrap the `Button` component with `React.memo` to optimize rendering performance. 3. Introduce specific `letter-spacing` Tailwind classes to button text variants for optimal typographic aesthetics, aligning with the "Typography is THE hero" standard. 4. Refactor long `cva` variant class strings across multiple lines for enhanced code readability. 5. Augment the `whileFocusState` to include a subtle background tint or a more distinct border alongside the shadow for clearer, more comprehensive visual feedback. 6. Explore incorporating responsive size definitions (e.g., `h-mobile-default` vs `h-desktop-default` or using responsive prefixes like `sm:h-10`) directly within the `buttonVariants` for more robust mobile-first sizing.
[38;5;114m+57[0m [38;5;203m-30[0m lines

### [2026-03-10 07:56:09] `frontend/src/components/momentum/strategy-builder.tsx` (was 8/10)
1. Refactor the inline `style` for color in the history table by utilizing `getTextColorClass` from `lib/utils.ts` to dynamically apply Tailwind text color classes. 2. Standardize `motion.div` transitions across the component to exclusively use the `springTransition` constant. 3. Update the `addCondition` logic to safely initialize new conditions using `FALLBACK_INDICATORS[0]` when `indicators` is empty.
[38;5;114m+19[0m [38;5;203m-18[0m lines

### [2026-03-10 07:56:38] `frontend/src/components/momentum/sector-heatmap.tsx` (was 8/10)
1. Audit and adjust all `letter-spacing` for uppercase elements (labels, badges) to strictly adhere to `0.1em`, replacing `tracking-wider`/`tracking-wide` with a consistent utility or explicit CSS value. 2. Redesign the "∞ AURA" badge's placement and visual treatment for more harmonious integration, potentially separating it as subtle metadata or using a more refined icon/text combination. 3. Centralize the `bg-slate-800/50` color or similar background tints for data visualizations into the `globals.css` or `constants.ts` as a defined design token.
[38;5;114m+15[0m [38;5;203m-10[0m lines

### [2026-03-10 07:57:28] `frontend/src/components/charts/equity-chart.tsx` (was 8/10)
Refactor `SPRING_TRANSITION` into `lib/constants.ts`. Review Lightweight Charts' typography options for more granular font control, or explicitly document the current approach. Apply `tracking-tight` to the chart title. Replace the `NoDataMessage` icon with a more intuitive empty-state graphic. Optimize `NoDataMessage` styling by consolidating `font-sans` to the parent element.
[38;5;114m+8[0m [38;5;203m-10[0m lines

### [2026-03-10 07:57:55] `frontend/src/components/charts/elder-chart.tsx` (was 8/10)
Replace the generic `NoDataPlaceholder` icon with a custom, app-specific design. Conduct a thorough review of the chart's internal spacing to maximize visual breathing room. Refine the data update `flash` animation for enhanced subtlety and integration with the overall minimalist aesthetic.
[38;5;114m+17[0m [38;5;203m-14[0m lines

### [2026-03-10 08:22:56] `frontend/src/components/momentum/yield-table.tsx` (was 4/10)
1. Centralize all Framer Motion constants (`SPRING_TRANSITION`, `PAGE_TRANSITION_VARIANTS`, `STAGGER_CHILDREN_DELAY`) into `lib/constants.ts` and refactor `YieldTable` to import them. 2. Refactor color logic in `yieldColor`, `compositeColor`, and `FlashWrapper` to exclusively use color utility functions (e.g., `getTextColorClass`, `getBackgroundColorClass`) from `lib/utils.ts`. 3. Implement frozen columns for the 'Ticker' and 'Name' columns to enhance data navigation. 4. Develop and integrate a consistent SF Symbol-like icon component for the table's `icon` prop. 5. Add `role="button"` and `aria-sort` attributes to sortable table headers. 6. Adjust the `FlashWrapper`'s `border-radius` to conform to the 1rem+ standard. 7. Replace the generic 'No results found' message with a premium, visually engaging empty state component.
[38;5;114m+210[0m [38;5;203m-135[0m lines

### [2026-03-10 08:23:50] `frontend/src/components/layout/sidebar.tsx` (was 4/10)
1. Immediately move `SPRING_TRANSITION` and `TAP_TRANSITION` to `lib/constants.ts` to enforce a single source of truth for animation constants. 2. Refactor the 'Pipeline Active' status to use the primary accent color (`cyan`) or a neutral `slate` tone to strictly adhere to the 'monochrome with one accent per section' principle for UI elements. 3. Systematically replace all hardcoded color values and direct `COLORS` references with `getBackgroundColorClass`, `getTextColorClass`, or `getBorderColorClass` for all palette-defined colors, ensuring consistent application of the design system's color utilities. 4. Develop a more robust and scalable icon system for `SFIcon`, such as using an SVG sprite, icon font, or dynamically imported individual SVGs, to improve performance and maintainability. 5. Revise the 'MOMENTUM' tagline to reflect a more sophisticated and premium brand voice aligned with the overall design philosophy. 6. Correct the close button's `focus-visible` ring class to use a `ring-{color}-{shade}` utility for appropriate visual feedback.
[38;5;114m+77[0m [38;5;203m-85[0m lines

### [2026-03-10 08:24:19] `frontend/src/components/ui/tooltip.tsx` (was 5/10)
1. **Centralize Framer Motion Constants:** Define `SPRING_TRANSITION_PROPS` and `TOOLTIP_MOTION_VARIANTS` (containing `initial`, `animate`, and `exit` states, all leveraging `SPRING_TRANSITION_PROPS` for their transitions) in `lib/constants.ts`. 2. **Apply Centralized Constants:** Update `TooltipContent` to exclusively use the newly defined `TOOLTIP_MOTION_VARIANTS` and `SPRING_TRANSITION_PROPS` for its Framer Motion props, removing all inline `useMemo` definitions for these animation values. 3. **Harmonize Arrow Styling:** Adjust the `TooltipPrimitive.Arrow`'s `border-radius` to be visually consistent with the `rounded-2xl` value used for the main tooltip content, ensuring a unified rounded aesthetic. 4. **Review and Harden Type Definitions:** Conduct a thorough review of `TooltipContent`'s prop types, simplifying or abstracting the `TooltipPrimitive.Popup.Props & Pick<...>` combination as needed to enhance clarity, reduce complexity, and improve resilience against future type-related build failures.
[38;5;114m+9[0m [38;5;203m-20[0m lines

### [2026-03-10 08:24:33] `frontend/src/components/ui/separator.tsx` (was 5/10)
1. Define a `FADE_IN_SPRING_TRANSITION` constant in `lib/constants.ts` with the specified spring physics (stiffness=300, damping=30) for opacity. 2. Refactor `Separator` to import and utilize this centralized spring transition constant for its `initial` and `animate` properties. 3. Verify the `border` color token is explicitly defined within `lib/constants.ts` (if it's a semantic color) or ensure its origin is clearly documented in `globals.css`.
[38;5;114m+6[0m [38;5;203m-11[0m lines

### [2026-03-10 08:26:30] `frontend/src/components/momentum/signal-table.tsx` (was 5/10)
Refactor `CollapsibleTier` headers for consistent UI accenting. Standardize Framer Motion transitions to ensure spring physics are correctly applied. Remove redundant `key` from `RealtimeFlashValue`. Update local color helpers to use `lib/utils.ts` color functions. Apply `springTransition` to the probability bar. Implement animated shimmer for skeleton loaders. Replace the empty state emoji with a high-quality graphic.
[38;5;114m+116[0m [38;5;203m-89[0m lines

### [2026-03-10 08:27:12] `frontend/src/components/momentum/kpi-strip.tsx` (was 5/10)
1. Extract Framer Motion `springTransition` constants to `lib/constants.ts` and apply them consistently in `AnimatedNumber` and `KPICard`. 2. Memoize the `whileHover` and `transition` objects in `KPICard` to avoid inline object literals. 3. Refactor the `color` prop in `KPICard` and `AnimatedNumber` to accept a `PaletteColorKey` and use `getTextColorClass` from `lib/utils.ts` to generate the appropriate Tailwind class. 4. Extract the number formatting logic from `AnimatedNumber` into a memoized utility function in `lib/utils.ts`. 5. Implement `staggerChildren` animation within the `KPIStrip` component for the initial rendering of `KPICard`s.
[38;5;114m+74[0m [38;5;203m-61[0m lines

### [2026-03-10 08:28:01] `frontend/src/components/momentum/regime-badge.tsx` (was 5/10)
1. Remove the explicit `border border-[var(--border)]` and rely on `REGIME_STYLES`' `border-transparent`, allowing `glass-subtle` and shadows to provide element definition as per the "minimal borders" philosophy. 2. Extract `stiffness`, `damping`, and `mass` values for `springTransition` into `lib/constants.ts` and utilize this centralized constant. 3. Apply a suitable Tailwind class (e.g., `tracking-wide` if configured to `0.1em`) to the badge text for precise letter-spacing.
[38;5;114m+8[0m [38;5;203m-18[0m lines

### [2026-03-10 08:28:57] `frontend/src/components/momentum/ticker-search.tsx` (was 5/10)
1. Migrate `springPhysics` to `lib/constants.ts` and ensure `TickerSearch.tsx` imports and uses this centralized constant. 2. Refactor `INPUT_FOCUS_GLOW_SHADOW`, `ITEM_FOCUS_GLOW_SHADOW`, and `ITEM_ACTIVE_BG` to leverage the color utility functions from `lib/utils.ts` for consistent design token application. 3. Apply the `letter-spacing: 0.1em` to the `uppercase` source badge and audit other `uppercase` elements in the component for adherence to this typography standard.
[38;5;114m+42[0m [38;5;203m-44[0m lines

### [2026-03-10 08:30:09] `frontend/src/app/globals.css` (was 5/10)
General improvement
[38;5;114m+84[0m [38;5;203m-79[0m lines

### [2026-03-10 08:30:40] `frontend/src/components/ui/card.tsx` (was 5/10)
General improvement
[38;5;114m+36[0m [38;5;203m-49[0m lines

### [2026-03-10 08:31:28] `frontend/src/components/momentum/sentiment-badge.tsx` (was 5/10)
General improvement
[38;5;114m+4[0m [38;5;203m-3[0m lines

### [2026-03-10 08:32:43] `frontend/src/components/momentum/rotation-signals.tsx` (was 5/10)
General improvement
[38;5;114m+102[0m [38;5;203m-39[0m lines

### [2026-03-10 08:34:57] `frontend/src/app/dashboard/page.tsx` (was 6/10)
1. Rework KPI strips and other general UI elements to strictly adhere to the "monochrome with one accent per section" rule, limiting data-specific colors to data visualizations and numerical displays. 2. Replace the placeholder Unicode `SFSymbol` implementation with a robust SVG-based icon system or a production-grade SF Symbols integration. 3. Extract all Framer Motion spring physics constants, including `springTransition` and `pageTransition`, to `lib/constants.ts`. 4. Refactor hardcoded color values in hover states (`whileHoverCard`, `whileHoverListItem`) to use `getBackgroundColorClass` and `getBorderColorClass` utilities. 5. Audit all uppercase text elements and replace `tracking-wide` with a precise `0.1em` letter-spacing utility or explicit CSS value. 6. Address the type casting for `getTextColorClass` by refining `PaletteColorKey` or the data structure.
[38;5;114m+104[0m [38;5;203m-145[0m lines

### [2026-03-10 08:35:22] `frontend/src/components/ui/apple-card.tsx` (was 6/10)
1. Extract Framer Motion's `spring` physics constants (stiffness, damping, restDelta) to `lib/constants.ts` and update `cardTransition` to utilize these centralized values for consistency across all animated components. 2. Create a `getAccentRgba(colorKey: PaletteColorKey, alpha: number)` utility function in `lib/utils.ts` to encapsulate the `hexToRgba` logic, centralizing dynamic color transformations for translucent accents. 3. Refactor `VALID_ACCENT_GLOW_COLORS` to dynamically derive its valid values from `COLORS` keys to eliminate redundancy and improve maintainability.
[38;5;114m+16[0m [38;5;203m-50[0m lines

### [2026-03-10 08:37:53] `frontend/src/components/momentum/strategy-builder.tsx` (was 6/10)
1. Replace `font-sf-symbols` placeholders with a production-grade SF Symbol-like icon system for all icons. 2. Re-evaluate the use of `violet` in the "Saved Strategies" section to ensure strict adherence to the "monochrome with ONE accent color per section" principle, potentially using a tonal variation of the primary accent or a neutral color for secondary categorization. 3. Redesign the "Add Condition" buttons to remove the dashed border, instead leveraging shadow depth, background tints, or a more subtle ring/outline for visual feedback. 4. Refactor all direct Tailwind color classes to consistently use `getBackgroundColorClass`, `getTextColorClass`, and `getBorderColorClass` from `lib/utils.ts`. 5. Increase horizontal padding in the `Backtest History` table for improved visual spaciousness and readability.
[38;5;114m+149[0m [38;5;203m-49[0m lines

### [2026-03-10 08:39:43] `frontend/src/components/momentum/top-signals.tsx` (was 6/10)
1. Replace all hardcoded SVG icons with a robust, centralized `SFIcon` component or a similar production-grade icon system. 2. Increase the padding/min-height of interactive list items to ensure they meet the 44x44px touch target minimum. 3. Revisit the color strategy for probability aura icons to strictly use `cyan` or a neutral tint, or find a different visual representation that doesn't introduce a new accent color (`amber`) into the primary UI flow. 4. Implement a subtle shimmer animation for the `TopSignalsSkeleton`. 5. Extract all Framer Motion constants (`itemTransition`, `itemWhileHover`, `flashVariants`) to `lib/constants.ts` for consistency. 6. Re-evaluate the `NoSignalsPlaceholder` border; consider replacing it with an elevated shadow or background tint to align with minimal borders.
[38;5;114m+24[0m [38;5;203m-81[0m lines

### [2026-03-10 08:41:35] `frontend/src/components/momentum/mini-signal-list.tsx` (was 6/10)
1. Extract `SPRING_PHYSICS_DEFAULT` to `lib/constants.ts` and ensure all motion definitions across the component utilize this centralized constant. 2. Refactor `DailyChangeDisplay` to use `getTextColorClass('emerald', '400')`, `getTextColorClass('rose', '400')`, and `getTextColorClass('slate', '400')` respectively. 3. Update `MiniSignalListItem`'s `whileHoverProps` to use `getBackgroundColorClass('cyan', '500', '10')` for the background color and construct the `boxShadow` using `COLORS.cyan` from `lib/constants.ts` or a dedicated shadow utility if available. 4. Extract animation timing values (e.g., `duration`, `delay`) from `FlashValue` into `lib/constants.ts`. 5. Move the `SFIcon` component to a shared location like `components/ui/sf-icon.tsx` to establish a truly reusable and centralized icon system, and review its default placeholder for a more sophisticated representation.
[38;5;114m+20[0m [38;5;203m-133[0m lines

### [2026-03-10 08:42:04] `frontend/src/components/momentum/strategy-card.tsx` (was 6/10)
1. Reconcile the 'one accent color' philosophy: Redesign the left directional indicator to consistently use the primary UI accent color (e.g., 'cyan'), or remove it and rely on a more subtle visual cue. For 's.action' text and numerical data (conviction, urgency), explore if color coding is truly necessary for core text or if it can be conveyed via more subtle means (e.g., a small color-coded icon or a very minimal tint) while keeping the primary text monochrome to maintain visual harmony. 2. Standardize color utility usage: Refactor 'dirColorClass' and 'urgColorClass' to consistently utilize 'getTextColorClass' from 'lib/utils.ts' for all palette-derived text colors. 3. Refine hover background: Experiment with alternative hover background treatments for 'AppleCard', such as a subtle tonal shift (e.g., a slightly lighter tint of the card's background or a subtle accent color tint) to create a more sophisticated and Apple-like elevation effect, rather than just increasing opacity.
[38;5;114m+25[0m [38;5;203m-36[0m lines

### [2026-03-10 08:44:00] `frontend/src/components/charts/price-chart.tsx` (was 6/10)
Refine the real-time update flash animation logic to precisely capture and visually indicate value changes to the latest data point. Extract all Framer Motion spring physics constants to `lib/constants.ts`. Consistently refactor all chart internal styling (text, background, borders, crosshair) to utilize the design system utilities in `lib/utils.ts`. Remove redundant `borderColor` declarations in chart options where `borderVisible` is false. Adjust the letter-spacing for headings to strictly match the `-0.03em` standard. Implement a dedicated, visually appealing empty state UI for cases where no data is available.
[38;5;114m+142[0m [38;5;203m-40[0m lines

### [2026-03-10 08:44:22] `frontend/src/hooks/use-signals.ts` (was 6/10)
Refactor the `selectedTickerState` `useEffect` to ensure robust, predictable auto-selection logic by carefully reviewing its dependencies and internal state updates. Move `SORTABLE_SIGNAL_KEYS` to `lib/constants.ts`, ensuring type safety is maintained in both `constants.ts` and `useSignals.ts`.
[38;5;114m+33[0m [38;5;203m-27[0m lines

### [2026-03-10 08:46:14] `frontend/src/app/receipts/page.tsx` (was 7/10)
Refactor the `KPIStrip` to adhere to the "one accent color per section" rule, possibly by using shades of a single accent color for different metrics, or restricting distinct colors only to direct data visualization. Implement a consistent utility class for `letter-spacing: 0.1em` and apply it to all uppercase labels, including table headers and card titles. Extract `SPRING_TRANSITION` to `lib/constants.ts` and ensure all Framer Motion components reference this centralized constant. Update all color class definitions (badges, conditional text colors) to consistently use the color utility functions from `lib/utils.ts`.
[38;5;114m+97[0m [38;5;203m-73[0m lines

### [2026-03-10 08:46:57] `frontend/src/components/ui/sheet.tsx` (was 7/10)
1. Extract all Framer Motion constants to `lib/constants.ts` and use them throughout the component. 2. Integrate the `SheetHandle`'s motion into the `SheetContent`'s `popupVariants` to streamline animation orchestration. 3. Adjust the `SheetHandle`'s background color to a neutral `white/10` or `foreground/20`. 4. Explore replacing the `SheetFooter`'s subtle border with a background tint or shadow to align more strictly with the minimal borders philosophy.
[38;5;114m+25[0m [38;5;203m-40[0m lines

### [2026-03-10 08:48:15] `frontend/src/components/ui/table.tsx` (was 7/10)
1. Extract `SPRING_TRANSITION` to `lib/constants.ts` and import it. 2. Refactor `TableCell`'s `isPositive`/`isNegative` color application to use `getTextColorClass` from `lib/utils.ts`. 3. Centralize the `TABLE_ROW_HOVER_PROPS.boxShadow` definition (or its constituent parts) in `lib/constants.ts` as a reusable interactive glow token. 4. Define named `z-index` constants in `lib/constants.ts` and apply them to sticky elements. 5. Evaluate further abstraction for complex sticky shadow classes.
[38;5;114m+26[0m [38;5;203m-21[0m lines

### [2026-03-10 08:48:38] `frontend/src/components/ui/input.tsx` (was 7/10)
1. Extract Framer Motion `springTransition` constants to `lib/constants.ts` and apply them to the input's `motionProps.transition`. 2. Re-evaluate the default `border border-[var(--border)]` for the input's idle state, exploring alternative visual cues like subtle inner shadows or background tints to align with the 'minimal borders' principle. 3. Harmonize the `whileFocus` state to rely purely on the existing `boxShadow` and `y` transform for elevation, removing the `focus-visible:border-[var(--color-mo-cyan)/50]` to maintain a consistent visual language without explicit borders.
[38;5;114m+13[0m [38;5;203m-14[0m lines

### [2026-03-10 08:50:50] `frontend/src/components/momentum/screener-table.tsx` (was 7/10)
1. Replace `SEARCH_ICON_SVG` with a dedicated, theme-aware `SFIcon` component that takes an icon name (e.g., 'magnifyingglass'). 2. Refactor `HOVER_BG_CYAN` to use `getBackgroundColorClass` from `lib/utils.ts` for consistent color tokenization. 3. Re-implement `whileHover={false}` or equivalent on the `AppleCard` that wraps the `ScreenerTableSkeleton` to prevent unintended hover animations. 4. Update the `dTextClass` logic to leverage `getTextColorClass` for dynamic color assignment. 5. Review the use of `flex items-center` on `th` elements and simplify to `text-left` where `flex` offers no distinct advantage for alignment.
[38;5;114m+96[0m [38;5;203m-70[0m lines

### [2026-03-10 08:51:07] `frontend/src/components/momentum/sector-heatmap.tsx` (was 7/10)
1. Refactor the sentiment bar's internal segment colors to utilize `getBackgroundColorClass` from `lib/utils.ts` for full consistency with the design token system. 2. Implement a custom Tailwind utility or explicit CSS for uppercase letter-spacing that strictly and explicitly defines `0.1em`, replacing `tracking-widest` for all uppercase labels and badges. 3. Re-evaluate the '∞ AURA' badge's font size to align with the defined typography scale (e.g., `text-xs`), ensuring legibility while maintaining its metadata quality.
[38;5;114m+11[0m [38;5;203m-7[0m lines

### [2026-03-10 08:52:17] `frontend/src/hooks/use-backtest.ts` (was 7/10)
Replace the placeholder `Log` utility with a dedicated, production-ready logging module. Extract all timing-related magic numbers into `lib/constants.ts` for consistency and easier tuning. Implement a UUID generation strategy for `backtestId` using `crypto.randomUUID()` or a similar robust method. Explicitly define and enforce the `cancelBacktest` API signature in `services/api.ts` to accept `backtestId`. Refine the `useEffect` cleanup to accurately log the `backtestId` of the operation being aborted. Ensure comprehensive error detail capture for all error types, including `unknown_error`.
[38;5;114m+100[0m [38;5;203m-80[0m lines

### [2026-03-10 08:53:39] `frontend/src/services/api.ts` (was 7/10)
Upgrade the client-side caching mechanism from a simple in-memory map to a dedicated data fetching library. Expand the RealtimeService into a full-fledged system with robust message routing, detailed subscription management, and advanced error handling. Migrate all shared API service constants to `lib/constants.ts`. Fully integrate `logError` with a production-grade error tracking and observability platform.
[38;5;114m+437[0m [38;5;203m-165[0m lines

### [2026-03-10 08:54:54] `frontend/src/components/ui/dialog.tsx` (was 8/10)
Address the mobile grab handle's touch target and interactivity, refine the close button's background color for tonal consistency with the dark theme, and introduce a subtle entrance animation for the close button to enhance motion flow.
[38;5;114m+15[0m [38;5;203m-7[0m lines

### [2026-03-10 08:55:17] `frontend/src/components/momentum/quote-rotator.tsx` (was 8/10)
1. Audit and adjust `letter-spacing` (or `tracking` utility classes) for the quote and author text, considering values like `tracking-tight` or a custom negative `em` value to achieve a more refined, 'hero' typography. 2. Increase responsive `min-height` and padding (`p-x md:p-y lg:p-z`) to allocate more visual breathing room around the quote, particularly on larger screens. 3. Replace the `return null` empty state with a skeleton loader or a custom 'No quotes available' message, ensuring it maintains the premium aesthetic of the `AppleCard`.
[38;5;114m+25[0m [38;5;203m-5[0m lines

### [2026-03-10 08:56:08] `frontend/src/components/charts/elder-chart.tsx` (was 8/10)
1. Prioritize developing and integrating a robust, app-wide icon system (e.g., `<SFIcon />`) and migrate the custom `NoDataPlaceholder` SVG into it. 2. Refactor the `NoDataPlaceholder` component to apply `font-sans` to the parent `motion.div` instead of repeating it on individual `<p>` tags. 3. Conduct a precise audit of all heading and label `letter-spacing` to ensure strict compliance with the `-0.03em` and `0.1em` standards, implementing custom Tailwind utilities or direct CSS if necessary for absolute precision.
[38;5;114m+59[0m [38;5;203m-52[0m lines

### [2026-03-10 08:57:00] `frontend/src/components/charts/indicator-chart.tsx` (was 8/10)
Refactor the data flash animation to use Framer Motion. Design and implement a custom SF Symbol-like icon for the empty chart state. Extract magic strings to constants. Verify color contrast for chart labels. Consider global error handling for utility functions.
[38;5;114m+74[0m [38;5;203m-33[0m lines

### [2026-03-10 09:21:47] `frontend/src/components/ui/apple-card.tsx` (was 3/10)
Implement `getAccentRgba` in `lib/utils.ts` to ensure the dynamic inner glow functions correctly. Refactor `cardTransition` to avoid redundant transition property declarations. Evaluate `AnimatePresence` mode for the inner glow, potentially switching to `mode='sync'` for a more fluid visual experience.
[38;5;114m+5[0m [38;5;203m-15[0m lines

### [2026-03-10 09:22:44] `frontend/src/components/momentum/trending-sectors.tsx` (was 4/10)
Systematically address all identified issues by: 1. Extracting Framer Motion transition properties and hover `boxShadow` parts to `lib/constants.ts` and applying them via utilities. 2. Refactoring the hover `backgroundColor` to dynamically adjust the existing `bg-card/opacity` to maintain the backdrop-blur effect. 3. Removing the explicit `hover:border` and relying solely on the defined `boxShadow` for the hover glow. 4. Updating the `AURA` badge to use `getBackgroundColorClass` and `getTextColorClass`, and adjusting its letter-spacing to a precise `0.1em` with a custom utility. 5. Replacing the inline SVG icon with the `<SFIcon />` component.
[38;5;114m+86[0m [38;5;203m-45[0m lines

### [2026-03-10 09:24:21] `frontend/src/components/ui/button.tsx` (was 5/10)
Refactor button sizing to meet the 44x44px minimum touch target for all variants. Eliminate explicit borders from the `outline` variant, replacing them with enhanced shadow depth or background tints consistent with the 'minimal borders' philosophy. Centralize `interactiveGlowShadow` into `lib/constants.ts` as a reusable token. Update the `whileFocusState` to leverage `getBackgroundColorClass` for all background color/opacity applications, ensuring consistent token usage. Audit and apply precise letter-spacing according to typography standards. Investigate a more systematic, Material 3-aligned approach for state layers in focus states, potentially using pseudo-elements or a dedicated overlay system.
[38;5;114m+83[0m [38;5;203m-28[0m lines

### [2026-03-10 09:26:03] `frontend/src/components/momentum/strategy-builder.tsx` (was 5/10)
Refactor `SFXIcon` into a reusable `components/ui/SFIcon.tsx` and replace all local implementations. Standardize border usage across interactive elements and error messages to align with 'minimal borders' philosophy, favoring shadows and background tints. Re-evaluate accent color usage for 'Add Exit Condition' to ensure adherence to 'one accent color per section' (e.g., using a neutral accent with a rose icon for distinction). Consolidate all card-like `border-radius` values to a single design token. Ensure all color applications, especially for interactive states, leverage the `get*ColorClass` utilities for consistency. Adjust the visual hierarchy of the 'Stop' button relative to 'Run Backtest'.
[38;5;114m+57[0m [38;5;203m-116[0m lines

### [2026-03-10 09:27:16] `frontend/src/hooks/use-signals.ts` (was 5/10)
Integrate with the centralized, production-ready logging module for all error logging within the hook. Move the `AppError` interface to a shared `types/` file (e.g., `types/api.ts`). Extract `refreshInterval` to `lib/constants.ts` if it represents a global polling frequency.
[38;5;114m+10[0m [38;5;203m-14[0m lines

### [2026-03-10 09:28:20] `frontend/src/components/momentum/ticker-search.tsx` (was 6/10)
1. Implement `getRgbaString` in `lib/utils.ts` to fix the critical error. 2. Create and integrate a centralized `<SFIcon />` component to replace all inline SVGs, aligning with the SF Symbols aesthetic. 3. Refactor skeleton and spinner color classes to consistently use `getBackgroundColorClass`. 4. Explore more robust focus management patterns to replace the `setTimeout` in `onBlur`.
[38;5;114m+107[0m [38;5;203m-40[0m lines

### [2026-03-10 09:29:36] `frontend/src/components/ui/card.tsx` (was 5/10)
General improvement
[38;5;114m+28[0m [38;5;203m-21[0m lines

### [2026-03-10 09:30:17] `frontend/src/components/layout/topnav.tsx` (was 5/10)
General improvement
[38;5;114m+55[0m [38;5;203m-50[0m lines

### [2026-03-10 09:32:46] `frontend/src/app/page.tsx` (was 6/10)
Refactor all color applications to strictly use `getBackgroundColorClass` and `getTextColorClass`. Centralize all app-wide constants and Framer Motion configurations in `lib/constants.ts`. Implement and integrate a dedicated `SFIcon` component to replace all hardcoded emojis. Abstract the hero text shadow into a reusable design token. Refine the sticky header shadow for subtlety and replace magic `z-index` values with named constants. Implement distinct routing or query parameters for 'Platform Modules' to enhance UX clarity.
[38;5;114m+138[0m [38;5;203m-79[0m lines

### [2026-03-10 09:34:05] `frontend/src/app/receipts/page.tsx` (was 6/10)
Refactor table styling to remove explicit borders from rows, relying solely on shadows and background tints for depth and interaction states. Implement a dedicated `<SFIcon />` component to replace all emoji icons, aligning with Apple's premium aesthetic. Centralize `z-index` values in constants for all sticky table elements and ensure consistent background color tokenization. Re-architect the table rows to achieve card-like appearances without `border-spacing` or `overflow-hidden` clipping, possibly by wrapping cell content or using a different table structure for row-as-card presentations. Conduct a comprehensive audit of padding across the page, ensuring optimal whitespace and consistent spacing hierarchy. Simplify tooltip content rendering.
[38;5;114m+229[0m [38;5;203m-175[0m lines

### [2026-03-10 09:35:41] `frontend/src/components/ui/select.tsx` (was 6/10)
1. Extract `SPRING_TRANSITION_PROPS` to `lib/constants.ts` and import it. 2. Refactor all direct Tailwind color classes using palette colors (e.g., `text-slate-400`, `ring-cyan-500/50`, `text-cyan-500`) to leverage `getTextColorClass`, `getBackgroundColorClass`, and `getBorderColorClass` from `lib/utils.ts`. 3. Re-evaluate and adjust the `SelectTrigger`'s focus state to remove the `focus-within:ring-2` and instead rely solely on `boxShadow` and `y` transform for elevation, aligning with the improved `input.tsx` pattern. 4. Move the `useMediaQuery` hook to `hooks/use-media-query.ts` to ensure reusability. 5. Adjust the `SelectContent`'s entry animation `y` value to `20` to strictly adhere to the defined motion guidelines.
[38;5;114m+23[0m [38;5;203m-48[0m lines

### [2026-03-10 09:36:45] `frontend/src/components/momentum/leaderboard.tsx` (was 6/10)
Extract all local constants (Framer Motion transitions, score multipliers, progress bar scales) to `lib/constants.ts` for centralized management. Implement a sticky header for the leaderboard title to improve data readability during scroll. Refine `letter-spacing` for the Aura Label to strictly adhere to design system typography. Replace the inline empty state icon with a component from a robust, SF Symbol-like icon system. Re-evaluate the fixed height of the scrollable content for better responsiveness, and consider adding tooltips for truncated text.
[38;5;114m+88[0m [38;5;203m-64[0m lines

### [2026-03-10 09:39:03] `frontend/src/components/momentum/screener-table.tsx` (was 6/10)
1. Define and apply named z-index constants from `lib/constants.ts` for all sticky table elements to enforce a consistent stacking order. 2. Refactor the `input` and `select` focus states to align with the premium interaction design, utilizing `whileFocus` with elevation (shadow, `y` transform) and removing direct background state changes. 3. Clean up the `ScreenerTableSkeleton` by removing all redundant `group-hover` utility classes from its `td` elements. 4. Review and refactor `FlashCell` to ensure its internal animation logic adheres to more idiomatic Framer Motion patterns for managing value transitions without relying on the internal `key` prop.
[38;5;114m+75[0m [38;5;203m-44[0m lines

### [2026-03-10 09:39:18] `frontend/src/components/momentum/regime-badge.tsx` (was 6/10)
Refactor the `RegimeBadge` to apply a dedicated Tailwind utility or explicit CSS for `letter-spacing: 0.1em` to its text content. Update the styling logic to use `getRegimeClasses` from `lib/utils.ts`. Define `SHADOW_SOFT` and `SHADOW_CARD` constants in `lib/constants.ts` and use them for the `boxShadow` properties in `initialProps`, `animateProps`, and `hoverProps`.
[38;5;114m+19[0m [38;5;203m-7[0m lines

### [2026-03-10 09:40:57] `frontend/src/components/momentum/ticker-modal.tsx` (was 6/10)
1. Audit and refactor all uppercase text and headings to strictly adhere to the `0.1em` and `-0.03em` letter-spacing standards, implementing custom Tailwind utilities or direct CSS if necessary. 2. Refactor all dynamic color applications to consistently use `getTextColorClass` and `getBackgroundColorClass` from `lib/utils.ts`. 3. Extract `SPRING_PHYSICS_DEFAULT`, `COMMON_HOVER_SHADOW`, `CTA_GLOW_SHADOW`, `TICKER_TEXT_GLOW`, and z-index values into `lib/constants.ts`. 4. Re-evaluate the 'Quick Stats' grid for mobile, implementing a `grid-cols-1` or `flex-col` layout below `sm` to improve density. 5. Introduce a robust `useScrollLock` hook for managing body scroll behavior when the modal is open.
[38;5;114m+150[0m [38;5;203m-64[0m lines

### [2026-03-10 09:42:00] `frontend/src/components/charts/equity-chart.tsx` (was 6/10)
Refactor the data flash animation to utilize Framer Motion for consistency. Integrate the app-wide `<SFIcon />` component into the `NoDataMessage`. Implement precise `-0.03em` letter-spacing for all headings. Enhance the `ChartSkeleton` shimmer effect for a more premium visual. Refactor the `color` prop to leverage the `PaletteColorKey` and associated utility functions for improved design token adherence.
[38;5;114m+103[0m [38;5;203m-66[0m lines

### [2026-03-10 09:42:59] `frontend/src/components/charts/price-chart.tsx` (was 6/10)
1. Extract `SFIcon` to `components/ui/sf-icon.tsx` and implement a robust icon system for rendering various SF Symbols, then import and use it. 2. Move `hexToRgba` and `getPaletteRgba` to `lib/utils.ts`, consolidating into a single `getColorWithAlpha` function for consistent color manipulation. 3. Adjust `ChartEmptyState` styling to leverage the parent `apple-card`'s translucent background and backdrop-blur, removing redundant background/blur styles from the empty state itself. 4. Refine the chart title to be more specific, potentially including the ticker symbol.
[38;5;114m+18[0m [38;5;203m-78[0m lines

### [2026-03-10 09:43:09] `frontend/src/hooks/use-sectors.ts` (was 6/10)
Migrate the `console.warn` to the application's dedicated logging module, ensuring consistent and observable reporting of data anomalies. Collaborate with backend teams to clarify the `DashboardData` contract, either by guaranteeing `sector_sentiment` completeness or explicitly typing it as optional to enable proactive, type-safe handling on the client side.
[38;5;114m+5[0m [38;5;203m-29[0m lines

### [2026-03-10 09:44:18] `frontend/src/components/ui/apple-button.tsx` (was 7/10)
1. Implement a distinct, custom `focus-visible` state for the `AppleButton` that leverages the existing elevation system (shadows, glows, `y` transform) instead of borders. 2. Audit and apply precise `letter-spacing` to all button text, creating a custom Tailwind utility (e.g., `tracking-tight-03`) to ensure adherence to the specified typographic standards. 3. Centralize and export pre-composed `boxShadow` constants for interactive states (e.g., `SECONDARY_BUTTON_HOVER_SHADOWS`) from `lib/constants.ts` and use them directly in `whileHoverProps` to enhance design system consistency.
[38;5;114m+36[0m [38;5;203m-30[0m lines

### [2026-03-10 09:44:44] `frontend/src/components/ui/separator.tsx` (was 7/10)
Refactor the separator's visual styling to eliminate the direct use of a `border` color. Instead, achieve separation by implementing a subtle background gradient that transitions between background tints (e.g., using `bg-background` and `bg-card` with varying opacities, or a slightly darker/lighter shade of the background color) or a very faint inner shadow, aligning with the "shadow depth and background tints instead" principle. Ensure any colors used are explicitly defined within `constants.ts` and preferably accessed via `getBackgroundColorClass` from `lib/utils.ts` for consistency.
[38;5;114m+9[0m [38;5;203m-4[0m lines

### [2026-03-10 09:45:53] `frontend/src/components/momentum/rotation-signals.tsx` (was 7/10)
Immediately extract the `SFIcon` component into `components/ui/sf-icon.tsx`, ensuring its `symbolSVGMap` is either colocated or further abstracted into a dedicated registry. Refine the hoverable item styles by adjusting padding and margins to ensure the interactive area precisely matches the visual boundaries. Document or define the `secondary-foreground` color token within the global color palette constants.
[38;5;114m+4[0m [38;5;203m-111[0m lines

### [2026-03-10 09:46:29] `frontend/src/components/momentum/strategy-card.tsx` (was 7/10)
1. Implement a custom Tailwind utility for precise `letter-spacing: -0.03em` and apply it to the ticker and other large headings. 2. Update the `AnimatedValue` background flash animation to use spring physics for its `transition`. 3. Define the full `hoverProps.boxShadow` string as a reusable constant in `lib/constants.ts`. Re-evaluate the vertical indicator's background to use a CSS variable or a more abstract color token helper.
[38;5;114m+11[0m [38;5;203m-11[0m lines

### [2026-03-10 09:48:16] `frontend/src/components/momentum/quote-rotator.tsx` (was 7/10)
Create a custom Tailwind utility (e.g., `tracking-hero`) that applies a precise `-0.03em` letter-spacing, and apply it to the quote and author text in both active and empty states. Refactor all direct Tailwind color classes to utilize `getTextColorClass` from `lib/utils.ts` for improved design token consistency.
[38;5;114m+26[0m [38;5;203m-5[0m lines

### [2026-03-10 09:48:45] `frontend/src/components/layout/app-shell.tsx` (was 7/10)
Refactor the Framer Motion transition for the hamburger button to use a named constant from `lib/constants.ts`. Replace the hardcoded `z-50` with a named z-index constant. Migrate the inline SVG hamburger icon to a dedicated `SFIcon` component. Improve the type definition for the `dbStats` prop.
[38;5;114m+14[0m [38;5;203m-13[0m lines

### [2026-03-10 09:50:24] `frontend/src/hooks/use-backtest.ts` (was 7/10)
1. Integrate the dedicated logging module throughout the hook, replacing direct `console` calls with structured loggers. 2. Refactor `run` and `cancel` callbacks to use a `useRef` to access the latest `progress` state, allowing `progress.status` to be removed from their dependency arrays. 3. Enhance error handling in the `catch` block to explicitly identify and set the `validation_error` type based on API response characteristics. 4. Wrap `console.debug` statements within a conditional check for `process.env.NODE_ENV === 'development'` or configure the new logging module to filter debug logs in production.
[38;5;114m+83[0m [38;5;203m-76[0m lines

### [2026-03-10 09:50:59] `frontend/src/lib/constants.ts` (was 7/10)
Refactor `lib/constants.ts` to include all foundational constants for animations, motion, layout (e.g., `z-index`), interactive states (e.g., hover/focus glow tokens), precise typography values (e.g., letter-spacing), and any remaining magic numbers related to timing from hooks/services. Ensure relevant components are updated to consume these new centralized constants, further solidifying the design system's technical foundation.
[38;5;114m+89[0m [38;5;203m-17[0m lines

### [2026-03-10 09:53:24] `frontend/src/app/dashboard/page.tsx` (was 8/10)
Refactor the `SFSymbol` component to utilize genuine SF Symbols, ensuring precise typography for all headings and labels, and reconsider the layout strategy for displaying trading cards to eliminate internal scroll areas for a more seamless user experience.
[38;5;114m+35[0m [38;5;203m-72[0m lines

### [2026-03-10 09:54:20] `frontend/src/components/ui/dialog.tsx` (was 8/10)
Increase the visual size of the mobile grab handle to better convey interactivity and align with touch target best practices. Define and utilize semantic z-index constants for all layered elements in `lib/constants.ts`. Refactor the `DialogDescription` to provide a more neutral base, allowing consumers to apply specific link styles via props or context.
[38;5;114m+23[0m [38;5;203m-11[0m lines

### [2026-03-10 09:55:26] `frontend/src/components/ui/table.tsx` (was 8/10)
Refine the hover effects for sticky table cells to ensure they consistently receive the accent glow defined for `TABLE_ROW_HOVER_SHADOW`. Explore implementing dynamic shadows for sticky headers and footers that react to scroll position, enhancing the sense of elevation. Adjust the visual proportion of skeleton content within cells to better align with the overall generous padding and height of the table rows.
[38;5;114m+131[0m [38;5;203m-73[0m lines

### [2026-03-10 09:56:29] `frontend/src/components/momentum/top-signals.tsx` (was 8/10)
Refine the `FlashOnChange` background highlight implementation to remove reliance on negative margins, exploring more declarative CSS techniques. Investigate options for a more seamlessly integrated scrollbar experience that does not require explicit padding adjustments. Audit the CSS implementation of the `shimmer` effect to ensure it meets performance and visual fluidity standards, potentially abstracting its properties to `lib/constants.ts`.
[38;5;114m+25[0m [38;5;203m-15[0m lines

### [2026-03-10 09:57:05] `frontend/src/components/momentum/sector-heatmap.tsx` (was 8/10)
1. Refactor the interactive sector `motion.div` to be a semantically correct `<button>` or include `role="button"` and `tabIndex="0"` along with keyboard event handlers (Enter/Space) for accessibility. 2. Implement a responsive skeleton loader component to display while `sectors` data is being fetched, ensuring a smooth and consistent loading experience. 3. Introduce a distinct visual state or a subtle `Tooltip` on the sentiment bar for individual sectors that have genuinely missing or insufficient sentiment data.
[38;5;114m+97[0m [38;5;203m-21[0m lines

### [2026-03-10 09:58:10] `frontend/src/types/momentum.ts` (was 8/10)
1. Update `Strategy.etf_cost_est` to `USDAmount | null`, clarifying that formatting for display should occur at the UI level. 2. Introduce a `NavSection` type derived from `SIDEBAR_NAV` and apply it to `NavItem.section`. 3. Create an `ISOYearMonthString` branded type and use it for `MonthlyReturn.month`.
[38;5;114m+11[0m [38;5;203m-3[0m lines

### [2026-03-10 10:24:30] `frontend/src/components/layout/topnav.tsx` (was 2/10)
1. Implement Genuine SF Symbols: Replace the current `SFIcon` with a method that renders actual SF Symbols (e.g., via font or SVG). 2. Refactor Color Usage: Update all direct Tailwind color classes to use `getTextColorClass` and `getBackgroundColorClass` from `lib/utils.ts`. 3. Centralize Constants: Move `SPRING_TRANSITION_PRESET`, `VAR_ACCENT_GLOW_CYAN`, and `z-50` into `lib/constants.ts` with semantic names and consume them. 4. Refine Label Typography: Apply a precise letter-spacing constant to navigation labels.
[38;5;114m+83[0m [38;5;203m-48[0m lines

### [2026-03-10 10:24:58] `frontend/src/components/ui/apple-card.tsx` (was 4/10)
1. Implement `getAccentRgba(colorKey: PaletteColorKey, opacity: number): string` in `lib/utils.ts` to convert the given `PaletteColorKey` into a valid `rgba()` string, resolving the critical build error. 2. Refactor the `whileHoverProps` to dynamically generate the accent glow `boxShadow` using this new utility (e.g., `getAccentRgba`) or a dedicated `getAccentShadowStyle` utility in `lib/utils.ts`, removing reliance on pre-defined CSS variables like `--shadow-glow-{color}` for increased flexibility and consistency.
[38;5;114m+22[0m [38;5;203m-20[0m lines

### [2026-03-10 10:26:32] `frontend/src/components/momentum/ticker-search.tsx` (was 4/10)
1. **Implement `getRgbaString`**: Add `getRgbaString` to `lib/utils.ts` to provide the necessary RGBA conversion for shadow colors, ensuring the component compiles and runs correctly. 2. **Extract `SFIcon`**: Move the `SFIcon` component definition to `components/ui/SFIcon.tsx` and import it into `ticker-search.tsx` to adhere to component modularity and reusability standards. 3. **Correct Spinner Border**: Adjust the `LoadingSpinner`'s border-top class to correctly apply the accent color using a valid Tailwind utility or by modifying `getBorderColorClass` to return only the color segment when needed. 4. **Standardize Logging**: Replace direct `console.error` calls with the application's dedicated logging module for consistent error handling. 5. **Refine Framer Motion Transitions**: Remove the redundant `transition={SPRING_TRANSITION_PROPS}` prop from the main dropdown `motion.div`, allowing `dropdownVariants` to fully control its animation states as intended. 6. **Unify Background Colors**: Replace `bg-[var(--card-subtle)]` with a call to `getBackgroundColorClass` using a specific shade and opacity to align with the design system's color token management. 7. **Centralize Touch Target Size**: Define a constant like `MIN_TOUCH_TARGET_SIZE = '44px'` in `lib/constants.ts` and apply it using Tailwind's arbitrary values or a custom utility for all `min-h-[44px]` instances.
[38;5;114m+42[0m [38;5;203m-98[0m lines

### [2026-03-10 10:27:24] `frontend/src/components/momentum/strategy-card.tsx` (was 4/10)
1. Immediately resolve the missing `getColorWithAlpha` utility in `lib/utils.ts` by implementing it or replacing its usage with an existing color token utility. 2. Replace the `z-[1]` with a semantic z-index constant from `lib/constants.ts`. 3. Refactor the `AnimatedValue` flash animation transition to use a dedicated Framer Motion keyframes/tween definition or ensure it strictly adheres to spring physics without conflicting `duration` and `times` properties. 4. Explicitly apply `font-inter` to the `options_note` element.
[38;5;114m+66[0m [38;5;203m-30[0m lines

### [2026-03-10 10:29:30] `frontend/src/app/page.tsx` (was 5/10)
1. Immediately fix the `SignalListItem` syntax error to ensure the application builds and runs correctly. 2. Refactor the local `SFIcon` component to import and utilize the centralized, genuine SF Symbol component as intended by the design system, ensuring consistent premium iconography. 3. Re-implement the "Live Signal Feed" using semantic `<table>`, `<thead>`, `<tbody>`, `<th>`, and `<td>` elements, while retaining the existing visual styling and sticky header functionality to improve accessibility and semantic correctness. 4. Refine type definitions for `platformModules` color properties to align more precisely with `PaletteColorKey` to enhance type safety.
[38;5;114m+114[0m [38;5;203m-109[0m lines

### [2026-03-10 10:30:22] `frontend/src/components/momentum/screener-table.tsx` (was 5/10)
Refactor `ScreenerTable` to utilize and compose the `components/ui/table.tsx` primitive for all table rendering, ensuring adherence to its API and leveraging its built-in features (e.g., sticky headers, hover effects, dynamic shadows). Subsequently, update `ScreenerTableSkeleton` to also compose `components/ui/table.tsx` and render skeleton cells within its structure. Finally, ensure `FlashCell` uses the imported `FLASH_COLORS` constants for background colors during its animation.
[38;5;114m+153[0m [38;5;203m-243[0m lines

### [2026-03-10 10:31:33] `frontend/src/components/momentum/top-signals.tsx` (was 5/10)
1. Remove the `max-h-80 overflow-y-auto`. Re-evaluate the layout strategy to either allow the parent container to manage vertical scrolling or implement pagination/infinite scroll for signal lists to prevent nested scrollbars. 2. Increase the typography scale for probability and daily change numbers to `text-base` or `text-lg` and ensure they are `font-bold` or `font-extrabold` to embody the "numbers are art" philosophy. 3. Abstract the `shimmer` animation properties into `lib/constants.ts` for centralized management and apply them consistently. 4. Update the `FlashOnChangeProps` to type `flashColor` using a union of `COLORS` values (e.g., `typeof COLORS.cyan | typeof COLORS.emerald | typeof COLORS.rose`).
[38;5;114m+25[0m [38;5;203m-18[0m lines

### [2026-03-10 10:31:57] `frontend/src/components/momentum/mini-signal-list.tsx` (was 5/10)
1. Immediately re-enable Spacebar key activation for `MiniSignalListItem` to meet fundamental accessibility standards for button elements. 2. Define and apply a custom Tailwind utility (e.g., `tracking-hero`) or a direct CSS property using a constant from `lib/constants.ts` for the precise `-0.03em` letter-spacing on headings. 3. Review available SF Symbols to replace the custom `NoSignalsIcon` with an `SFIcon` if a semantically appropriate option exists.
[38;5;114m+4[0m [38;5;203m-12[0m lines

### [2026-03-10 10:33:31] `frontend/src/components/momentum/yield-table.tsx` (was 5/10)
1. Prioritize refactoring `SFIcon` to integrate genuine SF Symbols, aligning with Apple's design language. 2. Redesign `FlashWrapper`'s animation to use `opacity` or `transform` for the visual flash effect, completely avoiding `backgroundColor` animation to adhere to performance standards. 3. Standardize hover effects across all table cells, especially sticky headers and columns, to consistently include the accent glow. Implement dynamic shadows for sticky headers based on scroll. 4. Replace all hardcoded `z-index` values with semantic constants from `lib/constants.ts`. 5. Re-evaluate and refine the `FlashWrapper`'s visual subtlety and duration to ensure real-time updates enhance, rather than detract from, information density. 6. Explicitly ensure the search input, and all interactive table headers, meet the 44x44px touch target minimum.
[38;5;114m+124[0m [38;5;203m-83[0m lines

### [2026-03-10 10:34:33] `frontend/src/components/charts/equity-chart.tsx` (was 5/10)
1. Define a semantic z-index constant (e.g., `Z_INDEX_FLASH`) in `lib/constants.ts` and update the flash animation to use it. 2. Replace the local `SFIcon` with a globally implemented, genuine SF Symbols component, or refactor the current local implementation to dynamically load SF Symbol paths. 3. Update the flash animation's transition to utilize `SPRING_TRANSITION` from `lib/constants.ts`. 4. Extract the shimmer effect's `duration` and `ease` to constants in `lib/constants.ts` and apply them. 5. Refactor static text color classes to use `getTextColorClass` from `lib/utils.ts` where appropriate.
[38;5;114m+77[0m [38;5;203m-43[0m lines

### [2026-03-10 10:36:20] `frontend/src/components/momentum/sector-heatmap.tsx` (was 5/10)
General improvement
[38;5;114m+36[0m [38;5;203m-35[0m lines

### [2026-03-10 10:37:10] `frontend/src/hooks/use-backtest.ts` (was 5/10)
General improvement
[38;5;114m+114[0m [38;5;203m-73[0m lines

### [2026-03-10 10:38:37] `frontend/src/components/ui/sheet.tsx` (was 6/10)
1. Replace all hardcoded `z-50` values with semantic `Z_INDEX_SHEET` (or similar) constants from `lib/constants.ts`. 2. Refactor the `motion.div` drag handle to be a keyboard-accessible element with `role="button"` and appropriate event handlers, and ensure its interactive touch target area is at least `44x44px`. 3. Migrate the inline `boxShadow` to a dedicated Tailwind class, or extend `cn` to apply it from `globals.css` if it's a CSS variable. 4. Implement a subtle entry/exit animation for the close button, possibly by wrapping it in its own `motion.div` with an `AnimatePresence` or by integrating its `initial`/`animate`/`exit` states within the `popupVariants`.
[38;5;114m+70[0m [38;5;203m-39[0m lines

### [2026-03-10 10:38:57] `frontend/src/components/ui/tooltip.tsx` (was 6/10)
1. Define a semantic z-index constant (e.g., `Z_INDEX_TOOLTIP`) in `lib/constants.ts` and apply it to `TooltipPrimitive.Positioner` and `MotionPopup`. 2. Harmonize the border-radius for the `TooltipPrimitive.Arrow` to visually match the `rounded-2xl` of the `TooltipContent` for a consistent premium feel. 3. Review the `text-xs` typography choice for `TooltipContent` and consider if `text-sm` or a `text-xs` variant with a refined `letter-spacing` from `lib/constants.ts` would better serve readability and the 'typography is THE hero' principle.
[38;5;114m+13[0m [38;5;203m-8[0m lines

### [2026-03-10 10:41:10] `frontend/src/components/ui/table.tsx` (was 6/10)
Refactor sticky cell hover effects to consistently apply an outer accent glow matching `TABLE_ROW_HOVER_SHADOW`. Implement scroll-triggered dynamic shadows for sticky column headers based on horizontal scroll. Integrate custom scrollbar styling. Re-evaluate and correct the `TableRow` `overflow-hidden` and `border-radius` interaction for crisp visual boundaries. Enhance `TableCellSkeleton` to feature more varied and nuanced placeholder widths.
[38;5;114m+225[0m [38;5;203m-79[0m lines

### [2026-03-10 10:41:46] `frontend/src/components/momentum/leaderboard.tsx` (was 6/10)
1. Refactor `LeaderboardItem` from a `motion.div` to a `motion.button` to ensure semantic correctness and improve accessibility. 2. Adjust the sticky header's background to `bg-card/80 backdrop-blur-md` or `bg-card/[0.45] backdrop-blur-xl` to maintain visual consistency with the parent `apple-card`'s glassmorphism effect. 3. Refactor the sentiment-to-style mapping logic within `LeaderboardItem`'s `useMemo` into a more declarative, data-driven approach. 4. Update the `FLASH_TRANSITION` definition in `lib/constants.ts` to use a tokenized color derived from `getTextColorClass` or `getBackgroundColorClass`, if feasible, for `COLORS.cyan`.
[38;5;114m+100[0m [38;5;203m-86[0m lines

### [2026-03-10 10:43:31] `frontend/src/components/momentum/sentiment-badge.tsx` (was 6/10)
1. If the badge is interactive, refactor `motion.span` to `motion.button`, ensuring proper accessibility attributes (e.g., `aria-label`) and keyboard event handling. If not interactive, reconsider the `whileHover` effect or replace `translateY` with a more subtle visual cue (e.g., shadow only). 2. Refactor `SENTIMENT_STYLES` in `lib/constants.ts` to store `PaletteColorKey` and `shade` instead of full Tailwind class strings. Update `getSentimentClasses` in `lib/utils.ts` to compose the final Tailwind classes using `getBackgroundColorClass`, `getTextColorClass`, and `getBorderColorClass`. 3. Define the concrete values for `--shadow-soft`, `--shadow-card`, and `--shadow-glow-cyan` as JavaScript constants in `lib/constants.ts` (e.g., `SHADOW_GLOW_CYAN_VALUE = "0 0 12px rgba(6, 182, 212, 0.6)"`). Update the `boxShadow` in `motionProps` to reference these constants, either directly or via a controlled CSS variable system tied to JS constants.
[38;5;114m+35[0m [38;5;203m-13[0m lines

### [2026-03-10 10:44:16] `frontend/src/components/layout/sidebar.tsx` (was 6/10)
1. Extract `SFIcon` to `components/ui/SFIcon.tsx` and refactor it to utilize genuine SF Symbols through an appropriate integration (e.g., a dedicated font or web library), removing hardcoded SVG paths. 2. Define and apply semantic z-index constants from `lib/constants.ts` for all layered elements including the sticky section headers and the mobile sidebar overlay. 3. Re-evaluate the custom scrollbar styling to ensure a visually seamless and less intrusive experience, minimizing explicit padding adjustments around it.
[38;5;114m+15[0m [38;5;203m-115[0m lines

### [2026-03-10 10:46:29] `frontend/src/services/api.ts` (was 6/10)
1. Conduct a comprehensive audit of TypeScript configuration, type definitions, and build processes for the `services/api.ts` file, ensuring robust type safety with no implicit `any` and strict null checks. Implement dedicated unit tests for API data contracts and WebSocket message types. 2. Fully integrate the `logTelemetry` function with chosen production observability tools (error tracking, APM, analytics) to capture, monitor, and alert on critical service events and performance metrics. 3. Refine the WebSocket reconnection logic to introduce an initial exponential backoff or a slightly longer fixed delay for the very first reconnect attempt, preventing overly aggressive retries in the face of immediate connection failures. 4. Enhance type safety within `ChannelEventEmitter` for generic WebSocket messages by exploring mechanisms like runtime type guards or union types for common message payloads to provide stronger compile-time guarantees for listeners.
[38;5;114m+136[0m [38;5;203m-77[0m lines

### [2026-03-10 10:47:06] `frontend/src/components/ui/select.tsx` (was 7/10)
1. Replace all hardcoded `z-index` values with defined constants from `lib/constants.ts`. 2. Introduce a prop to `SelectContent` or `Select` to allow the mobile `SheetTitle` to be customized based on context. 3. Audit `SelectPrimitive.Item` to ensure it renders semantically correct HTML with appropriate ARIA roles and keyboard interaction support, possibly by ensuring the primitive supports it or by wrapping with a semantic `button`.
[38;5;114m+31[0m [38;5;203m-15[0m lines

### [2026-03-10 10:49:35] `frontend/src/components/momentum/strategy-builder.tsx` (was 7/10)
Refactor color utility usage to correctly apply Tailwind variants and opacity modifiers, addressing specific misapplications in buttons, checkboxes, and icons. Centralize all animation, hover, and state-related magic numbers into `lib/constants.ts`. Harmonize accent color shades and apply consistent table hover effects across the component.
[38;5;114m+42[0m [38;5;203m-37[0m lines

### [2026-03-10 10:50:14] `frontend/src/components/momentum/regime-badge.tsx` (was 7/10)
Refactor the `motion.span` to a semantically correct interactive element such as `<motion.button>` or `<motion.div role='button' tabIndex='0'>`. Implement `onKeyDown` handlers for `Enter` and `Space` keys to trigger interaction. Introduce a `whileFocus` state in Framer Motion, mirroring the `whileHover` effect to provide consistent visual feedback for keyboard users.
[38;5;114m+33[0m [38;5;203m-28[0m lines

### [2026-03-10 10:52:07] `frontend/src/components/momentum/backtest-results.tsx` (was 7/10)
Refactor all hardcoded Tailwind color classes to use the design token utility functions from `lib/utils.ts`. Replace fixed height definitions on `AppleCard` components with more flexible responsive approaches. Refine the table row styling to ensure consistent and artifact-free rounding. Centralize the sticky header's `z-index` into `lib/constants.ts`. Simplify the Drawdown Chart placeholder to align with a minimal skeleton pattern.
[38;5;114m+85[0m [38;5;203m-78[0m lines

### [2026-03-10 10:52:53] `frontend/src/components/charts/price-chart.tsx` (was 7/10)
Refine the flash animation to subtly tint the `apple-card` background (e.g., via a pseudo-element or `box-shadow`) while preserving the `backdrop-blur`. Update `ChartSkeleton` to use responsive padding that mirrors the main chart container's styling. Move `min-h-[260px]` to a named constant in `lib/constants.ts`. Verify and ensure `getColorWithAlpha` is properly defined in `lib/utils.ts`.
[38;5;114m+8[0m [38;5;203m-8[0m lines

### [2026-03-10 10:54:35] `frontend/src/hooks/use-strategy.ts` (was 7/10)
1. Move `estimatedTotalDurationMs` and `initialProgressSteps` to `lib/constants.ts` and import them. 2. Ensure `services/api.ts` is correctly typed so `getBacktestHistory` returns `Promise<BacktestHistoryApiResponse>` directly, removing the need for `as` assertion. 3. Refactor `save` function parameters to use a discriminated union for `type` and its corresponding `config` or `code` properties. 4. Enhance the `executeBacktest` `catch` block to inspect thrown API error objects (if available from `services/api.ts`) for specific validation details and map them to `VALIDATION_ERROR`.
[38;5;114m+163[0m [38;5;203m-43[0m lines

### [2026-03-10 10:55:34] `frontend/src/lib/utils.ts` (was 7/10)
1. Reconcile `PaletteColorKey` with the officially documented `globals.css` color palette by either updating `globals.css` to explicitly include the additional colors or removing them from `PaletteColorKey` if they are not intended for system-wide use. 2. Replace `console.warn` statements in `getSentimentClasses` and `getRegimeClasses` with a centralized logging solution that allows for filtering of warning messages in production environments, leveraging the precedent set by the logging module integration in `use-backtest.ts`.
[38;5;114m+78[0m [38;5;203m-16[0m lines

### [2026-03-10 10:57:30] `frontend/src/app/dashboard/page.tsx` (was 8/10)
1. Conduct a whitespace audit across all breakpoints, particularly on desktop, to introduce more intentional negative space between major dashboard sections, creating a more serene and premium feel. 2. Experiment with alternative visual separators for list items and component boundaries, prioritizing tonal surfaces or subtle shadows over explicit borders. 3. Review all non-data UI elements to ensure `cyan` remains the singular accent color, reserving other palette colors exclusively for semantic data representation where differentiation is critical.
[38;5;114m+36[0m [38;5;203m-31[0m lines

### [2026-03-10 10:58:17] `frontend/src/components/ui/card.tsx` (was 8/10)
Refactor explicit border-radius values to consume a shared constant from `lib/constants.ts`. Clarify and enhance `CardAction`'s accessibility for direct interactivity if intended. Evaluate options to internalize `apple-card`'s core styling into the `Card` component for better encapsulation.
[38;5;114m+26[0m [38;5;203m-5[0m lines

### [2026-03-10 10:59:35] `frontend/src/components/ui/button.tsx` (was 8/10)
1. Standardize all interactive element transitions to use a unified motion language, either by applying Framer Motion's spring physics to `backgroundColor` changes or by defining a custom Tailwind utility for `transition-colors` that uses a consistent, spring-like cubic-bezier easing curve. 2. Refactor color palette type definitions to use a single `PaletteColorKey` source, exported from `lib/utils.ts` or `lib/constants.ts`, to ensure type consistency across the codebase. 3. Audit and confirm that `MIN_BUTTON_HEIGHT_PX`, `BUTTON_HEIGHT_LG_PX`, and associated padding values result in minimum 44x44px touch targets across all button sizes and breakpoints. 4. Define explicit neutral focus color tokens (e.g., `FOCUS_NEUTRAL_BACKGROUND_COLOR_KEY` and its opacity) in `lib/constants.ts` and utilize them in `getFocusBackgroundColorValue` for all neutral variants.
[38;5;114m+18[0m [38;5;203m-48[0m lines

### [2026-03-10 11:00:16] `frontend/src/components/ui/input.tsx` (was 8/10)
Implement a `whileTap` state for a complete interactive experience, providing immediate feedback on press. Consolidate all motion properties under Framer Motion's `transition` to remove redundant Tailwind CSS transitions. Review and potentially abstract direct spacing and typography Tailwind classes into semantic design tokens for enhanced system consistency.
[38;5;114m+10[0m [38;5;203m-4[0m lines

### [2026-03-10 11:01:37] `frontend/src/hooks/use-signals.ts` (was 8/10)
Refactor `compareValues` within the `sortedSignals` `useMemo` to leverage more specific type parameters or conditional types for `a` and `b`, aiming for full compile-time type safety across all sortable `Signal` properties while retaining its current runtime robustness for diverse data types.
[38;5;114m+16[0m [38;5;203m-32[0m lines

### [2026-03-10 11:29:12] `frontend/src/components/momentum/trending-sectors.tsx` (was 3/10)
1. Define `getAccentRgba` and `getCardBgRgba` in `lib/utils.ts` following existing utility patterns. 2. Refactor `TrendingSectorItem` to be a semantically correct interactive element (e.g., `motion.button` or `motion.div` with `role='button'`, `tabIndex='0'`, `onKeyDown` handlers, and a `whileFocus` state). 3. Replace the `SFIcon` text fallback with a more appropriate visual solution, such as a different placeholder SVG or a more robust SF Symbol integration. 4. Update `Separator` to use a color class from the design token system, e.g., a toned-down `bg-background` variant. 5. Validate the performance and visual integrity of the `backgroundColor` animation on hover with `backdrop-blur`, considering alternative tinting methods if necessary.
[38;5;114m+97[0m [38;5;203m-31[0m lines

### [2026-03-10 11:29:55] `frontend/src/components/ui/apple-card.tsx` (was 4/10)
1. **Restore Critical Utilities:** Immediately re-implement or correct the definitions for `getAccentRgba` and `getAccentShadowStyle` in `lib/utils.ts` to ensure the component builds successfully and the premium visual effects (shadows, glow) are correctly applied. 2. **Enhance Keyboard Accessibility:** When `interactive` is true, add `role="button"`, `tabIndex="0"`, `onKeyDown` handlers for `Enter` and `Space` keys to trigger interaction, and implement a `whileFocus` Framer Motion state that mirrors the `whileHover` effect for comprehensive keyboard user experience. 3. **Integrate Backdrop Blur:** Explicitly apply `backdrop-blur` to the `AppleCard` component's base styling to align with the `globals.css` palette and consistently deliver the desired "glass/translucency" aesthetic. 4. **Refine Z-index Usage:** Review and potentially refactor how `z-index` is applied, possibly introducing semantic Tailwind utility classes for `z-glow` and `z-content` to improve readability and maintainability.
[38;5;114m+40[0m [38;5;203m-12[0m lines

### [2026-03-10 11:31:57] `frontend/src/components/momentum/sentiment-badge.tsx` (was 4/10)
1. Move all shadow definitions (`LOCAL_SHADOW_SOFT`, `LOCAL_SHADOW_CARD_ELEVATED`, `LOCAL_SHADOW_GLOW_CYAN`) to `lib/constants.ts` as named design tokens. 2. Refactor the glow logic in `whileHover` to dynamically use a glow color derived from the badge's `sentiment` (via `getSentimentClasses`' `colorKey`) or, if a global interactive glow is preferred, ensure it aligns with the 'one accent color' rule without clashing with the badge's semantic color. 3. Add `whileFocus` and `whileTap` states to `motionProps`, ensuring they align with the existing `whileHover` and `SPRING_TRANSITION_PROPS` for a complete interactive experience. 4. Re-evaluate the application of `style.border` to ensure borders are only visibly rendered when explicitly required, aligning with the 'minimal borders' philosophy.
[38;5;114m+51[0m [38;5;203m-35[0m lines

### [2026-03-10 11:32:34] `frontend/src/components/momentum/rotation-signals.tsx` (was 4/10)
1. Replace `getTextColorClass('slate', '300')` with a semantically appropriate design token (e.g., `text-muted-foreground`) or explicitly add 'slate' to `PaletteColorKey` and `globals.css` if it is a truly intended system color. 2. Refactor the interactive `motion.div` elements to include `role='button'`, `tabIndex='0'`, `onKeyDown` handlers, and a `whileFocus` state, ensuring full keyboard accessibility and consistent interactive feedback. 3. Implement a `whileTap` state for the interactive signal items to provide immediate visual feedback upon press. 4. Standardize the `border-radius` of interactive elements to meet the `1rem+` standard, using `rounded-2xl` or a shared constant from `lib/constants.ts`.
[38;5;114m+35[0m [38;5;203m-9[0m lines
