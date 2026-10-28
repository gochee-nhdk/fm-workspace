import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'
import { autoBackupManager } from './services/autoBackupManager'
import { motionGuardian } from './services/motionGuardian'

// Kích hoạt Motion Guardian Agent để bảo vệ 100% animation Apple Liquid Glass
motionGuardian.enforceMotion();

// Khởi chạy hệ thống tự động sao lưu dự phòng ngầm
autoBackupManager.init().catch(console.warn);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
