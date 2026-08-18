import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

type FieldProps = Omit<HTMLAttributes<HTMLLabelElement>, "children"> & {
  children: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
};

export function Field({ children, className, error, hint, label, ...props }: FieldProps) {
  return (
    <label className={cn("mi-field", className)} {...props}>
      <span className="mi-field__label">{label}</span>
      {children}
      {hint ? <span className="mi-field__hint">{hint}</span> : null}
      {error ? <span className="mi-field__error">{error}</span> : null}
    </label>
  );
}
