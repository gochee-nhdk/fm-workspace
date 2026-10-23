import { contextBridge, ipcRenderer, shell } from 'electron';

export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => string;
  openExternal: (url: string) => Promise<void>;
  isDesktop: boolean;
}

const electronAPI: ElectronAPI = {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  openExternal: (url: string) => shell.openExternal(url),
  isDesktop: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
