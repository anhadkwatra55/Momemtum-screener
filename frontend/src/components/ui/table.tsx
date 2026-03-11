"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn, getTextColorClass } from "@/lib/utils"
import { AppleCard } from "@/components/ui/apple-card"
import {
  SPRING_TRANSITION,
  TABLE_ROW_HOVER_SHADOW,
  CARD_HOVER_Y_OFFSET,
  Z_INDEX_STICKY_CELL,
  Z_INDEX_STICKY_HEADER_FOOTER,
  Z_INDEX_STICKY_HEAD,
  TABLE_SCROLLED_HEADER_SHADOW,
  TABLE_SCROLLED_FOOTER_SHADOW,
  TABLE_SCROLLED_LEFT_COLUMN_SHADOW, // New constant for left column shadow
  TABLE_SCROLLED_RIGHT_COLUMN_SHADOW, // New constant for right column shadow
} from "@/lib/constants"

// --- TableRow Hover Animation Properties ---
const TABLE_ROW_HOVER_PROPS = {
  y: CARD_HOVER_Y_OFFSET,
  // Combined elevated shadow with a subtle cyan glow for interactive elements
  boxShadow: TABLE_ROW_HOVER_SHADOW,
};

// -----------------------------------------------------------------------------
// Skeleton Sub-components
// -----------------------------------------------------------------------------

// Widths for varied skeleton bars to enhance visual variety
const SKELETON_WIDTHS = ["w-1/2", "w-2/3", "w-3/4", "w-5/6", "w-11/12"];

// Skeleton for a single table cell
const TableCellSkeleton = React.memo(function TableCellSkeleton({ className, ...props }: React.ComponentProps<"td">) {
  // Randomly select a width for the skeleton bar
  const randomWidth = React.useMemo(() => SKELETON_WIDTHS[Math.floor(Math.random() * SKELETON_WIDTHS.length)], []);
  // Apply a subtle random delay to the shimmer animation for a more natural effect
  const randomDelay = React.useMemo(() => Math.random() * 0.2 + 0.05, []);

  return (
    <td
      className={cn(
        "py-4 px-6",
        "align-middle",
        "whitespace-nowrap",
        "h-14", // Ensure consistent height with actual cells
        "flex items-center", // Vertically center the skeleton bar
        className
      )}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
          delay: randomDelay,
        }}
        className={cn("h-6 rounded-[var(--radius-lg)] bg-gray-700/50", randomWidth)}
      />
    </td>
  );
});

// Skeleton for an entire table row
interface TableRowSkeletonProps extends React.ComponentProps<"tr"> {
  columns: number; // Number of columns to render skeletons for
  isStickyLeft?: boolean;
  isStickyRight?: boolean;
  isScrolledXLeft?: boolean; // For dynamic sticky column shadows
  isScrolledXRight?: boolean; // For dynamic sticky column shadows
}

const TableRowSkeleton = React.memo(function TableRowSkeleton({
  columns,
  className,
  isStickyLeft,
  isStickyRight,
  isScrolledXLeft,
  isScrolledXRight,
  ...props
}: TableRowSkeletonProps) {
  const getStickyCellClasses = React.useCallback((isLeft: boolean, isRight: boolean, scrolledLeft: boolean, scrolledRight: boolean) => {
    return cn(
      `sticky z-[${Z_INDEX_STICKY_CELL}]`, // z-index lower than header/footer but higher than regular cells
      "bg-card/80 backdrop-blur-md", // Apply translucency for sticky elements
      isLeft && "left-0",
      isRight && "right-0",
      // Apply dynamic shadows for sticky skeleton cells when scrolled
      isLeft && scrolledLeft && `shadow-[${TABLE_SCROLLED_LEFT_COLUMN_SHADOW}]`,
      isRight && scrolledRight && `shadow-[${TABLE_SCROLLED_RIGHT_COLUMN_SHADOW}]`,
    );
  }, []);

  return (
    <tr
      data-slot="table-row-skeleton"
      className={cn(
        "relative",
        "text-white",
        "rounded-[var(--radius-lg)]", // Apply generous rounded corners to individual skeleton rows
        className
      )}
      {...props}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <TableCellSkeleton
          key={i}
          className={cn(
            i === 0 && isStickyLeft && getStickyCellClasses(true, false, isScrolledXLeft!, isScrolledXRight!),
            i === columns - 1 && isStickyRight && getStickyCellClasses(false, true, isScrolledXLeft!, isScrolledXRight!),
          )}
        />
      ))}
    </tr>
  );
});


