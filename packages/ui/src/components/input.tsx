import type { InputHTMLAttributes } from "react";

import { cn } from "../lib/utils";

type ControlStateProps = {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & ControlStateProps) {
  return <input aria-invalid={invalid || undefined} className={cn("mi-input", invalid && "is-invalid", className)} {...props} />;
}
