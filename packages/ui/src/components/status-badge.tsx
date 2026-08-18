import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
};

export function StatusBadge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={cn("mi-badge", `mi-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
