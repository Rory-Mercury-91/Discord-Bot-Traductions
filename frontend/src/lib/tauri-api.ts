/**
 * API Tauri - Remplace window.electronAPI
 * Wrapper pour les commandes Tauri backend
 */

import { invoke } from '@tauri-apps/api/core';

export const tauriAPI = {
  /**
   * Publier un post sur Discord
   */
  async publishPost(payload: any) {
    try {
      const result = await invoke('publish_post', { payload });
      return { ok: true, data: result };
    } catch (error: any) {
      return { ok: false, error: error.message || String(error) };
    }
  },

  /**
   * Tester la connexion à l'API locale
   */
  async testConnection() {
    try {
      const result = await invoke('test_api_connection');
      return { ok: true, data: result };
    } catch (error: any) {
      return { ok: false, error: error.message || String(error) };
    }
  },

  /**
   * Sauvegarder une image dans le dossier images/
   */
  async saveImage(filePath: string) {
    try {
      const fileName = await invoke<string>('save_image', { sourcePath: filePath });
      return { ok: true, fileName };
    } catch (error: any) {
      return { ok: false, error: error.message || String(error) };
    }
  },

  /**
   * Lire une image en base64
   */
  async readImage(imagePath: string) {
    try {
      const base64 = await invoke<string>('read_image', { imagePath });
      // Convert base64 data URL to buffer format expected by frontend
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { ok: true, buffer: Array.from(bytes) };
    } catch (error: any) {
      return { ok: false, error: error.message || String(error) };
    }
  },

  /**
   * Supprimer une image
   */
  async deleteImage(imagePath: string) {
    try {
      await invoke('delete_image', { imagePath });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message || String(error) };
    }
  },

  /**
   * Obtenir la taille d'une image
   */
  async getImageSize(imagePath: string) {
    try {
      const size = await invoke<number>('get_image_size', { imagePath });
      return { ok: true, size };
    } catch (error: any) {
      return { ok: false, error: error.message || String(error) };
    }
  },

  // Config export/import - À implémenter si nécessaire
  async exportConfigToFile(config: any) {
    console.warn('exportConfigToFile not implemented in Tauri yet');
    return { ok: false, error: 'not_implemented' };
  },

  async importConfigFromFile() {
    console.warn('importConfigFromFile not implemented in Tauri yet');
    return { ok: false, error: 'not_implemented' };
  },

  // Template export/import - À implémenter si nécessaire
  async exportTemplateToFile(template: any) {
    console.warn('exportTemplateToFile not implemented in Tauri yet');
    return { ok: false, error: 'not_implemented' };
  },

  async importTemplateFromFile() {
    console.warn('importTemplateFromFile not implemented in Tauri yet');
    return { ok: false, error: 'not_implemented' };
  },
};

// Exposer dans window pour compatibilité
if (typeof window !== 'undefined') {
  (window as any).electronAPI = tauriAPI;
}
