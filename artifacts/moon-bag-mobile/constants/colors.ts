/**
 * Moon Bag mobile theme — synced with the web app's dark terminal look:
 * near-black surfaces, neon green primary, mono-inspired accents.
 * Both light and dark schemes use the dark palette (the brand is dark-only).
 */

const palette = {
  text: '#e8f5e9',
  tint: '#00e676',

  background: '#0a0d0a',
  foreground: '#e8f5e9',

  card: '#111611',
  cardForeground: '#e8f5e9',

  primary: '#00e676',
  primaryForeground: '#04140a',

  secondary: '#1a221a',
  secondaryForeground: '#c8e6c9',

  muted: '#161d16',
  mutedForeground: '#7d917d',

  accent: '#1a221a',
  accentForeground: '#00e676',

  destructive: '#ff5252',
  destructiveForeground: '#ffffff',

  border: '#223022',
  input: '#223022',
};

const colors = {
  light: palette,
  dark: palette,
  radius: 10,
};

export default colors;