// -----------------------------------------------------------------------------
// Table Root Component (acting as the card container)
// -----------------------------------------------------------------------------
interface TableProps extends React.ComponentProps<"table"> {
  containerClassName?: string; // For the outer card container
  isLoading?: boolean; // Prop for skeleton loader
  skeletonColumnCount?: number; // How many columns to render in skeleton mode
  skeletonRowCount?: number; // How many rows to render in skeleton mode
  isStickyLeftColumn?: boolean; // Enable sticky left column (first column)
  isStickyRightColumn?: boolean; // Enable sticky right column (last column)
}

// Define a type for the scroll container ref for better type safety
type ScrollableContainerRef = React.RefObject<HTMLDivElement>;

const Table = React.memo(function Table({
  className,
  containerClassName,
  isLoading = false,
  skeletonColumnCount = 5,
  skeletonRowCount = 5,
  isStickyLeftColumn = false,
  isStickyRightColumn = false,
  children,
  ...props
}: TableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const [isScrolledXLeft, setIsScrolledXLeft] = React.useState(false);
  const [isScrolledXRight, setIsScrolledXRight] = React.useState(false);

  // Monitor horizontal scroll for sticky column shadows
  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolledXLeft(container.scrollLeft > 0);
      // Check if there's still content to the right (allowing for a small tolerance)
      setIsScrolledXRight(container.scrollWidth - container.clientWidth - container.scrollLeft > 1);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Set initial state
    return () => container.removeEventListener("scroll", handleScroll);
  }, []); // Empty dependency array means this runs once on mount

  const tableBodyProps = React.useMemo(() => ({
    isLoading,
    skeletonColumnCount,
    skeletonRowCount,
    isStickyLeftColumn,
    isStickyRightColumn,
    isScrolledXLeft,
    isScrolledXRight,
  }), [isLoading, skeletonColumnCount, skeletonRowCount, isStickyLeftColumn, isStickyRightColumn, isScrolledXLeft, isScrolledXRight]);

  const headerFooterProps = React.useMemo(() => ({
    scrollRef,
    isScrolledXLeft,
    isScrolledXRight,
  }), [scrollRef, isScrolledXLeft, isScrolledXRight]);


  return (
    <AppleCard
      isInteractive={false} // Table rows are interactive, not the table container itself
      className={cn(
        "relative",
        // The AppleCard container itself provides the visual structure,
        // allowing internal elements like rows to have their own shadows.
        containerClassName
      )}
    >
      <div
        data-slot="table-scroll-container"
        ref={scrollRef} // Attach scroll ref to this div
        className={cn(
          "relative w-full",
          "overflow-x-auto overflow-y-auto", // Enable both horizontal and vertical scrolling
          "horizontal-scroll-on-mobile", // Global utility for mobile horizontal scroll
          "max-h-[min(80vh,800px)]", // Constrain vertical height, enabling `overflow-y-auto`
          // Custom scrollbar styling for a premium, integrated look
          "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2", // width for vertical, height for horizontal scrollbar
          "[&::-webkit-scrollbar-track]:bg-transparent", // Transparent track
          "[&::-webkit-scrollbar-thumb]:bg-slate-700/50", // Darker thumb with transparency
          "[&::-webkit-scrollbar-thumb]:hover:bg-slate-600/70", // Subtle hover state
          "[&::-webkit-scrollbar-thumb]:rounded-full", // Rounded thumb
        )}
      >
        <table
          data-slot="table"
          className={cn(
            "w-full caption-bottom text-sm",
            "border-separate", // Allows border-spacing and individual row styling
            "border-spacing-y-4", // Generous vertical spacing for card-like rows
            "border-spacing-x-0", // No horizontal spacing between cells (managed by cell padding)
            className
          )}
          {...props}
        >
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              if (child.type === TableBody) {
                // Pass loading state and skeleton props to TableBody
                return React.cloneElement(child as React.ReactElement<TableBodyPropsWithLoading>, tableBodyProps);
              }
              if (child.type === TableHeader || child.type === TableFooter) {
                // Pass the scrollRef and horizontal scroll states to TableHeader and TableFooter for dynamic shadows
                return React.cloneElement(child as React.ReactElement<TableHeaderProps | TableFooterProps>, headerFooterProps);
              }
            }
            return child;
          })}
        </table>
      </div>
    </AppleCard>
  )
});

