"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "./lib/cn";

export type MiithiiTheme = "light" | "dark";

const STORAGE_KEY = "miithii-theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_EVENT = "miithii:theme-change";
export const PRODUCT_TRANSITION_COOKIE = "miithii-product-transition";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

export const miithiiThemeInitScript = `(()=>{try{const k='${STORAGE_KEY}';const c=document.cookie.split('; ').find(v=>v.startsWith(k+'='))?.split('=')[1];const l=localStorage.getItem(k);const s=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';const t=(c==='light'||c==='dark')?c:((l==='light'||l==='dark')?l:s);document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;try{localStorage.setItem(k,t)}catch{}const n=document.cookie.split('; ').find(v=>v.startsWith('${PRODUCT_TRANSITION_COOKIE}='))?.split('=')[1];if(n)document.documentElement.dataset.productEntering=n;}catch{document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark';}})();`;

function readTheme(): MiithiiTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function persistTheme(theme: MiithiiTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in strict/private browser contexts; the
    // cookie still keeps the preference portable across Miithii subdomains.
  }

  const host = location.hostname;
  const domain = host === "miithii.in" || host.endsWith(".miithii.in")
    ? "; Domain=.miithii.in"
    : "";
  document.cookie = `${STORAGE_KEY}=${theme}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${domain}`;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === "light" ? "#fbfaf7" : "#07130f";
  window.dispatchEvent(new CustomEvent<MiithiiTheme>(THEME_EVENT, { detail: theme }));
}

export function setMiithiiTheme(theme: MiithiiTheme) {
  if (typeof window === "undefined") return;
  if (readTheme() === theme) {
    persistTheme(theme);
    return;
  }

  const commit = () => persistTheme(theme);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const transitionDocument = document as ViewTransitionDocument;
  if (reducedMotion || !transitionDocument.startViewTransition) {
    commit();
    return;
  }

  const root = document.documentElement;
  root.dataset.themeTransition = "shigure";
  const transition = transitionDocument.startViewTransition(commit);
  void transition.finished.finally(() => {
    delete root.dataset.themeTransition;
  });
}

export function useMiithiiTheme() {
  const [theme, setThemeState] = useState<MiithiiTheme>("dark");

  useEffect(() => {
    setThemeState(readTheme());
    const sync = (event: Event) => {
      const next = (event as CustomEvent<MiithiiTheme>).detail;
      setThemeState(next === "light" ? "light" : "dark");
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || (event.newValue !== "light" && event.newValue !== "dark")) return;
      persistTheme(event.newValue);
    };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  const changeTheme = useCallback((next: MiithiiTheme) => setMiithiiTheme(next), []);
  const toggleTheme = useCallback(() => setMiithiiTheme(readTheme() === "dark" ? "light" : "dark"), []);

  return { theme, changeTheme, toggleTheme };
}

export function MiithiiThemeToggle({ className }: { className?: string }) {
  const { toggleTheme } = useMiithiiTheme();
  return (
    <button
      type="button"
      className={cn("mi-theme-toggle", className)}
      onClick={toggleTheme}
      aria-label="Toggle light and dark theme"
      title="Toggle theme"
    >
      <Sun className="mi-theme-toggle__sun" aria-hidden="true" />
      <Moon className="mi-theme-toggle__moon" aria-hidden="true" />
    </button>
  );
}
