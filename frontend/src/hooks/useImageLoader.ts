import { useEffect, useState } from 'react';
import { tauriAPI } from '../lib/tauri-api';

/**
 * Hook pour charger une image depuis le filesystem via IPC (logique legacy restaurée)
 * Convertit le buffer en ObjectURL pour l'affichage
 */
export function useImageLoader(imagePath: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imagePath) {
      setImageUrl('');
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;

    async function loadImage() {
      if (!imagePath) return;
      
      try {
        setIsLoading(true);
        setError(null);

        // Vérifier si c'est une URL (commence par http:// ou https://)
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
          // C'est une URL externe, l'utiliser directement
          if (!isMounted) return;
          setImageUrl(imagePath);
          setIsLoading(false);
          return;
        }

        // Sinon, lire l'image depuis le filesystem via Tauri (comme dans la version legacy)
        const result = await tauriAPI.readImage(imagePath);
        
        if (!result.ok || !result.buffer) {
          throw new Error(result.error || 'Failed to load image');
        }

        if (!isMounted) return;

        // Convert array back to Uint8Array
        const buffer = new Uint8Array(result.buffer);
        
        // Detect MIME type from file extension
        const ext = (imagePath || '').split('.').pop()?.toLowerCase() || 'png';
        const mimeType = 
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
          ext === 'png' ? 'image/png' :
          ext === 'gif' ? 'image/gif' :
          ext === 'webp' ? 'image/webp' :
          ext === 'avif' ? 'image/avif' :
          ext === 'bmp' ? 'image/bmp' :
          ext === 'svg' ? 'image/svg+xml' :
          ext === 'ico' ? 'image/x-icon' :
          ext === 'tiff' || ext === 'tif' ? 'image/tiff' :
          'image/' + ext;

        // Create Blob and ObjectURL
        const blob = new Blob([buffer], { type: mimeType });
        objectUrl = URL.createObjectURL(blob);
        
        setImageUrl(objectUrl);
        setIsLoading(false);
      } catch (e: any) {
        if (!isMounted) return;
        setError(String(e?.message || e));
        setIsLoading(false);
      }
    }

    loadImage();

    // Cleanup: revoke ObjectURL to free memory
    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imagePath]);

  return { imageUrl, isLoading, error };
}
