"use client";

import {
  useEffect,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";
import { getProductLinks, getProductUrl, productLabels, type ProductKey } from "../product-links";
import { MiithiiThemeToggle, PRODUCT_TRANSITION_COOKIE } from "../theme";
import { LogoMark } from "./logo";

export type ProductDockProps = {
  active: ProductKey;
  actions?: ReactNode;
  account?: ReactNode;
  className?: string;
};

const productLinks = getProductLinks(["chat", "voice", "subtitles"]);

const cookieDomain = () => {
  const host = window.location.hostname;
  return host === "miithii.in" || host.endsWith(".miithii.in")
    ? "; Domain=.miithii.in"
    : "";
};

function clearTransitionCookie() {
  document.cookie = `${PRODUCT_TRANSITION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${cookieDomain()}`;
}

function transitionTo(event: MouseEvent<HTMLAnchorElement>, key: ProductKey, href: string) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  document.cookie = `${PRODUCT_TRANSITION_COOKIE}=${key}; Path=/; Max-Age=8; SameSite=Lax${cookieDomain()}`;
  document.documentElement.dataset.productLeaving = key;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(() => window.location.assign(href), reducedMotion ? 0 : 120);
}

export type ProductLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  product: ProductKey;
};

export function ProductLink({ product, onClick, ...props }: ProductLinkProps) {
  const href = getProductUrl(product);
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) transitionTo(event, product, href);
      }}
    />
  );
}

export function ProductDock({ active, actions, account, className }: ProductDockProps) {
  useEffect(() => {
    if (!document.documentElement.dataset.productEntering) return;
    clearTransitionCookie();
    const timer = window.setTimeout(() => {
      delete document.documentElement.dataset.productEntering;
    }, 280);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <header className={cn("mi-product-dock", className)}>
      <ProductLink
        product="home"
        className="mi-product-dock__brand"
        aria-label="Miithii home"
      >
        <LogoMark className="mi-product-dock__mark" />
        <span>miithii</span>
        {active !== "home" ? <span className="mi-product-dock__mode">{productLabels[active]}</span> : null}
      </ProductLink>

      <nav className="mi-product-dock__nav" aria-label="Miithii products">
        {productLinks.map((item) => (
          <ProductLink
            key={item.key}
            product={item.key}
            className={active === item.key ? "is-active" : undefined}
            aria-current={active === item.key ? "page" : undefined}
          >
            {item.label}
          </ProductLink>
        ))}
      </nav>

      <div className="mi-product-dock__actions">
        {actions}
        <MiithiiThemeToggle />
        {account}
      </div>
    </header>
  );
}
