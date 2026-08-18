export const colors = {
  teal950: "#081F1C",
  teal900: "#0B3B36",
  jade500: "#1D9E75",
  jade400: "#35C696",
  lime400: "#C6FF3D",
  cream50: "#F2F5F1",
  coral500: "#FF7A59",
  amber400: "#EFB344",
  ink900: "#111817"
} as const;

export const semanticColors = {
  light: {
    bg: colors.cream50,
    surface: "#FFFFFF",
    surfaceSoft: "#EDF3EF",
    textPrimary: colors.teal900,
    textSecondary: "#4C6B63",
    textMuted: "#7E9990",
    border: "#DCE7E1",
    borderStrong: "#B9CCC4",
    primary: colors.jade500,
    primaryHover: "#167A5B",
    onPrimary: "#FFFFFF",
    accent: colors.lime400,
    onAccent: "#1F2E0C"
  },
  dark: {
    bg: colors.teal950,
    surface: colors.teal900,
    surfaceSoft: "#123F39",
    textPrimary: colors.cream50,
    textSecondary: "#9FC2B7",
    textMuted: "#6D8F85",
    border: "#1D4239",
    borderStrong: "#2C554B",
    primary: colors.jade400,
    primaryHover: colors.jade500,
    onPrimary: "#06211B",
    accent: colors.lime400,
    onAccent: "#1F2E0C"
  }
} as const;

export const fonts = {
  display: "var(--font-miithii-display), 'Space Grotesk', system-ui, sans-serif",
  body: "var(--font-miithii-body), 'Manrope', system-ui, sans-serif",
  mono: "var(--font-miithii-mono), 'Space Mono', ui-monospace, monospace"
} as const;

export const radius = {
  sm: "6px",
  md: "8px",
  lg: "12px"
} as const;

export const typeScale = {
  displayXl: { size: "3rem", lineHeight: "1.05", weight: 600, font: fonts.display },
  displayLg: { size: "2.25rem", lineHeight: "1.12", weight: 600, font: fonts.display },
  displayMd: { size: "1.75rem", lineHeight: "1.2", weight: 600, font: fonts.display },
  bodyLg: { size: "1.125rem", lineHeight: "1.6", weight: 400, font: fonts.body },
  bodyMd: { size: "1rem", lineHeight: "1.6", weight: 400, font: fonts.body },
  bodySm: { size: "0.875rem", lineHeight: "1.5", weight: 400, font: fonts.body },
  caption: { size: "0.75rem", lineHeight: "1.4", weight: 600, font: fonts.mono }
} as const;

