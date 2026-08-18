import type { TextareaHTMLAttributes } from "react";

import { cn } from "../lib/utils";

type ControlStateProps = {
  invalid?: boolean;
};

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlStateProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn("mi-input", "mi-textarea", invalid && "is-invalid", className)}
      {...props}
    />
  );
}
