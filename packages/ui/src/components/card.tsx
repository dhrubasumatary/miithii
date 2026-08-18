import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "soft";
};

export function Card({ className, tone = "default", ...props }: CardProps) {
  return <div className={cn("mi-card", `mi-card--${tone}`, className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mi-card__header", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("mi-card__title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mi-card__description", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mi-card__content", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mi-card__footer", className)} {...props} />;
}
