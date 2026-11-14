import { createContext, type ReactNode, use } from 'react';
import { useColorScheme } from 'react-native';
import { useSession } from '@/features/session/store';
import { dark, light, type Palette } from './theme';

interface ThemeValue {
  colors: Palette;
  scheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeValue>({ colors: light, scheme: 'light' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useSession((s) => s.theme);
  const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return (
    <ThemeContext value={{ colors: scheme === 'dark' ? dark : light, scheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeValue {
  return use(ThemeContext);
}
