import { cn } from "../lib/utils";

type IconProps = {
  className?: string;
};

export function LogoMark({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="58"
      height="48"
      viewBox="0 0 58 48"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Miithii"
    >
      <rect x="4" y="17" width="6" height="14" rx="3" fill="var(--color-primary)" />
      <rect x="15" y="12" width="6" height="24" rx="3" fill="var(--color-primary)" />
      <rect x="26" y="6" width="6" height="36" rx="3" fill="var(--color-accent)" />
      <rect x="37" y="12" width="6" height="24" rx="3" fill="var(--color-primary)" />
      <rect x="48" y="17" width="6" height="14" rx="3" fill="var(--color-primary)" />
    </svg>
  );
}

export function LogoWordmark({ className }: IconProps) {
  return (
    <span className={cn("mi-wordmark", className)} aria-label="Miithii">
      <LogoMark className="mi-wordmark__mark" />
      <span className="mi-wordmark__text">miithii</span>
    </span>
  );
}
