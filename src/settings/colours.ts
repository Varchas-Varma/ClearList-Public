export type Palette = { main: string; side: string; complement: string };
export const lightPalette: Palette = { main: '#ffffff', side: '#f5f6f8', complement: '#215abd' };
export const darkPalette: Palette = { main: '#202226', side: '#191b1f', complement: '#8dbaff' };
export function hexColour(value: string): string | null {
  const text = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text))
    return `#${[...text]
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  return /^[0-9a-f]{6}$/i.test(text) ? `#${text.toLowerCase()}` : null;
}
function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function hex(rgb: number[]): string {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function mix(a: string, b: string, weight: number): string {
  const right = rgb(b);
  return hex(rgb(a).map((v, i) => v * (1 - weight) + right[i] * weight));
}
function luminance(colour: string): number {
  return rgb(colour)
    .map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function foreground(background: string): string {
  return contrast(background, '#ffffff') >= contrast(background, '#15171a') ? '#ffffff' : '#15171a';
}
function accentText(accent: string, background: string): string {
  const text = foreground(background);
  for (let i = 0; i <= 20; i++) {
    const colour = mix(accent, text, i / 20);
    if (contrast(colour, background) >= 4.5) return colour;
  }
  return text;
}
export function themeVariables(p: Palette): Record<string, string> {
  const text = foreground(p.main),
    sideText = foreground(p.side);
  return {
    '--surface': p.main,
    '--sidebar': p.side,
    '--detail': p.side,
    '--text': text,
    '--side-text': sideText,
    '--subtle': mix(p.main, text, 0.035),
    '--border': mix(p.main, text, 0.2),
    '--muted': mix(p.main, text, 0.67),
    '--hover': mix(p.main, text, 0.07),
    '--selected': mix(p.main, p.complement, 0.18),
    '--accent': p.complement,
    '--accent-text': accentText(p.complement, p.main),
    '--accent-on': foreground(p.complement),
    '--accent-hover': mix(p.complement, foreground(p.complement), 0.12),
    '--side-border': mix(p.side, sideText, 0.2),
    '--side-muted': mix(p.side, sideText, 0.67),
    '--side-hover': mix(p.side, sideText, 0.07),
    '--side-selected': mix(p.side, p.complement, 0.18),
    '--side-accent-text': accentText(p.complement, p.side),
    '--danger': accentText('#d1263d', p.main),
    '--error-bg': mix(p.main, '#d1263d', 0.13),
  };
}
export type HSV = { h: number; s: number; v: number };
export function toHSV(colour: string): HSV {
  const [r, g, b] = rgb(colour).map((v) => v / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let h = 0;
  if (delta)
    h = (max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
  return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max };
}
export function fromHSV({ h, s, v }: HSV): string {
  const hue = (((h % 360) + 360) % 360) / 60,
    c = v * s,
    x = c * (1 - Math.abs((hue % 2) - 1)),
    m = v - c;
  const channels =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  return hex(channels.map((n) => (n + m) * 255));
}
