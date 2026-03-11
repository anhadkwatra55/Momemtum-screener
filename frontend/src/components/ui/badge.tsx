import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, MotionProps } from "framer-motion";
import React, { useMemo } from "react";

import { cn } from "@/lib/utils";
import { SPRING_PHYSICS_DEFAULT, TAP_PHYSICS_DEFAULT } from "@/lib/constants";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent whitespace-nowrap font-medium tracking-tight " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out " + // Removed ring-color/offset from transition
  "focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow-cyan)] " + // Unified focus indicator using shadow glow
  "has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 " +
  "[&>svg]:pointer-events-none [&>svg]:size-4 " +
  "glass-subtle",
  {
    variants: {
      variant: {
        emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        rose: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        violet: "bg-violet-500/15 text-violet-400 border-violet-500/30",
        subtle: "bg-slate-700/20 text-slate-300 border-slate-700/30",
        outline: "border-slate-600 text-slate-300 bg-transparent",
        ghost: "bg-transparent text-slate-300 hover:bg-slate-800/50",
        link: "text-cyan-400 underline-offset-4 hover:underline hover:text-cyan-300",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-7 px-3 py-1.5 text-xs",
        xs: "h-6 px-2.5 py-1 text-xs",
      },
      interactive: {
        true: "cursor-pointer",
        false: "",
      },
    },
    compoundVariants: [
      {
        interactive: true,
        variant: ["emerald", "rose", "amber", "cyan", "violet", "subtle", "outline"],
        className: "hover:bg-opacity-25 hover:border-opacity-40",
      },
      {
        interactive: true,
        className: "min-h-[44px]", // Ensures minimum touch target size for interactive badges
      },
    ],
    defaultVariants: {
      variant: "subtle",
      size: "default",
      interactive: false,
    },
  }
);

interface BadgeBaseProps extends useRender.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant = "subtle",
  size = "default",
  interactive = false,
  render,
  children,
  ...props
}: BadgeBaseProps & MotionProps) {
  const { Element, props: renderedProps } = useRender({
    defaultTagName: "span",
    props: {
      ...props,
      className: cn(badgeVariants({ variant, size, interactive }), className),
      ...(interactive && {
        tabIndex: 0,
        role: props.onClick ? "button" : "status",
      }),
      children,
    },
    render,
    state: {
      slot: "badge",
      variant,
      size,
      interactive,
    },
  });

  const MotionComponent = motion[Element as keyof typeof motion];

  const springConfig = useMemo(() => SPRING_PHYSICS_DEFAULT, []);
  const tapConfig = useMemo(() => TAP_PHYSICS_DEFAULT, []);

  const whileHoverProps = useMemo(
    () => (interactive
      ? {
          y: -2,
          boxShadow: "var(--shadow-glow-cyan)", // Consistent cyan glow on hover
          transition: springConfig,
          ...((props.whileHover || {}) as MotionProps["whileHover"]),
        }
      : undefined),
    [interactive, props.whileHover, springConfig]
  );

  const whileTapProps = useMemo(
    () => (interactive
      ? {
          scale: 0.98,
          transition: tapConfig,
          ...((props.whileTap || {}) as MotionProps["whileTap"]),
        }
      : undefined),
    [interactive, props.whileTap, tapConfig]
  );

  const whileFocusProps = useMemo(
    () => (interactive
      ? {
          y: -2, // Lift slightly on keyboard focus
          transition: springConfig,
          ...((props.whileFocus || {}) as MotionProps["whileFocus"]),
        }
      : undefined),
    [interactive, props.whileFocus, springConfig]
  );

  return (
    <MotionComponent
      {...renderedProps}
      whileHover={whileHoverProps}
      whileTap={whileTapProps}
      whileFocus={whileFocusProps}
    />
  );
}

const MemoizedBadge = React.memo(Badge) as typeof Badge;

export { MemoizedBadge as Badge, badgeVariants };