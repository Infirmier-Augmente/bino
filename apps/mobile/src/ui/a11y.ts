import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Attributs ARIA que react-native-web sait rendre mais que les types de React Native ne
 * déclarent pas (aria-pressed, aria-current, aria-level). Sur mobile natif, on passe par
 * `accessibilityState`, que VoiceOver / TalkBack comprennent.
 */
const web = Platform.OS === 'web';

/** Bouton bascule (tri, segment, cercles de priorité). */
export function pressedA11y(pressed: boolean): object {
  return web ? { 'aria-pressed': pressed } : { accessibilityState: { selected: pressed } };
}

/** Onglet courant de la barre de navigation. */
export function currentPageA11y(current: boolean): object {
  return web
    ? { 'aria-current': current ? 'page' : undefined }
    : { accessibilityState: { selected: current } };
}

/** Titre de niveau n (h1, h2…) sur le web. */
export function headingA11y(level: 1 | 2 | 3): object {
  return web ? { role: 'heading', 'aria-level': level } : { accessibilityRole: 'header' };
}

/** Touche Échap (web) : ferme la feuille ou la popup ouverte. */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!web || !enabled || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscape, enabled]);
}
