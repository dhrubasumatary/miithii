import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ children, className, icon, variant = "secondary", type = "button", ...props }: ButtonProps) {
  return (
    <button className={cn("mi-button", `mi-button--${variant}`, className)} type={type} {...props}>
      {icon ? <span className="mi-button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
