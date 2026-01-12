import { useEffect } from 'react';

/**
 * Hook to lock body scroll when modal is open
 */
export function useModalScrollLock() {
  useEffect(() => {
    // Save original overflow style
    const originalOverflow = document.body.style.overflow;
    
    // Lock scroll
    document.body.style.overflow = 'hidden';
    
    // Restore on unmount
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
}
