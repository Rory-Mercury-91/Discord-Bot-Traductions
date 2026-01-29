import { useEffect } from 'react';

/**
 * Hook pour bloquer le scroll du body quand une modale est ouverte.
 * @param enabled - Si true (défaut), le scroll est bloqué ; si false, aucun effet.
 */
export function useModalScrollLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [enabled]);
}
