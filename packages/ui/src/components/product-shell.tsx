import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

export function ProductShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mi-product-shell", className)} {...props} />;
}

export function ProductHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={cn("mi-product-shell__header", className)} {...props} />;
}

export function ProductMain({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={cn("mi-product-shell__main", className)} {...props} />;
}
