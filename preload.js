const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Publisher config
  getPublisherConfig: async () => {
    return await ipcRenderer.invoke('publisher:get-config');
  },
  setPublisherConfig: async (cfg) => {
    return await ipcRenderer.invoke('publisher:set-config', cfg);
  },

  // Publish a post via main process (secure)
  publishPost: async (payload) => {
    return await ipcRenderer.invoke('publisher:publish', payload);
  },

  // Test API connection
  testConnection: async (config) => {
    return await ipcRenderer.invoke('publisher:test-connection', config);
  },

  // Export/Import config via native dialogs
  exportConfigToFile: async (config) => {
    return await ipcRenderer.invoke('config:export', config);
  },
  importConfigFromFile: async () => {
    return await ipcRenderer.invoke('config:import');
  },

  // Export/Import template via native dialogs
  exportTemplateToFile: async (template) => {
    return await ipcRenderer.invoke('template:export', template);
  },
  importTemplateFromFile: async () => {
    return await ipcRenderer.invoke('template:import');
  },

  // Images filesystem operations
  saveImage: async (filePath) => {
    return await ipcRenderer.invoke('images:save', filePath);
  },
  readImage: async (imagePath) => {
    return await ipcRenderer.invoke('images:read', imagePath);
  },
  deleteImage: async (imagePath) => {
    return await ipcRenderer.invoke('images:delete', imagePath);
  }
});