// -----------------------------------------------------------------------------
// TableHeader
// -----------------------------------------------------------------------------
interface TableHeaderProps extends React.ComponentProps<"thead"> {
  scrollRef?: ScrollableContainerRef;
  isScrolledXLeft?: boolean;
  isScrolledXRight?: boolean;
}

const TableHeader = React.memo(function TableHeader({ className, scrollRef, children, isScrolledXLeft, isScrolledXRight, ...props }: TableHeaderProps) {
  const [isScrolledY, setIsScrolledY] = React.useState(false);

  // Monitor vertical scroll for header shadow
  React.useEffect(() => {
    const container = scrollRef?.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolledY(container.scrollTop > 0);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Set initial state
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollRef]);

  // Apply dynamic shadow based on vertical scroll state
  const headerShadowClass = isScrolledY
    ? `shadow-[${TABLE_SCROLLED_HEADER_SHADOW}]`
    : "shadow-[var(--shadow-soft)]"; // Default subtle shadow when not scrolled vertically

  return (
    <motion.thead
      data-slot="table-header"
      // Sticky header with a subtle translucent background and blur for a layered Apple aesthetic
      className={cn(
        `sticky top-0 z-[${Z_INDEX_STICKY_HEADER_FOOTER}] bg-card/80 backdrop-blur-md`,
        headerShadowClass, // Apply dynamic vertical scroll shadow
        className
      )}
      {...props}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === TableRow) {
          // Pass horizontal scroll states down to TableRow, which will then pass them to TableHead cells
          return React.cloneElement(child as React.ReactElement<TableRowProps>, {
            isScrolledXLeft,
            isScrolledXRight,
          });
        }
        return child;
      })}
    </motion.thead>
  )
});

// -----------------------------------------------------------------------------
// TableBody
// -----------------------------------------------------------------------------
interface TableBodyPropsWithLoading extends React.ComponentProps<"tbody"> {
  isLoading?: boolean;
  skeletonColumnCount?: number;
  skeletonRowCount?: number;
  isStickyLeftColumn?: boolean;
  isStickyRightColumn?: boolean;
  isScrolledXLeft?: boolean; // For dynamic sticky column shadows
  isScrolledXRight?: boolean; // For dynamic sticky column shadows
}

const TableBody = React.memo(function TableBody({
  className,
  isLoading = false,
  skeletonColumnCount = 5,
  skeletonRowCount = 5,
  isStickyLeftColumn = false,
  isStickyRightColumn = false,
  isScrolledXLeft,
  isScrolledXRight,
  children,
  ...props
}: TableBodyPropsWithLoading) {
  return (
    <motion.tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:mb-0", className)}
      {...props}
    >
      {isLoading ? (
        Array.from({ length: skeletonRowCount }).map((_, i) => (
          <TableRowSkeleton
            key={i}
            columns={skeletonColumnCount}
            isStickyLeft={isStickyLeftColumn}
            isStickyRight={isStickyRightColumn}
            isScrolledXLeft={isScrolledXLeft}
            isScrolledXRight={isScrolledXRight}
          />
        ))
      ) : (
        React.Children.map(children, child => {
          if (React.isValidElement(child) && child.type === TableRow) {
            // Pass horizontal scroll states to TableRow for its sticky cells
            return React.cloneElement(child as React.ReactElement<TableRowProps>, {
              isStickyLeft: isStickyLeftColumn, // Indicate if the row's first/last cell should be sticky
              isStickyRight: isStickyRightColumn, // (TableRow handles applying to specific cells)
              isScrolledXLeft,
              isScrolledXRight,
            });
          }
          return child;
        })
      )}
    </motion.tbody>
  )
});

// -----------------------------------------------------------------------------
// TableFooter
// -----------------------------------------------------------------------------
interface TableFooterProps extends React.ComponentProps<"tfoot"> {
  scrollRef?: ScrollableContainerRef;
  isScrolledXLeft?: boolean;
  isScrolledXRight?: boolean;
}

