import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => string;
  openExternal: (url: string) => Promise<boolean>;
  isDesktop: boolean;
}

const electronAPI: ElectronAPI = {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  isDesktop: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
