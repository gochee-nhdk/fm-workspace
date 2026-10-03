import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'
import { autoBackupManager } from './services/autoBackupManager'

// Normalize origin: Always ensure browser runs under 'localhost' so IndexedDB data is never split or lost
if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
  const url = new URL(window.location.href);
  url.hostname = 'localhost';
  window.location.replace(url.href);
} else {
  autoBackupManager.init().catch(console.warn);

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}