const TableFooter = React.memo(function TableFooter({ className, scrollRef, children, isScrolledXLeft, isScrolledXRight, ...props }: TableFooterProps) {
  const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(false);

  // Monitor vertical scroll for footer shadow
  React.useEffect(() => {
    const container = scrollRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const isScrollable = container.scrollHeight > container.clientHeight;
      // Check if scrolled to the very bottom (allowing for 1px tolerance)
      const scrolledToBottom = Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight - 1;
      // Footer shadow appears if there's content below (i.e., not scrolled to bottom)
      setIsScrolledToBottom(isScrollable && !scrolledToBottom);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Set initial state
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollRef]);

  // Apply dynamic shadow based on vertical scroll state
  const footerShadowClass = isScrolledToBottom
    ? `shadow-[${TABLE_SCROLLED_FOOTER_SHADOW}]` // Inset shadow when not at bottom
    : "shadow-[inset_var(--shadow-soft)]"; // Default subtle inset shadow when at bottom or not scrollable

  return (
    <motion.tfoot
      data-slot="table-footer"
      className={cn(
        `sticky bottom-0 z-[${Z_INDEX_STICKY_HEADER_FOOTER}]`,
        "bg-card/80 backdrop-blur-md",
        "font-medium text-slate-300",
        footerShadowClass, // Apply dynamic vertical scroll shadow
        className
      )}
      {...props}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === TableRow) {
          // Pass horizontal scroll states to TableRow for its sticky cells
          return React.cloneElement(child as React.ReactElement<TableRowProps>, {
            isScrolledXLeft,
            isScrolledXRight,
          });
        }
        return child;
      })}
    </motion.tfoot>
  )
});

// -----------------------------------------------------------------------------
// TableRow
// -----------------------------------------------------------------------------
interface TableRowProps extends React.ComponentProps<"tr"> {
  isStickyLeft?: boolean; // Prop to indicate if the first cell *should* be sticky left
  isStickyRight?: boolean; // Prop to indicate if the last cell *should* be sticky right
  isScrolledXLeft?: boolean;
  isScrolledXRight?: boolean;
}

const TableRow = React.memo(function TableRow({ className, children, isStickyLeft, isStickyRight, isScrolledXLeft, isScrolledXRight, ...props }: TableRowProps) {
  return (
    <motion.tr
      data-slot="table-row"
      initial={false}
      whileHover={TABLE_ROW_HOVER_PROPS}
      transition={SPRING_TRANSITION}
      className={cn(
        "relative",
        "text-white",
        "hover:bg-white/[0.03]",
        "data-[state=selected]:bg-cyan-500/[0.1]",
        "rounded-[var(--radius-lg)]",
        // Removed "overflow-hidden" to allow outer `TABLE_ROW_HOVER_SHADOW` to be visible.
        // The `border-radius` visually defines the card, and cells' backgrounds ensure filling.
        "group", // Allows child elements to react to parent hover
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child, i) => {
        if (React.isValidElement(child) && (child.type === TableCell || child.type === TableHead)) {
          // Automatically apply sticky props if `TableRow` is configured for sticky columns
          // and pass horizontal scroll states down for dynamic shadows
          return React.cloneElement(child as React.ReactElement<TableCellProps | TableHeadProps>, {
            isStickyLeft: isStickyLeft && i === 0, // Only apply sticky to the first child if configured
            isStickyRight: isStickyRight && i === React.Children.count(children) - 1, // Only apply sticky to the last child
            isScrolledXLeft,
            isScrolledXRight,
          });
        }
        return child;
      })}
    </motion.tr>
  )
});

// -----------------------------------------------------------------------------
// TableHead
// -----------------------------------------------------------------------------
interface TableHeadProps extends React.ComponentProps<"th"> {
  isStickyLeft?: boolean;
  isStickyRight?: boolean;
  isScrolledXLeft?: boolean; // Indicates if container is scrolled horizontally to the left
  isScrolledXRight?: boolean; // Indicates if container is scrolled horizontally to the right
}

