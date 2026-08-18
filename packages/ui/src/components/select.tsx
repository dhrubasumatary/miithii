import type { SelectHTMLAttributes } from "react";

import { cn } from "../lib/utils";

type ControlStateProps = {
  invalid?: boolean;
};

export function Select({ className, invalid, ...props }: SelectHTMLAttributes<HTMLSelectElement> & ControlStateProps) {
  return <select aria-invalid={invalid || undefined} className={cn("mi-input", "mi-select", invalid && "is-invalid", className)} {...props} />;
}
