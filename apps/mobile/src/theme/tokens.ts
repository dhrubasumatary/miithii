/** Shared instrument tokens. Language accents stay isolated; Indic content uses
 * bundled faces and explicit line heights to preserve shaping and stacked marks. */
export type ThemeMode = 'dark' | 'light';

export type Accent = {
  tint: string;
  resting: string;
  wash: string;
};

export type Palette = {
  surface: {
    ink: string;
    raised: string;
    control: string;
    controlPressed: string;
    well: string;
  };
  hairline: {
    faint: string;
    strong: string;
  };
  text: {
    bone: string;
    body: string;
    past: string;
    muted: string;
    faint: string;
    absent: string;
    alarm: string;
    withheld: string;
  };
  accent: Record<'asm' | 'brx', Accent>;
};

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    surface: {
      // Not pure black: #000 smears on OLED and kills the dot matrix's soft edges.
      ink: '#08090A',
      raised: '#0E1011',
      control: '#131516',
      controlPressed: '#1A1D1D',
      well: '#0B0C0D',
    },
    hairline: {
      faint: '#1C1F20',
      strong: '#2A2E30',
    },
    text: {
      bone: '#E9EAEA',
      body: '#C6C9C9',
      past: '#7C8180',
      muted: '#8A8F8E',
      faint: '#5E6362',
      absent: '#424746',
      alarm: '#D98A8A',
      withheld: '#C4B08C',
    },
    accent: {
      asm: { tint: '#F2A93B', resting: '#5C4522', wash: 'rgba(242,169,59,0.14)' },
      brx: { tint: '#5CCFB4', resting: '#22514A', wash: 'rgba(92,207,180,0.14)' },
    },
  },
  light: {
    surface: {
      // Unbleached documentation paper, not white. Pure #FFF is the other stock default and it
      // is as recognisable as the dark one.
      ink: '#F2F1EC',
      raised: '#FBFBF8',
      control: '#E8E7E0',
      controlPressed: '#DCDBD3',
      well: '#F7F6F1',
    },
    hairline: {
      faint: '#DEDDD5',
      strong: '#C2C1B8',
    },
    text: {
      // Carbon ink. Not a softened grey: the primary has to be the strongest thing on the page
      // for the same reason bone is the brightest in dark mode.
      bone: '#141615',
      body: '#2B2E2D',
      past: '#6E7271',
      muted: '#565B5A',
      faint: '#838887',
      absent: '#A9ADAB',
      alarm: '#9A3434',
      withheld: '#7A5A22',
    },
    accent: {
      // The 16sp language label uses this directly on the paper surface; keep it above 4.5:1.
      asm: { tint: '#955B00', resting: '#D3AF72', wash: 'rgba(149,91,0,0.12)' },
      brx: { tint: '#0B6154', resting: '#84BCB0', wash: 'rgba(11,97,84,0.12)' },
    },
  },
};

export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

export type LanguageCode = keyof Palette['accent'];

export function accentFor(language: string, mode: ThemeMode = DEFAULT_THEME_MODE): Accent {
  const table = palettes[mode].accent;
  return language in table ? table[language as LanguageCode] : table.asm;
}

export const type = {
  brand: { fontSize: 19, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4 } as const,
  control: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 1.4 } as const,
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: 0.8 } as const,
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '400' } as const,
  status: { fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.8 } as const,
  eyebrow: { fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 1.6 } as const,

  reply: { fontSize: 19, lineHeight: 31, fontWeight: '400' } as const,
  replySpeaking: { fontSize: 19, lineHeight: 31, fontWeight: '400' } as const,
  said: { fontSize: 16, lineHeight: 26, fontWeight: '400' } as const,
} as const;

export const family = {
  mono: 'SpaceMono',
  assamese: 'HindSiliguri',
  bodo: 'AnnapurnaSIL',
} as const;

export function familyFor(language: string): string {
  return language === 'brx' ? family.bodo : family.assamese;
}

export const content = {
  padAscender: false,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
} as const;

export const radius = {
  panel: 6,
  control: 8,
  sheet: 14,
  lamp: 999,
  dot: 999,
} as const;

export const motion = {
  themeReveal: 1450,
  snap: 140,
  press: 110,
  attack: 90,
  release: 60,
  state: 320,
  settle: 640,
  standby: 5200,
  scan: 1100,
  sentenceFlash: 220,
} as const;

export const voiceLayout = { logoWidth: 190, logoCompact: 104, longWait: 12000, languageWidth: 144 } as const;