const TableHead = React.memo(function TableHead({ className, isStickyLeft, isStickyRight, isScrolledXLeft, isScrolledXRight, ...props }: TableHeadProps) {
  const getStickyHeadClasses = React.useCallback((isLeft: boolean, isRight: boolean, scrolledLeft: boolean, scrolledRight: boolean) => {
    return cn(
      `sticky z-[${Z_INDEX_STICKY_HEAD}]`,
      "bg-card/80 backdrop-blur-md", // Translucent background for sticky header cells
      isLeft && "left-0",
      isRight && "right-0",
      // Dynamic shadows based on horizontal scroll
      isLeft && scrolledLeft && `shadow-[${TABLE_SCROLLED_LEFT_COLUMN_SHADOW}]`,
      isRight && scrolledRight && `shadow-[${TABLE_SCROLLED_RIGHT_COLUMN_SHADOW}]`,
      // No default static shadow; `backdrop-blur` provides sufficient depth
    );
  }, []);

  return (
    <motion.th
      data-slot="table-head"
      className={cn(
        "h-14", // Ensure minimum touch target height
        "px-6 py-3",
        "text-left align-middle",
        "font-semibold text-xs uppercase",
        "text-slate-400",
        "tracking-[0.1em]", // Tight tracking for uppercase labels
        "whitespace-nowrap",
        "[&:has([role=checkbox])]:pr-0",
        isStickyLeft && getStickyHeadClasses(true, false, isScrolledXLeft!, isScrolledXRight!),
        isStickyRight && getStickyHeadClasses(false, true, isScrolledXLeft!, isScrolledXRight!),
        className
      )}
      {...props}
    />
  )
});

// -----------------------------------------------------------------------------
// TableCell
// -----------------------------------------------------------------------------
interface TableCellProps extends React.ComponentProps<"td"> {
  isNumeric?: boolean;
  isPositive?: boolean;
  isNegative?: boolean;
  isStickyLeft?: boolean;
  isStickyRight?: boolean;
  isScrolledXLeft?: boolean; // Indicates if container is scrolled horizontally to the left
  isScrolledXRight?: boolean; // Indicates if container is scrolled horizontally to the right
}

const TableCell = React.memo(function TableCell({
  className,
  isNumeric,
  isPositive,
  isNegative,
  isStickyLeft,
  isStickyRight,
  isScrolledXLeft,
  isScrolledXRight,
  ...props
}: TableCellProps) {
  const textColorClass = React.useMemo(() => {
    if (isPositive) return getTextColorClass('emerald', '400');
    if (isNegative) return getTextColorClass('rose', '400');
    return "text-white";
  }, [isPositive, isNegative]);

  const getStickyCellClasses = React.useCallback((isLeft: boolean, isRight: boolean, scrolledLeft: boolean, scrolledRight: boolean) => {
    return cn(
      `sticky z-[${Z_INDEX_STICKY_CELL}]`,
      "bg-card/80 backdrop-blur-md", // Translucent background for sticky cells
      "group-hover:ring-1 group-hover:ring-cyan-500", // Consistent accent glow on hover for sticky cells
      isLeft && "left-0",
      isRight && "right-0",
      // Dynamic shadows based on horizontal scroll for sticky cells
      isLeft && scrolledLeft && `shadow-[${TABLE_SCROLLED_LEFT_COLUMN_SHADOW}]`,
      isRight && scrolledRight && `shadow-[${TABLE_SCROLLED_RIGHT_COLUMN_SHADOW}]`,
    );
  }, []);

  return (
    <motion.td
      data-slot="table-cell"
      className={cn(
        "py-4 px-6",
        "align-middle",
        "whitespace-nowrap",
        "[&:has([role=checkbox])]:pr-0",
        // Default background for non-sticky cells to ensure proper rounding visuals with TableRow
        // Sticky cells define their own `bg-card/80`
        !isStickyLeft && !isStickyRight && "bg-background",
        isNumeric && "font-mono-data text-lg font-bold text-right", // "Numbers are art" typography
        isNumeric && textColorClass,
        !isNumeric && "text-base text-white",
        isStickyLeft && getStickyCellClasses(true, false, isScrolledXLeft!, isScrolledXRight!),
        isStickyRight && getStickyCellClasses(false, true, isScrolledXLeft!, isScrolledXRight!),
        className
      )}
      {...props}
    />
  )
});

// -----------------------------------------------------------------------------
// TableCaption
// -----------------------------------------------------------------------------
const TableCaption = React.memo(function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(
        "mt-6 text-sm text-slate-500",
        className
      )}
      {...props}
    />
  )
});

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}