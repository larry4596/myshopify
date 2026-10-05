/**
 * NaijaBites brand tokens — one file, one source of truth on the client.
 *
 * Mirrors the web `@theme` block in `app/globals.css` 1:1 so the app and the
 * store can never drift apart visually (PRD-LESSON3 §9). Dark mode is
 * deliberately out of scope for this lesson, so only light values exist.
 */
import type { TextStyle } from 'react-native';

export const colors = {
  brand: '#0F6B3C', // primary — deep green
  brandDark: '#0B5230', // pressed green
  brandLight: '#EAF3EE', // soft green tint
  gold: '#E8B923', // badges, highlights (used sparingly)
  goldDark: '#C99B12', // pressed gold
  cream: '#F9F5EB', // screen background
  ink: '#1A1A1A', // body text
  white: '#FFFFFF', // cards
  line: '#E8E0CE', // hairline dividers on cream
  inkSoft: 'rgba(26, 26, 26, 0.65)', // secondary text
  inkFaint: 'rgba(26, 26, 26, 0.45)', // placeholders, inactive tabs
  danger: '#B3311C', // errors
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** 16px corners + pill buttons, matching the web (PRD-LESSON3 §9). */
export const radius = { sm: 8, card: 16, pill: 999 } as const;

export const shadows = {
  card: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  bodyBold: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.ink },
  small: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  price: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.brand },
  badge: { fontSize: 12, fontWeight: '700', color: colors.ink },
} satisfies Record<string, TextStyle>;
