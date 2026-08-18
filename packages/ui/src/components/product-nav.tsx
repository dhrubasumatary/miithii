import { cn } from "../lib/utils";

type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

export function ProductNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="mi-product-nav" aria-label="Miithii products">
      {items.map((item) => (
        <a
          aria-current={item.active ? "page" : undefined}
          className={cn("mi-product-nav__item", item.active && "is-active")}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
