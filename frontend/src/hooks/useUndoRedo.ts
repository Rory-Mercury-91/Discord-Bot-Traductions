import { useRef, useCallback } from 'react';

export function useUndoRedo() {
  const historyRef = useRef<string[]>([]);
  const positionRef = useRef<number>(-1);

  const recordState = useCallback((value: string) => {
    // Ne pas enregistrer si c'est identique au dernier état
    if (historyRef.current[positionRef.current] === value) return;

    // Supprimer tout l'historique après la position actuelle
    historyRef.current = historyRef.current.slice(0, positionRef.current + 1);
    
    // Ajouter le nouvel état
    historyRef.current.push(value);
    positionRef.current++;

    // Limiter à 50 états pour éviter une utilisation excessive de mémoire
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      positionRef.current--;
    }
  }, []);

  const undo = useCallback((): string | null => {
    if (positionRef.current > 0) {
      positionRef.current--;
      return historyRef.current[positionRef.current];
    }
    return null;
  }, []);

  const redo = useCallback((): string | null => {
    if (positionRef.current < historyRef.current.length - 1) {
      positionRef.current++;
      return historyRef.current[positionRef.current];
    }
    return null;
  }, []);

  const reset = useCallback(() => {
    historyRef.current = [];
    positionRef.current = -1;
  }, []);

  return { recordState, undo, redo, reset };
}
