import { useEffect, useLayoutEffect, useState } from 'react';
import { darkPalette, foreground, lightPalette, themeVariables } from '../settings/colours';
import { usePreferences } from '../settings/preferences';
export function useTheme() {
  const colours = usePreferences((s) => s.colours);
  const [dark, setDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    const change = () => setDark(query?.matches ?? false);
    query?.addEventListener('change', change);
    return () => query?.removeEventListener('change', change);
  }, []);
  const palette = colours ?? (dark ? darkPalette : lightPalette);
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(themeVariables(palette)))
      root.style.setProperty(key, value);
    root.style.colorScheme = foreground(palette.main) === '#ffffff' ? 'dark' : 'light';
  }, [palette]);
  return palette;
}
